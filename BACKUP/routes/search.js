// backend/routes/search.js
const express = require('express');
const router = express.Router();
const { searchDeals } = require('../services/searchService');
// const verifyJwt = require('../middleware/verifyJwt'); // optional if you want auth

// GET /api/search?q=iphone&region=IN
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const region = req.query.region || undefined;
    const limit = parseInt(req.query.limit || '20', 10) || 20;
    const page = parseInt(req.query.page || '1', 10) || 1;

    if (!q) {
      return res.status(400).json({ ok: false, error: 'MISSING_QUERY', message: 'q is required' });
    }

    const results = await searchDeals({ q, region, limit, page });

    res.json({
      ok: true,
      query: q,
      region: region || process.env.DEFAULT_REGION || 'IN',
      count: results.length,
      results,
    });
  } catch (e) {
    console.error('Search error:', e);
    res.status(502).json({
      ok: false,
      error: 'SEARCH_UPSTREAM_FAIL',
      message: String(e.message || e),
    });
  }
});

module.exports = router;
