const fs = require('fs').promises;
const path = require('path');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWriteJson(filePath, data, pretty = true) {
  await ensureDir(path.dirname(filePath));
  const uniqueId = `${Date.now()}_${process.hrtime.bigint()}_${Math.random().toString(36).slice(2, 8)}`;
  const tempPath = `${filePath}.${uniqueId}.tmp`;
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await fs.writeFile(tempPath, json, 'utf8');
  try {
    await fs.rename(tempPath, filePath);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EEXIST' || err.code === 'EBUSY') {
      await fs.copyFile(tempPath, filePath);
      await fs.unlink(tempPath).catch(() => {});
    } else {
      await fs.unlink(tempPath).catch(() => {});
      throw err;
    }
  }
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function safeReadJson(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = {
  ensureDir,
  atomicWriteJson,
  readJson,
  safeReadJson,
  fileExists,
  deleteFile
};
