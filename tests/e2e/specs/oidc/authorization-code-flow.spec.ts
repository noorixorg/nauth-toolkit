import { test, expect } from '../../fixtures';
import {
  BRIDGE_PREFIX,
  DEMO_CLIENT,
  OIDC_PREFIX,
  RP_CALLBACK_PATH,
  authorizeUrl,
  createPkce,
  decodeJwtClaims,
  exchangeCode,
  interactionUidFrom,
  introspect,
  refreshTokens,
  revoke,
  runAuthorizationFlow,
  type InteractionState,
} from '../../oidc-helpers';

/**
 * OpenID Connect provider — the authorization code flow.
 *
 * The demo acts as an authorization server for a third-party client. A user signs in
 * through nauth's own flow, completing whatever challenges the running configuration
 * demands, and the relying party then receives a code it exchanges for tokens.
 *
 * The point being tested is the seam: the provider owns the protocol, nauth owns
 * identity, and neither has to know much about the other. Nothing here drives a
 * challenge component directly — the existing auth suite covers those — but the flow
 * genuinely passes through them.
 *
 * Runs in the dedicated `oidc` project: the flow is browser-shaped, and the
 * interaction bridge needs nauth's session cookie, which has no analogue in
 * bearer-token mode. Run it alone with `npx playwright test --project oidc`.
 */
