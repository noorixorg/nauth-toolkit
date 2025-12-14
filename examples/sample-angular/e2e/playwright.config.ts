import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Angular sample app UI/flow testing
 *
 * This is separate from the root Playwright config which tests backend/core functionality.
 * This config focuses on testing the Angular frontend UI flows and user interactions.
 *
 * Slow Motion: Set SLOWMO environment variable (in milliseconds) to enable slow motion
 * Example: SLOWMO=1000 yarn e2e:headed
 */
const slowMo = process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : undefined;

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '../../playwright-report-angular' }],
    ['json', { outputFile: '../../playwright-results-angular.json' }],
  ],
  use: {
    baseURL: process.env.FRONTEND_URL || 'https://angular.dev1.noorix.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // Optional slow motion for visual debugging (in milliseconds)
    // Set SLOWMO env var: SLOWMO=1000 yarn e2e:headed
    ...(slowMo && {
      launchOptions: {
        slowMo,
      },
    }),
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2400, height: 1350 }, // Increased resolution by 25% from 1920x1080
      },
    },
  ],
  // Note: webServer is commented out since we're using live URLs
  // Uncomment if you want to test against local dev server:
  // webServer: {
  //   command: 'yarn start',
  //   url: 'http://localhost:4200',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
