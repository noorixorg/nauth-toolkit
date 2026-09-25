import { test, expect, APIResponse } from '@playwright/test';

/**
 * MFA_SETUP_REQUIRED SMS phone-collection E2E test
 *
 * Verifies the SMS phone-collection step against a live backend: an account with
 * no phone on file (email-only signup) is challenged with MFA_SETUP_REQUIRED at
 * login, the challenge carries `requiresPhoneCollection: 'true'`, and the number
 * can be submitted (and changed) via `POST /auth/challenge/setup-data` before the
 * code verifies it.
 *
 * Requires the server started with:
 * ```bash
 * SIGNUP_VERIFICATION_METHOD=email MFA_ENFORCEMENT=REQUIRED MFA_GRACE_PERIOD=0 \
 *   MFA_GRACE_SKIP_FOR_SIGNUP=true npx playwright test --project=cookies \
 *   specs/auth-lifecycle/mfa-setup-sms-phone-collection
 * ```
 *
 * `SIGNUP_VERIFICATION_METHOD=email` keeps phone off the account at signup (so
 * `requiresPhoneCollection` is genuinely exercised), and the grace-skip pair
 * mirrors mfa-grace-period.spec.ts's frictionless-signup pass: signup completes
 * without an MFA wall, and the *next* login is immediately challenged.
 */

const SIGNUP_VERIFICATION_METHOD = process.env.SIGNUP_VERIFICATION_METHOD;
const ENFORCEMENT = process.env.MFA_ENFORCEMENT;
const GRACE_PERIOD = process.env.MFA_GRACE_PERIOD !== undefined ? parseInt(process.env.MFA_GRACE_PERIOD, 10) : undefined;
const SKIP_FOR_SIGNUP = process.env.MFA_GRACE_SKIP_FOR_SIGNUP === 'true';

const READY =
  SIGNUP_VERIFICATION_METHOD === 'email' && ENFORCEMENT === 'REQUIRED' && GRACE_PERIOD === 0 && SKIP_FOR_SIGNUP;

/**
 * Shape of the auth response fields this suite asserts on
 */
type AuthBody = {
  challengeName?: string;
  session?: string;
  accessToken?: string;
  user?: { sub: string; email: string };
  challengeParameters?: Record<string, unknown>;
};

/**
 * Shape of the GetSetupDataResponse body
 */
type SetupDataBody = {
  setupData: { maskedPhone?: string; autoCompleted?: boolean };
};

/**
 * Build a unique test identity so reruns never collide
 */
function makeIdentity(): { email: string; password: string; phoneA: string; phoneB: string } {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    email: `phone-collect-${unique}@example.com`,
    password: 'PhoneCollect!2345',
    // E.164, distinct numbers to exercise "change the number before it's verified"
    phoneA: `+1555${unique.slice(-7)}`,
    phoneB: `+1556${unique.slice(-7)}`,
  };
}

/**
 * Read the JSON body of a response, failing the test on non-JSON payloads
 */
async function body<T>(response: APIResponse): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON response, got status ${response.status()}: ${text.slice(0, 300)}`);
  }
}

/**
 * Poll the demo app's test endpoint for the latest code tied to a challenge session
 */
async function latestCode(baseURL: string, sessionId: string, method?: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const query = method
    ? `sessionId=${encodeURIComponent(sessionId)}&method=${encodeURIComponent(method)}`
    : `sessionId=${encodeURIComponent(sessionId)}`;
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await fetch(`${baseURL}/test/code/latest?${query}`);
    if (response.ok) {
      const parsed = (await response.json()) as { code?: string };
      if (parsed.code) {
        return parsed.code;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No verification code found for session ${sessionId} (method=${method ?? 'n/a'})`);
}

