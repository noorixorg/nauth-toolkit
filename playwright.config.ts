import { defineConfig } from '@playwright/test';

/**
 * Endpoint configuration for each project type
 * These endpoints are used by the test fixtures to determine which API paths to use
 */
export const PROJECT_ENDPOINTS = {
  cookies: {
    signup: '/auth/signup',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    verifyEmail: '/auth/verify/email',
    verifyPhone: '/auth/verify/phone',
    challenge: '/auth/challenge',
    respondChallenge: '/auth/respond-challenge', // Unified challenge API
    completeChallenge: '/auth/challenges/complete', // Legacy endpoint (deprecated)
    mfa: {
      setup: '/auth/mfa/setup',
      verify: '/auth/mfa/verify',
    },
  },
  json: {
    signup: '/mobile/auth/signup',
    login: '/mobile/auth/login',
    refresh: '/mobile/auth/refresh',
    logout: '/auth/logout',
    verifyEmail: '/auth/verify/email',
    verifyPhone: '/auth/verify/phone',
    challenge: '/auth/challenge',
    respondChallenge: '/auth/respond-challenge', // Unified challenge API
    completeChallenge: '/mobile/auth/challenges/complete', // Legacy endpoint (deprecated)
    mfa: {
      setup: '/auth/mfa/setup',
      verify: '/auth/mfa/verify',
    },
  },
} as const;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://api.angular.dev1.noorix.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // Enable request/response logging in console
    // This will show all HTTP requests and responses in the test output
  },
  // Enable full request/response logging for debugging
  // Set PLAYWRIGHT_DEBUG=1 to see all network requests
  globalSetup: undefined,
  projects: [
    {
      name: 'cookies',
      use: {
        baseURL: process.env.TEST_BASE_URL || 'https://api.angular.dev1.noorix.com',
        extraHTTPHeaders: {
          Origin: process.env.TEST_FRONTEND_URL || 'https://angular.dev1.noorix.com',
          //          'X-Forwarded-For': '192.168.1.100', // Default IP for cookie mode
        },
      },
    },
    {
      name: 'json',
      use: {
        baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
        extraHTTPHeaders: {
          Origin: 'http://localhost', // capacitorjs
          'X-Forwarded-For': '203.97.24.118', // Default IP for JSON mode
        },
      },
    },
  ],
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
  ],
});

//       '203.97.24.118', // Invercargill, New Zealand
//       '194.103.82.33', // Umeå, Sweden
//       '80.12.134.67', // La Rochelle, France
//       '124.148.98.45', // Port Hedland, Australia
//       '200.68.114.22', // Mar del Plata, Argentina
//       '213.216.200.77', // Oulu, Finland
//       '206.248.142.91', // Timmins, Canada
//       '95.43.18.140', // Plovdiv, Bulgaria
//       '110.164.231.162', // Surat Thani, Thailand
//       '190.186.7.20', // Cochabamba, Bolivia
