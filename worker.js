// Cloudflare Worker: ChemSpace Proxy

let accessToken = null;
let tokenExpiry = 0;

async function fetchToken(env) {
  const apiKey = env.CHEMSPACE_API_KEY;
  const url = 'https://api.chem-space.com/auth/token';
  const headers = { Authorization: `Bearer ${apiKey}` };
  try {
    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) {
      const msg = await resp.text();
      throw new Error(`Token fetch failed: ${resp.status} ${msg}`);
    }
    const data = await resp.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 10000; // 10s buffer
    return accessToken;
  } catch (err) {
    accessToken = null;
    tokenExpiry = 0;
    throw err;
  }
}

async function getToken(env) {
  if (!accessToken || Date.now() > tokenExpiry) {
    await fetchToken(env);
  }
  return accessToken;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

function errorResponse(status, message, query = null) {
  return new Response(
    JSON.stringify({ success: false, query, message }),
    { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
  );
}

async function searchChemSpace(query, token, categories, shipToCountry) {
  const url = `https://api.chem-space.com/v4/search/text?shipToCountry=${encodeURIComponent(shipToCountry)}&count=10&page=1&categories=${encodeURIComponent(categories)}`;
  const form = new FormData();
  form.append('query', query);
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  // Content-Type is set automatically by FormData
  const resp = await fetch(url, { method: 'POST', headers, body: form });
  return resp;
}

function findCheapest(items, unit) {
  let min = null;
  let result = null;
  let count = items.length;
  for (const item of items) {
    if (!item.offers) continue;
    for (const offer of item.offers) {
      if (!offer.prices) continue;
      for (const price of offer.prices) {
        let value = null;
        if (unit === 'ml') {
          // Only consider mL or L
          if (price.uom === 'ml') {
            value = price.pack;
          } else if (price.uom === 'l') {
            value = price.pack * 1000;
          } else {
            continue;
          }
          if (!value || value === 0) continue;
          if (!price.priceUsd || price.priceUsd <= 0) continue;
          const pricePerMl = price.priceUsd / value;
          if (!isFinite(pricePerMl) || pricePerMl <= 0) continue;
          if (min === null || pricePerMl < min) {
            min = pricePerMl;
            result = {
              cheapestPricePerMl: Number(pricePerMl.toFixed(2)),
              currency: 'USD',
              vendorName: offer.vendorName,
              pack: price.pack,
              uom: price.uom,
              link: item.link,
            };
          }
        } else {
          // Default: grams
          if (price.uom === 'g') {
            value = price.pack;
          } else if (price.uom === 'mg') {
            value = price.pack / 1000;
          } else if (price.uom === 'kg') {
            value = price.pack * 1000;
          } else {
            continue;
          }
          if (!value || value === 0) continue;
          if (!price.priceUsd || price.priceUsd <= 0) continue;
          const pricePerGram = price.priceUsd / value;
          if (!isFinite(pricePerGram) || pricePerGram <= 0) continue;
          if (min === null || pricePerGram < min) {
            min = pricePerGram;
            result = {
              cheapestPricePerGram: Number(pricePerGram.toFixed(2)),
              currency: 'USD',
              vendorName: offer.vendorName,
              pack: price.pack,
              uom: price.uom,
              link: item.link,
            };
          }
        }
      }
    }
  }
  if (result) result.resultCount = count;
  return result;
}

export default {
  async fetch(request, env) {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders() });
      }


      const url = new URL(request.url);
      const query = url.searchParams.get('query');
      const shipToCountry = url.searchParams.get('shipToCountry');
      const unit = url.searchParams.get('unit') === 'ml' ? 'ml' : 'g';
      if (!query) {
        return errorResponse(400, 'Missing query parameter');
      }
      if (!shipToCountry) {
        return errorResponse(400, 'Missing shipToCountry parameter');
      }

      let token;
      try {
        token = await getToken(env);
      } catch (err) {
        return errorResponse(500, 'Failed to fetch ChemSpace token');
      }

      // Use all categories as in your example
      const allCategories = 'CSMS,CSMB,CSCS,CSSB,CSSS';
      // Try in-stock first (CSSB,CSSS), then all if no results
      let resp = await searchChemSpace(query, token, 'CSSB,CSSS', shipToCountry);
      // Handle 401: try refresh token once
      if (resp.status === 401) {
        try {
          token = await fetchToken(env);
          resp = await searchChemSpace(query, token, 'CSSB,CSSS', shipToCountry);
        } catch {
          return errorResponse(500, 'Authentication failed (401)');
        }
      }
      // Handle 429
      if (resp.status === 429) {
        return errorResponse(429, 'Rate limit exceeded, please try later', query);
      }
      // Handle 500
      if (resp.status === 500) {
        return errorResponse(500, 'ChemSpace API error', query);
      }
      if (!resp.ok) {
        const msg = await resp.text();
        return errorResponse(resp.status, `ChemSpace error: ${msg}`, query);
      }
      let data = await resp.json();
      let items = data.items || [];
      // If no results, try make-on-demand
      if (items.length === 0) {
        const debug1 = {
          step: 'first search',
          status: resp.status,
          url: resp.url,
          params: { query, categories: 'CSSB,CSSS', shipToCountry }
        };
        resp = await searchChemSpace(query, token, allCategories, shipToCountry);
        let debug2 = {};
        if (resp.status === 401) {
          try {
            token = await fetchToken(env);
            resp = await searchChemSpace(query, token, allCategories, shipToCountry);
          } catch {
            return errorResponse(500, 'Authentication failed (401)');
          }
        }
        if (resp.status === 429) {
          return errorResponse(429, 'Rate limit exceeded, please try later', query);
        }
        if (resp.status === 500) {
          return errorResponse(500, 'ChemSpace API error', query);
        }
        if (!resp.ok) {
          const msg = await resp.text();
          return errorResponse(resp.status, `ChemSpace error: ${msg}`, query);
        }
        const raw = await resp.clone().text();
        data = await resp.json();
        items = data.items || [];
        debug2 = {
          step: 'second search',
          status: resp.status,
          url: resp.url,
          params: { query, categories: allCategories, shipToCountry },
          response: raw
        };
        if (items.length === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              query,
              message: 'No results found',
              debug: [debug1, debug2]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
          );
        }
      }

      if (items.length === 0) {
        return new Response(
          JSON.stringify({ success: false, query, message: 'No results found' }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
        );
      }

      const cheapest = findCheapest(items, unit);
      if (!cheapest) {
        return new Response(
          JSON.stringify({ success: false, query, message: unit === 'ml' ? 'No prices in mL found' : 'No prices in grams found', unit }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
        );
      }

      // Add unit field and normalize response shape
      let responseObj = { success: true, query, unit };
      if (unit === 'ml') {
        responseObj.cheapestPricePerMl = cheapest.cheapestPricePerMl;
        responseObj.currency = cheapest.currency;
        responseObj.vendorName = cheapest.vendorName;
        responseObj.pack = cheapest.pack;
        responseObj.uom = cheapest.uom;
        responseObj.resultCount = cheapest.resultCount;
        if (cheapest.link) responseObj.link = cheapest.link;
      } else {
        responseObj.cheapestPricePerGram = cheapest.cheapestPricePerGram;
        responseObj.currency = cheapest.currency;
        responseObj.vendorName = cheapest.vendorName;
        responseObj.pack = cheapest.pack;
        responseObj.uom = cheapest.uom;
        responseObj.resultCount = cheapest.resultCount;
        if (cheapest.link) responseObj.link = cheapest.link;
      }

      return new Response(
        JSON.stringify(responseObj),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
      );
    } catch (err) {
      return errorResponse(500, `Internal error: ${err.message}`);
    }
  }
};