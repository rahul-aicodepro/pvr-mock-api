const crypto = require('crypto');

function normalizeHeaders(headers = {}, whitelist = []) {
  if (!headers || typeof headers !== 'object') return '';

  const normalized = {};
  const keys = Object.keys(headers)
    .map((key) => key.toLowerCase())
    .sort();

  for (const key of keys) {
    if (whitelist.length === 0 || whitelist.includes(key)) {
      normalized[key] = String(headers[key] ?? '').trim();
    }
  }

  return JSON.stringify(normalized);
}

function computeHash({ method, url, normalizedPayload, normalizedHeaders = '' }) {
  const input = `${method.toUpperCase()}|${url}|${JSON.stringify(normalizedPayload)}|${normalizedHeaders}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

module.exports = {
  normalizeHeaders,
  computeHash
};
