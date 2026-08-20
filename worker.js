//This is a cloudflare worker

const MISTRAL_MODEL = 'mistral-small-latest';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_IP_QUERIES_PER_MINUTE = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const ipQueryHistory = new Map();

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

    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const rateLimit = checkIpRateLimit(clientIp);
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

function checkIpRateLimit(clientIp) {
  const now = Date.now();
  const recentQueries = (ipQueryHistory.get(clientIp) || []).filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recentQueries.length >= MAX_IP_QUERIES_PER_MINUTE) {
    return { allowed: false, error: 'Please wait before making more AI requests. The limit is 5 per minute.' };
  }
  recentQueries.push(now);
  ipQueryHistory.set(clientIp, recentQueries);
  return { allowed: true };
}

async function fillQuestionnaireFromPdf(pdfText, questionnaire, env) {
  const text = String(pdfText || '').trim();
  if (!text || text.length > 120000 || !questionnaire || typeof questionnaire !== 'object') {
    return { success: false, error: 'The PDF text or questionnaire schema is missing or too large.' };
  }
  const prompt = [
    'You fill a pharmaceutical laboratory questionnaire from extracted selectable PDF text.',
    'Use only values supported by the PDF. Do not invent values.',
    'Match answers to question IDs from the supplied questionnaire schema.',
    'Return only JSON in the shape {"answers": {"questionId": value, ...}, "confidence": "low"|"medium"|"high", "unfilled": ["questionId", ...]}.',
    'Use the availableAnswers and units to choose valid values. Preserve numeric values as numbers or numeric strings.',
    'For equipment_dropdown and column_selector questions, return an object with category and name, for example {"category":"HPLC","name":"Detector X"}; use category "Other" only when the PDF names an item not in the available list.',
    'For equipment_checklist questions, return an array of exact item names. For sample pretreatment checklists, return objects such as {"name":"Item name","amount":2} when an amount is stated; do not return one combined string.',
    'For ordinary dropdown questions, return exactly one value from availableAnswers. For booleans, return true or false.',
    `QUESTIONNAIRE SCHEMA:\n${JSON.stringify(questionnaire)}`,
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let mistralRes;
  try {
    mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${env.MistralAPI}`,
        'Content-Type': 'application/json'
      },
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

  if (!mistralRes.ok) {
    throw new Error(`Mistral request failed: ${mistralRes.status}`);
  }

  const data = await mistralRes.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Mistral');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Could not parse price estimate response');
  }

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
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, headers });
}