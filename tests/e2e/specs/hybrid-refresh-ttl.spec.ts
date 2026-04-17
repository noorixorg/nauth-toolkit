/**
 * Hybrid Per-Delivery Refresh TTL
 *
 * Validates the hybridPolicy.cookieRefreshExpiresIn / jsonRefreshExpiresIn
 * config settings end-to-end against sample-nestjs.
 *
 * sample-nestjs is configured with:
 *   tokenDelivery.method: 'hybrid'
 *   hybridPolicy: {
 *     cookieRefreshExpiresIn: '10s',
 *     jsonRefreshExpiresIn:   '20s',
 *   }
 *
 * Delivery mode is selected per route via @TokenDelivery() (NestJS) or
 * nauth.helpers.tokenDelivery() (Express/Fastify). The cookies project hits
 * /auth/* (decorated with @TokenDelivery('cookies')); the json project hits
 * /mobile/auth/* (decorated with @TokenDelivery('json')).
 *
 * For each delivery mode we assert:
 *   1. The issued refresh lifetime matches the configured TTL
 *      (cookies → JWT exp-iat of the refresh cookie; json → JWT exp-iat of
 *      the returned refreshToken).
 *   2. A refresh call inside the TTL window succeeds.
 *   3. A refresh call after the TTL expires fails.
 *
 * Uses the shared fixtures so signup + email/phone verification + any
 * incidental challenges are orchestrated automatically.
 */

import { test, expect } from '../fixtures';

// ============================================================================
// Configuration
// ============================================================================

// Expected TTLs from sample-nestjs config/auth.config.ts hybridPolicy.
const EXPECTED_TTL_S = {
  cookies: 10,
  json: 20,
} as const;

// Margin past the TTL to guarantee expiry (clock skew, network, etc).
const EXPIRY_MARGIN_MS = 2_500;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Decode a JWT payload without verification. Safe for reading our own
 * freshly-issued tokens' exp/iat claims.
 */
