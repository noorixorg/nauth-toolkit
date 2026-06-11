/**
 * Expired Refresh Token Reuse Reproduction
 *
 * Demonstrates the bug where an expired refresh token could still be accepted
 * by the reuse-detection "same-session race" handler because it used
 * jwtService.decodeToken() (no expiry check) instead of validateRefreshToken().
 *
 * The scenario:
 *   1. Login -> get RT1 (JWT expires in REFRESH_TOKEN_EXPIRY_S seconds)
 *   2. Refresh with RT1 -> rotates to RT2, RT1 marked as "used" in Redis
 *      (Redis TTL = REFRESH_TOKEN_EXPIRY_S)
 *   3. Wait for RT1's JWT to expire
 *   4. Attempt refresh with the expired RT1
 *
 * Before fix: Step 4 succeeds because the race handler accepts RT1 via
 *             decodeToken() (no expiry validation) + Redis "used" entry.
 * After fix:  Step 4 correctly rejects RT1 with TOKEN_INVALID because
 *             validateRefreshToken() now checks expiry in the race handler.
 *
 * Prerequisites:
 * - Backend running on localhost:3000 (pnpm start:dev in examples/demo-nestjs)
 * - JWT_REFRESH_TOKEN_EXPIRES_IN=10s in .env (short expiry for fast reproduction)
 * - JWT_ACCESS_TOKEN_EXPIRES_IN=5s in .env
 * - Reuse detection enabled in auth config (reuseDetection: true)
 * - Redis running on localhost:6379
 * - A test user exists (set TEST_USER_EMAIL / TEST_USER_PASSWORD)
 *
 * Run:
 *   TEST_BASE_URL=http://localhost:3000 TEST_USER_EMAIL=user@example.com TEST_USER_PASSWORD=secret \
 *     npx playwright test tests/e2e/specs/expired-token-reuse.spec.ts
 */

import { test, expect } from '@playwright/test';
import { parseSetCookieHeaders, buildCookieHeader } from '../cookie-helpers';

// ============================================================================
// Configuration
// ============================================================================
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ORIGIN = process.env.TEST_FRONTEND_URL || 'http://localhost:4200';
const LOGIN_EMAIL = process.env.TEST_USER_EMAIL || 'e2e-user@example.com';
const LOGIN_PASSWORD = process.env.TEST_USER_PASSWORD || 'ChangeMe123!';

// Total time from login before attempting the expired reuse (must exceed JWT exp).
// With a 30s refresh token: JWT expires at T+30s, so we wait 35s from login.
// The first refresh happens at PRE_REFRESH_WAIT_MS, creating a Redis entry with
// TTL = refreshToken.expiresIn. The bug window is between JWT expiry (T+30s) and
// Redis expiry (T + PRE_REFRESH_WAIT_MS + 30s). A larger PRE_REFRESH_WAIT_MS
// widens this window.
const REFRESH_TOKEN_EXPIRY_WAIT_MS = 35_000;

// Wait after login before doing the first refresh.
// This controls the bug window width: the Redis used-token entry expires
// PRE_REFRESH_WAIT_MS seconds AFTER the JWT itself expires.
const PRE_REFRESH_WAIT_MS = 10_000;

// ============================================================================
// Test
// ============================================================================

