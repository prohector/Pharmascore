// Cloudflare Worker for PharmaScore
// Integrates with Mistral AI, Turnstile Verification, Origin allowlist, and Rate Limiting.

const MISTRAL_MODEL = 'mistral-small-latest';
const REQUEST_TIMEOUT_MS = 15000;

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

    // 4. Cloudflare Turnstile Verification: verify token server-side before proceeding
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
      console.log('[PharmaScore] Worker received fill_questionnaire:', {
        textLength: typeof body.pdfText === 'string' ? body.pdfText.length : 0,
        questionCount: Array.isArray(body.questionnaire?.questions) ? body.questionnaire.questions.length : 0
      });
      try {
        const result = await fillQuestionnaireFromPdf(body.pdfText, body.questionnaire, env);
        return corsResponse(jsonResponse(result, 200), matchedOrigin);
      } catch (error) {
        console.error('[PharmaScore] Questionnaire Mistral request failed:', error instanceof Error ? error.message : String(error));
        return corsResponse(jsonResponse({ success: false, error: 'The PDF questionnaire could not be interpreted right now.' }, 502), matchedOrigin);
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
      console.error('[PharmaScore] Price Mistral request failed:', err instanceof Error ? err.message : String(err));
      return corsResponse(jsonResponse({
        success: false,
        error: 'Price estimate unavailable right now. Please try again or enter a price manually.'
      }, 502), matchedOrigin);
    }
  }
};

// --- Origin Matching & CORS Helper ---
function getAllowedOrigins(env) {
  if (env && env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS.map(s => s.toLowerCase());
}

function matchOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = getAllowedOrigins(env);
  return allowed.includes(origin.toLowerCase()) ? origin : null;
}

