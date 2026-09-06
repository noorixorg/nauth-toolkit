/**
 * Interoperability with a certified relying party.
 *
 * The other specs here drive the provider with hand-written requests, which proves it
 * is self-consistent but not that it is *correct*. This one hands the whole flow to
 * `openid-client` — a separate, OpenID Certified implementation by a different author
 * — and lets it discover the provider, run the code exchange, verify the id_token
 * signature against the published JWKS, and call the protected endpoints.
 *
 * If the discovery document, the JWKS, the token response or the id_token claims are
 * wrong in any way a real client would notice, this fails.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type Provider from 'oidc-provider';
import type { Repository } from 'typeorm';
import { MemoryStorageAdapter, ContextStorage, type BaseUser, type NAuthConfig } from '@nauth-toolkit/core';
import { IdpSessionGate } from '@nauth-toolkit/core/internal';
import { createNAuthOIDCProvider } from './create-provider';
import { loadESM } from './load-esm';
import { OIDCInteractionBridge } from './interaction-bridge';
import { isProviderPath } from './mount/express';

/** `openid-client` is ESM-only, so it is loaded at runtime rather than imported. */
type OpenIdClient = typeof import('openid-client');
let client: OpenIdClient;

/**
 * Load the ESM-only client from this CommonJS test runtime.
 *
 * Shares `loadESM` with the provider loader rather than repeating a `Function`-wrapped
 * dynamic import here — see that function for why a second, byte-identical copy of that
 * source in this package made whichever spec ran second fail against a torn-down
 * environment.
 */
function loadOpenIdClient(): Promise<OpenIdClient> {
  return loadESM<OpenIdClient>('openid-client');
}

const PREFIX = '/oidc';
const CLIENT_ID = 'certified-rp';
const CLIENT_SECRET = 'certified-rp-secret';

const user = {
  id: 1,
  sub: '4cf0ff4c-74ea-4178-b3f4-bf6d715bb3ea',
  email: 'ada@example.com',
  username: 'ada',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: null,
  isEmailVerified: true,
  isPhoneVerified: false,
  isActive: true,
  isLocked: false,
  lockedUntil: null,
  mustChangePassword: false,
  updatedAt: new Date('2026-01-01'),
} as unknown as BaseUser;