function decodeJwtPayload(jwt: string): { exp?: number; iat?: number } {
  const [, payloadB64] = jwt.split('.');
  if (!payloadB64) throw new Error('Invalid JWT');
  const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
  const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(json) as { exp?: number; iat?: number };
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Hybrid Per-Delivery Refresh TTL', () => {
  // Tests wait 10-20s past the TTL, plus signup orchestration. Give 90s.
  test.setTimeout(90_000);

  test('refresh TTL matches hybrid policy per delivery, and refresh expires at that boundary', async ({
    flows,
    flowState,
    api,
    mail,
    sms,
    baseURL,
  }, testInfo) => {
    const mode: 'cookies' | 'json' = testInfo.project.name === 'json' ? 'json' : 'cookies';
    const expectedTtl = EXPECTED_TTL_S[mode];

    // In hybrid mode on sample-nestjs, /auth/respond-challenge has no
    // @TokenDelivery decorator, so final token issuance falls back to the
    // cookie safe-default. For the json project we must hit the explicit
    // mobile variant so the response carries JSON tokens.
    const respondChallengeEndpoint = mode === 'json' ? '/auth/respond-challenge/mobile' : '/auth/respond-challenge';

    const completeChallenge = async (
      challengeName: 'VERIFY_EMAIL' | 'VERIFY_PHONE',
      code: string,
    ): Promise<void> => {
      const res = await api.post(`${baseURL}${respondChallengeEndpoint}`, {
        data: { session: flowState.challengeSession, type: challengeName, code },
      });
      expect(res.status(), `${challengeName} completion should succeed`).toBe(200);
      const body = await res.json().catch(() => ({}));
      if (body.challengeName) {
        flowState.challengeName = body.challengeName;
        flowState.challengeSession = body.session;
      } else {
        flowState.challengeName = undefined;
        flowState.challengeSession = undefined;
      }
    };

    // ------------------------------------------------------------------
    // Step 1: Signup + complete verifications to get a logged-in user
    // ------------------------------------------------------------------
    const signup = await flows.signup(flowState.userEmail, flowState.userPhone);
    expect(signup.success, 'signup should succeed').toBe(true);

    if (signup.data?.challengeName === 'VERIFY_EMAIL') {
      const session = flowState.challengeSession!;
      const code = await mail.latestCode(session);
      expect(code, 'email verification code must be available').toBeTruthy();
      await completeChallenge('VERIFY_EMAIL', code);
    }

    if (flowState.challengeName === 'VERIFY_PHONE') {
      const session = flowState.challengeSession!;
      const code = await sms.latestCode(session);
      expect(code, 'sms verification code must be available').toBeTruthy();
      await completeChallenge('VERIFY_PHONE', code);
    }

    // After verifications, we should either have tokens or an MFA challenge.
    // For a brand-new user on the same IP, adaptive MFA typically doesn't fire.
    // If it does, skip the test — TTL behavior is not MFA-dependent.
    if (flowState.challengeName === 'MFA_SETUP_REQUIRED' || flowState.challengeName === 'MFA_REQUIRED') {
      test.skip(true, `Adaptive MFA fired (${flowState.challengeName}); TTL test needs a direct login.`);
    }

    const loginAt = Date.now();

    // ------------------------------------------------------------------
    // Step 2: Capture the issued refresh token + assert its TTL
    // ------------------------------------------------------------------
    let refreshJwt: string | undefined;
    if (mode === 'cookies') {
      refreshJwt = api.getCookies()['nauth_refresh_token'];
      expect(refreshJwt, 'nauth_refresh_token cookie must be set').toBeTruthy();
    } else {
      refreshJwt = flowState.refreshToken;
      expect(refreshJwt, 'refreshToken must be in JSON body').toBeTruthy();
    }

    const { exp, iat } = decodeJwtPayload(refreshJwt!);
    expect(exp, 'refresh JWT must have exp').toBeTruthy();
    expect(iat, 'refresh JWT must have iat').toBeTruthy();
    const issuedTtl = (exp as number) - (iat as number);

    console.log(`[${mode}] issued refresh TTL = ${issuedTtl}s (expected ${expectedTtl}s)`);
    expect(
      issuedTtl,
      `issued refresh lifetime should equal hybridPolicy.${mode === 'cookies' ? 'cookieRefreshExpiresIn' : 'jsonRefreshExpiresIn'}`,
    ).toBe(expectedTtl);

    // ------------------------------------------------------------------
    // Step 3: Refresh inside the TTL window → success
    // ------------------------------------------------------------------
    const withinWindowResult = await flows.refreshToken();
    console.log(`[${mode}] refresh within window → ${withinWindowResult.response?.status()}`);
    expect(withinWindowResult.success, 'refresh inside TTL window should succeed').toBe(true);

    // Rotated token should also carry the configured TTL.
    let rotatedJwt: string | undefined;
    if (mode === 'cookies') {
      rotatedJwt = api.getCookies()['nauth_refresh_token'];
    } else {
      rotatedJwt = flowState.refreshToken;
    }
    expect(rotatedJwt, 'rotated refresh token must exist').toBeTruthy();
    const rotated = decodeJwtPayload(rotatedJwt!);
    expect(
      (rotated.exp as number) - (rotated.iat as number),
      'rotated refresh should also use per-delivery TTL',
    ).toBe(expectedTtl);

    // ------------------------------------------------------------------
    // Step 4: Wait past the TTL (measured from original login), then
    // attempt refresh — expect failure.
    //
    // We measure from loginAt so the wait covers the ORIGINAL token's exp.
    // The rotated token has its own fresh window but it was issued at
    // roughly loginAt+t, so it also expires at ~loginAt+t+TTL. Waiting
    // (TTL + margin) from loginAt puts us past both expiries.
    // ------------------------------------------------------------------
    const elapsedMs = Date.now() - loginAt;
    const waitMs = expectedTtl * 1000 + EXPIRY_MARGIN_MS - elapsedMs;
    if (waitMs > 0) {
      console.log(`[${mode}] waiting ${waitMs}ms for refresh TTL to elapse`);
      await new Promise((r) => setTimeout(r, waitMs));
    }

    const postExpiryResult = await flows.refreshToken();
    const postExpiryStatus = postExpiryResult.response?.status();
    console.log(`[${mode}] refresh after TTL → ${postExpiryStatus}`);

    expect(postExpiryResult.success, `refresh after ${expectedTtl}s TTL should fail`).toBe(false);
    expect(
      [401, 403].includes(postExpiryStatus ?? 0),
      `expected 401/403 after TTL expiry, got ${postExpiryStatus}`,
    ).toBe(true);
  });
});
