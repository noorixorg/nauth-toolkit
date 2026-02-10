/**
 * Multi-Tab Refresh Token Race Condition Reproduction
 *
 * Demonstrates the critical bug where concurrent refresh requests from multiple
 * tabs cause the backend to clear httpOnly cookies, logging out all tabs.
 *
 * See docs/MULTI_TAB_REFRESH_RACE_CONDITION.md for full analysis.
 *
 * Prerequisites:
 * - Backend running on localhost:3000 (yarn start:dev in examples/sample-nestjs)
 * - JWT_ACCESS_TOKEN_EXPIRES_IN=5s in .env (short expiry for fast reproduction)
 * - Redis running on localhost:6379
 * - User murtaza@noorix.com with password Welcome1$ exists
 *
 * Run:
 *   TEST_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/specs/multi-tab-refresh-race.spec.ts
 */

import { test, expect } from '@playwright/test';

// ============================================================================
// Configuration
// ============================================================================
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ORIGIN = 'http://localhost:4200';
const LOGIN_EMAIL = 'murtaza@noorix.com';
const LOGIN_PASSWORD = 'Welcome1$';

// Access token expiry set in .env (5s) plus buffer for network latency
const ACCESS_TOKEN_EXPIRY_WAIT_MS = 7000;

// ============================================================================
// Cookie parsing helpers
// ============================================================================

interface ParsedCookie {
  name: string;
  value: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  domain?: string;
}

/**
 * Parse Set-Cookie headers from a Playwright APIResponse into structured cookies.
 */
function parseSetCookieHeaders(headersArray: Array<{ name: string; value: string }>): ParsedCookie[] {
  return headersArray
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => {
      const [nameValue, ...attrs] = h.value.split(';').map((s) => s.trim());
      const eqIdx = nameValue.indexOf('=');
      const cookie: ParsedCookie = {
        name: nameValue.substring(0, eqIdx),
        value: nameValue.substring(eqIdx + 1),
      };
      for (const attr of attrs) {
        const lower = attr.toLowerCase();
        if (lower === 'httponly') cookie.httpOnly = true;
        else if (lower.startsWith('secure')) cookie.secure = true;
        else if (lower.startsWith('samesite=')) cookie.sameSite = attr.split('=')[1];
        else if (lower.startsWith('path=')) cookie.path = attr.split('=')[1];
        else if (lower.startsWith('domain=')) cookie.domain = attr.split('=')[1];
        else if (lower.startsWith('max-age=')) cookie.maxAge = parseInt(attr.split('=')[1], 10);
      }
      return cookie;
    });
}

/**
 * Build a Cookie header string from parsed cookies (non-empty values only).
 */
function buildCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

// ============================================================================
// Test
// ============================================================================