function corsResponse(response, allowedOrigin) {
  const headers = new Headers(response.headers);
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Vary', 'Origin');
  }
  return new Response(response.body, { status: response.status, headers });
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// --- Cloudflare Turnstile Verification ---
async function verifyTurnstileToken(token, clientIp, env) {
  // Use TURNSTILE_SECRET_KEY secret, with Cloudflare's always-pass testing secret as fallback
  const secretKey = env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
  if (!token) {
    return { success: false, error: 'Security token is missing. Please complete the security check.' };
  }

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (clientIp && clientIp !== 'unknown') {
      formData.append('remoteip', clientIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!data.success) {
      console.warn('[PharmaScore] Turnstile verification failed:', data['error-codes']);
      return { success: false, error: 'Security verification failed. Please try again.' };
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
  if (recent.length >= LOCAL_RATE_LIMIT) {
    return { allowed: false, error: 'Please wait before making more AI requests. The limit is 5 per minute.' };
  }
  recent.push(now);
  localQueryHistory.set(clientIp, recent);
  return { allowed: true };
}

// --- Daily Cap on Total Calls ---
async function checkDailyCap(env) {
  const dailyCap = Number(env.DAILY_CAP || env.DAILY_CALL_LIMIT || DEFAULT_DAILY_CAP);
  const today = new Date().toISOString().slice(0, 10);
  const key = `daily_calls:${today}`;

  if (env && env.DAILY_STATS && typeof env.DAILY_STATS.get === 'function') {
    try {
      const current = Number(await env.DAILY_STATS.get(key) || 0);
      if (current >= dailyCap) {
        return {
          allowed: false,
          error: `The daily limit of ${dailyCap} AI requests has been reached. Please try again tomorrow or enter values manually.`
        };
      }
      await env.DAILY_STATS.put(key, String(current + 1), { expirationTtl: 172800 });
      return { allowed: true };
    } catch (err) {
      console.warn('[PharmaScore] Daily stats KV error, falling back to local memory:', err);
    }
  }

  // In-memory fallback per worker isolate
  if (localDailyDate !== today) {
    localDailyDate = today;
    localDailyCount = 0;
  }
  if (localDailyCount >= dailyCap) {
    return {
      allowed: false,
      error: `The daily limit of ${dailyCap} AI requests has been reached. Please try again tomorrow or enter values manually.`
    };
  }
  localDailyCount += 1;
  return { allowed: true };
}

// --- Mistral AI Prompts & Handlers ---
async function fillQuestionnaireFromPdf(pdfText, questionnaire, env) {
  const text = String(pdfText || '').trim();
  if (!text || text.length > MAX_TEXT_LENGTH || !questionnaire || typeof questionnaire !== 'object') {
    return { success: false, error: 'The PDF text or questionnaire schema is missing or too large.' };
  }
  let schemaJson;
  try {
    schemaJson = JSON.stringify(questionnaire);
  } catch {
    return { success: false, error: 'The questionnaire schema could not be serialized.' };
  }
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
    'If the paper or document describes more than one method or experiment, fill the whole questionnaire consistently from the single method that achieved the best analytical results (e.g., best resolution, sensitivity/LOQ, recovery, or validation outcome); never mix values taken from different methods.',
    'For dropdown questions, pick exactly one value from availableAnswers verbatim (same spelling and case); do not paraphrase, abbreviate, or invent new labels.',
    'For equipment_dropdown and column_selector questions, return an object with category, name and an estimated price in EUR, for example {"category":"HPLC","name":"Detector X","price":25000}. Choose the closest available option even when the PDF wording differs slightly (for example a 4.7 mm column when the list contains a 4.6 mm column), preferring options priced similarly, and return the exact available category and name for that option. Use category "Other" only when no item in the available list is a close match, and then provide the exact name from the PDF plus an estimated positive price so it can be filled without a separate lookup.',
    'For equipment_checklist questions, return an array of exact item names, each name at most once (no duplicates). For sample pretreatment checklists, return objects such as {"name":"Item name","amount":2} with the amount in the appropriate unit (mL for solvents, g for reagents, quantity for materials) when stated; if no amount is stated use 1. For an item not in availableAnswers, include an estimated positive price as {"name":"Item name","amount":2,"price":25}; do not return one combined string.',
    'For recurring_cost_calculator questions, return an object describing the mobile phase composition using the question value as a template, including run (min), flow (mL/min), gradientMode ("isocratic" or "gradient"), gradientFlow, normalPhaseSolvents and reversePhaseSolvents as [{name, percent, price}], buffers and modifiers as [{name, amountMgPerL, price}], and gradientRows as [{time, values:{A,B,...}}] where time is the time point in minutes and the first solvent letter (A) is auto-computed so each row totals 100%. List every solvent, buffer and modifier exactly once across all lists (a solvent belongs either to normalPhaseSolvents or reversePhaseSolvents, never both); do not repeat the same item. Give each gradient time point a unique, increasing time value. Use prices only when stated in the PDF; otherwise keep them as zero.',
    'For ordinary dropdown questions, return exactly one value from availableAnswers. For booleans, return true or false.',
    `QUESTIONNAIRE SCHEMA:\n${schemaJson}`,
    `EXTRACTED PDF TEXT:\n${text}`
  ].join('\n\n');

  const response = await fetchMistralJson(prompt, env);
  if (!response || typeof response.answers !== 'object' || Array.isArray(response.answers)) {
    return { success: false, error: 'The AI did not return a usable questionnaire answer set.' };
  }
  return {
    success: true,
    questionnaire: { ...questionnaire, answers: response.answers },
    confidence: response.confidence || 'low',
    unfilled: Array.isArray(response.unfilled) ? response.unfilled : []
  };
}

async function fetchMistralJson(prompt, env) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let mistralRes;
  try {
    mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Authorization': `Bearer ${env.MistralAPI}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      })
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!mistralRes.ok) throw new Error(`Mistral request failed: ${mistralRes.status}`);
  const data = await mistralRes.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Mistral');
  return JSON.parse(content);
}

async function getPriceEstimate(name, country, unit, question, env) {
  const prompt = buildPrompt(name, country, unit, question);
  const parsed = await fetchMistralJson(prompt, env);
  const price = Number(parsed.price);
  if (!Number.isFinite(price) || price <= 0) {
    return {
      success: false,
      error: `No reliable price estimate found for "${name}". Please enter a price manually.`
    };
  }

  return {
    success: true,
    price,
    link: '',
    estimated: true,
    confidence: parsed.confidence || 'low',
    disclaimer: 'AI-estimated price. Verify against a supplier quote before relying on this figure.'
  };
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
    `Respond ONLY with a JSON object, no other text, in exactly this shape:`,
    `{"price": <number or null>, "confidence": "low"|"medium"|"high"}`
  ].join(' ');
}