test.describe('Expired Refresh Token Reuse via Race Handler', () => {
  test.setTimeout(90_000);

  test('expired refresh token is rejected even when Redis used-token entry still exists', async ({ request }) => {
    // ------------------------------------------------------------------
    // Step 1: Login to get initial tokens (RT1)
    // ------------------------------------------------------------------
    console.log('\n=== STEP 1: Login ===');

    const loginRes = await request.post(`${BASE_URL}/auth/login`, {
      data: { identifier: LOGIN_EMAIL, password: LOGIN_PASSWORD },
      headers: { Origin: ORIGIN },
    });

    const loginStatus = loginRes.status();
    const loginBody = await loginRes.json();
    console.log(`Login status: ${loginStatus}`);

    if (loginBody.challengeName) {
      console.log(`Login returned challenge: ${loginBody.challengeName}`);
      console.log('This test requires a user without active MFA or with a trusted device.');
      test.skip();
      return;
    }

    expect(loginStatus).toBe(200);

    const loginCookies = parseSetCookieHeaders(loginRes.headersArray());
    const cookieJar: Record<string, string> = {};
    for (const c of loginCookies) {
      cookieJar[c.name] = c.value;
    }

    console.log(`Cookies received: ${Object.keys(cookieJar).join(', ')}`);
    expect(cookieJar['nauth_refresh_token']).toBeTruthy();
    expect(cookieJar['nauth_access_token']).toBeTruthy();

    const originalRefreshToken = cookieJar['nauth_refresh_token'];
    console.log(`RT1 (first 20 chars): ${originalRefreshToken.substring(0, 20)}...`);

    // ------------------------------------------------------------------
    // Step 2: Wait briefly, then refresh to rotate the token
    // This creates the Redis "used-token" entry for RT1's hash
    // ------------------------------------------------------------------
    console.log(`\n=== STEP 2: Wait ${PRE_REFRESH_WAIT_MS}ms then refresh (rotate RT1 -> RT2) ===`);
    await new Promise((resolve) => setTimeout(resolve, PRE_REFRESH_WAIT_MS));

    const csrfToken = cookieJar['nauth_csrf_token'] || '';
    const refreshHeaders: Record<string, string> = {
      Origin: ORIGIN,
      Cookie: buildCookieHeader(cookieJar),
      'Content-Type': 'application/json',
    };
    if (csrfToken) {
      refreshHeaders['x-csrf-token'] = csrfToken;
    }

    const firstRefreshRes = await request.post(`${BASE_URL}/auth/refresh`, {
      data: {},
      headers: { ...refreshHeaders },
    });

    const firstRefreshStatus = firstRefreshRes.status();
    console.log(`First refresh status: ${firstRefreshStatus}`);
    expect(firstRefreshStatus).toBe(200);

    // Update cookie jar with the new tokens (RT2)
    const refreshCookies = parseSetCookieHeaders(firstRefreshRes.headersArray());
    for (const c of refreshCookies) {
      if (c.maxAge === 0) {
        delete cookieJar[c.name];
      } else if (c.value) {
        cookieJar[c.name] = c.value;
      }
    }

    const rotatedRefreshToken = cookieJar['nauth_refresh_token'];
    console.log(`RT2 (first 20 chars): ${rotatedRefreshToken?.substring(0, 20)}...`);

    // Verify rotation actually happened
    expect(rotatedRefreshToken).not.toBe(originalRefreshToken);
    console.log('Token rotation confirmed: RT1 != RT2');

    // ------------------------------------------------------------------
    // Step 3: Verify RT1 reuse works BEFORE JWT expiry (legitimate race)
    // The same-session handler should return fresh tokens for a valid JWT
    // ------------------------------------------------------------------
    console.log('\n=== STEP 3: Reuse RT1 immediately (JWT still valid, same-session race) ===');

    const staleHeaders: Record<string, string> = {
      Origin: ORIGIN,
      Cookie: buildCookieHeader({
        ...cookieJar,
        nauth_refresh_token: originalRefreshToken,
      }),
      'Content-Type': 'application/json',
    };
    if (csrfToken) {
      staleHeaders['x-csrf-token'] = csrfToken;
    }

    const reuseBeforeExpiryRes = await request.post(`${BASE_URL}/auth/refresh`, {
      data: {},
      headers: { ...staleHeaders },
    });

    const reuseBeforeExpiryStatus = reuseBeforeExpiryRes.status();
    console.log(`RT1 reuse (before JWT expiry) status: ${reuseBeforeExpiryStatus}`);

    if (reuseBeforeExpiryStatus === 200) {
      console.log('Same-session race handler accepted the valid (non-expired) stale token - correct behavior');
    } else {
      let errorBody: Record<string, unknown> = {};
      try {
        errorBody = await reuseBeforeExpiryRes.json();
      } catch {
        /* empty */
      }
      console.log(`Unexpected failure: ${JSON.stringify(errorBody).substring(0, 200)}`);
    }

    // RT1 reuse should succeed when JWT is still valid
    expect(reuseBeforeExpiryStatus).toBe(200);

    // ------------------------------------------------------------------
    // Step 4: Wait for RT1's JWT to expire
    // Redis used-token entry was created in Step 2 with TTL = refreshToken.expiresIn.
    // RT1 JWT was created in Step 1, so its exp is earlier than the Redis TTL expiry.
    // After RT1's JWT expires but before the Redis entry expires, the bug window opens.
    // ------------------------------------------------------------------
    const remainingWait = REFRESH_TOKEN_EXPIRY_WAIT_MS - PRE_REFRESH_WAIT_MS;
    console.log(`\n=== STEP 4: Waiting ${remainingWait}ms for RT1 JWT to expire (Redis entry still alive) ===`);
    await new Promise((resolve) => setTimeout(resolve, remainingWait));

    // ------------------------------------------------------------------
    // Step 5: Attempt refresh with expired RT1
    // Before fix: succeeds (race handler uses decodeToken, no expiry check)
    // After fix: fails with TOKEN_INVALID (race handler now validates expiry)
    // ------------------------------------------------------------------
    console.log('\n=== STEP 5: Reuse RT1 after JWT expiry (the bug scenario) ===');

    const expiredReuseRes = await request.post(`${BASE_URL}/auth/refresh`, {
      data: {},
      headers: { ...staleHeaders },
    });

    const expiredReuseStatus = expiredReuseRes.status();
    let expiredReuseBody: Record<string, unknown> = {};
    try {
      expiredReuseBody = await expiredReuseRes.json();
    } catch {
      /* empty */
    }

    console.log(`RT1 reuse (after JWT expiry) status: ${expiredReuseStatus}`);
    console.log(`Response body: ${JSON.stringify(expiredReuseBody).substring(0, 300)}`);

    // Analyze the Set-Cookie headers from the response
    const expiredReuseCookies = parseSetCookieHeaders(expiredReuseRes.headersArray());
    console.log('\nSet-Cookie headers from expired reuse attempt:');
    for (const c of expiredReuseCookies) {
      const truncatedValue = c.value.length > 30 ? `${c.value.substring(0, 30)}...` : c.value;
      console.log(`  ${c.name}=${truncatedValue} (maxAge=${c.maxAge ?? 'unset'})`);
    }

    // ------------------------------------------------------------------
    // Step 6: Verify the fix
    // ------------------------------------------------------------------
    console.log('\n=== STEP 6: Bug verification ===');

    if (expiredReuseStatus === 200) {
      console.log('*** BUG PRESENT: Expired refresh token was accepted! ***');
      console.log('The same-session race handler is NOT checking JWT expiry.');
      console.log('This is the root cause of the 72-hour logout issue on mobile apps.');
      console.log('An expired refresh token should be rejected regardless of Redis state.');
    } else if (expiredReuseStatus === 401) {
      console.log('FIX VERIFIED: Expired refresh token correctly rejected.');
      console.log(`Error code: ${expiredReuseBody['code']}`);
      console.log(`Message: ${expiredReuseBody['message']}`);
    } else {
      console.log(`Unexpected status: ${expiredReuseStatus}`);
    }

    // After the fix, the expired token must be rejected
    expect(expiredReuseStatus).toBe(401);
    expect(expiredReuseBody['code']).toBe('AUTH_TOKEN_INVALID');

    // ------------------------------------------------------------------
    // Step 7: Verify RT2 still works (rotation was legitimate)
    // ------------------------------------------------------------------
    console.log('\n=== STEP 7: Verify RT2 (rotated token) still works ===');

    const rt2CsrfToken = cookieJar['nauth_csrf_token'] || '';
    const rt2Headers: Record<string, string> = {
      Origin: ORIGIN,
      Cookie: buildCookieHeader(cookieJar),
      'Content-Type': 'application/json',
    };
    if (rt2CsrfToken) {
      rt2Headers['x-csrf-token'] = rt2CsrfToken;
    }

    const rt2RefreshRes = await request.post(`${BASE_URL}/auth/refresh`, {
      data: {},
      headers: { ...rt2Headers },
    });

    const rt2RefreshStatus = rt2RefreshRes.status();
    console.log(`RT2 refresh status: ${rt2RefreshStatus}`);

    // RT2 should still be valid (it was created in Step 2 and has a fresh expiry)
    // Note: RT2 might also be expired if REFRESH_TOKEN_EXPIRY is very short (e.g., 10s)
    // and the total test runtime exceeds it. If so, this is expected.
    if (rt2RefreshStatus === 200) {
      console.log('RT2 still valid - legitimate rotation chain works correctly.');
    } else {
      console.log(`RT2 also expired (expected if refresh token TTL <= total test time). Status: ${rt2RefreshStatus}`);
    }
  });
});
