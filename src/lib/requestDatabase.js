const path = require('path');
const { normalizePayload } = require('./requestDatabase/normalizePayload');
const { normalizeHeaders, computeHash } = require('./requestDatabase/hash');
const { ensureDir, atomicWriteJson, safeReadJson, fileExists, deleteFile } = require('./requestDatabase/fsUtils');
const { loadRegistry, addRegistryEntry, removeRegistryEntry } = require('./requestDatabase/registry');
const logger = require('./requestDatabase/logger');
const config = require('../../request-db.config.js');

const pendingRequests = new Map();

function getEndpointDir(endpoint) {
  return path.join(process.cwd(), config.root, endpoint);
}

function getEndpointRegistry(endpoint) {
  return path.join(process.cwd(), config.root, config.registryDir, `${endpoint}.json`);
}

function getRecordPath(endpoint, key) {
  return path.join(getEndpointDir(endpoint), `${key}.json`);
}

function normalizeRecordRequest({ method, url, payload, headers, hashHeaders }) {
  const normalizedPayload = normalizePayload(payload);
  const normalizedHeaders = hashHeaders ? normalizeHeaders(headers, config.headerWhitelist) : '';
  return { method, url, normalizedPayload, normalizedHeaders };
}

function buildRecord({ key, endpoint, method, url, payload, normalizedPayload, headers, hashHeaders, response, status, apiVersion, responseTime, responseSize }) {
  const normalizedHeaders = hashHeaders ? normalizeHeaders(headers, config.headerWhitelist) : '';

  return {
    schemaVersion: config.schemaVersion,
    key,
    request: {
      method,
      url,
      endpoint,
      payload,
      normalizedPayload,
      normalizedHeaders,
      hashHeaders,
      headerWhitelist: hashHeaders ? config.headerWhitelist : undefined,
      headers: hashHeaders ? headers : undefined
    },
    response,
    metadata: {
      status,
      apiVersion,
      storedAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      accessCount: 1,
      responseTime,
      responseSize
    }
  };
}

async function getStats() {
  const statsPath = path.join(process.cwd(), config.root, config.statsFile);
  const stats = await safeReadJson(statsPath);
  return stats || {
    storedRequests: 0,
    localHits: 0,
    apiCalls: 0,
    forceRefreshes: 0,
    corruptedRecovered: 0,
    failedRequests: 0
  };
}

async function saveStats(stats) {
  const statsPath = path.join(process.cwd(), config.root, config.statsFile);
  await ensureDir(path.dirname(statsPath));
  await atomicWriteJson(statsPath, stats, config.prettyJson);
  return stats;
}

async function has(endpoint, key) {
  const record = await getStoredRecord(endpoint, key);
  return record !== null;
}

async function get(endpoint, key) {
  const record = await getStoredRecord(endpoint, key);
  return record ? record.response : null;
}

async function findByEndpoint(endpoint) {
  return loadRegistry(endpoint);
}

let statsQueue = Promise.resolve();

async function updateStats(updates) {
  statsQueue = statsQueue.then(async () => {
    try {
      const stats = await getStats();
      const newStats = { ...stats, ...Object.keys(updates).reduce((acc, key) => {
        acc[key] = (stats[key] || 0) + updates[key];
        return acc;
      }, {}) };
      return await saveStats(newStats);
    } catch (err) {
      logger.warn(`Failed to update stats: ${err.message}`);
    }
  }).catch(() => {});
  return statsQueue;
}

async function getStoredRecord(endpoint, key) {
  const recordPath = getRecordPath(endpoint, key);
  if (!(await fileExists(recordPath))) return null;

  try {
    const record = await safeReadJson(recordPath);
    if (!record || record.key !== key) {
      throw new Error('Integrity check failed');
    }

    const normalizedPayload = normalizePayload(record.request.payload);
    const normalizedHeaders = record.request.hashHeaders
      ? normalizeHeaders(record.request.headers, record.request.headerWhitelist || config.headerWhitelist)
      : '';

    const recomputedKey = computeHash({
      method: record.request.method,
      url: record.request.url,
      normalizedPayload,
      normalizedHeaders
    });

    if (recomputedKey !== record.key) {
      throw new Error('Hash mismatch');
    }

    record.metadata.lastAccessed = new Date().toISOString();
    record.metadata.accessCount = (record.metadata.accessCount || 0) + 1;
    await atomicWriteJson(recordPath, record, config.prettyJson);
    return record;
  } catch (error) {
    logger.warn(`Corrupted record detected for ${endpoint}/${key}: ${error.message}`);
    await deleteFile(recordPath);
    await updateStats({ corruptedRecovered: 1 });
    return null;
  }
}

async function writeRecord(endpoint, key, record) {
  const recordPath = getRecordPath(endpoint, key);
  await ensureDir(path.dirname(recordPath));
  await atomicWriteJson(recordPath, record, config.prettyJson);
  await addRegistryEntry(endpoint, key, {
    endpoint,
    storedAt: record.metadata.storedAt,
    file: path.relative(path.join(process.cwd(), config.root), recordPath),
    status: record.metadata.status,
    apiVersion: record.metadata.apiVersion || null
  });
}