test.describe('MFA_SETUP_REQUIRED SMS phone collection @mfa-phone-collection', () => {
  test.describe.configure({ mode: 'serial' });

  test('collects and can change the phone before verifying it, then issues tokens', async ({ request, baseURL }) => {
    test.skip(
      !READY,
      'Requires a server started with SIGNUP_VERIFICATION_METHOD=email, MFA_ENFORCEMENT=REQUIRED, ' +
        'MFA_GRACE_PERIOD=0 and MFA_GRACE_SKIP_FOR_SIGNUP=true',
    );

    const identity = makeIdentity();

    // ------------------------------------------------------------------
    // Signup - email only, no phone. Grace-skip keeps this frictionless.
    // ------------------------------------------------------------------
    const signup = await request.post(`${baseURL}/auth/signup`, {
      data: { email: identity.email, password: identity.password },
    });
    expect(signup.status()).toBe(201);

    const signupBody = await body<AuthBody>(signup);
    expect(signupBody.challengeName).toBe('VERIFY_EMAIL');

    const emailCode = await latestCode(baseURL!, signupBody.session!);
    const emailStep = await request.post(`${baseURL}/auth/respond-challenge`, {
      data: { session: signupBody.session, type: 'VERIFY_EMAIL', code: emailCode },
    });
    expect(emailStep.ok()).toBe(true);

    // verificationMethod: 'email' + grace-skip → signup completes with no MFA wall
    const emailBody = await body<AuthBody>(emailStep);
    expect(emailBody.challengeName).toBeUndefined();

    // ------------------------------------------------------------------
    // Login - grace is spent for this user, so MFA_SETUP_REQUIRED fires immediately,
    // and the account still has no phone: requiresPhoneCollection must be true.
    // ------------------------------------------------------------------
    const login = await request.post(`${baseURL}/auth/login`, {
      data: { identifier: identity.email, password: identity.password },
    });
    expect(login.ok()).toBe(true);

    const loginBody = await body<AuthBody>(login);
    expect(loginBody.challengeName).toBe('MFA_SETUP_REQUIRED');
    expect(loginBody.session).toBeTruthy();
    expect(loginBody.challengeParameters?.['requiresPhoneCollection']).toBe('true');

    const session = loginBody.session!;

    // ------------------------------------------------------------------
    // Collect the phone number - saves it (unverified) and sends a code.
    // ------------------------------------------------------------------
    const firstSetup = await request.post(`${baseURL}/auth/challenge/setup-data`, {
      data: { session, method: 'sms', setupData: { phoneNumber: identity.phoneA } },
    });
    expect(firstSetup.status()).toBe(200);

    const firstSetupBody = await body<SetupDataBody>(firstSetup);
    expect(firstSetupBody.setupData.autoCompleted).toBeFalsy();
    expect(firstSetupBody.setupData.maskedPhone).toBeTruthy();

    // ------------------------------------------------------------------
    // Change the number before verifying - replaces the phone on file and resends.
    // ------------------------------------------------------------------
    const secondSetup = await request.post(`${baseURL}/auth/challenge/setup-data`, {
      data: { session, method: 'sms', setupData: { phoneNumber: identity.phoneB } },
    });
    expect(secondSetup.status()).toBe(200);

    const secondSetupBody = await body<SetupDataBody>(secondSetup);
    expect(secondSetupBody.setupData.maskedPhone).toBeTruthy();
    expect(secondSetupBody.setupData.maskedPhone).not.toBe(firstSetupBody.setupData.maskedPhone);

    // ------------------------------------------------------------------
    // Verify the (second, current) number's code - completes MFA setup and login.
    // ------------------------------------------------------------------
    const smsCode = await latestCode(baseURL!, session, 'sms');
    const respond = await request.post(`${baseURL}/auth/respond-challenge`, {
      data: { session, type: 'MFA_SETUP_REQUIRED', method: 'sms', setupData: { code: smsCode } },
    });
    expect(respond.ok()).toBe(true);

    const respondBody = await body<AuthBody>(respond);
    expect(respondBody.challengeName).toBeUndefined();

    // ------------------------------------------------------------------
    // Profile reflects the (second) phone number, now verified.
    // Cookies mode: the shared `request` context carries the session cookies set
    // above. JSON mode: attach the bearer token returned in the response body.
    // ------------------------------------------------------------------
    const authHeaders = respondBody.accessToken ? { Authorization: `Bearer ${respondBody.accessToken}` } : undefined;
    const profile = await request.get(`${baseURL}/auth/profile`, { headers: authHeaders });
    expect(profile.ok()).toBe(true);

    const profileBody = await body<{ phone?: string; isPhoneVerified?: boolean }>(profile);
    expect(profileBody.phone).toBe(identity.phoneB);
    expect(profileBody.isPhoneVerified).toBe(true);
  });
});
