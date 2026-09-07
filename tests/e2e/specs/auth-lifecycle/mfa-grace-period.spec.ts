import { test, expect, APIResponse } from '@playwright/test';

/**
 * MFA grace period E2E tests
 *
 * Verifies the grace period surfaced in auth responses, and the frictionless-signup
 * escape hatch, against a live backend.
 *
 * The suite adapts to how the server under test was started:
 * - `MFA_GRACE_PERIOD > 0`  → the day-based window is reported on every response of the
 *   signup flow (challenges included) and on subsequent logins.
 * - `MFA_GRACE_PERIOD === 0` with `MFA_GRACE_SKIP_FOR_SIGNUP=true` → signup completes
 *   without an MFA wall and reports `requiredAtNextLogin`, while the next login is
 *   immediately challenged with `MFA_SETUP_REQUIRED`.
 *
 * Run pass 1 (window):
 * ```bash
 * npx playwright test --project=cookies specs/auth-lifecycle/mfa-grace-period
 * ```
 *
 * Run pass 2 (frictionless signup), with the server started using the same env:
 * ```bash
 * MFA_ENFORCEMENT=REQUIRED MFA_GRACE_PERIOD=0 MFA_GRACE_SKIP_FOR_SIGNUP=true \
 *   npx playwright test --project=cookies specs/auth-lifecycle/mfa-grace-period
 * ```
 */

const ENFORCEMENT = process.env.MFA_ENFORCEMENT || 'ADAPTIVE';
const GRACE_PERIOD = process.env.MFA_GRACE_PERIOD !== undefined ? parseInt(process.env.MFA_GRACE_PERIOD, 10) : 2;
const SKIP_FOR_SIGNUP = process.env.MFA_GRACE_SKIP_FOR_SIGNUP === 'true';

/**
 * Shape of the grace period payload returned in auth responses
 */
type MfaGracePeriod = {
  active: boolean;
  endsAt?: string;
  daysRemaining: number;
  enforcement: 'REQUIRED' | 'ADAPTIVE';
  requiredAtNextLogin?: boolean;
};

/**
 * Auth response fields this suite asserts on
 */
type AuthBody = {
  challengeName?: string;
  session?: string;
  accessToken?: string;
  user?: { sub: string; email: string };
  sub?: string;
  mfaGracePeriod?: MfaGracePeriod;
};

/**
 * Build a unique test identity so reruns never collide
 */
function makeIdentity(): { email: string; phone: string; password: string } {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    email: `grace-${unique}@example.com`,
    // E.164, inside the demo app's accepted range
    phone: `+1555${unique.slice(-7)}`,
    password: 'GracePeriod!2345',
  };
}

/**
 * Read the JSON body of a response, failing the test on non-JSON payloads
 */
async function body(response: APIResponse): Promise<AuthBody> {
  const text = await response.text();
  try {
    return JSON.parse(text) as AuthBody;
  } catch {
    throw new Error(`Expected JSON auth response, got status ${response.status()}: ${text.slice(0, 300)}`);
  }
}

/**
 * Poll the demo app's test endpoint for the code tied to a challenge session
 */
