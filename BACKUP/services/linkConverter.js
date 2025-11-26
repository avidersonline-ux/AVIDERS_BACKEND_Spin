// backend/services/linkConverter.js
const { URL } = require('url');

function getRegionFromParam(region) {
  if (!region) return process.env.DEFAULT_REGION || 'IN';
  const up = String(region).toUpperCase();
  if (up === 'US' || up === 'IN') return up;
  return 'IN';
}

function addTagToUrl(urlString, tagKey, tagValue) {
  const url = new URL(urlString);
  const params = url.searchParams;

  // Remove existing tag if present
  params.delete(tagKey);
  params.set(tagKey, tagValue);

  url.search = params.toString();
  return url.toString();
}

function buildAmazonAffiliateUrl(destinationUrl, region) {
  const url = new URL(destinationUrl);
  const host = url.hostname.toLowerCase();
  const reg = getRegionFromParam(region);

  let tag = process.env.AMAZON_TAG_IN || 'aviders-21';

  if (host.includes('amazon.com') && !host.includes('amazon.in')) {
    tag = process.env.AMAZON_TAG_US || 'aviders-20';
  } else {
    // Default to IN if it's amazon.in or anything else
    tag = process.env.AMAZON_TAG_IN || 'aviders-21';
  }

  return addTagToUrl(url.toString(), 'tag', tag);
}

/**
 * Decide the final affiliate URL based on merchant domain.
 * - Amazon: use your own tags
 * - Others: just return Cuelinks tracking link as-is
 */
function buildAffiliateUrl({ merchantDomain, destinationUrl, cuelinksTrackingUrl, region }) {
  const domain = (merchantDomain || '').toLowerCase();

  // If we have a clean destination URL AND it's Amazon → override
  if (destinationUrl && (domain.includes('amazon.in') || domain.includes('amazon.com'))) {
    return buildAmazonAffiliateUrl(destinationUrl, region);
  }

  // Fallback: use Cuelinks tracking URL if provided
  if (cuelinksTrackingUrl) return cuelinksTrackingUrl;

  // Last fallback: use destination URL itself (no monetisation)
  return destinationUrl || '';
}

module.exports = {
  getRegionFromParam,
  buildAmazonAffiliateUrl,
  buildAffiliateUrl,
};