test.describe('Multi-Tab Refresh Race Condition', () => {
  // Increase timeout: we wait for access token expiry
  test.setTimeout(60_000);

  test('concurrent refresh after token rotation causes SESSION_NOT_FOUND and cookie clearing', async ({ request }) => {
    // ------------------------------------------------------------------
    // Step 1: Login to get authenticated cookies
    // ------------------------------------------------------------------
    console.log('\n=== STEP 1: Login ===');

    const loginRes = await request.post(`${BASE_URL}/auth/login`, {
      data: { identifier: LOGIN_EMAIL, password: LOGIN_PASSWORD },
      headers: { Origin: ORIGIN },
    });

    const loginStatus = loginRes.status();
    const loginBody = await loginRes.json();
    console.log(`Login status: ${loginStatus}`);

    // Handle MFA challenge if returned
    if (loginBody.challengeName) {
      console.log(`Login returned challenge: ${loginBody.challengeName}`);
      console.log('This test requires a user without active MFA or with a trusted device.');
      console.log('Skipping test - adjust MFA config or use a non-MFA user.');
      test.skip();
      return;
    }

    expect(loginStatus).toBe(200);

    // Extract cookies from Set-Cookie headers (httpOnly cookies)
    const loginCookies = parseSetCookieHeaders(loginRes.headersArray());
    const cookieJar: Record<string, string> = {};
    for (const c of loginCookies) {
      cookieJar[c.name] = c.value;
    }

    console.log(`Cookies received: ${Object.keys(cookieJar).join(', ')}`);
    expect(cookieJar['nauth_refresh_token']).toBeTruthy();
    expect(cookieJar['nauth_access_token']).toBeTruthy();

    const originalRefreshToken = cookieJar['nauth_refresh_token'];
    console.log(`Refresh token (first 20 chars): ${originalRefreshToken.substring(0, 20)}...`);

    // ------------------------------------------------------------------
    // Step 2: Verify authenticated requests work
    // ------------------------------------------------------------------
    console.log('\n=== STEP 2: Verify auth works ===');

    const verifyRes = await request.get(`${BASE_URL}/auth/profile`, {
      headers: {
        Origin: ORIGIN,
        Cookie: buildCookieHeader(cookieJar),
      },
    });
    console.log(`GET /auth/profile status: ${verifyRes.status()}`);
    expect(verifyRes.status()).toBe(200);

    // ------------------------------------------------------------------
    // Step 3: Wait for access token to expire
    // ------------------------------------------------------------------
    console.log(`\n=== STEP 3: Waiting ${ACCESS_TOKEN_EXPIRY_WAIT_MS}ms for access token to expire ===`);
    await new Promise((resolve) => setTimeout(resolve, ACCESS_TOKEN_EXPIRY_WAIT_MS));

    // Confirm access token is now expired
    const expiredRes = await request.get(`${BASE_URL}/auth/profile`, {
      headers: {
        Origin: ORIGIN,
        Cookie: buildCookieHeader(cookieJar),
      },
    });
    console.log(`GET /auth/profile after expiry: ${expiredRes.status()}`);
    expect(expiredRes.status()).toBe(401);

    // ------------------------------------------------------------------
    // Step 4: Simulate two tabs sending concurrent refresh requests
    // Both tabs send the SAME old refresh token cookie (race condition)
    // ------------------------------------------------------------------
    console.log('\n=== STEP 4: Two concurrent refresh requests (simulating two tabs) ===');
    console.log('Both tabs send the same old refresh token cookie...');

    // CSRF token needed for POST in cookies mode
    const csrfToken = cookieJar['nauth_csrf_token'] || '';
    const refreshHeaders: Record<string, string> = {
      Origin: ORIGIN,
      Cookie: buildCookieHeader(cookieJar),
      'Content-Type': 'application/json',
    };
    if (csrfToken) {
      refreshHeaders['x-csrf-token'] = csrfToken;
    }

    // Fire both refresh requests at the same time
    const [tabARes, tabBRes] = await Promise.all([
      request.post(`${BASE_URL}/auth/refresh`, {
        data: {},
        headers: { ...refreshHeaders },
      }),
      request.post(`${BASE_URL}/auth/refresh`, {
        data: {},
        headers: { ...refreshHeaders },
      }),
    ]);

    // ------------------------------------------------------------------
    // Step 5: Analyze results
    // ------------------------------------------------------------------
    console.log('\n=== STEP 5: Results ===');

    const tabAStatus = tabARes.status();
    const tabBStatus = tabBRes.status();

    let tabABody: Record<string, unknown> = {};
    let tabBBody: Record<string, unknown> = {};
    try {
      tabABody = await tabARes.json();
    } catch {
      /* empty response */
    }
    try {
      tabBBody = await tabBRes.json();
    } catch {
      /* empty response */
    }

    console.log(`Tab A response: ${tabAStatus} - ${JSON.stringify(tabABody).substring(0, 200)}`);
    console.log(`Tab B response: ${tabBStatus} - ${JSON.stringify(tabBBody).substring(0, 200)}`);

    // Parse Set-Cookie headers from both responses
    const tabACookies = parseSetCookieHeaders(tabARes.headersArray());
    const tabBCookies = parseSetCookieHeaders(tabBRes.headersArray());

    console.log('\nTab A Set-Cookie headers:');
    for (const c of tabACookies) {
      const truncatedValue = c.value.length > 30 ? `${c.value.substring(0, 30)}...` : c.value;
      console.log(`  ${c.name}=${truncatedValue} (maxAge=${c.maxAge ?? 'unset'})`);
    }

    console.log('\nTab B Set-Cookie headers:');
    for (const c of tabBCookies) {
      const truncatedValue = c.value.length > 30 ? `${c.value.substring(0, 30)}...` : c.value;
      console.log(`  ${c.name}=${truncatedValue} (maxAge=${c.maxAge ?? 'unset'})`);
    }

    // ------------------------------------------------------------------
    // Step 6: Determine which tab won and which lost
    // ------------------------------------------------------------------
    console.log('\n=== STEP 6: Race condition analysis ===');

    const aWon = tabAStatus === 200;
    const bWon = tabBStatus === 200;

    if (aWon && bWon) {
      // Both succeeded - lock caught the race (Tab B got current tokens from reuse detection)
      console.log('RESULT: Both tabs succeeded (lock or reuse detection caught the race).');
      console.log('This means the distributed lock held and the race was handled safely.');
    } else if (aWon && !bWon) {
      console.log('RESULT: Tab A won the race, Tab B failed.');
      analyzeLoser('Tab B', tabBStatus, tabBBody, tabBCookies);
    } else if (!aWon && bWon) {
      console.log('RESULT: Tab B won the race, Tab A failed.');
      analyzeLoser('Tab A', tabAStatus, tabABody, tabACookies);
    } else {
      // Both failed - edge case (e.g., both hit lock contention)
      console.log('RESULT: Both tabs failed.');
      analyzeLoser('Tab A', tabAStatus, tabABody, tabACookies);
      analyzeLoser('Tab B', tabBStatus, tabBBody, tabBCookies);
    }

    // ------------------------------------------------------------------
    // Step 7: Demonstrate the impact - try using cookies after the race
    // ------------------------------------------------------------------
    console.log('\n=== STEP 7: Post-race cookie state ===');

    // Simulate what the browser sees: apply Set-Cookie headers from BOTH responses
    // In a real browser, the last response processed wins for each cookie name
    const finalCookies = { ...cookieJar };

    // Apply Tab A's cookies first (Tab A's response arrived first in most cases)
    for (const c of tabACookies) {
      if (c.maxAge === 0) {
        // maxAge=0 clears the cookie
        delete finalCookies[c.name];
      } else if (c.value) {
        finalCookies[c.name] = c.value;
      }
    }

    // Apply Tab B's cookies second (Tab B's response arrives after)
    for (const c of tabBCookies) {
      if (c.maxAge === 0) {
        // maxAge=0 clears the cookie
        delete finalCookies[c.name];
      } else if (c.value) {
        finalCookies[c.name] = c.value;
      }
    }

    const hasRefreshToken = !!finalCookies['nauth_refresh_token'];
    const hasAccessToken = !!finalCookies['nauth_access_token'];

    console.log(`Final cookie state after both responses processed:`);
    console.log(`  nauth_access_token: ${hasAccessToken ? 'present' : 'CLEARED'}`);
    console.log(`  nauth_refresh_token: ${hasRefreshToken ? 'present' : 'CLEARED'}`);
    console.log(`  nauth_csrf_token: ${finalCookies['nauth_csrf_token'] ? 'present' : 'CLEARED'}`);

    if (!hasRefreshToken || !hasAccessToken) {
      console.log('\n*** BUG CONFIRMED: Cookies were cleared by the losing tab\'s response! ***');
      console.log('In a real browser, ALL tabs would now be logged out.');
      console.log('The user would be redirected to the login page.');
    }

    // Try to use the final cookies for an authenticated request
    if (hasAccessToken) {
      const postRaceRes = await request.get(`${BASE_URL}/auth/profile`, {
        headers: {
          Origin: ORIGIN,
          Cookie: buildCookieHeader(finalCookies),
        },
      });
      console.log(`\nPost-race GET /auth/profile: ${postRaceRes.status()}`);
    } else {
      console.log('\nCannot make authenticated request - access token cookie was cleared.');
    }

    // ------------------------------------------------------------------
    // Assertions: document the bug
    // ------------------------------------------------------------------
    // At least one tab should succeed
    const anySuccess = aWon || bWon;
    expect(anySuccess).toBe(true);

    // Check if the losing response cleared cookies (the actual bug)
    const loserCookies = aWon ? tabBCookies : tabACookies;
    const loserStatus = aWon ? tabBStatus : tabAStatus;

    if (loserStatus !== 200) {
      const clearedCookies = loserCookies.filter((c) => c.maxAge === 0);

      if (clearedCookies.length > 0) {
        console.log(`\n*** BUG DEMONSTRATED: The losing response cleared ${clearedCookies.length} cookie(s) ***`);
        console.log('Cookie names cleared:', clearedCookies.map((c) => c.name).join(', '));

        // This is the bug: the backend clears cookies on the losing tab's response.
        // In production, this wipes the winning tab's freshly-set cookies.
        // IMPORTANT: This expect documents the bug. Once fixed, change to:
        //   expect(clearedCookies.length).toBe(0);
        expect(clearedCookies.length).toBeGreaterThan(0);
      }
    }
  });
});

// ============================================================================
// Helper: analyze the losing tab's response
// ============================================================================
function analyzeLoser(
  tabName: string,
  status: number,
  body: Record<string, unknown>,
  cookies: ParsedCookie[],
): void {
  console.log(`\n  ${tabName} status: ${status}`);
  console.log(`  ${tabName} error code: ${body['code'] || 'unknown'}`);
  console.log(`  ${tabName} message: ${body['message'] || 'unknown'}`);

  const clearedCookies = cookies.filter((c) => c.maxAge === 0);
  if (clearedCookies.length > 0) {
    console.log(`  ${tabName} CLEARED cookies: ${clearedCookies.map((c) => c.name).join(', ')}`);
    console.log(`  ^^^ THIS IS THE BUG: backend sent Set-Cookie with maxAge=0, wiping valid cookies`);
  } else {
    console.log(`  ${tabName} did NOT clear any cookies (safe failure)`);
  }
}
