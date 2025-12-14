import { test, expect } from '../../fixtures';
import { getConfigsByTag } from '../../config-matrix';
import { processTestConfig } from '../../current-config-filter';

/**
 * Complete authentication lifecycle tests
 * Tests full flow: Signup → Verification → Login → Refresh → Logout
 * Tests all token delivery modes (cookies, json) and all verification methods
 *
 * This is the comprehensive test that covers the entire authentication lifecycle
 * for all configurations in the config matrix.
 *
 * When run via current-config.spec.ts, only tests matching the current auth.config.ts will run.
 */
const configs = getConfigsByTag('@signup');

for (const config of configs) {
  const { shouldSkip, tagSuffix } = processTestConfig(config);

  if (shouldSkip) {
    test.describe.skip(`Complete Lifecycle: ${config.name} [SKIPPED - doesn't match current config]`, () => {
      test('Skipped - config does not match current auth.config.ts', () => {});
    });
    continue;
  }

  // Create test describe with conditional skip based on project mismatch
  // We need to check project name at test execution time, not at file load time
  test.describe(`Complete Lifecycle: ${config.name}${tagSuffix}`, () => {
    // Skip entire test suite if tokenDelivery doesn't match the Playwright project
    test.beforeAll(({}, testInfo) => {
      const projectName = testInfo.project.name;
      const configTokenDelivery = config.tokenDelivery;
      if (
        (configTokenDelivery === 'json' && projectName === 'cookies') ||
        (configTokenDelivery === 'cookies' && projectName === 'json')
      ) {
        test.skip();
      }
    });
    // Override authConfig fixture with config values
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

    test.describe.serial('Complete Authentication Lifecycle', () => {
      test(
        '1. Signup',
        {
          annotation: [
            {
              type: 'testId',
              description: `Config: ${config.name}`,
            },
            {
              type: 'testDetails',
              description: `Token Delivery: ${config.tokenDelivery} | Verification: ${config.verificationMethod} | MFA: ${config.mfaEnforcement} (grace: ${config.mfaGracePeriod}d)`,
            },
            {
              type: 'testSteps',
              description:
                'POST /auth/signup (or /mobile) with email and optional phone. Expect challenge if verification required, tokens if not.',
            },
          ],
        },
        async ({ flows, flowState, authConfig, cookies }) => {
          const email = flowState.userEmail;
          // Use phone from flowState if phone verification is required
          const phone = authConfig.shouldVerifyPhone() ? flowState.userPhone : undefined;

          const result = await flows.signup(email, phone);

          expect(result.success).toBe(true);
          expect(result.response?.status()).toBe(201);

          // Check expected challenge based on config
          // Sequential flow: VERIFY_EMAIL first, then VERIFY_PHONE after email is verified
          if (authConfig.verificationMethod === 'both') {
            expect(result.data?.challengeName).toBeTruthy();
            expect(result.data?.challengeName).toBe('VERIFY_EMAIL');
            // Store challenge session for next step
            flowState.challengeSession = result.data?.session;
            flowState.challengeName = result.data?.challengeName;
          } else if (authConfig.shouldVerifyEmail()) {
            expect(result.data?.challengeName).toBe('VERIFY_EMAIL');
            // Store challenge session for next step
            flowState.challengeSession = result.data?.session;
            flowState.challengeName = result.data?.challengeName;
          } else if (authConfig.shouldVerifyPhone()) {
            expect(result.data?.challengeName).toBe('VERIFY_PHONE');
            // Store challenge session for next step
            flowState.challengeSession = result.data?.session;
            flowState.challengeName = result.data?.challengeName;
          } else {
            // No verification required - check if MFA setup is required
            // For ADAPTIVE/REQUIRED MFA with gracePeriod=0, signup should return MFA_SETUP_REQUIRED
            if (authConfig.shouldRequireMFA() && config.mfaGracePeriod === 0) {
              expect(result.data?.challengeName).toBe('MFA_SETUP_REQUIRED');
              expect(result.data?.session).toBeTruthy();
              // Store challenge session for next step
              flowState.challengeSession = result.data?.session;
              flowState.challengeName = result.data?.challengeName;
            } else {
              // No verification and no immediate MFA setup - should have tokens
              if (authConfig.expectJsonTokens()) {
                const body = await result.response!.json();
                expect(body).toHaveProperty('accessToken');
                expect(body).toHaveProperty('refreshToken');
              }

              if (authConfig.expectCookies()) {
                const parsedCookies = cookies.parseFromResponse(result.response!);
                expect(parsedCookies).toHaveProperty('nauth_access_token');
                expect(parsedCookies).toHaveProperty('nauth_refresh_token');
              }
            }
          }
        },
      );

      test(
        '2. Complete Email Verification (if required)',
        {
          annotation: [
            {
              type: 'testId',
              description: `Config: ${config.name}`,
            },
            {
              type: 'testDetails',
              description: `Token Delivery: ${config.tokenDelivery} | Verification: ${config.verificationMethod} | MFA: ${config.mfaEnforcement}`,
            },
            {
              type: 'testSteps',
              description:
                'Test resend code (after 60s delay) → Get email code from /test/email/latest → POST /auth/verify-email/verify → POST /auth/challenges/complete',
            },
            {
              type: 'skipCondition',
              description: 'Skipped if email verification not required',
            },
          ],
        },
        async ({ flows, flowState, authConfig, mail, cookies }) => {
          test.skip(!authConfig.shouldVerifyEmail(), 'Email verification not required');

          // Ensure challenge session is set from signup
          expect(flowState.challengeSession).toBeTruthy();
          expect(flowState.challengeSession).not.toBe('undefined');
          const challengeSession = flowState.challengeSession!;

          // Test resend code functionality (resendDelay is 0 in config, so no wait needed)
          const resendResult = await flows.resendCode();
          expect(resendResult.success).toBe(true);
          expect(resendResult.data?.destination).toBeTruthy();

          // Wait a moment for the new code to be sent
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Get the new code using the same challenge session (resend doesn't create a new session)
          const code = await mail.latestCode(challengeSession);
          expect(code).toBeTruthy();
          expect(code).not.toBe('');

          const result = await flows.completeChallenge('VERIFY_EMAIL', code);

          expect(result.success).toBe(true);
          expect(result.response?.status()).toBe(200);

          // Check if there's another challenge (phone) or tokens
          if (authConfig.verificationMethod === 'both') {
            expect(result.data?.challengeName).toBe('VERIFY_PHONE');
          } else {
            // Should have tokens now (email-only verification complete)
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
        '3. Complete Phone Verification (if required)',
        {
          annotation: [
            {
              type: 'testId',
              description: `Config: ${config.name}`,
            },
            {
              type: 'testDetails',
              description: `Token Delivery: ${config.tokenDelivery} | Verification: ${config.verificationMethod} | MFA: ${config.mfaEnforcement} (grace: ${config.mfaGracePeriod}d)`,
            },
            {
              type: 'testSteps',
              description:
                'Get SMS code from /test/sms/latest → POST /auth/verify-phone/verify → POST /auth/challenges/complete. May trigger MFA_SETUP_REQUIRED if MFA required with no grace period.',
            },
            {
              type: 'skipCondition',
              description: 'Skipped if phone verification not required',
            },
          ],
        },
        async ({ flows, flowState, authConfig, sms, cookies }) => {
          test.skip(!authConfig.shouldVerifyPhone(), 'Phone verification not required');

          // Ensure challenge session is set
          expect(flowState.challengeSession).toBeTruthy();
          expect(flowState.challengeSession).not.toBe('undefined');

          // Store the challenge session before resend (resend doesn't change the session)
          const challengeSession = flowState.challengeSession!;

          // Test resend code functionality (resendDelay is 0 in config, so no wait needed)
          const resendResult = await flows.resendCode();
          expect(resendResult.success).toBe(true);
          expect(resendResult.data?.destination).toBeTruthy();

          // Wait a moment for the new code to be sent
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Get the new code using the same challenge session (resend doesn't create a new session)
          const code = await sms.latestCode(challengeSession);
          expect(code).toBeTruthy();

          const result = await flows.completeChallenge('VERIFY_PHONE', code);

          expect(result.success).toBe(true);
          expect(result.response?.status()).toBe(200);

          // Should have tokens now (unless MFA setup required)
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
            // Check tokens based on delivery mode
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
        '3b. Complete MFA Setup (if required)',
        {
          annotation: [
            {
              type: 'testId',
              description: `Config: ${config.name}`,
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
          // Skip if MFA not required, grace period active, or if email-only config
          // Email-only users (verificationMethod: 'none' or 'email') cannot set up SMS MFA
          // without completing phone verification first. This would require TOTP/Passkey providers.
          const isEmailOnly = authConfig.verificationMethod === 'none' || authConfig.verificationMethod === 'email';
          const skipReason = !(authConfig.shouldRequireMFA() && authConfig.mfaGracePeriod === 0)
            ? 'MFA setup not required or grace period active'
            : isEmailOnly
              ? 'Email-only config - cannot set up SMS MFA without phone (TOTP/Passkey providers may not be configured)'
              : null;

          test.skip(skipReason !== null, skipReason || '');

          // For MFA setup, use TOTP for email-only scenarios or SMS if phone verification was completed
          // Use TOTP if: no phone in config OR phone verification was required but not completed
          const mfaMethod = authConfig.shouldVerifyPhone() && flowState.userPhone ? 'sms' : 'totp';

          // Step 1: Get setup data using the unified challenge API
          const setupDataResponse = await api.post(`${baseURL}/auth/challenge/setup-data`, {
            data: {
              session: flowState.challengeSession,
              method: mfaMethod,
            },
          });

          // Debug: Log error if request fails
          if (setupDataResponse.status() !== 200) {
            const errorBody = await setupDataResponse.json();
            console.log('Setup data request failed:', {
              status: setupDataResponse.status(),
              error: errorBody,
              challengeSession: flowState.challengeSession,
              method: mfaMethod,
            });
          }

          expect(setupDataResponse.status()).toBe(200);

          const setupBody = await setupDataResponse.json();
          // Response is wrapped in GetSetupDataResponseDTO with setupData property
          const setupResult = setupBody.setupData || setupBody;

          if (mfaMethod === 'totp') {
            // TOTP setup - generate code from secret
            expect(setupBody.secret).toBeTruthy();
            flowState.mfaSecret = setupBody.secret;

            // Generate TOTP code dynamically using otplib
            const { authenticator } = await import('otplib');
            console.log('TOTP setup:', { secret: setupBody.secret, secretLength: setupBody.secret?.length });
            const totpCode = authenticator.generate(setupBody.secret);
            console.log('Generated TOTP code:', totpCode);

            // Step 2: Complete MFA setup by verifying TOTP code
            const result = await api.post(`${baseURL}${endpoints.respondChallenge}`, {
              data: {
                type: 'MFA_SETUP_REQUIRED',
                session: flowState.challengeSession,
                method: 'totp',
                setupData: {
                  code: totpCode,
                  deviceName: 'Test Device',
                },
              },
            });

            // Debug: Log error if request fails
            if (result.status() !== 200) {
              const errorBody = await result.json();
              console.log('MFA setup failed:', {
                status: result.status(),
                error: errorBody,
                totpCode: totpCode,
                session: flowState.challengeSession,
              });
            }

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
            // SMS setup
            // Check if setup was auto-completed (phone already verified)
            if (setupResult.autoCompleted) {
              // Phone was already verified - setup is complete, just respond to challenge
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
          }
        },
      );

      test(
        '4. Login',
        {
          annotation: [
            {
              type: 'testId',
              description: `Config: ${config.name}`,
            },
            {
              type: 'testDetails',
              description: `Token Delivery: ${config.tokenDelivery} | User should be verified from previous steps`,
            },
            {
              type: 'testSteps',
              description:
                'POST /auth/login (or /mobile) with email and password. Expect tokens in response (cookies or JSON body).',
            },
          ],
        },
        async ({ flows, flowState, authConfig, cookies, sms, api, baseURL }) => {
          const result = await flows.login(flowState.userEmail, flowState.password);

          expect(result.success).toBe(true);
          expect(result.response?.status()).toBe(200);

          // If MFA is required, login will return MFA_REQUIRED challenge
          if (authConfig.shouldRequireMFA() && result.data?.challengeName === 'MFA_REQUIRED') {
            // Store challenge session from login response
            flowState.challengeSession = result.data?.session;
            expect(flowState.challengeSession).toBeTruthy();

            // SMS code is now sent automatically when MFA_REQUIRED challenge is created
            // (if SMS is the user's preferred MFA method)

            // Wait for SMS to be sent
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Get the MFA code using the challenge session ID
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

          // If verificationMethod is 'both', user must complete both verifications before login
          // Login might return a challenge if verifications aren't complete
          if (authConfig.verificationMethod === 'both') {
            // User should be fully verified by now (from previous tests)
            // If not, login will return a challenge
            if (result.data?.challengeName) {
              // This means verification wasn't completed - test should fail
              expect(result.data.challengeName).toBeUndefined();
              return;
            }
          }

          // Validate tokens are set
          if (authConfig.expectJsonTokens()) {
            const body = await result.response!.json();
            expect(body).toHaveProperty('accessToken');
            expect(body).toHaveProperty('refreshToken');
          }

          if (authConfig.expectCookies()) {
            // Ensure response is available
            if (!result.response) {
              throw new Error('Login response is null - cannot check for cookies');
            }

            // Debug: Log all headers to see what's in the response
            const headersArray = result.response.headersArray();
            const setCookieHeaders = headersArray.filter((h) => h.name.toLowerCase() === 'set-cookie');

            // Log response status and headers for debugging
            console.log('Login response status:', result.response.status());
            console.log('Set-Cookie headers found:', setCookieHeaders.length);
            if (setCookieHeaders.length === 0) {
              // Log all headers to help debug
              console.log(
                'All response headers:',
                headersArray.map((h) => `${h.name}: ${h.value}`),
              );
            } else {
              setCookieHeaders.forEach((h) => console.log('Set-Cookie:', h.value));
            }

            const parsedCookies = cookies.parseFromResponse(result.response);
            console.log('Parsed cookies keys:', Object.keys(parsedCookies));
            console.log('Parsed cookies:', parsedCookies);

            if (Object.keys(parsedCookies).length === 0) {
              // If no cookies parsed, check if response body has tokens (fallback for debugging)
              try {
                const body = await result.response.json();
                console.log('Response body (for debugging):', JSON.stringify(body, null, 2));
              } catch (e) {
                console.log('Could not parse response body as JSON');
              }
            }

            expect(parsedCookies).toHaveProperty('nauth_access_token');
            expect(parsedCookies).toHaveProperty('nauth_refresh_token');
          }
        },
      );

      test(
        '5. Refresh Token',
        {
          annotation: [
            {
              type: 'testId',
              description: `Config: ${config.name}`,
            },
            {
              type: 'testDetails',
              description: `Token Delivery: ${config.tokenDelivery} | Uses refresh token from previous login`,
            },
            {
              type: 'testSteps',
              description: 'POST /auth/refresh (or /mobile) with refresh token. Expect new access token in response.',
            },
          ],
        },
        async ({ flows, flowState, authConfig, cookies }) => {
          // Use expect() to validate prerequisites
          if (authConfig.expectJsonTokens()) {
            expect(flowState.refreshToken).toBeTruthy();
          }

          const result = await flows.refreshToken();

          // Use expect() to validate result
          expect(result.success).toBe(true);
          expect(result.response?.status()).toBe(200);

          // Validate new tokens are set
          if (authConfig.expectJsonTokens()) {
            const body = await result.response!.json();
            expect(body).toHaveProperty('accessToken');
          }

          if (authConfig.expectCookies()) {
            const parsedCookies = cookies.parseFromResponse(result.response!);
            expect(parsedCookies).toHaveProperty('nauth_access_token');
          }
        },
      );

      test(
        '6. Change IP and Login Again (for adaptive MFA testing)',
        {
          annotation: [
            {
              type: 'testId',
              description: `Config: ${config.name}`,
            },
            {
              type: 'testDetails',
              description: `Token Delivery: ${config.tokenDelivery} | MFA: ${config.mfaEnforcement} | Simulates location change`,
            },
            {
              type: 'testSteps',
              description:
                'Set IP to 203.0.113.1 → POST /auth/login. With adaptive MFA, may trigger challenge if risk detected.',
            },
            {
              type: 'skipCondition',
              description: 'Skipped if adaptive MFA not enabled',
            },
          ],
        },
        async ({ flows, flowState, ipAddress, authConfig }) => {
          // This test only applies to adaptive MFA
          test.skip(authConfig.mfaEnforcement !== 'ADAPTIVE', 'Adaptive MFA not enabled');

          // Change IP to simulate location change
          ipAddress.setIP('203.0.113.1');

          const result = await flows.login(flowState.userEmail, flowState.password);

          expect(result.success).toBe(true);
          expect(result.response?.status()).toBe(200);

          // With adaptive MFA, might get challenge if risk detected
          // This test validates IP change works correctly
        },
      );

      test(
        '7. Logout',
        {
          annotation: [
            {
              type: 'testId',
              description: `Config: ${config.name}`,
            },
            {
              type: 'testDetails',
              description: `Token Delivery: ${config.tokenDelivery} | Validates token/cookie invalidation`,
            },
            {
              type: 'testSteps',
              description: 'GET /auth/logout with access token. Expect tokens/cookies cleared (expired or maxAge=0).',
            },
          ],
        },
        async ({ flows, flowState, cookies, authConfig }) => {
          // Use expect() to validate prerequisites
          if (authConfig.expectJsonTokens()) {
            expect(flowState.accessToken).toBeTruthy();
          }

          const result = await flows.logout();

          // Use expect() to validate
          expect(result.success).toBe(true);
          expect(result.response?.status()).toBe(200);

          // Verify tokens are cleared
          if (authConfig.expectCookies() && result.response) {
            const parsedCookies = cookies.parseFromResponse(result.response);
            const accessCookie = parsedCookies['nauth_access_token'];
            if (accessCookie) {
              // Cookie should be expired or have maxAge 0
              expect(
                accessCookie.maxAge === 0 || (accessCookie.expires && accessCookie.expires < new Date()),
              ).toBeTruthy();
            }
          }
        },
      );
    });
  });
}
