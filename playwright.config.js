const path = require('node:path');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(__dirname, '.playwright-browsers');
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './browser-tests',
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:49837', ...devices['Desktop Chrome'] },
  webServer: { command: 'node server.js', env: { PORT: '49837' }, url: 'http://127.0.0.1:49837/api/health', reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 1_000 }, timeout: 30_000 }
});

