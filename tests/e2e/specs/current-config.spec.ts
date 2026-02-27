import { test, expect } from '../fixtures';
import { getMatchingConfigs, getCurrentConfig } from '../current-config-filter';

/**
 * Test Delegator for Current Config
 *
 * This file reads your current auth.config.ts and determines which tests should run.
 * It does NOT contain test logic - it delegates to other test files.
 *
 * The actual test logic is in:
 * - tests/e2e/specs/auth-lifecycle/complete-lifecycle.spec.ts
 * - tests/e2e/specs/auth-lifecycle/deferred-verification.spec.ts
 *
 * Usage:
 * 1. Update your auth.config.ts with desired settings
 * 2. Run: npx playwright test --project <json|cookies>
 *
 * The filter is automatically applied - only tests matching your current config will run.
 */

// Get matching configs (this also sets up the global filter)
const matchingConfigs = getMatchingConfigs();
const currentConfig = getCurrentConfig();

// Determine which Playwright project should run these tests
const expectedProject = currentConfig.tokenDelivery === 'json' ? 'json' : 'cookies';

// Build grep pattern to match config names (used for filtering tests in other files)
const configNames = matchingConfigs.map((c) => c.name).join('|');
const grepPattern = configNames ? `(${configNames})` : '';

console.log('\n' + '='.repeat(80));
console.log('Current Config Test Delegator');
console.log('='.repeat(80));
console.log(`Current auth.config.ts settings:`);
console.log(`  - verificationMethod: ${currentConfig.verificationMethod}`);
console.log(`  - mfaEnforcement: ${currentConfig.mfaEnforcement}`);
console.log(`  - tokenDelivery: ${currentConfig.tokenDelivery}`);
console.log(`\nMatching test configurations: ${matchingConfigs.length}`);
matchingConfigs.forEach((config) => {
  console.log(`  - ${config.name} [${config.tags.join(', ')}]`);
});
console.log(`\nExpected project: ${expectedProject}`);
console.log(`Grep pattern for filtering: ${grepPattern || '(none - no matching configs)'}`);
console.log('\n' + '='.repeat(80));
console.log('Delegating to other test files...');
console.log('='.repeat(80));
if (matchingConfigs.length > 0) {
  console.log(`\nTests from complete-lifecycle.spec.ts`);
  console.log(`   matching configs: ${configNames}`);
  console.log(`   will run automatically when you run:`);
  console.log(`   npx playwright test --project ${expectedProject}`);
  console.log(`\n   Or run specific test files:`);
  console.log(`   npx playwright test complete-lifecycle --project ${expectedProject} --grep "${grepPattern}"`);
  console.log(`\n   deferred-verification.spec.ts is enabled`);
} else {
  console.log(`\nWARNING: No matching test configurations found!`);
  console.log(`\nPlease add a matching configuration to tests/e2e/config-matrix.ts`);
  console.log(`or update your auth.config.ts to match an existing configuration.`);
}
console.log('='.repeat(80) + '\n');

if (matchingConfigs.length === 0) {
  test.describe('Current Config Tests', () => {
    test.skip(
      true,
      `No test configurations match your current auth.config.ts settings.

      Please add a matching configuration to tests/e2e/config-matrix.ts
      or update your auth.config.ts to match an existing configuration.

      See console output above for details.`,
    );
  });
} else {
  test.describe('Current Config Test Delegator', () => {
    test('Delegates to other test files', () => {
      // This test always passes - it's just a placeholder
      // The actual tests are in complete-lifecycle.spec.ts and deferred-verification.spec.ts
      // Those files will filter themselves based on matchingConfigs
      expect(matchingConfigs.length).toBeGreaterThan(0);
    });
  });
}
