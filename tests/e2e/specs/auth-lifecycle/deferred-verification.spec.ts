import { test, expect } from '../../fixtures';
import { getConfigsByTag } from '../../config-matrix';
import { processTestConfig } from '../../current-config-filter';

/**
 * Deferred verification tests
 *
 * Tests scenarios where users skip verification at signup and are challenged when they try to login.
 * This validates that the challenge system enforces verification even if skipped during signup.
 *
 * Scenarios:
 * 1. Email-only verification: Skip at signup → Login triggers VERIFY_EMAIL challenge
 * 2. Phone-only verification: Skip at signup → Login triggers VERIFY_PHONE challenge
 * 3. Both required:
 *    - 3a: Skip email at signup → Login triggers VERIFY_EMAIL → Complete email → Login triggers VERIFY_PHONE
 *    - 3b: Skip phone at signup → Complete email at signup → Login triggers VERIFY_PHONE
 *
 * When run via current-config.spec.ts, only tests matching the current auth.config.ts will run.
 */

// ✅ ENABLED: Deferred verification tests are now active
const DEFERRED_VERIFICATION_ENABLED = true;

if (DEFERRED_VERIFICATION_ENABLED) {
  // Scenario 1: Email-only verification (skip at signup, verify at login)
  const emailOnlyConfigs = getConfigsByTag('@email-only').filter((c) => c.verificationMethod === 'email');

  for (const config of emailOnlyConfigs) {
    const { shouldSkip, tagSuffix } = processTestConfig(config);

    if (shouldSkip) {
      test.describe
        .skip(`Deferred Verification - Email Only: ${config.name} [SKIPPED - doesn't match current config]`, () => {
        test('Skipped - config does not match current auth.config.ts', () => {});
      });
      continue;
    }

    test.describe(`Deferred Verification - Email Only: ${config.name}${tagSuffix}`, () => {
      // Skip entire suite if project doesn't match config's tokenDelivery
      test.beforeEach(({}, testInfo) => {
        const projectName = testInfo.project.name;
        const configTokenDelivery = config.tokenDelivery;
        if (
          (configTokenDelivery === 'json' && projectName === 'cookies') ||
          (configTokenDelivery === 'cookies' && projectName === 'json')
        ) {
          test.skip();
        }
      });
      test.use({
        authConfig: async ({}, use) => {
          await use({
            deliveryMode: config.tokenDelivery,
            verificationMethod: config.verificationMethod,
            mfaEnforcement: config.mfaEnforcement,
            mfaGracePeriod: config.mfaGracePeriod,
            // Endpoints are configured per project in playwright.config.ts via the endpoints fixture
            // Expectations use config.tokenDelivery (what the API returns), not project name
            expectCookies: () => config.tokenDelivery === 'cookies',
            expectJsonTokens: () => config.tokenDelivery === 'json',
            shouldVerifyEmail: () => config.verificationMethod === 'email' || config.verificationMethod === 'both',
            shouldVerifyPhone: () => config.verificationMethod === 'phone' || config.verificationMethod === 'both',
            shouldRequireMFA: () => config.mfaEnforcement === 'REQUIRED' || config.mfaEnforcement === 'ADAPTIVE',
          });
        },
      });

      test.describe.serial('Skip Email Verification at Signup, Verify at Login', () => {
        test(
          '1. Signup (skip email verification)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Email Verification`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Verification: ${config.verificationMethod}`,
              },
              {
                type: 'testSteps',
                description:
                  'POST /auth/signup (or /mobile) with email. Receive VERIFY_EMAIL challenge but do NOT complete it. User remains unverified.',
              },
              {
                type: 'testScenario',
                description: 'User skips email verification at signup, will be challenged on login',
              },
            ],
          },
          async ({ flows, flowState, authConfig, cookies }) => {
            const email = flowState.userEmail;

            const result = await flows.signup(email);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(201);

            // Should receive VERIFY_EMAIL challenge
            expect(result.data?.challengeName).toBe('VERIFY_EMAIL');
            expect(result.data?.session).toBeTruthy();

            // User should NOT have tokens yet (verification not complete)
            if (authConfig.expectJsonTokens()) {
              const body = await result.response!.json();
              expect(body).not.toHaveProperty('accessToken');
              expect(body).not.toHaveProperty('refreshToken');
            }

            if (authConfig.expectCookies()) {
              const parsedCookies = cookies.parseFromResponse(result.response!);
              expect(parsedCookies).not.toHaveProperty('nauth_access_token');
              expect(parsedCookies).not.toHaveProperty('nauth_refresh_token');
            }
          },
        );

        test(
          '2. Login (triggers email verification challenge)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Email Verification`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | User is unverified from previous step`,
              },
              {
                type: 'testSteps',
                description:
                  'POST /auth/login (or /mobile) with email and password. Should return VERIFY_EMAIL challenge since email is not verified.',
              },
              {
                type: 'testScenario',
                description: 'Login enforces verification that was skipped at signup',
              },
            ],
          },
          async ({ flows, flowState, authConfig }) => {
            const result = await flows.login(flowState.userEmail, flowState.password);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // Should receive VERIFY_EMAIL challenge (user is not verified)
            expect(result.data?.challengeName).toBe('VERIFY_EMAIL');
            expect(result.data?.session).toBeTruthy();

            // Should NOT have tokens yet
            if (authConfig.expectJsonTokens()) {
              const body = await result.response!.json();
              expect(body).not.toHaveProperty('accessToken');
              expect(body).not.toHaveProperty('refreshToken');
            }
          },
        );

        test(
          '3. Complete Email Verification (from login challenge)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Email Verification`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Completing verification from login challenge`,
              },
              {
                type: 'testSteps',
                description:
                  'Get email code from /test/email/latest → POST /auth/verify-email/verify → POST /auth/challenges/complete. Should receive tokens after verification.',
              },
            ],
          },
          async ({ flows, flowState, authConfig, mail, cookies }) => {
            const code = await mail.latestCode(flowState.challengeSession!);
            expect(code).toBeTruthy();

            const result = await flows.completeChallenge('VERIFY_EMAIL', code);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // Should have tokens now (verification complete)
            if (authConfig.expectCookies()) {
              const parsedCookies = cookies.parseFromResponse(result.response!);
              expect(parsedCookies).toHaveProperty('nauth_access_token');
              expect(parsedCookies).toHaveProperty('nauth_refresh_token');
            } else if (authConfig.expectJsonTokens()) {
              const body = await result.response!.json();
              expect(body).toHaveProperty('accessToken');
              expect(body).toHaveProperty('refreshToken');
            }
          },
        );
      });
    });
  }

  // Scenario 2: Phone-only verification (skip at signup, verify at login)
  // Note: Currently no phone-only configs in config-matrix.ts
  const phoneOnlyConfigs = getConfigsByTag('@signup').filter((c) => c.verificationMethod === 'phone');

  if (phoneOnlyConfigs.length === 0) {
    test.describe('Deferred Verification - Phone Only', () => {
      test.skip(
        true,
        'No phone-only verification configs found in config-matrix.ts. Add configs with verificationMethod: "phone" to test this scenario.',
      );
    });
  }

  for (const config of phoneOnlyConfigs) {
    const { shouldSkip, tagSuffix } = processTestConfig(config);

    if (shouldSkip) {
      test.describe
        .skip(`Deferred Verification - Phone Only: ${config.name} [SKIPPED - doesn't match current config]`, () => {
        test('Skipped - config does not match current auth.config.ts', () => {});
      });
      continue;
    }

    test.describe(`Deferred Verification - Phone Only: ${config.name}${tagSuffix}`, () => {
      // Skip entire suite if project doesn't match config's tokenDelivery
      test.beforeEach(({}, testInfo) => {
        const projectName = testInfo.project.name;
        const configTokenDelivery = config.tokenDelivery;
        if (
          (configTokenDelivery === 'json' && projectName === 'cookies') ||
          (configTokenDelivery === 'cookies' && projectName === 'json')
        ) {
          test.skip();
        }
      });
      test.use({
        authConfig: async ({}, use) => {
          await use({
            deliveryMode: config.tokenDelivery,
            verificationMethod: config.verificationMethod,
            mfaEnforcement: config.mfaEnforcement,
            mfaGracePeriod: config.mfaGracePeriod,
            // Endpoints are configured per project in playwright.config.ts via the endpoints fixture
            // Expectations use config.tokenDelivery (what the API returns), not project name
            expectCookies: () => config.tokenDelivery === 'cookies',
            expectJsonTokens: () => config.tokenDelivery === 'json',
            shouldVerifyEmail: () => config.verificationMethod === 'email' || config.verificationMethod === 'both',
            shouldVerifyPhone: () => config.verificationMethod === 'phone' || config.verificationMethod === 'both',
            shouldRequireMFA: () => config.mfaEnforcement === 'REQUIRED' || config.mfaEnforcement === 'ADAPTIVE',
          });
        },
      });

      test.describe.serial('Skip Phone Verification at Signup, Verify at Login', () => {
        test(
          '1. Signup (skip phone verification)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Phone Verification`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Verification: ${config.verificationMethod}`,
              },
              {
                type: 'testSteps',
                description:
                  'POST /auth/signup (or /mobile) with email and phone. Receive VERIFY_PHONE challenge but do NOT complete it. User remains unverified.',
              },
              {
                type: 'testScenario',
                description: 'User skips phone verification at signup, will be challenged on login',
              },
            ],
          },
          async ({ flows, flowState, authConfig, cookies }) => {
            const email = flowState.userEmail;
            const phone = flowState.userPhone;

            const result = await flows.signup(email, phone);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(201);

            // Should receive VERIFY_PHONE challenge
            expect(result.data?.challengeName).toBe('VERIFY_PHONE');
            expect(result.data?.session).toBeTruthy();

            // User should NOT have tokens yet (verification not complete)
            if (authConfig.expectJsonTokens()) {
              const body = await result.response!.json();
              expect(body).not.toHaveProperty('accessToken');
              expect(body).not.toHaveProperty('refreshToken');
            }

            if (authConfig.expectCookies()) {
              const parsedCookies = cookies.parseFromResponse(result.response!);
              expect(parsedCookies).not.toHaveProperty('nauth_access_token');
              expect(parsedCookies).not.toHaveProperty('nauth_refresh_token');
            }
          },
        );

        test(
          '2. Login (triggers phone verification challenge)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Phone Verification`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | User is unverified from previous step`,
              },
              {
                type: 'testSteps',
                description:
                  'POST /auth/login (or /mobile) with email and password. Should return VERIFY_PHONE challenge since phone is not verified.',
              },
              {
                type: 'testScenario',
                description: 'Login enforces verification that was skipped at signup',
              },
            ],
          },
          async ({ flows, flowState, authConfig }) => {
            const result = await flows.login(flowState.userEmail, flowState.password);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // Should receive VERIFY_PHONE challenge (user is not verified)
            expect(result.data?.challengeName).toBe('VERIFY_PHONE');
            expect(result.data?.session).toBeTruthy();

            // Store challenge session for next step
            flowState.challengeSession = result.data?.session;
            flowState.challengeName = result.data?.challengeName;

            // Should NOT have tokens yet
            if (authConfig.expectJsonTokens()) {
              const body = await result.response!.json();
              expect(body).not.toHaveProperty('accessToken');
              expect(body).not.toHaveProperty('refreshToken');
            }
          },
        );

        test(
          '3. Complete Phone Verification (from login challenge)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Phone Verification`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Completing verification from login challenge`,
              },
              {
                type: 'testSteps',
                description:
                  'Get SMS code from /test/sms/latest → POST /auth/verify-phone/verify → POST /auth/challenges/complete. Should receive tokens after verification.',
              },
            ],
          },
          async ({ flows, flowState, authConfig, sms, cookies }) => {
            // Ensure challenge session is set
            expect(flowState.challengeSession).toBeTruthy();
            expect(flowState.challengeSession).not.toBe('undefined');

            const code = await sms.latestCode(flowState.challengeSession!);
            expect(code).toBeTruthy();

            const result = await flows.completeChallenge('VERIFY_PHONE', code);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // Should have tokens now (verification complete)
            // Unless MFA setup required (when mfaGracePeriod === 0)
            if (authConfig.shouldRequireMFA() && authConfig.mfaGracePeriod === 0) {
              const body = await result.response!.json();
              expect(body.challengeName).toBe('MFA_SETUP_REQUIRED');
              expect(body.session).toBeDefined();
              // Store the MFA setup challenge session for next step (if needed)
              flowState.challengeSession = body.session;
            } else {
              if (authConfig.expectCookies()) {
                const parsedCookies = cookies.parseFromResponse(result.response!);
                expect(parsedCookies).toHaveProperty('nauth_access_token');
                expect(parsedCookies).toHaveProperty('nauth_refresh_token');
              } else if (authConfig.expectJsonTokens()) {
                const body = await result.response!.json();
                expect(body).toHaveProperty('accessToken');
                expect(body).toHaveProperty('refreshToken');
              }
            }
          },
        );
      });
    });
  }

  // Scenario 3: Both email and phone required
  const bothVerificationConfigs = getConfigsByTag('@email-phone');

  // 3a: Skip email at signup, verify email at login, then verify phone
  for (const config of bothVerificationConfigs) {
    const { shouldSkip, tagSuffix } = processTestConfig(config);

    if (shouldSkip) {
      test.describe
        .skip(`Deferred Verification - Both (3a: Skip Email): ${config.name} [SKIPPED - doesn't match current config]`, () => {
        test('Skipped - config does not match current auth.config.ts', () => {});
      });
      continue;
    }

    test.describe(`Deferred Verification - Both (3a: Skip Email): ${config.name}${tagSuffix}`, () => {
      // Skip entire suite if project doesn't match config's tokenDelivery
      test.beforeEach(({}, testInfo) => {
        const projectName = testInfo.project.name;
        const configTokenDelivery = config.tokenDelivery;
        if (
          (configTokenDelivery === 'json' && projectName === 'cookies') ||
          (configTokenDelivery === 'cookies' && projectName === 'json')
        ) {
          test.skip();
        }
      });
      test.use({
        authConfig: async ({}, use) => {
          await use({
            deliveryMode: config.tokenDelivery,
            verificationMethod: config.verificationMethod,
            mfaEnforcement: config.mfaEnforcement,
            mfaGracePeriod: config.mfaGracePeriod,
            // Endpoints are configured per project in playwright.config.ts via the endpoints fixture
            // Expectations use config.tokenDelivery (what the API returns), not project name
            expectCookies: () => config.tokenDelivery === 'cookies',
            expectJsonTokens: () => config.tokenDelivery === 'json',
            shouldVerifyEmail: () => config.verificationMethod === 'email' || config.verificationMethod === 'both',
            shouldVerifyPhone: () => config.verificationMethod === 'phone' || config.verificationMethod === 'both',
            shouldRequireMFA: () => config.mfaEnforcement === 'REQUIRED' || config.mfaEnforcement === 'ADAPTIVE',
          });
        },
      });

      test.describe.serial('Skip Email at Signup, Verify Email at Login, Then Phone', () => {
        test(
          '1. Signup (skip email verification)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3a: Skip Email)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Verification: ${config.verificationMethod}`,
              },
              {
                type: 'testSteps',
                description:
                  'POST /auth/signup (or /mobile) with email and phone. Receive VERIFY_EMAIL challenge but do NOT complete it.',
              },
              {
                type: 'testScenario',
                description: 'User skips email verification at signup, will be challenged on login',
              },
            ],
          },
          async ({ flows, flowState, authConfig, cookies }) => {
            const email = flowState.userEmail;
            const phone = flowState.userPhone;

            const result = await flows.signup(email, phone);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(201);

            // Should receive VERIFY_EMAIL challenge (first challenge)
            expect(result.data?.challengeName).toBe('VERIFY_EMAIL');
            expect(result.data?.session).toBeTruthy();

            // User should NOT have tokens yet
            if (authConfig.expectJsonTokens()) {
              const body = await result.response!.json();
              expect(body).not.toHaveProperty('accessToken');
            }

            if (authConfig.expectCookies()) {
              const parsedCookies = cookies.parseFromResponse(result.response!);
              expect(parsedCookies).not.toHaveProperty('nauth_access_token');
            }
          },
        );

        test(
          '2. Login (triggers email verification challenge)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3a: Skip Email)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Email not verified, phone not verified`,
              },
              {
                type: 'testSteps',
                description:
                  'POST /auth/login (or /mobile) with email and password. Should return VERIFY_EMAIL challenge (email must be verified first).',
              },
            ],
          },
          async ({ flows, flowState, authConfig }) => {
            const result = await flows.login(flowState.userEmail, flowState.password);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // Should receive VERIFY_EMAIL challenge (email not verified)
            expect(result.data?.challengeName).toBe('VERIFY_EMAIL');
            expect(result.data?.session).toBeTruthy();
          },
        );

        test(
          '3. Complete Email Verification (from login challenge)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3a: Skip Email)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Completing email verification from login challenge`,
              },
              {
                type: 'testSteps',
                description:
                  'Get email code from /test/email/latest → POST /auth/verify-email/verify → POST /auth/challenges/complete. Should receive VERIFY_PHONE challenge (next step).',
              },
            ],
          },
          async ({ flows, flowState, authConfig, mail }) => {
            const code = await mail.latestCode(flowState.challengeSession!);
            expect(code).toBeTruthy();

            const result = await flows.completeChallenge('VERIFY_EMAIL', code);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // Should receive VERIFY_PHONE challenge (next verification required)
            expect(result.data?.challengeName).toBe('VERIFY_PHONE');
            expect(result.data?.session).toBeTruthy();

            // Should NOT have tokens yet (phone still not verified)
            if (authConfig.expectJsonTokens()) {
              const body = await result.response!.json();
              expect(body).not.toHaveProperty('accessToken');
            }
          },
        );

        test(
          '4. Login Again (triggers phone verification challenge)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3a: Skip Email)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Email verified, phone not verified`,
              },
              {
                type: 'testSteps',
                description:
                  'POST /auth/login (or /mobile) with email and password. Should return VERIFY_PHONE challenge since phone is not verified.',
              },
            ],
          },
          async ({ flows, flowState, authConfig }) => {
            const result = await flows.login(flowState.userEmail, flowState.password);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // Should receive VERIFY_PHONE challenge (phone not verified)
            expect(result.data?.challengeName).toBe('VERIFY_PHONE');
            expect(result.data?.session).toBeTruthy();
          },
        );

        test(
          '5. Complete Phone Verification',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3a: Skip Email)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Completing phone verification`,
              },
              {
                type: 'testSteps',
                description:
                  'Get SMS code from /test/sms/latest → POST /auth/verify-phone/verify → POST /auth/challenges/complete. Should receive tokens after both verifications complete.',
              },
            ],
          },
          async ({ flows, flowState, authConfig, sms, cookies }) => {
            // Ensure challenge session is set
            expect(flowState.challengeSession).toBeTruthy();
            expect(flowState.challengeSession).not.toBe('undefined');

            const code = await sms.latestCode(flowState.challengeSession!);
            expect(code).toBeTruthy();

            const result = await flows.completeChallenge('VERIFY_PHONE', code);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // Should have tokens now (both verifications complete)
            // Unless MFA setup required
            if (authConfig.shouldRequireMFA() && authConfig.mfaGracePeriod === 0) {
              const body = await result.response!.json();
              // Debug: Log the actual response if assertion fails
              if (!body.challengeName) {
                console.error('Expected MFA_SETUP_REQUIRED challenge but got:', JSON.stringify(body, null, 2));
              }
              expect(body.challengeName).toBe('MFA_SETUP_REQUIRED');
              expect(body.session).toBeDefined();
              // Store the MFA setup challenge session for next step
              flowState.challengeSession = body.session;
            } else {
              if (authConfig.expectCookies()) {
                const parsedCookies = cookies.parseFromResponse(result.response!);
                expect(parsedCookies).toHaveProperty('nauth_access_token');
              } else if (authConfig.expectJsonTokens()) {
                const body = await result.response!.json();
                expect(body).toHaveProperty('accessToken');
              }
            }
          },
        );
      });
    });

    // 3b: Complete email at signup, skip phone, verify phone at login
    const { shouldSkip: shouldSkip3b, tagSuffix: tagSuffix3b } = processTestConfig(config);

    if (shouldSkip3b) {
      test.describe
        .skip(`Deferred Verification - Both (3b: Skip Phone): ${config.name} [SKIPPED - doesn't match current config]`, () => {
        test('Skipped - config does not match current auth.config.ts', () => {});
      });
      continue;
    }

    test.describe(`Deferred Verification - Both (3b: Skip Phone): ${config.name}${tagSuffix3b}`, () => {
      // Skip entire suite if project doesn't match config's tokenDelivery
      test.beforeEach(({}, testInfo) => {
        const projectName = testInfo.project.name;
        const configTokenDelivery = config.tokenDelivery;
        if (
          (configTokenDelivery === 'json' && projectName === 'cookies') ||
          (configTokenDelivery === 'cookies' && projectName === 'json')
        ) {
          test.skip();
        }
      });
      test.use({
        authConfig: async ({}, use) => {
          await use({
            deliveryMode: config.tokenDelivery,
            verificationMethod: config.verificationMethod,
            mfaEnforcement: config.mfaEnforcement,
            mfaGracePeriod: config.mfaGracePeriod,
            // Endpoints are configured per project in playwright.config.ts via the endpoints fixture
            // Expectations use config.tokenDelivery (what the API returns), not project name
            expectCookies: () => config.tokenDelivery === 'cookies',
            expectJsonTokens: () => config.tokenDelivery === 'json',
            shouldVerifyEmail: () => config.verificationMethod === 'email' || config.verificationMethod === 'both',
            shouldVerifyPhone: () => config.verificationMethod === 'phone' || config.verificationMethod === 'both',
            shouldRequireMFA: () => config.mfaEnforcement === 'REQUIRED' || config.mfaEnforcement === 'ADAPTIVE',
          });
        },
      });

      test.describe.serial('Complete Email at Signup, Skip Phone, Verify Phone at Login', () => {
        test(
          '1. Signup (receive email verification challenge)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3b: Skip Phone)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Verification: ${config.verificationMethod}`,
              },
              {
                type: 'testSteps',
                description: 'POST /auth/signup (or /mobile) with email and phone. Receive VERIFY_EMAIL challenge.',
              },
            ],
          },
          async ({ flows, flowState, authConfig, cookies }) => {
            const email = flowState.userEmail;
            const phone = flowState.userPhone;

            const result = await flows.signup(email, phone);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(201);

            // Should receive VERIFY_EMAIL challenge (first challenge)
            expect(result.data?.challengeName).toBe('VERIFY_EMAIL');
            expect(result.data?.session).toBeTruthy();
          },
        );

        test(
          '2. Complete Email Verification (at signup)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3b: Skip Phone)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Completing email verification at signup`,
              },
              {
                type: 'testSteps',
                description:
                  'Get email code from /test/email/latest → POST /auth/verify-email/verify → POST /auth/challenges/complete. Should receive VERIFY_PHONE challenge but we will skip it.',
              },
            ],
          },
          async ({ flows, flowState, authConfig, mail }) => {
            const code = await mail.latestCode(flowState.challengeSession!);
            expect(code).toBeTruthy();

            const result = await flows.completeChallenge('VERIFY_EMAIL', code);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // Should receive VERIFY_PHONE challenge (next step)
            expect(result.data?.challengeName).toBe('VERIFY_PHONE');
            expect(result.data?.session).toBeTruthy();

            // Should NOT have tokens yet (phone not verified)
            if (authConfig.expectJsonTokens()) {
              const body = await result.response!.json();
              expect(body).not.toHaveProperty('accessToken');
            }
          },
        );

        test(
          '3. Skip Phone Verification (do not complete VERIFY_PHONE challenge)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3b: Skip Phone)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Email verified, phone not verified`,
              },
              {
                type: 'testSteps',
                description:
                  'Do NOT complete the VERIFY_PHONE challenge. User remains with email verified but phone unverified.',
              },
              {
                type: 'testScenario',
                description: 'User skips phone verification, will be challenged on login',
              },
            ],
          },
          async ({}) => {
            // Intentionally do nothing - phone verification is skipped
            // This test just documents that we're skipping phone verification
          },
        );

        test(
          '4. Login (triggers phone verification challenge)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3b: Skip Phone)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Email verified, phone not verified`,
              },
              {
                type: 'testSteps',
                description:
                  'POST /auth/login (or /mobile) with email and password. Should return VERIFY_PHONE challenge since phone is not verified.',
              },
              {
                type: 'testScenario',
                description: 'Login enforces phone verification that was skipped at signup',
              },
            ],
          },
          async ({ flows, flowState, authConfig }) => {
            const result = await flows.login(flowState.userEmail, flowState.password);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // Should receive VERIFY_PHONE challenge (phone not verified)
            expect(result.data?.challengeName).toBe('VERIFY_PHONE');
            expect(result.data?.session).toBeTruthy();

            // Should NOT have tokens yet
            if (authConfig.expectJsonTokens()) {
              const body = await result.response!.json();
              expect(body).not.toHaveProperty('accessToken');
              expect(body).not.toHaveProperty('refreshToken');
            }
          },
        );

        test(
          '5. Complete Phone Verification (from login challenge)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3b: Skip Phone)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | Completing phone verification from login challenge`,
              },
              {
                type: 'testSteps',
                description:
                  'Get SMS code from /test/sms/latest → POST /auth/verify-phone/verify → POST /auth/challenges/complete. Should receive tokens after verification.',
              },
            ],
          },
          async ({ flows, flowState, authConfig, sms, cookies }) => {
            // Ensure challenge session is set
            expect(flowState.challengeSession).toBeTruthy();
            expect(flowState.challengeSession).not.toBe('undefined');

            const code = await sms.latestCode(flowState.challengeSession!);
            expect(code).toBeTruthy();

            const result = await flows.completeChallenge('VERIFY_PHONE', code);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // Should have tokens now (both verifications complete)
            // Unless MFA setup required
            if (authConfig.shouldRequireMFA() && authConfig.mfaGracePeriod === 0) {
              const body = await result.response!.json();
              // Debug: Log the actual response if assertion fails
              if (!body.challengeName) {
                console.error('Expected MFA_SETUP_REQUIRED challenge but got:', JSON.stringify(body, null, 2));
              }
              expect(body.challengeName).toBe('MFA_SETUP_REQUIRED');
              expect(body.session).toBeDefined();
              // Store the MFA setup challenge session for next step
              flowState.challengeSession = body.session;
            } else {
              if (authConfig.expectCookies()) {
                const parsedCookies = cookies.parseFromResponse(result.response!);
                expect(parsedCookies).toHaveProperty('nauth_access_token');
              } else if (authConfig.expectJsonTokens()) {
                const body = await result.response!.json();
                expect(body).toHaveProperty('accessToken');
              }
            }
          },
        );

        test(
          '5b. Complete MFA Setup (if required)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3b: Skip Phone)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | MFA: ${config.mfaEnforcement} (grace: ${config.mfaGracePeriod}d)`,
              },
              {
                type: 'testSteps',
                description:
                  'Get SMS code from /test/sms/latest → POST /auth/mfa/sms/verify-setup-challenge → POST /auth/challenges/complete. Only runs if MFA required with no grace period.',
              },
              {
                type: 'skipCondition',
                description: 'Skipped if MFA not required or grace period > 0',
              },
            ],
          },
          async ({ flows, flowState, authConfig, sms, cookies, api, baseURL, endpoints }) => {
            test.skip(
              !(authConfig.shouldRequireMFA() && authConfig.mfaGracePeriod === 0),
              'MFA setup not required or grace period active',
            );

            // For MFA setup, we need to send a new SMS code first
            // The phone verification code was already used, so we need to trigger sending a new one
            // Use the unified challenge API: /auth/challenge/setup-data
            const sendCodeResponse = await api.post(`${baseURL}/auth/challenge/setup-data`, {
              data: {
                session: flowState.challengeSession,
                method: 'sms',
              },
            });
            expect(sendCodeResponse.status()).toBe(200);

            const setupBody = await sendCodeResponse.json();
            // Response is wrapped in GetSetupDataResponseDTO with setupData property
            const setupResult = setupBody.setupData || setupBody;

            // Check if setup was auto-completed (phone already verified)
            if (setupResult.autoCompleted) {
              // Phone was already verified - setup is complete, just respond to challenge
              // Use unified respondToChallenge API
              const result = await api.post(`${baseURL}${endpoints.respondChallenge}`, {
                data: {
                  type: 'MFA_SETUP_REQUIRED',
                  session: flowState.challengeSession,
                  method: 'sms',
                  setupData: {}, // Empty since auto-completed
                },
              });
              expect(result.status()).toBe(200);

              // Should have tokens now (MFA setup complete)
              if (authConfig.expectCookies()) {
                const parsedCookies = cookies.parseFromResponse(result);
                expect(parsedCookies).toHaveProperty('nauth_access_token');
              } else if (authConfig.expectJsonTokens()) {
                const body = await result.json();
                expect(body).toHaveProperty('accessToken');
              }
            } else {
              // Phone not verified - wait for SMS code and verify it
              // Wait a bit for SMS to be sent and stored
              await new Promise((resolve) => setTimeout(resolve, 500));

              // Get the new SMS code for MFA setup
              const code = await sms.latestCode(flowState.challengeSession!);
              expect(code).toBeTruthy();

              const result = await flows.completeMFASetupChallenge(code);
              expect(result.success).toBe(true);
              expect(result.response?.status()).toBe(200);

              // Should have tokens now (MFA setup complete)
              if (authConfig.expectCookies()) {
                const parsedCookies = cookies.parseFromResponse(result.response!);
                expect(parsedCookies).toHaveProperty('nauth_access_token');
              } else if (authConfig.expectJsonTokens()) {
                const body = await result.response!.json();
                expect(body).toHaveProperty('accessToken');
              }
            }
          },
        );

        test(
          '6. Login Again (should succeed, user is now fully verified)',
          {
            annotation: [
              {
                type: 'testId',
                description: `Config: ${config.name} - Deferred Both Verification (3b: Skip Phone)`,
              },
              {
                type: 'testDetails',
                description: `Token Delivery: ${config.tokenDelivery} | User is now fully verified`,
              },
              {
                type: 'testSteps',
                description:
                  'POST /auth/login (or /mobile) with email and password. Should succeed and return tokens since both verifications are complete.',
              },
            ],
          },
          async ({ flows, flowState, authConfig, cookies, sms, api, baseURL }) => {
            const result = await flows.login(flowState.userEmail, flowState.password);

            expect(result.success).toBe(true);
            expect(result.response?.status()).toBe(200);

            // If MFA is required, login will return MFA_REQUIRED challenge
            if (authConfig.shouldRequireMFA() && result.data?.challengeName === 'MFA_REQUIRED') {
              // SMS code is now sent automatically when MFA_REQUIRED challenge is created
              // (if SMS is the user's preferred MFA method)

              // Wait for SMS to be sent
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // Complete MFA verification
              const mfaCode = await sms.latestCode(flowState.challengeSession!);
              expect(mfaCode).toBeTruthy();

              const mfaResult = await flows.verifyMFA(mfaCode);
              expect(mfaResult.success).toBe(true);
              expect(mfaResult.response?.status()).toBe(200);

              // Now should have tokens
              if (authConfig.expectCookies()) {
                const parsedCookies = cookies.parseFromResponse(mfaResult.response!);
                expect(parsedCookies).toHaveProperty('nauth_access_token');
                expect(parsedCookies).toHaveProperty('nauth_refresh_token');
              } else if (authConfig.expectJsonTokens()) {
                const body = await mfaResult.response!.json();
                expect(body).toHaveProperty('accessToken');
                expect(body).toHaveProperty('refreshToken');
              }
              return;
            }

            // Should NOT have challenge (user is verified and MFA not required)
            expect(result.data?.challengeName).toBeUndefined();

            // Should have tokens
            if (authConfig.expectCookies()) {
              const parsedCookies = cookies.parseFromResponse(result.response!);
              expect(parsedCookies).toHaveProperty('nauth_access_token');
              expect(parsedCookies).toHaveProperty('nauth_refresh_token');
            } else if (authConfig.expectJsonTokens()) {
              const body = await result.response!.json();
              expect(body).toHaveProperty('accessToken');
              expect(body).toHaveProperty('refreshToken');
            }
          },
        );
      });
    });
  }
}
