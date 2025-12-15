import { test } from '../fixtures/auth.fixtures';
import { FlowBuilder } from '../utils/flow-builders';
import { SCENARIOS, getScenariosForConfig } from '../utils/scenarios';
import { getCurrentBackendConfig } from '../utils/current-config-filter';
import { faker } from '@faker-js/faker';

/**
 * Test runner for all scenarios
 *
 * Automatically filters scenarios based on current backend configuration
 * and executes matching test cases.
 */
const currentConfig = getCurrentBackendConfig();
const matchingScenarios = getScenariosForConfig(currentConfig);

console.log(`\n[Test Runner] Current config:`, currentConfig);
console.log(`[Test Runner] Matching scenarios: ${matchingScenarios.length}\n`);

test.describe('All Scenarios', () => {
  for (const scenario of matchingScenarios) {
    test.describe(scenario.name, () => {
      test(scenario.id, async ({ page, getTotpSecret, generateTotpCode }) => {
        // Set timeout for scenarios that need longer waits (e.g., TOTP login with 35s wait + retry)
        if (scenario.id === 'login-mfa-required-totp' || scenario.id === 'login-both-verification-mfa-required-totp') {
          test.setTimeout(180000); // 3 minutes for 35s wait + 35s retry + test execution
        }
        // Phase 10 complex scenario with logout/login and TOTP wait
        if (scenario.id === 'complete-flow-email-both-totp') {
          test.setTimeout(120000); // 2 minutes for 35s wait + test execution
        }
        console.log(`\n========== ${scenario.id} ==========`);

        const data = {
          email: faker.internet.email().toLowerCase(),
          password: 'Test123!@#',
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          phone: `+1${faker.string.numeric(10)}`,
        };

        const builder = new FlowBuilder(page, {
          getTotpSecret,
          generateTotpCode,
        });

        await scenario.execute(builder, data);

        console.log(`[Test Runner] ${scenario.id} completed successfully\n`);
      });
    });
  }
});