function getErrorRecordPath(endpoint, key) {
  const timestamp = Date.now();
  return path.join(process.cwd(), config.root, config.errorsDir, `${endpoint}-${key}-${timestamp}.json`);
}

async function writeErrorRecord(endpoint, key, request, error) {
  const recordPath = getErrorRecordPath(endpoint, key);
  await ensureDir(path.dirname(recordPath));
  const errorRecord = {
    schemaVersion: config.schemaVersion,
    key,
    request,
    error: {
      message: error.message,
      stack: error.stack || null,
      status: error.status || null
    },
    metadata: {
      storedAt: new Date().toISOString()
    }
  };
  await atomicWriteJson(recordPath, errorRecord, config.prettyJson);
}

function buildPendingKey(endpoint, method, url, normalizedPayload, normalizedHeaders) {
  return `${endpoint}|${method.toUpperCase()}|${url}|${JSON.stringify(normalizedPayload)}|${normalizedHeaders}`;
}

async function execute({ endpoint, method, url, payload = {}, headers = {}, fetcher, forceRefresh = false, hashHeaders = false, apiVersion = 'v1' }) {
  if (!endpoint || !method || !url || typeof fetcher !== 'function') {
    throw new Error('Missing required execute parameters');
  }

  // If passthrough mode is enabled, directly fetch from PVR without touching local DB/storage
  if (config.mode === 'passthrough' || process.env.REQUEST_DB_MODE === 'passthrough') {
    logger.info(`Passthrough mode active: Fetching directly from PVR for ${endpoint}`);
    return fetcher();
  }

  const { normalizedPayload, normalizedHeaders } = normalizeRecordRequest({ method, url, payload, headers, hashHeaders });
  const key = computeHash({ method, url, normalizedPayload, normalizedHeaders });
  const pendingKey = buildPendingKey(endpoint, method, url, normalizedPayload, normalizedHeaders);

  if (pendingRequests.has(pendingKey)) {
    logger.info(`Pending request found for ${endpoint}:${key}, waiting for existing execution`);
    return pendingRequests.get(pendingKey);
  }

  const recordPath = getRecordPath(endpoint, key);
  const fileAlreadyExists = await fileExists(recordPath);

  const work = (async () => {
    const existingValidRecord = await getStoredRecord(endpoint, key);
    if (!forceRefresh && existingValidRecord) {
      logger.info(`Found existing request for ${endpoint}:${key} Returning stored response`);
      await updateStats({ localHits: 1 });
      return existingValidRecord.response;
    }

    if (config.mode === 'readonly') {
      const error = new Error('Request not stored');
      error.status = 404;
      throw error;
    }

    if (config.mode === 'passthrough') {
      logger.info(`Passthrough mode enabled for ${endpoint}:${key}`);
      return fetcher();
    }

    logger.info(`Request not found for ${endpoint}:${key} Fetching from PVR API...`);
    await updateStats({ apiCalls: 1 });

    const start = Date.now();
    let responseData;

    try {
      responseData = await fetcher();
    } catch (error) {
      await writeErrorRecord(endpoint, key, { method, url, endpoint, payload, headers: hashHeaders ? headers : undefined }, error);
      await updateStats({ failedRequests: 1 });
      throw error;
    }

    const responseTime = Date.now() - start;
    const responseSize = Buffer.byteLength(JSON.stringify(responseData), 'utf8');
    const status = responseData && responseData.status ? responseData.status : 200;

    const record = buildRecord({
      key,
      endpoint,
      method,
      url,
      payload,
      normalizedPayload,
      headers,
      hashHeaders,
      response: responseData,
      status,
      apiVersion,
      responseTime,
      responseSize
    });

    await writeRecord(endpoint, key, record);
    if (!fileAlreadyExists) {
      await updateStats({ storedRequests: 1 });
    }

    if (forceRefresh) {
      await updateStats({ forceRefreshes: 1 });
    }

    logger.info(`Stored new request for ${endpoint}:${key}`);
    return responseData;
  })();

  pendingRequests.set(pendingKey, work);

  try {
    return await work;
  } finally {
    pendingRequests.delete(pendingKey);
  }
}

async function deleteRecord(endpoint, key) {
  const recordPath = getRecordPath(endpoint, key);
  await deleteFile(recordPath);
  await removeRegistryEntry(endpoint, key);
}

async function refresh(endpoint, method, url, payload = {}, headers = {}, fetcher, hashHeaders = false, apiVersion = 'v1') {
  return execute({ endpoint, method, url, payload, headers, fetcher, forceRefresh: true, hashHeaders, apiVersion });
}

async function find(endpoint) {
  return loadRegistry(endpoint);
}

async function stats() {
  return getStats();
}

module.exports = {
  execute,
  has,
  get,
  find,
  findByEndpoint,
  delete: deleteRecord,
  refresh,
  stats
};
