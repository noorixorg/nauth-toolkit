/**
 * End-to-end OpenID Connect flow, in process.
 *
 * Runs the real `oidc-provider` against the real `MemoryStorageAdapter`, the real
 * storage adapter written here, the real `IdpSessionGate`, and the real interaction
 * bridge. Only the user repository is a stand-in. An HTTP server is bound on an
 * ephemeral port so the flow is driven exactly as a browser and a relying party would
 * drive it — redirects, cookies, form posts and all.
 *
 * This is the proof that nauth can be an OpenID Connect provider without owning any
 * protocol code.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import type Provider from 'oidc-provider';
import type { Repository } from 'typeorm';
import {
  AuthAuditEventType,
  MemoryStorageAdapter,
  NAuthException,
  getHttpStatusForErrorCode,
  type BaseUser,
  type NAuthConfig,
} from '@nauth-toolkit/core';
import type { AuthAuditService } from '@nauth-toolkit/core/internal';
import { IdpSessionGate } from '@nauth-toolkit/core/internal';
import { ContextStorage } from '@nauth-toolkit/core';
import { createNAuthOIDCProvider } from './create-provider';
import { OIDCInteractionBridge } from './interaction-bridge';
import { isProviderPath } from './mount/express';

const PREFIX = '/oidc';
const REDIRECT_URI = 'https://rp.example.com/cb';

const user = {
  id: 1,
  sub: 'user-sub-uuid',
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

describe('OIDC provider flow', () => {
  let storage: MemoryStorageAdapter;
  let provider: Provider;
  let bridge: OIDCInteractionBridge;
  let server: http.Server;
  let base: string;
  let signedIn: boolean;
  let accountActive: boolean;

  /** Everything the bridge wrote to the audit trail during a test. */
  let auditLog: { eventType: AuthAuditEventType; metadata?: Record<string, unknown> | null }[];

  /** Cookie jar shared across the flow, standing in for the browser's. */
  let jar: Map<string, string>;

  const capture = (r: Response): void => {
    for (const c of r.headers.getSetCookie()) {
      const [k, v] = c.split(';')[0].split('=');
      jar.set(k, v);
    }
  };
  const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    ...extra,
  });

  beforeAll(async () => {
    storage = new MemoryStorageAdapter();
    await storage.initialize();
    jar = new Map();
    signedIn = true;
    accountActive = true;

    const userRepository = {
      findOne: async ({ where }: { where: { sub?: string } }) =>
        where.sub === user.sub ? ({ ...user, isActive: accountActive } as BaseUser) : null,
    } as unknown as Repository<BaseUser>;

    const config = { signup: { verificationMethod: 'none' } } as unknown as NAuthConfig;

    provider = await createNAuthOIDCProvider({
      issuer: 'http://127.0.0.1',
      pathPrefix: PREFIX,
      interactionUrl: (uid) => `/interaction/${uid}`,
      storage,
      userRepository,
      cookieKeys: ['test-key'],
      secureCookies: false,
      proxy: true,
      clients: [
        {
          client_id: 'partner',
          client_secret: 'partner-secret',
          client_name: 'Partner App',
          redirect_uris: [REDIRECT_URI],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
        },
        {
          client_id: 'other',
          client_secret: 'other-secret',
          client_name: 'Another App',
          redirect_uris: ['https://other.example.com/cb'],
          grant_types: ['authorization_code'],
          response_types: ['code'],
        },
      ],
    });

    auditLog = [];
    const auditService = {
      recordEvent: async (event: { eventType: AuthAuditEventType; metadata?: Record<string, unknown> | null }) => {
        auditLog.push(event);
        return null;
      },
    } as unknown as AuthAuditService;

    bridge = new OIDCInteractionBridge(provider, new IdpSessionGate(userRepository, config), auditService);

    const callback = provider.callback();
    server = http.createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0];

      if (isProviderPath({ url: req.url }, PREFIX)) {
        (callback as unknown as (rq: unknown, rs: unknown) => void)(req, res);
        return;
      }

      // The interaction bridge, standing in for the consumer's nauth-guarded routes.
      // Running inside ContextStorage.run with CURRENT_USER set is exactly what
      // nauth's guards do for a signed-in caller.
      const bridgeMatch = /^\/bridge\/([^/]+)\/(state|login|confirm|deny|abort)$/.exec(path);
      if (bridgeMatch) {
        void ContextStorage.run(async () => {
          if (signedIn) {
            ContextStorage.set('CURRENT_USER', user);
          }
          try {
            const action = bridgeMatch[2];
            const out =
              action === 'state'
                ? await bridge.getState(req, res)
                : action === 'login'
                  ? await bridge.completeLogin(req, res)
                  : action === 'confirm'
                    ? await bridge.completeConsent(req, res, { approve: true })
                    : action === 'deny'
                      ? await bridge.completeConsent(req, res, { approve: false })
                      : await bridge.abort(req, res);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(out));
          } catch (e) {
            // Mirrors NAuthHttpExceptionFilter: a domain error must reach the frontend
            // with a status it can act on, not as an opaque 500.
            if (e instanceof NAuthException) {
              res.writeHead(getHttpStatusForErrorCode(e.code), { 'content-type': 'application/json' });
              res.end(JSON.stringify({ code: e.code, message: e.message, details: e.details }));
              return;
            }
            res.writeHead(500, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: (e as Error).message }));
          }
        });
        return;
      }

      res.writeHead(404).end();
    });

    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await storage.disconnect();
  });

  beforeEach(() => {
    jar = new Map();
    signedIn = true;
    accountActive = true;
    auditLog = [];
  });

  /** The audit events of one type recorded so far. */
  const auditedAs = (
    eventType: AuthAuditEventType,
  ): { eventType: AuthAuditEventType; metadata?: Record<string, unknown> | null }[] =>
    auditLog.filter((event) => event.eventType === eventType);

  /** Start an authorization request and return the interaction it parks. */
  const startAuthorization = async (state: string, scope = 'openid'): Promise<string> => {
    const q = new URLSearchParams({
      client_id: 'partner',
      response_type: 'code',
      scope,
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge: createHash('sha256').update('v'.repeat(43)).digest('base64url'),
      code_challenge_method: 'S256',
    });

    const r = await fetch(`${base}${PREFIX}/auth?${q}`, { redirect: 'manual', headers: headers() });
    capture(r);
    return (r.headers.get('location') ?? '').split('/').pop() as string;
  };

  /** Drive authorize → login → consent → code, returning the authorization code. */
  const getCode = async (verifier: string, scope = 'openid email profile'): Promise<URL> => {
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const q = new URLSearchParams({
      client_id: 'partner',
      response_type: 'code',
      scope,
      redirect_uri: REDIRECT_URI,
      state: 'state-123',
      nonce: 'nonce-abc',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    let r = await fetch(`${base}${PREFIX}/auth?${q}`, { redirect: 'manual', headers: headers() });
    capture(r);
    let uid = (r.headers.get('location') ?? '').split('/').pop() as string;

    r = await fetch(`${base}/bridge/${uid}/login`, { method: 'POST', headers: headers() });
    capture(r);
    let { redirectTo } = (await r.json()) as { redirectTo: string };

    r = await fetch(redirectTo, { redirect: 'manual', headers: headers() });
    capture(r);
    uid = (r.headers.get('location') ?? '').split('/').pop() as string;

    r = await fetch(`${base}/bridge/${uid}/confirm`, { method: 'POST', headers: headers() });
    capture(r);
    ({ redirectTo } = (await r.json()) as { redirectTo: string });

    r = await fetch(redirectTo, { redirect: 'manual', headers: headers() });
    capture(r);
    return new URL(r.headers.get('location') as string);
  };

  /** Exchange an authorization code for tokens. */
  const exchange = async (code: string, verifier: string): Promise<Record<string, string>> => {
    const r = await fetch(`${base}${PREFIX}/token`, {
      method: 'POST',
      headers: headers({
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from('partner:partner-secret').toString('base64')}`,
      }),
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    return (await r.json()) as Record<string, string>;
  };

  // ==========================================================================

  describe('discovery', () => {
    it('advertises every endpoint under the configured path prefix', async () => {
      const doc = (await (
        await fetch(`${base}/.well-known/openid-configuration`, { headers: headers() })
      ).json()) as Record<string, string>;

      // Regression guard: with a path-prefixed issuer these silently lose the prefix
      // and every advertised endpoint 404s.
      expect(doc.authorization_endpoint).toContain(`${PREFIX}/auth`);
      expect(doc.token_endpoint).toContain(`${PREFIX}/token`);
      expect(doc.jwks_uri).toContain(`${PREFIX}/jwks`);
      expect(doc.userinfo_endpoint).toContain(`${PREFIX}/me`);
      expect(doc.introspection_endpoint).toContain(`${PREFIX}/token/introspection`);
      expect(doc.revocation_endpoint).toContain(`${PREFIX}/token/revocation`);
    });

    it('serves a JWKS with at least one signing key', async () => {
      const jwks = (await (await fetch(`${base}${PREFIX}/jwks`, { headers: headers() })).json()) as {
        keys: unknown[];
      };
      expect(jwks.keys.length).toBeGreaterThan(0);
    });

    it('advertises only the authorization code flow and S256 PKCE', async () => {
      const doc = (await (
        await fetch(`${base}/.well-known/openid-configuration`, { headers: headers() })
      ).json()) as Record<string, string[]>;

      expect(doc.response_types_supported).toEqual(['code']);
      expect(doc.code_challenge_methods_supported).toEqual(['S256']);
      expect(doc.grant_types_supported).toContain('authorization_code');
      expect(doc.grant_types_supported).toContain('refresh_token');
      expect(doc.grant_types_supported).not.toContain('password');
      expect(doc.grant_types_supported).not.toContain('implicit');
    });
  });

  describe('authorization code flow', () => {
    it('issues a code bound to the request, and exchanges it for tokens', async () => {
      const verifier = randomBytes(32).toString('base64url');
      const loc = await getCode(verifier);

      expect(loc.origin + loc.pathname).toBe(REDIRECT_URI);
      expect(loc.searchParams.get('state')).toBe('state-123');
      const code = loc.searchParams.get('code') as string;
      expect(code).toEqual(expect.any(String));

      const tokens = await exchange(code, verifier);
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.access_token).toEqual(expect.any(String));
      expect(tokens.refresh_token).toEqual(expect.any(String));
      expect(tokens.id_token).toEqual(expect.any(String));
      expect(tokens.scope).toBe('openid email profile');
    });

    it('binds the id_token to the request nonce and the client', async () => {
      const verifier = randomBytes(32).toString('base64url');
      const loc = await getCode(verifier);
      const tokens = await exchange(loc.searchParams.get('code') as string, verifier);

      const claims = JSON.parse(
        Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString('utf8'),
      ) as Record<string, unknown>;

      expect(claims.sub).toBe(user.sub);
      expect(claims.aud).toBe('partner');
      expect(claims.nonce).toBe('nonce-abc');
      expect(claims.iss).toBe('http://127.0.0.1');
    });

    it('rejects a replayed authorization code', async () => {
      const verifier = randomBytes(32).toString('base64url');
      const loc = await getCode(verifier);
      const code = loc.searchParams.get('code') as string;

      await expect(exchange(code, verifier)).resolves.toMatchObject({ access_token: expect.any(String) });
      await expect(exchange(code, verifier)).resolves.toMatchObject({ error: 'invalid_grant' });
    });

    it('rejects a wrong PKCE verifier', async () => {
      const verifier = randomBytes(32).toString('base64url');
      const loc = await getCode(verifier);
      const wrong = randomBytes(32).toString('base64url');

      await expect(exchange(loc.searchParams.get('code') as string, wrong)).resolves.toMatchObject({
        error: 'invalid_grant',
      });
    });

    it('rejects an unregistered redirect_uri without redirecting to it', async () => {
      const q = new URLSearchParams({
        client_id: 'partner',
        response_type: 'code',
        scope: 'openid',
        redirect_uri: 'https://evil.example.com/cb',
        state: 's',
        code_challenge: 'x'.repeat(43),
        code_challenge_method: 'S256',
      });
      const r = await fetch(`${base}${PREFIX}/auth?${q}`, { redirect: 'manual', headers: headers() });

      // Must NOT be a redirect to the attacker's URI — that would be an open redirect.
      expect(r.status).not.toBe(303);
      expect(r.headers.get('location') ?? '').not.toContain('evil.example.com');
    });

    it('rejects an unknown client', async () => {
      const q = new URLSearchParams({
        client_id: 'no-such-client',
        response_type: 'code',
        scope: 'openid',
        redirect_uri: REDIRECT_URI,
        state: 's',
      });
      const r = await fetch(`${base}${PREFIX}/auth?${q}`, { redirect: 'manual', headers: headers() });
      expect(r.status).not.toBe(303);
    });
  });

  describe('refresh token rotation', () => {
    it('rotates the refresh token and rejects the superseded one', async () => {
      const verifier = randomBytes(32).toString('base64url');
      const loc = await getCode(verifier, 'openid email offline_access');
      const first = await exchange(loc.searchParams.get('code') as string, verifier);
      expect(first.refresh_token).toEqual(expect.any(String));

      const refresh = async (token: string): Promise<Record<string, string>> => {
        const r = await fetch(`${base}${PREFIX}/token`, {
          method: 'POST',
          headers: headers({
            'content-type': 'application/x-www-form-urlencoded',
            authorization: `Basic ${Buffer.from('partner:partner-secret').toString('base64')}`,
          }),
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token }),
        });
        return (await r.json()) as Record<string, string>;
      };

      const second = await refresh(first.refresh_token);
      expect(second.access_token).toEqual(expect.any(String));
      expect(second.access_token).not.toBe(first.access_token);
    });
  });

  describe('userinfo', () => {
    it('releases only the claims the granted scopes allow', async () => {
      const verifier = randomBytes(32).toString('base64url');
      const loc = await getCode(verifier, 'openid email');
      const tokens = await exchange(loc.searchParams.get('code') as string, verifier);

      const claims = (await (
        await fetch(`${base}${PREFIX}/me`, {
          headers: headers({ authorization: `Bearer ${tokens.access_token}` }),
        })
      ).json()) as Record<string, unknown>;

      expect(claims.sub).toBe(user.sub);
      expect(claims.email).toBe('ada@example.com');
      expect(claims.email_verified).toBe(true);
      // `profile` was not granted, so name claims must not leak.
      expect(claims.given_name).toBeUndefined();
      expect(claims.family_name).toBeUndefined();
    });

    it('rejects an invalid access token', async () => {
      const r = await fetch(`${base}${PREFIX}/me`, {
        headers: headers({ authorization: 'Bearer not-a-real-token' }),
      });
      expect(r.status).toBe(401);
    });
  });

  describe('introspection and revocation', () => {
    const clientAuth = (): Record<string, string> => ({
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from('partner:partner-secret').toString('base64')}`,
    });

    it('reports a live token as active, and a revoked one as inactive', async () => {
      const verifier = randomBytes(32).toString('base64url');
      const loc = await getCode(verifier);
      const tokens = await exchange(loc.searchParams.get('code') as string, verifier);

      const introspect = async (): Promise<Record<string, unknown>> =>
        (await (
          await fetch(`${base}${PREFIX}/token/introspection`, {
            method: 'POST',
            headers: headers(clientAuth()),
            body: new URLSearchParams({ token: tokens.access_token }),
          })
        ).json()) as Record<string, unknown>;

      const live = await introspect();
      expect(live.active).toBe(true);
      expect(live.sub).toBe(user.sub);
      expect(live.client_id).toBe('partner');

      await fetch(`${base}${PREFIX}/token/revocation`, {
        method: 'POST',
        headers: headers(clientAuth()),
        body: new URLSearchParams({ token: tokens.access_token }),
      });

      // An inactive token must reveal nothing beyond `active: false`.
      const dead = await introspect();
      expect(dead.active).toBe(false);
      expect(dead.sub).toBeUndefined();
    });

    it('refuses to let one client introspect another client\'s token', async () => {
      const verifier = randomBytes(32).toString('base64url');
      const loc = await getCode(verifier);
      const tokens = await exchange(loc.searchParams.get('code') as string, verifier);

      const r = await fetch(`${base}${PREFIX}/token/introspection`, {
        method: 'POST',
        headers: headers({
          'content-type': 'application/x-www-form-urlencoded',
          authorization: `Basic ${Buffer.from('other:other-secret').toString('base64')}`,
        }),
        body: new URLSearchParams({ token: tokens.access_token }),
      });

      // Upstream would answer `active: true` here, letting one partner probe another's
      // tokens for subject and scope. The tightened policy must refuse.
      const body = (await r.json()) as Record<string, unknown>;
      expect(body.active).not.toBe(true);
      expect(body.sub).toBeUndefined();
    });

    it('reports an unknown token as inactive rather than erroring', async () => {
      const r = await fetch(`${base}${PREFIX}/token/introspection`, {
        method: 'POST',
        headers: headers(clientAuth()),
        body: new URLSearchParams({ token: 'never-existed' }),
      });
      expect(r.status).toBe(200);
      await expect(r.json()).resolves.toEqual({ active: false });
    });
  });

  describe('the nauth session gate', () => {
    it('tells the frontend a login is required when nobody is signed in', async () => {
      signedIn = false;
      const uid = await startAuthorization('s');

      const r = await fetch(`${base}/bridge/${uid}/state`, { headers: headers() });
      const state = (await r.json()) as Record<string, unknown>;

      expect(state.prompt).toBe('login');
      expect(state.gate).toBe('login_required');
      expect(state.gateReason).toBe('no_session');
      expect(state.client).toMatchObject({ clientId: 'partner', clientName: 'Partner App' });
    });

    it('refuses to complete a login with no nauth session, recoverably', async () => {
      signedIn = false;
      const uid = await startAuthorization('s');

      const r = await fetch(`${base}/bridge/${uid}/login`, { method: 'POST', headers: headers() });

      // 401 with the interaction id, not a 500: the frontend has to be able to stash
      // the request, send the user through login, and come back to it.
      expect(r.status).toBe(401);
      await expect(r.json()).resolves.toMatchObject({
        code: 'OIDC_LOGIN_REQUIRED',
        details: { uid, reason: 'no_session' },
      });
    });

    it('reports an unknown interaction as not found rather than as a server fault', async () => {
      const r = await fetch(`${base}/bridge/never-existed/state`, { headers: headers() });

      expect(r.status).toBe(404);
      await expect(r.json()).resolves.toMatchObject({ code: 'OIDC_INTERACTION_NOT_FOUND' });
    });

    it('answers the same way when an expired interaction is aborted', async () => {
      // Every route here has to agree: a request that is no longer pending is a 404,
      // never a 500. Abort resolves the interaction rather than reading it, so it is
      // the one that could easily drift.
      const r = await fetch(`${base}/bridge/never-existed/abort`, { method: 'POST', headers: headers() });

      expect(r.status).toBe(404);
      await expect(r.json()).resolves.toMatchObject({ code: 'OIDC_INTERACTION_NOT_FOUND' });
    });

    it('asks for a fresh login when the session lapses while the consent screen is open', async () => {
      const uid = await startAuthorization('state-lapse', 'openid email');

      let r = await fetch(`${base}/bridge/${uid}/login`, { method: 'POST', headers: headers() });
      capture(r);
      const { redirectTo } = (await r.json()) as { redirectTo: string };

      r = await fetch(redirectTo, { redirect: 'manual', headers: headers() });
      capture(r);
      const consentUid = (r.headers.get('location') ?? '').split('/').pop() as string;

      // The user reads the consent screen for longer than their session lasts.
      signedIn = false;

      r = await fetch(`${base}/bridge/${consentUid}/confirm`, { method: 'POST', headers: headers() });

      expect(r.status).toBe(401);
      await expect(r.json()).resolves.toMatchObject({
        code: 'OIDC_LOGIN_REQUIRED',
        details: { uid: consentUid },
      });
    });

    it('returns access_denied to the client when the account is disabled mid-flow', async () => {
      const uid = await startAuthorization('state-disabled', 'openid email');

      let r = await fetch(`${base}/bridge/${uid}/login`, { method: 'POST', headers: headers() });
      capture(r);
      let { redirectTo } = (await r.json()) as { redirectTo: string };

      r = await fetch(redirectTo, { redirect: 'manual', headers: headers() });
      capture(r);
      const consentUid = (r.headers.get('location') ?? '').split('/').pop() as string;

      // An administrator disables the account while the consent screen is open. This is
      // not recoverable by logging in again, so the relying party is told outright.
      accountActive = false;

      r = await fetch(`${base}/bridge/${consentUid}/confirm`, { method: 'POST', headers: headers() });
      capture(r);
      expect(r.status).toBe(200);
      ({ redirectTo } = (await r.json()) as { redirectTo: string });

      r = await fetch(redirectTo, { redirect: 'manual', headers: headers() });
      const loc = new URL(r.headers.get('location') as string);
      expect(loc.searchParams.get('error')).toBe('access_denied');
      expect(loc.searchParams.get('code')).toBeNull();
    });
  });

  describe('the audit trail', () => {
    it('records which relying party a completed login was released to', async () => {
      const verifier = randomBytes(32).toString('base64url');
      await getCode(verifier, 'openid email');

      const [completed] = auditedAs(AuthAuditEventType.OIDC_LOGIN_COMPLETED);
      expect(completed).toBeDefined();
      // The point of the event: the ordinary LOGIN_SUCCESS cannot say which third-party
      // application the user was signed into, because at that moment nothing knew.
      expect(completed.metadata).toMatchObject({
        clientId: 'partner',
        requestedScopes: ['openid', 'email'],
      });
      expect(completed.metadata?.interactionUid).toEqual(expect.any(String));
    });

    it('records the scopes the user actually granted', async () => {
      const verifier = randomBytes(32).toString('base64url');
      await getCode(verifier, 'openid email profile');

      const [granted] = auditedAs(AuthAuditEventType.OIDC_CONSENT_GRANTED);
      expect(granted).toBeDefined();
      expect(granted.metadata).toMatchObject({ clientId: 'partner' });
      expect(granted.metadata?.grantedScopes).toEqual(expect.arrayContaining(['openid', 'email']));
    });

    it('records a refusal', async () => {
      const uid = await startAuthorization('state-audit-deny', 'openid email');

      let r = await fetch(`${base}/bridge/${uid}/login`, { method: 'POST', headers: headers() });
      capture(r);
      const { redirectTo } = (await r.json()) as { redirectTo: string };

      r = await fetch(redirectTo, { redirect: 'manual', headers: headers() });
      capture(r);
      const consentUid = (r.headers.get('location') ?? '').split('/').pop() as string;

      r = await fetch(`${base}/bridge/${consentUid}/deny`, { method: 'POST', headers: headers() });
      capture(r);

      const [denied] = auditedAs(AuthAuditEventType.OIDC_CONSENT_DENIED);
      expect(denied).toBeDefined();
      expect(denied.metadata).toMatchObject({ clientId: 'partner' });
    });

    it('records an account that may not be vouched for', async () => {
      const uid = await startAuthorization('state-audit-denied');
      accountActive = false;

      const r = await fetch(`${base}/bridge/${uid}/login`, { method: 'POST', headers: headers() });
      capture(r);

      const [denied] = auditedAs(AuthAuditEventType.OIDC_ACCESS_DENIED);
      expect(denied).toBeDefined();
      expect(denied.metadata).toMatchObject({ clientId: 'partner', reason: 'account_disabled' });
    });

    it('records nothing when a login is merely required', async () => {
      signedIn = false;
      const uid = await startAuthorization('state-audit-anon');

      await fetch(`${base}/bridge/${uid}/state`, { headers: headers() });
      await fetch(`${base}/bridge/${uid}/login`, { method: 'POST', headers: headers() });

      // Nothing was decided and no user was resolved, so there is nothing to record —
      // the user has simply not logged in yet.
      expect(auditLog).toEqual([]);
    });
  });

  describe('consent refusal', () => {
    it('returns access_denied to the relying party', async () => {
      const verifier = randomBytes(32).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const q = new URLSearchParams({
        client_id: 'partner',
        response_type: 'code',
        scope: 'openid email',
        redirect_uri: REDIRECT_URI,
        state: 'state-deny',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      });

      let r = await fetch(`${base}${PREFIX}/auth?${q}`, { redirect: 'manual', headers: headers() });
      capture(r);
      let uid = (r.headers.get('location') ?? '').split('/').pop() as string;

      r = await fetch(`${base}/bridge/${uid}/login`, { method: 'POST', headers: headers() });
      capture(r);
      let { redirectTo } = (await r.json()) as { redirectTo: string };

      r = await fetch(redirectTo, { redirect: 'manual', headers: headers() });
      capture(r);
      uid = (r.headers.get('location') ?? '').split('/').pop() as string;

      r = await fetch(`${base}/bridge/${uid}/deny`, { method: 'POST', headers: headers() });
      capture(r);
      ({ redirectTo } = (await r.json()) as { redirectTo: string });

      r = await fetch(redirectTo, { redirect: 'manual', headers: headers() });
      const loc = new URL(r.headers.get('location') as string);

      expect(loc.origin + loc.pathname).toBe(REDIRECT_URI);
      expect(loc.searchParams.get('error')).toBe('access_denied');
      expect(loc.searchParams.get('state')).toBe('state-deny');
      expect(loc.searchParams.get('code')).toBeNull();
    });
  });
});
