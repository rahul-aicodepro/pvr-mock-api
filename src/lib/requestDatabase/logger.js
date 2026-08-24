const fs = require('fs');
const path = require('path');
const config = require('../../../request-db.config.js');

const LEVELS = ['error', 'warn', 'info'];
const logFilePath = path.join(process.cwd(), config.root, config.logsDir, 'request-db.log');

function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[REQUEST-DB] [${timestamp}] [${level.toUpperCase()}] ${message}`;
}

function maybeWriteToFile(message) {
  if (!config.logToFile) return;
  try {
    const dir = path.dirname(logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(logFilePath, `${message}\n`, 'utf8');
  } catch (error) {
    console.error('[REQUEST-DB] Failed to write log file:', error.message);
  }
}

function log(level, message) {
  if (LEVELS.indexOf(level) > LEVELS.indexOf(config.logLevel || 'info')) return;
  const formatted = formatMessage(level, message);
  if (level === 'error') {
    console.error(formatted);
  } else {
    console.log(formatted);
  }
  maybeWriteToFile(formatted);
}

module.exports = {
  info: (message) => log('info', message),
  warn: (message) => log('warn', message),
  error: (message) => log('error', message)
};
