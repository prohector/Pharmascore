const WORKER_URL = 'https://misty-waterfall-054f.up1107677.workers.dev';
const MAX_SESSION_QUERIES = 20;
const MAX_MINUTE_QUERIES = 5;
const MINUTE_MS = 60 * 1000;

function checkAndRecordQuery() {
  const now = Date.now();
  const stored = sessionStorage.getItem('pharmascore_price_queries');
  let timestamps;
  try {
    timestamps = Array.isArray(JSON.parse(stored || '[]')) ? JSON.parse(stored || '[]') : [];
  } catch {
    timestamps = [];
  }
  timestamps = timestamps.filter(timestamp => Number.isFinite(timestamp) && now - timestamp < MINUTE_MS);

  const sessionTotal = Number(sessionStorage.getItem('pharmascore_price_query_total') || 0);
  if (sessionTotal >= MAX_SESSION_QUERIES) {
    return { allowed: false, error: 'The 20 price-query limit for this session has been reached.' };
  }
  if (timestamps.length >= MAX_MINUTE_QUERIES) {
    return { allowed: false, error: 'Please wait before making more price queries. The limit is 5 per minute.' };
  }

  timestamps.push(now);
  sessionStorage.setItem('pharmascore_price_queries', JSON.stringify(timestamps));
  sessionStorage.setItem('pharmascore_price_query_total', String(sessionTotal + 1));
  return { allowed: true };
}

export async function lookupChemicalPrice(name, country = 'US', unit = 'g', question = '') {
  const chemicalName = String(name || '').trim();
  const priceUnit = ['g', 'ml', 'item'].includes(unit) ? unit : 'g';
  if (!chemicalName) return { success: false, error: 'Enter a name before querying.' };

  const limit = checkAndRecordQuery();
  if (!limit.allowed) return { success: false, error: limit.error, rateLimited: true };

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: chemicalName, country, unit: priceUnit, question })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || `Price lookup failed (${response.status}).` };
    }
    return data;
  } catch {
    return { success: false, error: 'Price lookup is unavailable. Check your connection and try again.' };
  }
}
