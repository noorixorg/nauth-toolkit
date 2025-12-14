/**
 * Test configuration constants
 * Centralized timeout, delay, and retry settings for E2E tests
 */
export const TEST_CONFIG = {
  TIMEOUTS: {
    PAGE_LOAD: 10000,
    TOAST_APPEAR: 3000,
    CODE_GENERATION: 5000,
    RESEND_TIMER: 30000,
    NAVIGATION: 15000,
  },

  DELAYS: {
    AFTER_SIGNUP: 1000,
    AFTER_LOGIN: 1000,
    TOAST_FETCH: 2000,
    AFTER_ACTION: 500,
  },

  RETRIES: {
    CODE_FETCH: 3,
    TOTP_VERIFY: 2,
    NAVIGATION: 2,
  },
};

