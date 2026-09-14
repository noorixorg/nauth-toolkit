import { test, expect } from '../../fixtures';

/**
 * Timezone and locale preferences
 *
 * The frontend SDK detects these from the browser and sends them with signup. This suite
 * covers the server half of that contract: the fields are accepted, survive the
 * verification challenge flow, are echoed on the profile, and stay editable afterwards.
 *
 * The SDK's browser detection itself is unit-tested in
 * `packages/client/src/core/environment.ts` — this suite drives the API directly and never
 * loads the SDK, so it proves the API accepts what the SDK sends, not that it sends it.
 */
test.describe('User timezone and locale', () => {
  const uniqueEmail = (): string => `tz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  /** E.164 phone — configs using verificationMethod 'both' require one at signup. */
  const uniquePhone = (): string => `+1415${Math.floor(1000000 + Math.random() * 8999999)}`;

  /**
   * Sign up and clear whatever verification challenges the running config demands, so the
   * session is authenticated and `/auth/profile` is reachable.
   */
  /**
   * Sign up and clear whatever verification challenges the running config demands.
   *
   * Returns the challenge still outstanding, if any. With `mfa.gracePeriod = 0` the flow
   * ends on `MFA_SETUP_REQUIRED`, which leaves the session unauthenticated — the caller
   * skips rather than asserting, matching how the rest of this suite handles a config it
   * does not apply to.
   */
  const signupAndVerify = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { flows, mail, sms }: any,
    extra?: Record<string, unknown>,
  ): Promise<string | undefined> => {
    const result = await flows.signup(uniqueEmail(), uniquePhone(), extra);
    expect(result.success, `signup failed: ${JSON.stringify(result.data)}`).toBe(true);

    let challenge = result.data?.challengeName as string | undefined;
    let session = result.data?.session as string | undefined;

    while (challenge === 'VERIFY_EMAIL' || challenge === 'VERIFY_PHONE') {
      const code = challenge === 'VERIFY_EMAIL' ? await mail.latestCode(session) : await sms.latestCode(session);
      expect(code, `no ${challenge} code delivered`).toBeTruthy();

      const completed = await flows.completeChallenge(challenge, code);
      expect(completed.success, `${challenge} failed: ${JSON.stringify(completed.data)}`).toBe(true);

      challenge = completed.data?.challengeName as string | undefined;
      session = completed.data?.session as string | undefined;
    }

    return challenge;
  };

  test('signup persists timezone and locale and echoes them on the profile', async ({
    api,
    baseURL,
    flows,
    mail,
    sms,
  }) => {
    const pending = await signupAndVerify({ flows, mail, sms }, { timezone: 'Asia/Karachi', locale: 'en-GB' });
    test.skip(!!pending, `session blocked by ${pending} — needs a config where signup completes`);

    const profile = await api.get(`${baseURL}/auth/profile`);
    expect(profile.status()).toBe(200);
    const body = await profile.json();
    expect(body.timezone).toBe('Asia/Karachi');
    expect(body.locale).toBe('en-GB');
  });

  test('signup without them succeeds and leaves both null', async ({
    api,
    baseURL,
    flows,
    mail,
    sms,
  }) => {
    // Optional means optional: clients that never send these keep working unchanged.
    const pending = await signupAndVerify({ flows, mail, sms });
    test.skip(!!pending, `session blocked by ${pending} — needs a config where signup completes`);

    const profile = await api.get(`${baseURL}/auth/profile`);
    expect(profile.status()).toBe(200);
    const body = await profile.json();
    expect(body.timezone ?? null).toBeNull();
    expect(body.locale ?? null).toBeNull();
  });

  test('rejects an unknown timezone at signup', async ({ api, baseURL, endpoints }) => {
    const signup = await api.post(`${baseURL}${endpoints.signup}`, {
      data: {
        email: uniqueEmail(),
        phone: uniquePhone(),
        password: 'SecurePass123!',
        timezone: 'Mars/Olympus',
      },
    });

    expect(signup.status()).toBe(400);
  });

  test('profile update changes both fields', async ({ api, baseURL, flows, mail, sms }, testInfo) => {
    // Cookies-only. In json/bearer mode there is no CSRF cookie for the fixture to echo,
    // and the shipped profile route still requires the header on a state-changing request,
    // so the PUT returns AUTH_CSRF_TOKEN_MISSING. That is existing CSRF behaviour, not
    // something these fields introduce — this spec is simply the first in the suite to
    // issue an api.put at all.
    test.skip(testInfo.project.name === 'json', 'json mode has no CSRF cookie to send on a PUT');

    const pending = await signupAndVerify({ flows, mail, sms }, { timezone: 'UTC', locale: 'en-US' });
    test.skip(!!pending, `session blocked by ${pending} — needs a config where signup completes`);

    const updated = await api.put(`${baseURL}/auth/profile`, {
      data: { timezone: 'Europe/Dublin', locale: 'en-GB' },
    });
    expect(updated.status()).toBe(200);
    const updatedBody = await updated.json();
    expect(updatedBody.timezone).toBe('Europe/Dublin');
    expect(updatedBody.locale).toBe('en-GB');

    const profile = await api.get(`${baseURL}/auth/profile`);
    expect((await profile.json()).timezone).toBe('Europe/Dublin');
  });
});
