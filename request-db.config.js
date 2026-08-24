module.exports = {
  root: 'request-db/v1',
  mode: 'passthrough',
  prettyJson: true,
  hashHeaders: false,
  headerWhitelist: ['authorization'],
  logLevel: 'info',
  logToFile: true,
  logsDir: 'logs',
  registryDir: 'registry',
  statsFile: 'stats.json',
  endpointsFile: 'endpoints.json',
  errorsDir: 'errors',
  schemaVersion: 1
};
