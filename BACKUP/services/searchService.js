// backend/services/searchService.js
// This file converts raw Cuelinks offers into a clean structure for your app, and uses linkConverter to inject your Amazon tags.

//📝 Note: Right now this is deal search, not perfect “product price comparison”.For real product prices, we’ll later integrate Amazon PA API / Flipkart APIs and plug them into this same searchService.
const { searchOffers } = require('./cuelinksService');
const { buildAffiliateUrl, getRegionFromParam } = require('./linkConverter');

/**
 * Normalize ONE offer from Cuelinks into your app's format.
 * You MUST map the fields according to your actual Cuelinks response.
 */
function normalizeOffer(raw, region) {
  // These keys are placeholders based on typical "offers" structure.
  // Adjust them based on actual Cuelinks API response.
  const merchantDomain = raw.merchant_domain || raw.merchant_domain_name || '';
  const merchantName = raw.merchant_name || raw.campaign_name || '';
  const title = raw.title || raw.offer_title || raw.name || '';
  const description = raw.description || raw.details || '';
  const logo = raw.logo || raw.merchant_logo || '';
  const destinationUrl = raw.destination_url || raw.landing_page || raw.url || '';
  const trackingUrl = raw.tracking_url || raw.affiliate_url || '';

  const regionCode = getRegionFromParam(region);

  const affiliateUrl = buildAffiliateUrl({
    merchantDomain,
    destinationUrl,
    cuelinksTrackingUrl: trackingUrl,
    region: regionCode,
  });

  return {
    id: raw.id || raw.offer_id || null,
    title,
    merchant: merchantName,
    merchant_domain: merchantDomain,
    description,
    image: logo,
    destination_url: destinationUrl,
    affiliate_url: affiliateUrl,
    // If Cuelinks offers any numeric fields like discount / payout, map them here:
    price: null,          // Cuelinks offers are normally NOT real-time product price
    discount_text: raw.coupon_code || raw.discount || null,
    raw,                  // keep full raw record for debugging if needed
  };
}

async function searchDeals({ q, region, limit = 20, page = 1 }) {
  const offers = await searchOffers({ q, limit, page });
  const regionCode = getRegionFromParam(region);
  return offers.map(o => normalizeOffer(o, regionCode));
}

module.exports = {
  searchDeals,
};
