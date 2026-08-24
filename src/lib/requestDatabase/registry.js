 const path = require('path');
const { safeReadJson, atomicWriteJson, ensureDir } = require('./fsUtils');
const config = require('../../../request-db.config.js');

function getRegistryPath(endpoint) {
  return path.join(process.cwd(), config.root, config.registryDir, `${endpoint}.json`);
}

async function loadRegistry(endpoint) {
  const registryPath = getRegistryPath(endpoint);
  const registry = await safeReadJson(registryPath);
  return registry || {};
}

async function saveRegistry(endpoint, registry) {
  const registryPath = getRegistryPath(endpoint);
  await ensureDir(path.dirname(registryPath));
  await atomicWriteJson(registryPath, registry, config.prettyJson);
  return registry;
}

const registryQueues = new Map();

function enqueueRegistryOperation(endpoint, op) {
  const current = registryQueues.get(endpoint) || Promise.resolve();
  const next = current.then(op).catch(() => {});
  registryQueues.set(endpoint, next);
  return next;
}

async function addRegistryEntry(endpoint, key, entry) {
  return enqueueRegistryOperation(endpoint, async () => {
    const registry = await loadRegistry(endpoint);
    registry[key] = entry;
    await saveRegistry(endpoint, registry);
    return registry;
  });
}

async function removeRegistryEntry(endpoint, key) {
  return enqueueRegistryOperation(endpoint, async () => {
    const registry = await loadRegistry(endpoint);
    if (registry[key]) {
      delete registry[key];
      await saveRegistry(endpoint, registry);
    }
    return registry;
  });
}

module.exports = {
  getRegistryPath,
  loadRegistry,
  saveRegistry,
  addRegistryEntry,
  removeRegistryEntry
};
