// backend/services/cuelinksService.js
//This will call the Cuelinks Offers / Links API. You’ll need to adjust the exact URL and field names based on your Cuelinks docs.const fetch = require('node-fetch');

const CUELINKS_API_BASE = process.env.CUELINKS_API_BASE || '';
const CUELINKS_API_TOKEN = process.env.CUELINKS_API_TOKEN || '';

if (!CUELINKS_API_TOKEN) {
  console.warn('[Cuelinks] CUELINKS_API_TOKEN is not set in .env');
}

/**
 * Basic wrapper around Cuelinks "Offers" (or any search) endpoint.
 * NOTE: You MUST adjust the endpoint + query parameters based on
 *       your actual Cuelinks API contract.
 */
async function searchOffers({ q, limit = 20, page = 1 }) {
  if (!CUELINKS_API_BASE) {
    throw new Error('CUELINKS_API_BASE not configured');
  }

  const params = new URLSearchParams();
  if (q) params.set('q', q);         // if supported
  params.set('page', String(page));
  params.set('per_page', String(limit)); // if supported

  const url = `${CUELINKS_API_BASE}/offers?${params.toString()}`;

  const headers = {
    'Accept': 'application/json',
    // Adjust this to whatever Cuelinks expects:
    'Authorization': `Token token=${CUELINKS_API_TOKEN}`,
  };

  const resp = await fetch(url, { headers, timeout: 8000 });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Cuelinks API error: ${resp.status} ${text}`);
  }

  const data = await resp.json();

  // IMPORTANT:
  // Adjust this based on actual Cuelinks response structure.
  // Here we assume data.offers is an array of offers.
  const offers = Array.isArray(data.offers) ? data.offers : data;

  return offers;
}

module.exports = {
  searchOffers,
};
