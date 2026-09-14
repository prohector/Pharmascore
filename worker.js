//This is a cloudflare worker

const MISTRAL_MODEL = 'mistral-small-latest';
const REQUEST_TIMEOUT_MS = 15000;

// Input-size guards for the fill_questionnaire prompt.
const MAX_TEXT_LENGTH = 120000;
const MAX_SCHEMA_JSON_LENGTH = 60000;
const MAX_PROMPT_LENGTH = 160000;

// Local fallback rate counter — used only if the Rate Limiting binding is unavailable.
const LOCAL_RATE_LIMIT = 5;
const LOCAL_RATE_WINDOW_MS = 60 * 1000;
const localQueryHistory = new Map();

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return corsResponse(new Response(null, { status: 204 }));
    }

    if (request.method !== 'POST') {
      return corsResponse(jsonResponse({ success: false, error: 'Method not allowed' }, 405));
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(jsonResponse({ success: false, error: 'Invalid request body' }, 400));
    }

    // Shared-secret gate: applied to both request paths before any Mistral call.
    const appSecret = request.headers.get('x-app-secret');
    if (!env.APP_SHARED_SECRET || appSecret !== env.APP_SHARED_SECRET) {
      return corsResponse(jsonResponse({ success: false, error: 'Unauthorized: missing or invalid app secret.' }, 401));
    }

    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const rateLimit = await checkRateLimit(env, clientIp);
    if (!rateLimit.allowed) {
      return corsResponse(jsonResponse({ success: false, error: rateLimit.error, rateLimited: true }, 429));
    }

    if (body.action === 'fill_questionnaire') {
      console.log('[PharmaScore] Worker received fill_questionnaire:', {
        textLength: typeof body.pdfText === 'string' ? body.pdfText.length : 0,
        questionCount: Array.isArray(body.questionnaire?.questions) ? body.questionnaire.questions.length : 0
      });
      try {
        const result = await fillQuestionnaireFromPdf(body.pdfText, body.questionnaire, env);
        return corsResponse(jsonResponse(result, 200));
      } catch {
        return corsResponse(jsonResponse({ success: false, error: 'The PDF questionnaire could not be interpreted right now.' }, 502));
      }
    }

    const name = String(body.name || '').trim();
    const country = String(body.country || 'US').trim();
    const unit = ['g', 'ml', 'item'].includes(body.unit) ? body.unit : 'g';
    const question = String(body.question || '').trim().slice(0, 500);

    if (!name || name.length > 200) {
      return corsResponse(jsonResponse({ success: false, error: 'Missing or invalid chemical name' }, 400));
    }

    try {
      const estimate = await getPriceEstimate(name, country, unit, question, env);
      return corsResponse(jsonResponse(estimate, 200));
    } catch (err) {
      return corsResponse(jsonResponse({
        success: false,
        error: 'Price estimate unavailable right now. Please try again or enter a price manually.'
      }, 502));
    }
  }
};

// Uses the Cloudflare Rate Limiting binding, which is reliable across Worker isolates.
// Falls back to a per-isolate in-memory counter only if the binding is not configured.
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
      // Binding errored (e.g. namespace not provisioned) — degrade gracefully.
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
  // Reuse the shared Mistral call/parse helper; throws on failure so the fetch
  // handler returns the same 502 response as before.
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

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function corsResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, x-app-secret');
  return new Response(response.body, { status: response.status, headers });
}