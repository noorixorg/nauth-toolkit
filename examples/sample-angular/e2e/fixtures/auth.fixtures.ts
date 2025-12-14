import { test as base, APIRequestContext } from '@playwright/test';

/**
 * API base URL for backend requests
 */
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.angular.dev1.noorix.com';

/**
 * Type definitions for auth fixtures
 * Note: getVerificationCode removed - codes are extracted from toast on screen
 */
type AuthFixtures = {
  apiRequest: APIRequestContext;
  apiBaseUrl: string;
  getTotpSecret: (userId: string) => Promise<string>;
  generateTotpCode: (secret: string) => string;
};

/**
 * Extended test with auth-related fixtures
 *
 * Provides helpers for:
 * - API requests to backend
 * - Getting TOTP secrets
 * - Generating TOTP codes
 *
 * Note: Verification codes (SMS/Email) are extracted from toast notifications on screen,
 * not from API. This ensures toast functionality is tested.
 */
export const test = base.extend<AuthFixtures>({
  /**
   * API request context for making HTTP requests to backend
   */
  apiRequest: async ({ request }, use) => {
    await use(request);
  },

  /**
   * API base URL
   */
  // eslint-disable-next-line no-empty-pattern
  apiBaseUrl: async ({}, use) => {
    await use(API_BASE_URL);
  },

  /**
   * Get TOTP secret for a user from test controller
   *
   * @param userId - User ID
   * @returns TOTP secret
   *
   * @example
   * ```typescript
   * const secret = await getTotpSecret('user-id');
   * ```
   */
  getTotpSecret: async ({ apiRequest, apiBaseUrl }, use) => {
    const getSecret = async (userId: string): Promise<string> => {
      const response = await apiRequest.get(`${apiBaseUrl}/test/totp/secret?userId=${userId}`);
      if (!response.ok()) {
        throw new Error(`Failed to get TOTP secret: ${response.status()}`);
      }
      const data = await response.json();
      return data.secret;
    };
    await use(getSecret);
  },

  /**
   * Generate TOTP code from secret
   *
   * @param secret - TOTP secret
   * @returns 6-digit TOTP code
   *
   * @example
   * ```typescript
   * const code = generateTotpCode(secret);
   * ```
   */

  // eslint-disable-next-line no-empty-pattern
  generateTotpCode: async ({}, use) => {
    const { authenticator } = await import('otplib');

    // Configure otplib to use standard 30-second steps (matches backend and real authenticator apps)
    authenticator.options = {
      step: 30, // Standard 30 seconds (compatible with Google Authenticator, Authy, etc.)
      window: 1, // Check current + 1 step before/after
      digits: 6,
      algorithm: 'sha1',
    };

    const generate = (secret: string): string => {
      // Ensure options are set before each generation (in case they were reset)
      authenticator.options = {
        step: 30,
        window: 1,
        digits: 6,
        algorithm: 'sha1',
      };
      return authenticator.generate(secret);
    };
    await use(generate);
  },
});

export { expect } from '@playwright/test';
