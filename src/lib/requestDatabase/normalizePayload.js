function normalizePayload(value) {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => normalizePayload(item));
  }
  if (typeof value === 'object') {
    if (value === undefined) return null;
    const keys = Object.keys(value).sort();
    const normalized = {};

    for (const key of keys) {
      normalized[key] = normalizePayload(value[key]);
    }

    return normalized;
  }

  if (typeof value === 'undefined') return null;
  return value;
}

function stableStringify(value) {
  return JSON.stringify(value);
}

module.exports = {
  normalizePayload,
  stableStringify
};