async function latestCode(baseURL: string, sessionId: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await fetch(`${baseURL}/test/code/latest?sessionId=${encodeURIComponent(sessionId)}`);
    if (response.ok) {
      const parsed = (await response.json()) as { code?: string };
      if (parsed.code) {
        return parsed.code;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No verification code found for session ${sessionId}`);
}

/**
 * Assert that a payload describes an open day-based grace window
 */
function expectWindow(grace: MfaGracePeriod | undefined, label: string): void {
  expect(grace, `${label} should carry mfaGracePeriod`).toBeDefined();
  expect(grace!.active).toBe(true);
  expect(grace!.enforcement).toBe(ENFORCEMENT);
  expect(typeof grace!.endsAt).toBe('string');
  expect(new Date(grace!.endsAt!).getTime()).toBeGreaterThan(Date.now());
  expect(grace!.daysRemaining).toBeGreaterThan(0);
  expect(grace!.daysRemaining).toBeLessThanOrEqual(GRACE_PERIOD);
  expect(grace!.requiredAtNextLogin).toBeUndefined();
}

test.describe('MFA grace period @mfa-grace', () => {
  test.describe.configure({ mode: 'serial' });

  test('reports the grace window on every step of the signup flow and on login', async ({ request, baseURL }) => {
    test.skip(GRACE_PERIOD <= 0, 'Requires a server started with a day-based grace period');

    const identity = makeIdentity();

    // ------------------------------------------------------------------
    // Signup - the response is a VERIFY_EMAIL challenge, and must still tell the
    // client that MFA setup is due in the future
    // ------------------------------------------------------------------
    const signup = await request.post(`${baseURL}/auth/signup`, {
      data: { email: identity.email, phone: identity.phone, password: identity.password },
    });
    expect(signup.status()).toBe(201);

    const signupBody = await body(signup);
    expect(signupBody.challengeName).toBe('VERIFY_EMAIL');
    expectWindow(signupBody.mfaGracePeriod, 'Signup response');

    // ------------------------------------------------------------------
    // Email verification - the continuation of the signup flow keeps reporting it
    // ------------------------------------------------------------------
    const emailCode = await latestCode(baseURL!, signupBody.session!);
    const emailStep = await request.post(`${baseURL}/auth/respond-challenge`, {
      data: { session: signupBody.session, type: 'VERIFY_EMAIL', code: emailCode },
    });
    expect(emailStep.ok()).toBe(true);

    const emailBody = await body(emailStep);
    expect(emailBody.challengeName).toBe('VERIFY_PHONE');
    expectWindow(emailBody.mfaGracePeriod, 'Email verification response');

    // ------------------------------------------------------------------
    // Phone verification - final step issues tokens, still inside the window
    // ------------------------------------------------------------------
    const phoneCode = await latestCode(baseURL!, emailBody.session!);
    const phoneStep = await request.post(`${baseURL}/auth/respond-challenge`, {
      data: { session: emailBody.session, type: 'VERIFY_PHONE', code: phoneCode },
    });
    expect(phoneStep.ok()).toBe(true);

    const phoneBody = await body(phoneStep);
    expect(phoneBody.challengeName).toBeUndefined();
    expectWindow(phoneBody.mfaGracePeriod, 'Phone verification response');

    // ------------------------------------------------------------------
    // Login - a returning user inside the window is told about it too
    // ------------------------------------------------------------------
    const login = await request.post(`${baseURL}/auth/login`, {
      data: { identifier: identity.email, password: identity.password },
    });
    expect(login.ok()).toBe(true);

    const loginBody = await body(login);
    expectWindow(loginBody.mfaGracePeriod, 'Login response');
  });

  test('keeps signup frictionless with grace.skipForSignup and enforces MFA on the next login', async ({
    request,
    baseURL,
  }) => {
    test.skip(
      !(GRACE_PERIOD === 0 && SKIP_FOR_SIGNUP),
      'Requires a server started with MFA_GRACE_PERIOD=0 and MFA_GRACE_SKIP_FOR_SIGNUP=true',
    );

    const identity = makeIdentity();

    // ------------------------------------------------------------------
    // Signup - no day-based grace at all, so without the skip this flow would end
    // on an MFA_SETUP_REQUIRED challenge
    // ------------------------------------------------------------------
    const signup = await request.post(`${baseURL}/auth/signup`, {
      data: { email: identity.email, phone: identity.phone, password: identity.password },
    });
    expect(signup.status()).toBe(201);

    const signupBody = await body(signup);
    expect(signupBody.challengeName).toBe('VERIFY_EMAIL');
    expect(signupBody.mfaGracePeriod).toEqual({
      active: true,
      daysRemaining: 0,
      enforcement: ENFORCEMENT,
      requiredAtNextLogin: true,
    });

    // ------------------------------------------------------------------
    // Verification steps are part of the signup flow, so the skip survives them
    // ------------------------------------------------------------------
    const emailCode = await latestCode(baseURL!, signupBody.session!);
    const emailStep = await request.post(`${baseURL}/auth/respond-challenge`, {
      data: { session: signupBody.session, type: 'VERIFY_EMAIL', code: emailCode },
    });
    expect(emailStep.ok()).toBe(true);

    const emailBody = await body(emailStep);
    expect(emailBody.challengeName).toBe('VERIFY_PHONE');
    expect(emailBody.mfaGracePeriod?.requiredAtNextLogin).toBe(true);

    const phoneCode = await latestCode(baseURL!, emailBody.session!);
    const phoneStep = await request.post(`${baseURL}/auth/respond-challenge`, {
      data: { session: emailBody.session, type: 'VERIFY_PHONE', code: phoneCode },
    });
    expect(phoneStep.ok()).toBe(true);

    // Signup completes authenticated - no MFA wall.
    // `user` is the delivery-mode-agnostic success marker: in cookies mode the token
    // fields are stripped from the body and set as httpOnly cookies instead.
    const phoneBody = await body(phoneStep);
    expect(phoneBody.challengeName).toBeUndefined();
    expect(phoneBody.user).toBeTruthy();
    expect(phoneBody.mfaGracePeriod).toEqual({
      active: true,
      daysRemaining: 0,
      enforcement: ENFORCEMENT,
      requiredAtNextLogin: true,
    });

    // ------------------------------------------------------------------
    // Next login - enforcement resumes immediately
    // ------------------------------------------------------------------
    const login = await request.post(`${baseURL}/auth/login`, {
      data: { identifier: identity.email, password: identity.password },
    });
    expect(login.ok()).toBe(true);

    const loginBody = await body(login);
    expect(loginBody.challengeName).toBe('MFA_SETUP_REQUIRED');
    expect(loginBody.user).toBeUndefined();
    // The grace is spent: nothing left to report
    expect(loginBody.mfaGracePeriod).toBeUndefined();
  });
});
