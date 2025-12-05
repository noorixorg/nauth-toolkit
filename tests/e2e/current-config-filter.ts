import { getConfigsForCurrentAuthConfig, type TestConfig } from './config-matrix';
import { authConfig } from '../../examples/sample-nestjs/src/config/auth.config';

/**
 * Current Config Filter Utility
 *
 * This utility determines which test configurations match the current auth.config.ts
 * and provides filtering functions for test files to use.
 *
 * This is separate from current-config.spec.ts to avoid Playwright's restriction
 * on test files importing other test files.
 */

/**
 * Extract relevant config values for test matching
 */
const rawTokenDelivery = authConfig.tokenDelivery?.method ?? 'cookies';
// Only support 'json' or 'cookies' for test matching
const tokenDelivery: 'cookies' | 'json' =
  rawTokenDelivery === 'json' || rawTokenDelivery === 'cookies' ? rawTokenDelivery : 'cookies';

const currentConfig = {
  verificationMethod: authConfig.signup?.verificationMethod ?? 'none',
  mfaEnforcement: authConfig.mfa?.enforcement ?? 'OPTIONAL',
  tokenDelivery,
};

/**
 * Get all test configs that match current auth.config.ts
 */
const matchingConfigs = getConfigsForCurrentAuthConfig(currentConfig);

// Store matching configs globally so test files can access them
// This allows test files to conditionally run based on current config
(globalThis as any).__CURRENT_CONFIG_MATCHING_CONFIGS__ = matchingConfigs;

/**
 * Check if a config should run based on current auth.config.ts
 * @param config - Test configuration to check
 * @returns true if config matches current auth.config.ts, false otherwise
 */
export function shouldRunConfig(config: TestConfig): boolean {
  // If no matching configs are set (not running via current-config), run all tests
  if (typeof (globalThis as any).__CURRENT_CONFIG_MATCHING_CONFIGS__ === 'undefined') {
    return true;
  }

  return matchingConfigs.some((match) => match.name === config.name);
}

/**
 * Generate tags from current config values
 * These tags reflect the actual auth.config.ts settings
 * Note: Excludes token delivery tag (@json/@cookies) as Playwright adds it automatically from project name
 * @returns Array of tags representing the current configuration
 */
export function getCurrentConfigTags(): string[] {
  const tags: string[] = [];

  // Don't add token delivery tag - Playwright automatically adds it from project name
  // tags.push(`@${currentConfig.tokenDelivery}`); // Removed - causes duplicate

  // Verification method tags
  if (currentConfig.verificationMethod === 'both') {
    tags.push('@email-phone');
  } else if (currentConfig.verificationMethod === 'email') {
    tags.push('@email');
  } else if (currentConfig.verificationMethod === 'phone') {
    tags.push('@phone');
  }

  // MFA enforcement tag
  if (currentConfig.mfaEnforcement === 'OPTIONAL') {
    tags.push('@mfa-optional');
  } else if (currentConfig.mfaEnforcement === 'REQUIRED') {
    tags.push('@mfa-required');
  } else if (currentConfig.mfaEnforcement === 'ADAPTIVE') {
    tags.push('@mfa-adaptive');
  }

  return tags;
}

/**
 * Get matching configs for current auth.config.ts
 * @returns Array of matching test configurations
 */
export function getMatchingConfigs(): TestConfig[] {
  return matchingConfigs;
}

/**
 * Get current config values
 * @returns Current config object
 */
export function getCurrentConfig() {
  return currentConfig;
}

/**
 * Helper to process test config for filtering and tagging
 * Handles the common pattern of checking if config should run and generating tags
 *
 * @param config - Test configuration to process
 * @returns Object with shouldSkip flag and tagSuffix string
 *
 * @example
 * ```typescript
 * const { shouldSkip, tagSuffix } = processTestConfig(config);
 * if (shouldSkip) {
 *   test.describe.skip(`Test: ${config.name} [SKIPPED]`, () => {
 *     test('Skipped', () => {});
 *   });
 *   continue;
 * }
 * test.describe(`Test: ${config.name}${tagSuffix}`, () => {
 *   // tests...
 * });
 * ```
 */
export function processTestConfig(config: TestConfig): { shouldSkip: boolean; tagSuffix: string } {
  // Skip if running via current-config and this config doesn't match
  const shouldSkip =
    typeof (globalThis as any).__CURRENT_CONFIG_MATCHING_CONFIGS__ !== 'undefined' && !shouldRunConfig(config);

  // Use tags from current config (if running via current-config) or from config matrix
  // This ensures tags reflect the actual auth.config.ts settings
  const currentConfigTags =
    typeof (globalThis as any).__CURRENT_CONFIG_MATCHING_CONFIGS__ !== 'undefined'
      ? getCurrentConfigTags()
      : config.tags.filter((tag) => tag !== '@json' && tag !== '@cookies');

  // Use pipe separator instead of brackets to avoid Playwright parsing issues
  const tagSuffix = currentConfigTags.length > 0 ? ` | ${currentConfigTags.join(' ')}` : '';

  return { shouldSkip, tagSuffix };
}
