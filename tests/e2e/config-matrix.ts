/**
 * Parameterized test configuration matrix
 *
 * Defines test configurations for different combinations of:
 * - Token delivery modes (cookies, json)
 * - Verification methods (none, email, phone, both)
 * - MFA enforcement (OPTIONAL, REQUIRED, ADAPTIVE)
 */

export type TestConfig = {
  name: string;
  tokenDelivery: 'cookies' | 'json';
  verificationMethod: 'none' | 'email' | 'phone' | 'both';
  mfaEnforcement: 'OPTIONAL' | 'REQUIRED' | 'ADAPTIVE';
  mfaGracePeriod: number;
  tags: string[];
};

/**
 * Test configurations for parameterized testing
 */
export const TEST_CONFIGS: TestConfig[] = [
  // Email-only signup flows
  {
    name: 'email-only-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'none',
    mfaEnforcement: 'OPTIONAL',
    mfaGracePeriod: 7,
    tags: ['@signup', '@email-only', '@cookies', '@no-verification'],
  },
  {
    name: 'email-only-json',
    tokenDelivery: 'json',
    verificationMethod: 'none',
    mfaEnforcement: 'OPTIONAL',
    mfaGracePeriod: 7,
    tags: ['@signup', '@email-only', '@json', '@no-verification'],
  },

  // Email-only with email verification
  {
    name: 'email-only-verify-email-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'email',
    mfaEnforcement: 'OPTIONAL',
    mfaGracePeriod: 7,
    tags: ['@signup', '@email-only', '@cookies', '@email-verification'],
  },
  {
    name: 'email-only-verify-email-json',
    tokenDelivery: 'json',
    verificationMethod: 'email',
    mfaEnforcement: 'OPTIONAL',
    mfaGracePeriod: 7,
    tags: ['@signup', '@email-only', '@json', '@email-verification'],
  },

  // Email + phone signup flows
  {
    name: 'email-phone-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'both',
    mfaEnforcement: 'OPTIONAL',
    mfaGracePeriod: 7,
    tags: ['@signup', '@email-phone', '@cookies', '@both-verification'],
  },
  {
    name: 'email-phone-json',
    tokenDelivery: 'json',
    verificationMethod: 'both',
    mfaEnforcement: 'OPTIONAL',
    mfaGracePeriod: 7,
    tags: ['@signup', '@email-phone', '@json', '@both-verification'],
  },

  // Email + phone with MFA required
  {
    name: 'email-phone-mfa-required-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'both',
    mfaEnforcement: 'REQUIRED',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-phone', '@cookies', '@mfa-required'],
  },
  {
    name: 'email-phone-mfa-required-json',
    tokenDelivery: 'json',
    verificationMethod: 'both',
    mfaEnforcement: 'REQUIRED',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-phone', '@json', '@mfa-required'],
  },

  // Email + phone with adaptive MFA
  {
    name: 'email-phone-mfa-adaptive-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'both',
    mfaEnforcement: 'ADAPTIVE',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-phone', '@cookies', '@mfa-adaptive'],
  },
  {
    name: 'email-phone-mfa-adaptive-json',
    tokenDelivery: 'json',
    verificationMethod: 'both',
    mfaEnforcement: 'ADAPTIVE',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-phone', '@json', '@mfa-adaptive'],
  },

  // Email-only with ADAPTIVE MFA
  {
    name: 'email-only-mfa-adaptive-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'none',
    mfaEnforcement: 'ADAPTIVE',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-only', '@cookies', '@mfa-adaptive', '@no-verification'],
  },
  {
    name: 'email-only-mfa-adaptive-json',
    tokenDelivery: 'json',
    verificationMethod: 'none',
    mfaEnforcement: 'ADAPTIVE',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-only', '@json', '@mfa-adaptive', '@no-verification'],
  },

  // Email-only with REQUIRED MFA
  {
    name: 'email-only-mfa-required-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'none',
    mfaEnforcement: 'REQUIRED',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-only', '@cookies', '@mfa-required', '@no-verification'],
  },
  {
    name: 'email-only-mfa-required-json',
    tokenDelivery: 'json',
    verificationMethod: 'none',
    mfaEnforcement: 'REQUIRED',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-only', '@json', '@mfa-required', '@no-verification'],
  },

  // Email verification with ADAPTIVE MFA
  {
    name: 'email-verify-mfa-adaptive-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'email',
    mfaEnforcement: 'ADAPTIVE',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-only', '@cookies', '@mfa-adaptive', '@email-verification'],
  },
  {
    name: 'email-verify-mfa-adaptive-json',
    tokenDelivery: 'json',
    verificationMethod: 'email',
    mfaEnforcement: 'ADAPTIVE',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-only', '@json', '@mfa-adaptive', '@email-verification'],
  },

  // Email verification with REQUIRED MFA
  {
    name: 'email-verify-mfa-required-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'email',
    mfaEnforcement: 'REQUIRED',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-only', '@cookies', '@mfa-required', '@email-verification'],
  },
  {
    name: 'email-verify-mfa-required-json',
    tokenDelivery: 'json',
    verificationMethod: 'email',
    mfaEnforcement: 'REQUIRED',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email-only', '@json', '@mfa-required', '@email-verification'],
  },

  // Phone verification only
  {
    name: 'phone-only-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'phone',
    mfaEnforcement: 'OPTIONAL',
    mfaGracePeriod: 7,
    tags: ['@signup', '@phone-only', '@cookies', '@phone-verification'],
  },
  {
    name: 'phone-only-json',
    tokenDelivery: 'json',
    verificationMethod: 'phone',
    mfaEnforcement: 'OPTIONAL',
    mfaGracePeriod: 7,
    tags: ['@signup', '@phone-only', '@json', '@phone-verification'],
  },

  // Phone verification with ADAPTIVE MFA
  {
    name: 'phone-only-mfa-adaptive-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'phone',
    mfaEnforcement: 'ADAPTIVE',
    mfaGracePeriod: 0,
    tags: ['@signup', '@phone-only', '@cookies', '@mfa-adaptive', '@phone-verification'],
  },
  {
    name: 'phone-only-mfa-adaptive-json',
    tokenDelivery: 'json',
    verificationMethod: 'phone',
    mfaEnforcement: 'ADAPTIVE',
    mfaGracePeriod: 0,
    tags: ['@signup', '@phone-only', '@json', '@mfa-adaptive', '@phone-verification'],
  },

  // Phone verification with REQUIRED MFA
  {
    name: 'phone-only-mfa-required-cookies',
    tokenDelivery: 'cookies',
    verificationMethod: 'phone',
    mfaEnforcement: 'REQUIRED',
    mfaGracePeriod: 0,
    tags: ['@signup', '@phone-only', '@cookies', '@mfa-required', '@phone-verification'],
  },
  {
    name: 'phone-only-mfa-required-json',
    tokenDelivery: 'json',
    verificationMethod: 'phone',
    mfaEnforcement: 'REQUIRED',
    mfaGracePeriod: 0,
    tags: ['@signup', '@phone-only', '@json', '@mfa-required', '@phone-verification'],
  },
];

