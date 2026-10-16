import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // CI runners render with software WebGL on fewer cores, so give each test more room there.
  timeout: process.env.CI ? 180_000 : 90_000,
  // And give each check more time there, for the same reason.
  expect: { timeout: process.env.CI ? 30_000 : 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${port}/811-101/`,
    // Software WebGL, explicitly opted in so Chrome doesn't warn about the fallback.
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'npm run preview',
    url: `http://localhost:${port}/811-101/training/frequency-lab/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
