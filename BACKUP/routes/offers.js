const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const PUBLIC_OFFERS_URL =
  process.env.PUBLIC_OFFERS_URL ||
  'https://cdn.jsdelivr.net/gh/aviders/offers@main/offers/index.json';

let _cache = { at: 0, items: [] };
const TTL = 10 * 60 * 1000; // 10 minutes

async function loadOffers() {
  const now = Date.now();
  if (now - _cache.at < TTL && _cache.items.length) return _cache.items;
  const resp = await fetch(PUBLIC_OFFERS_URL, { timeout: 8000 });
  if (!resp.ok) throw new Error(`Offers fetch failed: ${resp.status}`);
  const data = await resp.json();
  const items = Array.isArray(data) ? data : (Array.isArray(data.offers) ? data.offers : []);
  _cache = { at: now, items };
  return items;
}

router.get('/offers', async (req, res) => {
  try {
    const items = await loadOffers();
    res.json(items);
  } catch (e) {
    res.status(502).json({ error: 'OFFERS_UPSTREAM_FAIL', message: String(e) });
  }
});

// helper for other routes
router.getOfferById = async (id) => {
  const items = await loadOffers();
  return items.find(o => String(o.id) === String(id));
};

module.exports = router;