describe('interop with a certified relying party (openid-client)', () => {
  let storage: MemoryStorageAdapter;
  let provider: Provider;
  let bridge: OIDCInteractionBridge;
  let server: http.Server;
  let issuer: string;
  let redirectUri: string;
  let jar: Map<string, string>;

  const capture = (r: Response): void => {
    for (const c of r.headers.getSetCookie()) {
      const [k, v] = c.split(';')[0].split('=');
      jar.set(k, v);
    }
  };
  const cookieHeader = (): string => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

  beforeAll(async () => {
    client = await loadOpenIdClient();
    storage = new MemoryStorageAdapter();
    await storage.initialize();
    jar = new Map();

    const userRepository = {
      findOne: async ({ where }: { where: { sub?: string } }) => (where.sub === user.sub ? user : null),
    } as unknown as Repository<BaseUser>;

    // Bind first so the issuer can carry the real port — a certified client checks
    // that every discovered endpoint shares the issuer's origin.
    server = http.createServer(() => undefined);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    issuer = `http://127.0.0.1:${port}`;
    redirectUri = `${issuer}/rp/callback`;

    provider = await createNAuthOIDCProvider({
      issuer,
      pathPrefix: PREFIX,
      interactionUrl: (uid) => `/interaction/${uid}`,
      storage,
      userRepository,
      cookieKeys: ['interop-key'],
      secureCookies: false,
      clients: [
        {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          client_name: 'Certified RP',
          redirect_uris: [redirectUri],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
        },
      ],
    });

    bridge = new OIDCInteractionBridge(
      provider,
      new IdpSessionGate(userRepository, { signup: { verificationMethod: 'none' } } as unknown as NAuthConfig),
    );

    const callback = provider.callback();
    server.removeAllListeners('request');
    server.on('request', (req, res) => {
      const path = (req.url ?? '/').split('?')[0];

      if (isProviderPath({ url: req.url }, PREFIX)) {
        (callback as unknown as (rq: unknown, rs: unknown) => void)(req, res);
        return;
      }

      const match = /^\/bridge\/([^/]+)\/(login|confirm)$/.exec(path);
      if (match) {
        void ContextStorage.run(async () => {
          ContextStorage.set('CURRENT_USER', user);
          const out =
            match[2] === 'login'
              ? await bridge.completeLogin(req, res)
              : await bridge.completeConsent(req, res, { approve: true });
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(out));
        });
        return;
      }

      res.writeHead(404).end();
    });
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await storage.disconnect();
  });

  /**
   * Play the browser's part: follow the provider's redirects, answering the login and
   * consent prompts through the bridge, until it lands on the client's redirect URI.
   */
  const completeInBrowser = async (authorizationUrl: URL): Promise<URL> => {
    let response = await fetch(authorizationUrl, { redirect: 'manual', headers: { cookie: cookieHeader() } });
    capture(response);

    for (let hop = 0; hop < 6; hop += 1) {
      const location = response.headers.get('location') ?? '';
      if (location.startsWith(redirectUri)) {
        return new URL(location);
      }

      const uid = location.split('?')[0].split('/').filter(Boolean).pop();
      if (!uid) {
        throw new Error(`Unexpected hop: ${location || `status ${response.status}`}`);
      }

      // Which prompt this is decides which bridge endpoint answers it.
      const action = hop === 0 ? 'login' : 'confirm';
      const answered = await fetch(`${issuer}/bridge/${uid}/${action}`, {
        method: 'POST',
        headers: { cookie: cookieHeader() },
      });
      capture(answered);
      const { redirectTo } = (await answered.json()) as { redirectTo: string };

      response = await fetch(redirectTo, { redirect: 'manual', headers: { cookie: cookieHeader() } });
      capture(response);
    }

    throw new Error('The flow did not reach the redirect URI');
  };

  it('a certified client discovers the provider from its issuer alone', async () => {
    const config = await client.discovery(
      new URL(issuer),
      CLIENT_ID,
      CLIENT_SECRET,
      undefined,
      // The provider is plain http in this test; a real deployment is https.
      { execute: [client.allowInsecureRequests] },
    );

    const metadata = config.serverMetadata();
    expect(metadata.issuer).toBe(issuer);
    expect(metadata.authorization_endpoint).toBe(`${issuer}${PREFIX}/auth`);
    expect(metadata.token_endpoint).toBe(`${issuer}${PREFIX}/token`);
    expect(metadata.jwks_uri).toBe(`${issuer}${PREFIX}/jwks`);
  });

  it('runs the full code flow and verifies the id_token against the published JWKS', async () => {
    const config = await client.discovery(new URL(issuer), CLIENT_ID, CLIENT_SECRET, undefined, {
      execute: [client.allowInsecureRequests],
    });

    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    const callbackUrl = await completeInBrowser(authorizationUrl);
    expect(callbackUrl.searchParams.get('code')).toBeTruthy();

    // This is the part that matters: the client validates state, exchanges the code,
    // fetches the JWKS, verifies the id_token signature, and checks iss, aud, exp and
    // nonce. Anything malformed throws here rather than being asserted around.
    const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
      expectedNonce: nonce,
    });

    expect(tokens.token_type.toLowerCase()).toBe('bearer');
    expect(tokens.access_token).toEqual(expect.any(String));
    expect(tokens.refresh_token).toEqual(expect.any(String));
    expect(tokens.id_token).toEqual(expect.any(String));

    const claims = tokens.claims();
    expect(claims?.sub).toBe(user.sub);
    expect(claims?.iss).toBe(issuer);
    expect(claims?.aud).toBe(CLIENT_ID);

    // And the protected endpoints answer that same client.
    const info = await client.fetchUserInfo(config, tokens.access_token, claims!.sub);
    expect(info.sub).toBe(user.sub);
    expect(info.email).toBe('ada@example.com');
    expect(info.given_name).toBe('Ada');
    expect(info.family_name).toBe('Lovelace');
  });

  it('refreshes and introspects through the certified client', async () => {
    const config = await client.discovery(new URL(issuer), CLIENT_ID, CLIENT_SECRET, undefined, {
      execute: [client.allowInsecureRequests],
    });

    jar = new Map();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();

    const callbackUrl = await completeInBrowser(
      client.buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: 'openid email offline_access',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
      }),
    );

    const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
    });

    const introspected = await client.tokenIntrospection(config, tokens.access_token);
    expect(introspected.active).toBe(true);
    expect(introspected.client_id).toBe(CLIENT_ID);

    const refreshed = await client.refreshTokenGrant(config, tokens.refresh_token!);
    expect(refreshed.access_token).toEqual(expect.any(String));
    expect(refreshed.access_token).not.toBe(tokens.access_token);

    await client.tokenRevocation(config, refreshed.access_token);
    const afterRevocation = await client.tokenIntrospection(config, refreshed.access_token);
    expect(afterRevocation.active).toBe(false);
  });

  it('rejects a tampered state, so the client never completes the exchange', async () => {
    const config = await client.discovery(new URL(issuer), CLIENT_ID, CLIENT_SECRET, undefined, {
      execute: [client.allowInsecureRequests],
    });

    jar = new Map();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();

    const callbackUrl = await completeInBrowser(
      client.buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: 'openid',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
      }),
    );

    await expect(
      client.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: 'a-different-state',
      }),
    ).rejects.toThrow();
  });
});
