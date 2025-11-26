const express = require('express');
const fs = require('fs');
const path = require('path');
const offersRouter = require('./offers'); // reuse helper
const router = express.Router();

const logPath = path.join(__dirname, '..', 'data', 'clicks.log');

function appendLog(line) {
  fs.appendFile(logPath, line + '\n', () => {});
}

function safeHttpUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

router.get('/r/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const offer = await offersRouter.getOfferById(id);
    if (!offer || !offer.url || !safeHttpUrl(offer.url)) {
      return res.status(404).send('Offer not found');
    }

    // add basic UTM
    const target = new URL(offer.url);
    if (!target.searchParams.get('utm_source')) target.searchParams.set('utm_source', 'aviders');
    if (!target.searchParams.get('utm_medium')) target.searchParams.set('utm_medium', 'app');
    if (!target.searchParams.get('utm_campaign')) target.searchParams.set('utm_campaign', id);

    // log (ts, id, ip, ua)
    const ts = new Date().toISOString();
    appendLog(JSON.stringify({
      ts, id, ip: req.ip, ua: req.headers['user-agent'] || '', to: target.toString()
    }));

    return res.redirect(302, target.toString());
  } catch (e) {
    return res.status(500).send('Redirect error');
  }
});

module.exports = router;
