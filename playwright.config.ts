import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './specs',
  /* Global timeout for entire test suite (10 min on CI to prevent GitHub Actions timeouts) */
  globalTimeout: process.env.CI ? 600_000 : undefined,
  /* Per-test timeout (60s on CI due to slower runners, 30s locally) */
  timeout: process.env.CI ? 60_000 : 30_000,
  /* Global setup for database testcontainers (teardown handled by setup return value) */
  globalSetup: './specs/global-setup.ts',
  /* Global teardown for emergency process cleanup */
  globalTeardown: './specs/global-teardown.ts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'github' : [['list'], ['html']],

  /* Snapshot configuration */
  snapshotDir: './specs',
  snapshotPathTemplate:
    '{snapshotDir}/{testFileDir}/__snapshots__/{testFileName}-snapshots/{arg}{-projectName}{-platform}{ext}',

  /* Update snapshots settings */
  updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true' ? 'all' : 'missing',
  ignoreSnapshots: process.env.IGNORE_SNAPSHOTS === 'true',

  /* Default timeout and screenshot comparison settings */
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      /* Default visual comparison options */
      maxDiffPixels: 100,
      threshold: 0.2,
      animations: 'disabled',
      scale: 'css',
    },
  },

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot options for visual regression testing */
    screenshot: {
      mode: 'only-on-failure',
      fullPage: false,
    },

    /* Visual regression testing options */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    // Default - All tests (chromium only)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-blink-features=AutomationControlled',
            '--font-render-hinting=none',
            '--disable-font-subpixel-positioning',
          ],
        },
      },
    },

    /* Cross-browser testing (uncomment when needed) */
    /*{
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },*/

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
})