/**
 * Get configurations filtered by tag
 * @param tag - Tag to filter by (e.g., '@signup', '@cookies', '@email-only')
 * @returns Array of matching configurations
 */
export function getConfigsByTag(tag: string): TestConfig[] {
  return TEST_CONFIGS.filter((config) => config.tags.includes(tag));
}

/**
 * Get configurations filtered by multiple tags (all must match)
 * @param tags - Array of tags to filter by
 * @returns Array of matching configurations
 */
export function getConfigsByTags(tags: string[]): TestConfig[] {
  return TEST_CONFIGS.filter((config) => tags.every((tag) => config.tags.includes(tag)));
}

/**
 * Get configuration by name
 * @param name - Configuration name
 * @returns Configuration or undefined if not found
 */
export function getConfig(name: string): TestConfig | undefined {
  return TEST_CONFIGS.find((c) => c.name === name);
}

/**
 * Filter configs by tag expression with OR/AND logic
 *
 * Supports complex filtering:
 * - OR logic: Config must have at least one of `orTags` (if provided)
 * - AND logic: Config must have all of `andTags` (if provided)
 *
 * @param orTags - Tags that match with OR logic (any one matches)
 * @param andTags - Tags that must all match (AND logic)
 * @returns Filtered configurations
 *
 * @example
 * ```typescript
 * // Get configs with @cookies AND @email-only
 * getConfigsByTagFilter(['@cookies'], ['@email-only'])
 *
 * // Get configs with @cookies OR @json (no AND requirement)
 * getConfigsByTagFilter(['@cookies', '@json'])
 *
 * // Get configs with all of these tags
 * getConfigsByTagFilter([], ['@email-only', '@cookies', '@no-verification'])
 * ```
 */
export function getConfigsByTagFilter(orTags: string[] = [], andTags: string[] = []): TestConfig[] {
  return TEST_CONFIGS.filter((config) => {
    // OR logic: config must have at least one of orTags (if provided)
    const matchesOr = orTags.length === 0 || orTags.some((tag) => config.tags.includes(tag));

    // AND logic: config must have all of andTags
    const matchesAnd = andTags.every((tag) => config.tags.includes(tag));

    return matchesOr && matchesAnd;
  });
}

/**
 * Get configs matching current auth.config.ts settings
 *
 * Automatically determines which tests to run based on actual config values.
 * This is useful for running tests that match your current development configuration.
 *
 * @param config - Auth configuration object
 * @param config.verificationMethod - Verification method setting
 * @param config.mfaEnforcement - MFA enforcement setting
 * @param config.tokenDelivery - Token delivery method
 * @returns Array of matching test configurations
 *
 * @example
 * ```typescript
 * const matchingConfigs = getConfigsForCurrentAuthConfig({
 *   verificationMethod: 'both',
 *   mfaEnforcement: 'OPTIONAL',
 *   tokenDelivery: 'json',
 * });
 * // Returns: ['email-phone-json']
 * ```
 */
export function getConfigsForCurrentAuthConfig(config: {
  verificationMethod: 'none' | 'email' | 'phone' | 'both';
  mfaEnforcement: 'OPTIONAL' | 'REQUIRED' | 'ADAPTIVE';
  tokenDelivery: 'cookies' | 'json';
}): TestConfig[] {
  return TEST_CONFIGS.filter(
    (testConfig) =>
      testConfig.verificationMethod === config.verificationMethod &&
      testConfig.mfaEnforcement === config.mfaEnforcement &&
      testConfig.tokenDelivery === config.tokenDelivery,
  );
}
