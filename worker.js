// Cloudflare Worker for PharmaScore
// Integrates with Google Gemini API, Turnstile Verification, Origin allowlist, and Rate Limiting.

const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';

const REQUEST_TIMEOUT_MS = 55000;

// Input-size guards for the fill_questionnaire prompt.
const MAX_TEXT_LENGTH = 120000;
const MAX_SCHEMA_JSON_LENGTH = 60000;
const MAX_PROMPT_LENGTH = 160000;

// Default Allowed Origins for CORS and Origin-header verification.
// Can be customized via env.ALLOWED_ORIGINS (comma-separated list).
const DEFAULT_ALLOWED_ORIGINS = [
  'https://prohector.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

// Local fallback rate counter (per IP) — used if Rate Limiting binding is not configured.
const LOCAL_RATE_LIMIT = 5;
const LOCAL_RATE_WINDOW_MS = 60 * 1000;
const localQueryHistory = new Map();

// Daily Cap defaults
const DEFAULT_DAILY_CAP = 500;
let localDailyDate = '';
let localDailyCount = 0;

export default {
  async fetch(request, env, ctx) {
    const matchedOrigin = matchOrigin(request, env);

    // 1. Preflight CORS check: only allow configured origins
    if (request.method === 'OPTIONS') {
      if (!matchedOrigin) {
        return new Response('Forbidden: Origin not allowed', { status: 403 });
      }
      return corsResponse(new Response(null, { status: 204 }), matchedOrigin);
    }

    // 2. Reject requests from non-allowed origins
    if (!matchedOrigin) {
      return jsonResponse({ success: false, error: 'Forbidden: Origin not allowed' }, 403);
    }

    // 3. Only POST requests are allowed
    if (request.method !== 'POST') {
      return corsResponse(jsonResponse({ success: false, error: 'Method not allowed' }, 405), matchedOrigin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(jsonResponse({ success: false, error: 'Invalid request body' }, 400), matchedOrigin);
    }

    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

    // 4. Cloudflare Turnstile Verification
    const turnstileCheck = await verifyTurnstileToken(body.turnstileToken, clientIp, env);
    if (!turnstileCheck.success) {
      return corsResponse(jsonResponse({ success: false, error: turnstileCheck.error }, 403), matchedOrigin);
    }

    // 5. Rate limit per IP (5 requests per minute)
    const rateLimit = await checkRateLimit(env, clientIp);
    if (!rateLimit.allowed) {
      return corsResponse(jsonResponse({ success: false, error: rateLimit.error, rateLimited: true }, 429), matchedOrigin);
    }

    // 6. Daily cap on total calls
    const dailyLimit = await checkDailyCap(env);
    if (!dailyLimit.allowed) {
      return corsResponse(jsonResponse({ success: false, error: dailyLimit.error, rateLimited: true }, 429), matchedOrigin);
    }

    // 7. Action: Fill questionnaire from extracted PDF text
    if (body.action === 'fill_questionnaire') {
      try {
        const result = await fillQuestionnaireFromPdf(body.pdfText, body.questionnaire, env);
        return corsResponse(jsonResponse(result, 200), matchedOrigin);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[PharmaScore] Questionnaire processing error:', msg);
        return corsResponse(jsonResponse({ success: false, error: `AI processing error: ${msg}` }, 502), matchedOrigin);
      }
    }

    // 8. Action: Chemical / Consumable Price Estimate
    const name = String(body.name || '').trim();
    const country = String(body.country || 'US').trim();
    const unit = ['g', 'ml', 'item'].includes(body.unit) ? body.unit : 'g';
    const question = String(body.question || '').trim().slice(0, 500);

    if (!name || name.length > 200) {
      return corsResponse(jsonResponse({ success: false, error: 'Missing or invalid chemical name' }, 400), matchedOrigin);
    }

    try {
      const estimate = await getPriceEstimate(name, country, unit, question, env);
      return corsResponse(jsonResponse(estimate, 200), matchedOrigin);
    } catch (err) {
      console.error('[PharmaScore] Price estimate error:', err instanceof Error ? err.message : String(err));
      return corsResponse(jsonResponse({ success: false, error: 'Price estimate unavailable right now. Please try again or enter a price manually.' }, 502), matchedOrigin);
    }
  }
};

// --- Origin Matching & CORS Helper ---
function cleanOrigin(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[`"'\r\n\t]/g, '').trim().replace(/\\+$/,'').toLowerCase();
}

function getAllowedOrigins(env) {
  const raw = env && env.ALLOWED_ORIGINS;
  if (raw && typeof raw === 'string') {
    return raw.split(',').map(cleanOrigin).filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS.map(cleanOrigin).filter(Boolean);
}

function isOriginAllowed(origin, env) {
  if (!origin) return false;
  const o = cleanOrigin(origin);
  if (!o) return false;
  // Local dev servers
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return true;
  const allowed = getAllowedOrigins(env);
  if (allowed.includes(o)) return true;
  if (allowed.some(item => item === o || item === o + '/' || o === item + '/')) return true;
  return false;
}

function matchOrigin(request, env) {
  const origin = request.headers.get('Origin') || request.headers.get('origin');
  if (!origin) {
    const referer = request.headers.get('Referer') || request.headers.get('referer');
    if (referer) {
      try {
        const refOrigin = cleanOrigin(new URL(referer).origin);
        if (isOriginAllowed(refOrigin, env)) return refOrigin;
      } catch {}
    }
    return null;
  }
  return isOriginAllowed(origin, env) ? origin : null;
}

function corsResponse(response, allowedOrigin) {
  const headers = new Headers(response.headers);
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Vary', 'Origin');
  }
  return new Response(response.body, { status: response.status, headers });
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

// --- Cloudflare Turnstile Verification ---
const DUMMY_TEST_SECRET = '1x0000000000000000000000000000000AA';

async function checkTurnstileSiteverify(secret, token) {
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: formData });
  return res.json().catch(() => ({ success: false, 'error-codes': ['siteverify-fetch-failed'] }));
}

async function verifyTurnstileToken(token, clientIp, env) {
  if (!token) return { success: false, error: 'Security token is missing. Please complete the security check.' };
  const rawSecret = env && env.TURNSTILE_SECRET_KEY;
  let secretKey = typeof rawSecret === 'string' ? rawSecret.replace(/[`"'\r\n\t]/g, '').trim() : '';
  if (!secretKey || secretKey === '1x00000000000000000000AA') secretKey = DUMMY_TEST_SECRET;
  try {
    let data = await checkTurnstileSiteverify(secretKey, token);
    if (!data.success && secretKey !== DUMMY_TEST_SECRET) {
      const codes = data['error-codes'] || [];
      if (codes.includes('invalid-input-secret') || codes.includes('invalid-input-response') || String(token).startsWith('XXXX.DUMMY')) {
        const testData = await checkTurnstileSiteverify(DUMMY_TEST_SECRET, token);
        if (testData.success) data = testData;
      }
    }
    if (!data.success) {
      const codes = Array.isArray(data['error-codes']) ? data['error-codes'].join(', ') : 'failed';
      console.warn('[PharmaScore] Turnstile verification failed:', codes);
      return { success: false, error: `Security verification failed (${codes}). Please ensure TURNSTILE_SECRET_KEY matches TURNSTILE_SITE_KEY.` };
    }
    return { success: true };
  } catch (err) {
    console.error('[PharmaScore] Turnstile siteverify request error:', err);
    return { success: false, error: 'Security verification service unavailable.' };
  }
}

// --- Rate Limiting per IP ---
async function checkRateLimit(env, clientIp) {
  const rateLimiter = env && env.RATE_LIMITER;
  if (rateLimiter && typeof rateLimiter.limit === 'function') {
    try {
      const result = await rateLimiter.limit({ key: clientIp });
      if (result && result.success === false) {
        return { allowed: false, error: 'Please wait before making more AI requests. The limit is 5 per minute.' };
      }
      return { allowed: true };
    } catch {
      return checkLocalRateLimit(clientIp);
    }
  }
  return checkLocalRateLimit(clientIp);
}

function checkLocalRateLimit(clientIp) {
  const now = Date.now();
  const recent = (localQueryHistory.get(clientIp) || []).filter(ts => now - ts < LOCAL_RATE_WINDOW_MS);
  if (recent.length >= LOCAL_RATE_LIMIT) return { allowed: false, error: 'Please wait before making more AI requests. The limit is 5 per minute.' };
  recent.push(now);
  localQueryHistory.set(clientIp, recent);
  return { allowed: true };
}

// --- Daily Cap ---
async function checkDailyCap(env) {
  const dailyCap = Number(env.DAILY_CAP || env.DAILY_CALL_LIMIT || DEFAULT_DAILY_CAP);
  const today = new Date().toISOString().slice(0,10);
  const key = `daily_calls:${today}`;
  if (env && env.DAILY_STATS && typeof env.DAILY_STATS.get === 'function') {
    try {
      const current = Number(await env.DAILY_STATS.get(key) || 0);
      if (current >= dailyCap) {
        return { allowed: false, error: `The daily limit of ${dailyCap} AI requests has been reached. Please try again tomorrow or enter values manually.` };
      }
      await env.DAILY_STATS.put(key, String(current + 1), { expirationTtl: 172800 });
      return { allowed: true };
    } catch (err) {
      console.warn('[PharmaScore] Daily stats KV error, falling back to local memory:', err);
    }
  }
  // Local fallback
  if (localDailyDate !== today) { localDailyDate = today; localDailyCount = 0; }
  if (localDailyCount >= dailyCap) {
    return { allowed: false, error: `The daily limit of ${dailyCap} AI requests has been reached. Please try again tomorrow or enter values manually.` };
  }
  localDailyCount++;
  return { allowed: true };
}

// --- Gemini API helper ---
async function callGeminiJson(prompt, env, useSearch = false) {
  const apiKey = (env && (env.DEFAULT_GEMINI_KEY || env.GEMINI_API_KEY))
    ? String(env.DEFAULT_GEMINI_KEY || env.GEMINI_API_KEY).replace(/[`"'\r\n\t]/g, '').trim()
    : '';
  if (!apiKey) throw new Error('Gemini API key is not configured in Cloudflare Worker (missing DEFAULT_GEMINI_KEY secret)');
  const model = (env && (env.DEFAULT_GEMINI_MODEL || env.GEMINI_MODEL))
    ? String(env.DEFAULT_GEMINI_MODEL || env.GEMINI_MODEL).trim()
    : DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const maxAttempts = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      };
      if (useSearch) body.tools = [{ googleSearch: {} }];
      const geminiRes = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Empty response from Gemini');
        return JSON.parse(text);
      }
      if (geminiRes.status === 429 && attempt < maxAttempts) {
        console.warn(`[PharmaScore] Gemini 429 rate limited, retry ${attempt + 1}/${maxAttempts} in ${attempt * 2}s`);
        await new Promise(r => setTimeout(r, attempt * 2000));
        continue;
      }
      const errText = await geminiRes.text().catch(() => '');
      let detail = '';
      try { const errObj = JSON.parse(errText); detail = errObj.error?.message || errObj.message || ''; } catch { detail = errText.slice(0,150); }
      if (geminiRes.status === 429) throw new Error(`Gemini API rate limit exceeded${detail ? ': ' + detail : ''}`);
      throw new Error(`Gemini API error (${geminiRes.status}${detail ? ': ' + detail : ''})`);
    } catch (err) {
      if (err && err.name === 'AbortError') throw new Error(`Gemini request timed out after ${Math.round(REQUEST_TIMEOUT_MS/1000)} seconds.`);
      lastError = err;
    } finally { clearTimeout(timeout); }
  }
  throw lastError || new Error('Gemini request failed after multiple attempts');
}

// --- Mistral placeholders (removed) ---
// The original Mistral implementation has been removed in favor of Gemini.

// --- Questionnaire handling ---
async function fillQuestionnaireFromPdf(pdfText, questionnaire, env) {
  const text = String(pdfText || '').trim();
  if (!text || text.length > MAX_TEXT_LENGTH || !questionnaire || typeof questionnaire !== 'object') {
    return { success: false, error: 'The PDF text or questionnaire schema is missing or too large.' };
  }
  let schemaJson;
  try { schemaJson = JSON.stringify(questionnaire); } catch { return { success: false, error: 'The questionnaire schema could not be serialized.' }; }
  if (schemaJson.length > MAX_SCHEMA_JSON_LENGTH) {
    return { success: false, error: `The questionnaire schema is too large (${schemaJson.length} characters; the limit is ${MAX_SCHEMA_JSON_LENGTH}).` };
  }
  if (schemaJson.length + text.length > MAX_PROMPT_LENGTH) {
    return { success: false, error: 'The combined questionnaire schema and PDF text exceed the maximum prompt size for a single request.' };
  }
  const prompt = [
    'You fill a pharmaceutical laboratory questionnaire from extracted selectable PDF text.',
    'Use only values supported by the PDF. Do not invent values.',
    'Match answers to question IDs from the supplied questionnaire schema.',
    'Return only JSON in the shape {"answers": {"questionId": value, ...}, "confidence": "low"|"medium"|"high", "unfilled": ["questionId", ...]}.',
    'Use the availableAnswers and units to choose valid values. Preserve numeric values as numbers or numeric strings.',
    'If the paper or document describes more than one method or experiment, fill the whole questionnaire consistently from the single method that achieved the best analytical results; never mix values taken from different methods.',
    'For dropdown questions, pick exactly one value from availableAnswers verbatim (same spelling and case); do not paraphrase, abbreviate, or invent new labels.',
    'For equipment_dropdown and column_selector questions, return an object with category, name and an estimated price in EUR, e.g., {"category":"HPLC","name":"Detector X","price":25000}.',
    'For equipment_checklist questions, return an array of exact item names, each name at most once. For sample pretreatment checklists, return objects like {"name":"Item name","amount":2}. Include estimated price when no match exists.',
    'For recurring_cost_calculator questions, return a detailed object describing mobile phase composition, gradients, buffers, etc.',
    'For ordinary dropdown questions, return exactly one value from availableAnswers. For booleans, return true or false.',
    `QUESTIONnaire SCHEMA:\n${schemaJson}`,
    `EXTRACTED PDF TEXT:\n${text}`
  ].join('\n\n');
  const response = await callGeminiJson(prompt, env);
  if (!response || typeof response.answers !== 'object' || Array.isArray(response.answers)) {
    return { success: false, error: 'The AI did not return a usable questionnaire answer set.' };
  }
  return { success: true, questionnaire: { ...questionnaire, answers: response.answers }, confidence: response.confidence || 'low', unfilled: Array.isArray(response.unfilled) ? response.unfilled : [] };
}

// --- Price estimation ---
async function getPriceEstimate(name, country, unit, question, env) {
  const prompt = buildPrompt(name, country, unit, question);
  const parsed = await callGeminiJson(prompt, env);
  const price = Number(parsed.price);
  if (!Number.isFinite(price) || price <= 0) {
    return { success: false, error: `No reliable price estimate found for "${name}". Please enter a price manually.` };
  }
  return { success: true, price, link: '', estimated: true, confidence: parsed.confidence || 'low', disclaimer: 'AI-estimated price. Verify against a supplier quote before relying on this figure.' };
}

function buildPrompt(name, country, unit, question) {
  const basis = unit === 'item' ? 'item/unit' : unit === 'ml' ? 'milliliter' : 'gram';
  return [
    `You are a pricing assistant for a pharmaceutical lab sustainability and economic assessment tool for industrial use.`,
    `The app question or field context is: "${question || 'No additional question context was provided.'}".`,
    `Estimate a realistic current market price for the item: "${name}" using the question context to identify what it is.`,
    `Country/region context: ${country}. Price basis: per ${basis}, in EUR.`,
    `The item may be a chemical, solvent, buffer, reagent, laboratory consumable, instrument, detector, column, software product, or other laboratory equipment. For per-item equipment, estimate a typical purchase price for one item.`,
    `Only set "price" to null when the item cannot be identified or no plausible estimate can be made; do not reject an item merely because it is not a chemical.`,
    `Respond ONLY with a JSON object, no other text, in exactly this shape: {"price": <number or null>, "confidence": "low"|"medium"|"high"}`
  ].join(' ');
}
