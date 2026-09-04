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
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'cookies',
      // The OIDC provider suite has its own project: it drives browser-shaped
      // redirects against the provider rather than nauth's own API surface.
      testIgnore: /specs\/oidc\//,
      use: {
        baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
        extraHTTPHeaders: {
          Origin: process.env.TEST_FRONTEND_URL || 'http://localhost:4200',
        },
      },
    },
    {
      name: 'json',
      testIgnore: /specs\/oidc\//,
      use: {
        baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
        extraHTTPHeaders: {
          Origin: 'http://localhost', // capacitorjs
          'X-Forwarded-For': '203.97.24.118', // Default IP for JSON mode
        },
      },
    },
    {
      // OpenID Connect provider flows.
      //
      // Separate from the two token-delivery projects because it exercises a
      // different surface entirely: the provider owns the origin root (/oidc/*) and
      // is reached through redirects, while its interaction bridge is an ordinary
      // nauth route under /api. Cookie delivery is assumed throughout — the flow is
      // browser-shaped and the bridge needs nauth's session cookie.
      //
      // Run on its own with: npx playwright test --project oidc
      name: 'oidc',
      testMatch: /specs\/oidc\/.*\.spec\.ts/,
      use: {
        // Must be the **issuer origin**, which is not necessarily the API base URL the
        // other projects use: the provider is mounted at the origin root, and every
        // registered redirect URI is built from the issuer. In a single-origin
        // deployment (Caddy in front of both, or the dev proxy in examples/demo-angular)
        // that is the frontend origin. TEST_OIDC_BASE_URL sets it without disturbing the
        // cookies and json projects.
        baseURL: process.env.TEST_OIDC_BASE_URL || process.env.TEST_BASE_URL || 'http://localhost:3000',
        extraHTTPHeaders: {
          Origin: process.env.TEST_FRONTEND_URL || 'http://localhost:4200',
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
