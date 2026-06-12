import { defineConfig, devices } from '@playwright/test';

const e2ePort = process.env.PLAYWRIGHT_PORT ?? '5173';
const e2eHost = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1';
const e2eBaseUrl = `http://${e2eHost}:${e2ePort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: e2eBaseUrl,
    locale: 'en-US',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --host ${e2eHost} --port ${e2ePort} --strictPort`,
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
  },
});
