// playwright.config.js
// @ts-check
const { devices } = require('@playwright/test');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: './scripts', // Point to the scripts directory for REALFLOW tests
  // You can add other directories too:
  // testDir: '.', // To scan all, then use testMatch
  // testMatch: /.*\.spec\.(js|ts|mjs)/, // Or specify patterns

  timeout: 60 * 1000, // 60 seconds timeout for each test
  expect: {
    timeout: 10 * 1000, // 10 seconds timeout for expect assertions
  },
  fullyParallel: true, // Run tests in parallel
  forbidOnly: !!process.env.CI, // Fail the build on CI if you accidentally left test.only in the source code.
  retries: process.env.CI ? 2 : 0, // Retry on CI only
  workers: process.env.CI ? 1 : undefined, // Opt out of parallel tests on CI by default.
  reporter: 'html', // Reporter to use. See https://playwright.dev/docs/test-reporters

  use: {
    // All requests we send go to this API endpoint.
    baseURL: process.env.BASE_URL || 'http://localhost:3000', // Adjust if your app runs elsewhere

    // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
    trace: 'on-first-retry',

    // Emulates light color scheme.
    colorScheme: 'light',
  },

  projects: [
    {
      name: 'electron-app',
      // Playwright doesn't have a built-in 'electron' device like 'Desktop Chrome'.
      // Electron testing is configured by how you launch the application in your test setup.
      // See scripts/realflow.spec.ts for the playwright._electron.launch() call.
      // This project entry is more for organization if you have multiple test types.
    },
    // Example for web tests against a running server (if you had them)
    // {
    //   name: 'chromium',
    //   use: { ...devices['Desktop Chrome'] },
    //   testDir: './frontend/e2e', // If you want to separate web e2e tests
    // },
  ],

  // Folder for test artifacts such as screenshots, videos, traces, etc.
  outputDir: 'test-results/',

  // Optional: Run your local dev server before starting the tests
  // webServer: {
  //   command: 'npm run start', // Command to start your Electron app or dev server
  //   url: 'http://localhost:3000', // URL to wait for
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000, // 2 minutes to start
  //   // stdout: 'pipe',
  //   // stderr: 'pipe',
  // },
};

module.exports = config;