test.describe('OIDC Provider: authorization code flow', () => {
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const redirectUri = `${baseUrl}${RP_CALLBACK_PATH}`;

  test.beforeAll(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'oidc', 'Runs in the dedicated `oidc` project');
  });

  // ==========================================================================
  // Metadata — no session needed
  // ==========================================================================

  test.describe('provider metadata', () => {
    test('discovery advertises the endpoints where they are actually mounted', async ({ api }) => {
      const response = await api.get('/.well-known/openid-configuration');
      expect(response.status()).toBe(200);

      const doc = (await response.json()) as Record<string, string & string[]>;

      // Regression guard for the mount. Configuring a path-prefixed issuer instead of
      // prefixed routes silently drops the prefix from every generated URL, leaving a
      // discovery document whose endpoints all 404.
      expect(doc.authorization_endpoint).toContain(`${OIDC_PREFIX}/auth`);
      expect(doc.token_endpoint).toContain(`${OIDC_PREFIX}/token`);
      expect(doc.jwks_uri).toContain(`${OIDC_PREFIX}/jwks`);
      expect(doc.userinfo_endpoint).toContain(`${OIDC_PREFIX}/me`);
    });

    test('only the authorization code flow and S256 PKCE are offered', async ({ api }) => {
      const doc = (await (await api.get('/.well-known/openid-configuration')).json()) as Record<string, string[]>;

      expect(doc.response_types_supported).toEqual(['code']);
      expect(doc.code_challenge_methods_supported).toEqual(['S256']);
      // The implicit and hybrid flows return tokens in the URL fragment and are
      // removed in OAuth 2.1. They must not be advertised.
      expect(doc.grant_types_supported).not.toContain('implicit');
      expect(doc.grant_types_supported).not.toContain('password');
    });

    test('the JWKS is published with a key id for offline verification', async ({ api }) => {
      const response = await api.get(`${OIDC_PREFIX}/jwks`);
      expect(response.status()).toBe(200);

      const jwks = (await response.json()) as { keys: { kid?: string; use?: string; alg?: string }[] };
      expect(jwks.keys.length).toBeGreaterThan(0);
      expect(jwks.keys[0].kid).toBeTruthy();
      // Private material must never appear in a published key set.
      expect(JSON.stringify(jwks)).not.toContain('"d"');
    });

    test('an anonymous authorization request is told a login is required', async ({ api }) => {
      const start = await api.get(authorizeUrl({ redirectUri, pkce: createPkce() }), { maxRedirects: 0 });
      expect(start.status()).toBe(303);

      const state = (await (
        await api.get(`${BRIDGE_PREFIX}/${interactionUidFrom(start)}`)
      ).json()) as InteractionState;

      expect(state.prompt).toBe('login');
      expect(state.gate).toBe('login_required');
      expect(state.gateReason).toBe('no_session');
      expect(state.client.clientId).toBe(DEMO_CLIENT.clientId);
    });

    test('an unregistered redirect_uri is refused without redirecting to it', async ({ api }) => {
      const response = await api.get(
        authorizeUrl({ redirectUri: 'https://evil.example.com/steal', pkce: createPkce() }),
        { maxRedirects: 0 },
      );

      // Redirecting here would be an open redirect: the server has not confirmed that
      // URI belongs to the client.
      expect(response.status()).not.toBe(303);
      expect(response.headers()['location'] ?? '').not.toContain('evil.example.com');
    });

    test('an unknown client is refused', async ({ api }) => {
      const response = await api.get(
        authorizeUrl({ clientId: 'no-such-client', redirectUri, pkce: createPkce() }),
        { maxRedirects: 0 },
      );
      expect(response.status()).not.toBe(303);
    });
  });

  // ==========================================================================
  // The full flow, against a real signed-in user
  // ==========================================================================

  test.describe.serial('a partner application signs a user in', () => {
    test('a user completes nauth signup, including every configured challenge', async ({
      flows,
      flowState,
      authConfig,
      mail,
      sms,
    }) => {
      const signup = await flows.signup(flowState.userEmail, flowState.userPhone);
      expect(signup.success).toBe(true);

      // Walk whatever chain this configuration produces. Which challenges appear is
      // the auth suite's concern; here it only matters that the OIDC flow inherits a
      // fully authenticated user at the end of it.
      let challenge = signup.data?.challengeName;
      for (let step = 0; challenge && step < 6; step += 1) {
        const session = flowState.challengeSession;
        expect(session).toBeTruthy();

        let code: string | undefined;
        if (challenge === 'VERIFY_EMAIL') {
          code = await mail.latestCode(session!);
        } else if (challenge === 'VERIFY_PHONE') {
          code = await sms.latestCode(session!);
        }

        if (!code) {
          // An MFA challenge needs an enrolled device, which this suite does not set
          // up. Stop here and let the assertion below decide whether that is a problem.
          break;
        }

        const result = await flows.completeChallenge(challenge, code);
        expect(result.success).toBe(true);
        challenge = result.data?.challengeName;
      }

      void authConfig;
      expect(challenge).toBeFalsy();
    });

    test('the authorization request completes and the client receives a code', async ({ api, flowState }) => {
      const login = await api.post('/auth/login', {
        data: { email: flowState.userEmail, password: flowState.password },
      });
      expect(login.ok()).toBe(true);

      const pkce = createPkce();
      const { callback } = await runAuthorizationFlow(api, {
        redirectUri,
        pkce,
        state: 'partner-state-123',
        nonce: 'partner-nonce-abc',
      });

      expect(callback.pathname).toBe(RP_CALLBACK_PATH);
      expect(callback.searchParams.get('state')).toBe('partner-state-123');
      expect(callback.searchParams.get('error')).toBeNull();
      expect(callback.searchParams.get('code')).toBeTruthy();

      flowState.oidcCode = callback.searchParams.get('code')!;
      flowState.oidcVerifier = pkce.verifier;
    });

    test('the code exchanges for an access token, refresh token and id_token', async ({ api, flowState }) => {
      const tokens = await exchangeCode(api, flowState.oidcCode!, redirectUri, flowState.oidcVerifier!);

      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.access_token).toBeTruthy();
      expect(tokens.refresh_token).toBeTruthy();
      expect(tokens.id_token).toBeTruthy();
      expect(tokens.scope).toContain('openid');

      const claims = decodeJwtClaims(tokens.id_token);
      expect(claims.aud).toBe(DEMO_CLIENT.clientId);
      expect(claims.nonce).toBe('partner-nonce-abc');
      expect(claims.sub).toBeTruthy();

      // The subject must be nauth's external identifier, never an internal row id.
      expect(String(claims.sub)).not.toMatch(/^\d+$/);

      flowState.oidcTokens = tokens;
    });

    test('a replayed authorization code is rejected', async ({ api, flowState }) => {
      const replay = await exchangeCode(api, flowState.oidcCode!, redirectUri, flowState.oidcVerifier!);
      expect(replay.error).toBe('invalid_grant');
      expect(replay.access_token).toBeUndefined();
    });

    test('UserInfo releases only the claims the granted scopes allow', async ({ api, flowState }) => {
      const response = await api.get(`${OIDC_PREFIX}/me`, {
        headers: { authorization: `Bearer ${flowState.oidcTokens!.access_token}` },
      });
      expect(response.status()).toBe(200);

      const claims = (await response.json()) as Record<string, unknown>;
      expect(claims.sub).toBe(decodeJwtClaims(flowState.oidcTokens!.id_token).sub);
      expect(claims.email).toBe(flowState.userEmail.toLowerCase());
    });

    test('introspection reports the token as active, with its binding claims', async ({ api, flowState }) => {
      const result = await introspect(api, flowState.oidcTokens!.access_token);

      expect(result.active).toBe(true);
      expect(result.client_id).toBe(DEMO_CLIENT.clientId);
      expect(result.scope).toContain('openid');
      expect(result.exp).toEqual(expect.any(Number));
    });

    test('the refresh token rotates', async ({ api, flowState }) => {
      const refreshed = await refreshTokens(api, flowState.oidcTokens!.refresh_token);

      expect(refreshed.access_token).toBeTruthy();
      expect(refreshed.access_token).not.toBe(flowState.oidcTokens!.access_token);

      flowState.oidcTokens = { ...flowState.oidcTokens!, ...refreshed };
    });

    test('a revoked token introspects as inactive and leaks nothing', async ({ api, flowState }) => {
      await revoke(api, flowState.oidcTokens!.access_token);

      const result = await introspect(api, flowState.oidcTokens!.access_token);
      expect(result.active).toBe(false);
      // An inactive token must reveal nothing about who it belonged to.
      expect(result.sub).toBeUndefined();
      expect(result.scope).toBeUndefined();
    });

    test('an already signed-in user is not asked to log in again', async ({ api }) => {
      const start = await api.get(authorizeUrl({ redirectUri, pkce: createPkce() }), { maxRedirects: 0 });
      expect(start.status()).toBe(303);

      const state = (await (
        await api.get(`${BRIDGE_PREFIX}/${interactionUidFrom(start)}`)
      ).json()) as InteractionState;

      // The provider's own session is established, and nauth's gate agrees.
      expect(state.gate).toBe('authenticated');
      expect(state.sub).toBeTruthy();
    });

    test('refusing consent returns access_denied to the relying party', async ({ api }) => {
      const start = await api.get(
        authorizeUrl({ redirectUri, pkce: createPkce(), state: 'deny-state', prompt: 'consent' }),
        { maxRedirects: 0 },
      );
      let uid = interactionUidFrom(start);

      const state = (await (await api.get(`${BRIDGE_PREFIX}/${uid}`)).json()) as InteractionState;
      if (state.prompt === 'login') {
        const login = await api.post(`${BRIDGE_PREFIX}/${uid}/login`, { maxRedirects: 0 });
        const { redirectTo } = (await login.json()) as { redirectTo: string };
        uid = interactionUidFrom(await api.get(redirectTo, { maxRedirects: 0 }));
      }

      const denied = await api.post(`${BRIDGE_PREFIX}/${uid}/confirm`, {
        data: { approve: false },
        maxRedirects: 0,
      });
      const { redirectTo } = (await denied.json()) as { redirectTo: string };
      const final = await api.get(redirectTo, { maxRedirects: 0 });
      const callback = new URL(final.headers()['location'] ?? '');

      expect(callback.pathname).toBe(RP_CALLBACK_PATH);
      expect(callback.searchParams.get('error')).toBe('access_denied');
      expect(callback.searchParams.get('state')).toBe('deny-state');
      expect(callback.searchParams.get('code')).toBeNull();
    });
  });
});
