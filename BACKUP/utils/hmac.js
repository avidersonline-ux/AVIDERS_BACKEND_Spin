const crypto = require('crypto');
function createHmacSignature(payloadString, secret) {
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}
function verifyHmacSignature(payloadString, secret, signature) {
  const expected = createHmacSignature(payloadString, secret);
  const A = Buffer.from(expected, 'utf8'); const B = Buffer.from(signature, 'utf8');
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}
module.exports = { createHmacSignature, verifyHmacSignature };
