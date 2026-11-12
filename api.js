const WORKER_URL = 'https://misty-waterfall-054f.up1107677.workers.dev';
const MAX_SESSION_QUERIES = 20;
const MAX_MINUTE_QUERIES = 5;
const MINUTE_MS = 60 * 1000;
const TURNSTILE_TIMEOUT_MS = 120 * 1000;

// Cloudflare Turnstile Site Key.
// Can be customized via window.TURNSTILE_SITE_KEY or by replacing the fallback below.
// By default, uses Cloudflare's official testing site key ('1x00000000000000000000AA') which always passes.
export const TURNSTILE_SITE_KEY = window.TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

let turnstileWidgetId = null;
let turnstilePendingPromise = null;

export function getTurnstileToken() {
  if (turnstilePendingPromise) return turnstilePendingPromise;

  turnstilePendingPromise = new Promise((resolve) => {
    let settled = false;
    let timeoutId;
    const modal = document.getElementById('turnstile-modal');
    const container = document.getElementById('turnstile-widget');
    const errorEl = document.getElementById('turnstile-error');
    const cancelBtn = document.getElementById('turnstile-cancel-btn');
    const finish = (token) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (modal) modal.classList.add('hidden');
      turnstilePendingPromise = null;
      resolve(token);
    };

    // If turnstile script is not loaded or blocked, resolve gracefully with null
    if (typeof window.turnstile === 'undefined') {
      console.warn('[PharmaScore] Cloudflare Turnstile script is not loaded.');
      finish(null);
      return;
    }

    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }

    if (modal) modal.classList.remove('hidden');

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        finish(null);
      };
    }

    try {
      if (turnstileWidgetId !== null) {
        try {
          window.turnstile.remove(turnstileWidgetId);
        } catch {
          // Some Turnstile versions do not expose remove(); rendering replaces the widget.
        }
        turnstileWidgetId = null;
      }
      if (container) {
        container.replaceChildren();
        turnstileWidgetId = window.turnstile.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          callback: (token) => {
            finish(token);
          },
          'error-callback': () => {
            if (errorEl) {
              errorEl.textContent = 'Security check encountered an error. Please retry.';
              errorEl.classList.remove('hidden');
            }
            finish(null);
          },
          'expired-callback': () => {
            if (errorEl) {
              errorEl.textContent = 'The security check expired. Please retry.';
              errorEl.classList.remove('hidden');
            }
            finish(null);
          }
        });
        timeoutId = setTimeout(() => {
          if (errorEl) {
            errorEl.textContent = 'The security check timed out. Please retry.';
            errorEl.classList.remove('hidden');
          }
          finish(null);
        }, TURNSTILE_TIMEOUT_MS);
      } else {
        finish(null);
      }
    } catch (err) {
      console.warn('[PharmaScore] Turnstile render error:', err);
      finish(null);
    }
  });

  return turnstilePendingPromise;
}

export function resetTurnstile() {
  if (typeof window.turnstile !== 'undefined' && turnstileWidgetId !== null) {
    try {
      if (typeof window.turnstile.remove === 'function') {
        window.turnstile.remove(turnstileWidgetId);
      } else {
        window.turnstile.reset(turnstileWidgetId);
      }
    } catch {}
    turnstileWidgetId = null;
  }
}

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
    return { allowed: false, error: 'The 20 AI query limit for this session has been reached.' };
  }
  if (timestamps.length >= MAX_MINUTE_QUERIES) {
    return { allowed: false, error: 'Please wait before making more AI requests. The limit is 5 per minute.' };
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

  const turnstileToken = await getTurnstileToken();
  if (!turnstileToken) {
    return { success: false, error: 'Security check was not completed. Please try again.' };
  }

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: chemicalName, country, unit: priceUnit, question, turnstileToken })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || `Price lookup failed (${response.status}).` };
    }
    return data;
  } catch {
    return { success: false, error: 'Price lookup is unavailable. Check your connection and try again.' };
  } finally {
    resetTurnstile();
  }
}

export async function requestQuestionnaireFill(pdfText, questionnaire, options = {}) {
  const text = String(pdfText || '').trim();
  if (!text) return { success: false, error: 'No selectable PDF text was found.' };
  const internalVerification = options.internalVerification === true;
  if (!internalVerification) {
    const limit = checkAndRecordQuery();
    if (!limit.allowed) return { success: false, error: limit.error, rateLimited: true };
  }

  const turnstileToken = await getTurnstileToken();
  if (!turnstileToken) {
    return { success: false, error: 'Security check was not completed. Please try again.' };
  }

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'fill_questionnaire',
        pdfText: text.slice(0, 120000),
        questionnaire,
        turnstileToken,
        ...(internalVerification ? {
          verificationMode: 'internal',
          appSharedSecret: String(options.appSharedSecret || '')
        } : {})
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) return { success: false, error: data.error || `Questionnaire fill failed (${response.status}).` };
    return data;
  } catch (err) {
    console.error('[PharmaScore] PDF questionnaire service error:', err);
    return { success: false, error: 'The PDF questionnaire service is unavailable (CORS or network error). Please verify your connection or Worker origin settings.' };
  } finally {
    resetTurnstile();
  }
}
