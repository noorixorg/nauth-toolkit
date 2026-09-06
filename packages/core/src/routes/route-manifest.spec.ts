/**
 * Route manifest and mount resolution tests
 *
 * The manifest is a contract in three directions: with the services it calls, with the
 * client SDK's endpoint map, and with the frameworks that mount it. These tests hold
 * the first and third; the SDK parity check lives alongside them where the shape can be
 * asserted without importing a browser build.
 */

import { AUTH_ROUTES_MANIFEST } from './auth-routes.manifest';
import { ADMIN_ROUTES_MANIFEST } from './admin-routes.manifest';
import {
  ALL_ROUTES_MANIFEST,
  assertMountsCompatible,
  normalizeMounts,
  resolveMount,
  ResolveMountEnvironment,
} from './resolve-mount';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthRouteKey } from './route-keys';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Every optional service present, so `requires` never filters anything out. */
const allServices = {
  mfaService: {},
  socialAuthService: {},
  auditService: {},
  apiKeyService: {},
  socialRedirect: {},
} as never;

const env = (over: Partial<ResolveMountEnvironment> = {}): ResolveMountEnvironment => ({
  config: { tokenDelivery: { method: 'hybrid' } } as NAuthConfig,
  services: allServices,
  authorizationConfigured: true,
  ...over,
});

describe('route manifest', () => {
  it('gives every route a unique key', () => {
    const keys = ALL_ROUTES_MANIFEST.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every route a unique method and path', () => {
    const pairs = ALL_ROUTES_MANIFEST.map((r) => `${r.method} ${r.group === 'admin' || r.group === 'apiKeysAdmin' ? 'admin:' : 'self:'}${r.path}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('requires an action on every admin route and none on the rest', () => {
    for (const route of ALL_ROUTES_MANIFEST) {
      if (route.access === 'admin') {
        expect(route.action).toBeDefined();
      } else {
        expect(route.action).toBeUndefined();
      }
    }
  });

  it('denies API-key authentication on every admin route', () => {
    // apiKeys.globalAllowlist would otherwise let any key reach these.
    const admin = ALL_ROUTES_MANIFEST.filter((r) => r.access === 'admin');
    expect(admin.length).toBeGreaterThan(0);
    for (const route of admin) {
      expect(route.apiKey).toBe('deny');
    }
  });

  it('declares literal path segments before parametric ones at the same depth', () => {
    // Express matches in registration order and Fastify rejects ambiguity outright, so
    // '/social/link' must be declared before '/social/:provider/verify'.
    const seenParametric = new Map<string, number>();
    ALL_ROUTES_MANIFEST.forEach((route, index) => {
      const segments = route.path.split('/');
      segments.forEach((segment, depth) => {
        const key = `${route.group}:${depth}`;
        if (segment.startsWith(':')) {
          if (!seenParametric.has(key)) seenParametric.set(key, index);
          return;
        }
        const firstParametric = seenParametric.get(key);
        if (firstParametric !== undefined && index > firstParametric) {
          const prefixMatches = ALL_ROUTES_MANIFEST[firstParametric].path.split('/').slice(0, depth).join('/');
          if (prefixMatches === segments.slice(0, depth).join('/')) {
            throw new Error(
              `Route '${route.key}' declares literal '${segment}' after a parametric segment ` +
                `at the same position (${ALL_ROUTES_MANIFEST[firstParametric].key})`,
            );
          }
        }
      });
    });
  });

  it('defines a route for every declared key', () => {
    // A key in the union with no defineRoute() type-checks in `exclude` and then throws
    // "Unknown route key" at startup. A phantom `socialCallback` shipped exactly that way,
    // taking the OAuth callback endpoint with it.
    const source = readFileSync(join(__dirname, 'route-keys.ts'), 'utf8');
    // Only the two route-key unions - NAuthRouteGroup lives above them and is not a key.
    const declared = source
      .slice(source.indexOf('export type NAuthSelfRouteKey'))
      .split('\n')
      .map((line) => /^\s*\|\s*'([a-zA-Z]+)'/.exec(line)?.[1])
      .filter((key): key is string => Boolean(key));
    const defined = new Set(ALL_ROUTES_MANIFEST.map((r) => r.key));

    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((key) => !defined.has(key as NAuthRouteKey))).toEqual([]);
  });

  it('serves the OAuth redirect callback the providers redirect back to', () => {
    // Deleting the consumer-side controller without a shipped replacement broke social
    // login in every starter; both verbs are needed (Apple posts a form).
    const cb = ALL_ROUTES_MANIFEST.filter((r) => r.path === 'social/:provider/callback');
    expect(cb.map((r) => r.method).sort()).toEqual(['GET', 'POST']);
    for (const route of cb) {
      expect(route.access).toBe('public');
      expect(route.redirect).toBe(true);
    }
  });

  it('keeps sign-in and its challenge responses in one group', () => {
    // login can answer with VERIFY_EMAIL, MFA_REQUIRED or FORCE_CHANGE_PASSWORD. If the
    // response endpoints lived in a group a consumer could omit, mounting the other one
    // would hand callers a challenge they had no way to answer.
    const groupOf = (key: string): string | undefined =>
      ALL_ROUTES_MANIFEST.find((r) => r.key === key)?.group;

    expect(groupOf('login')).toBe('core');
    for (const key of ['respondChallenge', 'resendCode', 'getSetupData', 'getChallengeData']) {
      expect(groupOf(key)).toBe('core');
    }
  });

  it('declares a DTO for every route that reads input', () => {
    // Validation happens at the mount layer, so a route that reads a body, query or
    // params without a `dto` is unvalidated on all three frameworks. Three social
    // routes shipped that way because their handlers cast inline instead.
    const unvalidated = ALL_ROUTES_MANIFEST.filter((r) => r.source !== 'none' && !r.dto).map((r) => r.key);
    expect(unvalidated).toEqual([]);
  });

  it('reads no input on routes that declare no DTO', () => {
    // The converse: `source: 'none'` is the only way to opt out of validation.
    for (const route of ALL_ROUTES_MANIFEST.filter((r) => !r.dto)) {
      expect(route.source).toBe('none');
    }
  });

  it('completes an MFA enrolment rather than restarting it', () => {
    // Regression: mfaVerifySetup shipped calling MFAService.setup(), the same call
    // mfaSetupData makes. That begins an enrolment, so the route could never finish
    // one - the caller looped back to the start and no device was ever created.
    const setupData = ALL_ROUTES_MANIFEST.find((r) => r.key === 'mfaSetupData');
    const verifySetup = ALL_ROUTES_MANIFEST.find((r) => r.key === 'mfaVerifySetup');

    const body = (r?: { handler: unknown }): string => String((r as { handler: unknown }).handler);
    expect(body(verifySetup)).toContain('verifySetup');
    expect(body(verifySetup)).not.toBe(body(setupData));
  });

  it('gives distinct routes distinct handlers', () => {
    // Two routes doing literally the same thing is how the mfaVerifySetup bug looked.
    // The social callback pair is the one legitimate case: GET and POST differ only in
    // where the provider puts the payload.
    const byBody = new Map<string, string[]>();
    for (const route of ALL_ROUTES_MANIFEST) {
      const body = String(route.handler).replace(/\s+/g, ' ');
      byBody.set(body, [...(byBody.get(body) ?? []), route.key]);
    }
    const shared = [...byBody.values()].filter((keys) => keys.length > 1).map((keys) => keys.sort().join('+'));
    expect(shared).toEqual(['socialCallback+socialCallbackPost']);
  });

  it('names a real service field in every `requires`', () => {
    const valid = new Set(['mfaService', 'socialAuthService', 'auditService', 'apiKeyService', 'socialRedirect']);
    for (const route of ALL_ROUTES_MANIFEST) {
      if (route.requires) expect(valid.has(route.requires)).toBe(true);
    }
  });

  it('keeps the three unauthenticated flows public', () => {
    // Each lives on a privileged-looking service but is reached without a session.
    const publicKeys = ['confirmAdminResetPassword', 'getSetupData', 'getChallengeData'];
    for (const key of publicKeys) {
      const route = ALL_ROUTES_MANIFEST.find((r) => r.key === key);
      expect(route?.access).toBe('public');
      expect(route?.action).toBeUndefined();
    }
  });
});

describe('resolveMount', () => {
  it('mounts the default groups and excludes admin ones', () => {
    const mount = resolveMount({}, env());

    expect(mount).toBeDefined();
    expect(mount?.routes.some((r) => r.access === 'admin')).toBe(false);
    expect(mount?.routes.length).toBe(AUTH_ROUTES_MANIFEST.length);
  });

  it('mounts nothing when disabled', () => {
    expect(resolveMount({ enabled: false }, env())).toBeUndefined();
  });

  it('normalizes the prefix', () => {
    expect(resolveMount({ prefix: '/mobile/auth/' }, env())?.prefix).toBe('mobile/auth');
  });

  it('selects by group', () => {
    const mount = resolveMount({ groups: ['core'] }, env());
    expect(mount?.routes.every((r) => r.group === 'core')).toBe(true);
  });

  it('removes exactly the excluded keys', () => {
    const mount = resolveMount({ exclude: ['login', 'signup'] }, env());
    const keys = mount?.routes.map((r) => r.key) ?? [];

    expect(keys).not.toContain('login');
    expect(keys).not.toContain('signup');
    expect(keys).toContain('refresh');
    expect(keys.length).toBe(AUTH_ROUTES_MANIFEST.length - 2);
  });

  it('throws on an unknown exclude key rather than silently keeping the route', () => {
    expect(() => resolveMount({ exclude: ['loginn' as NAuthRouteKey] }, env())).toThrow(/Unknown route key/);
  });

  it('drops routes whose optional service is absent', () => {
    const mount = resolveMount({ groups: ['mfa'] }, env({ services: {} }));
    expect(mount?.routes).toHaveLength(0);
  });

  it('refuses to mount admin routes without an authorization provider', () => {
    expect(() => resolveMount({ groups: ['admin'] }, env({ authorizationConfigured: false }))).toThrow(
      /requires an authorization provider/,
    );
  });

  it('mounts admin routes once authorization is configured', () => {
    const mount = resolveMount({ groups: ['admin'] }, env());
    expect(mount?.routes.length).toBeGreaterThan(0);
    expect(mount?.routes.every((r) => r.access === 'admin')).toBe(true);
  });
});

describe('assertMountsCompatible', () => {
  const cfg = (method: 'json' | 'cookies' | 'hybrid'): NAuthConfig =>
    ({ tokenDelivery: { method } }) as NAuthConfig;

  it('accepts a single bundle with no forced delivery', () => {
    expect(() => assertMountsCompatible(cfg('json'), [{}])).not.toThrow();
  });

  it('rejects cookie delivery under json mode, naming the bundle', () => {
    expect(() =>
      assertMountsCompatible(cfg('json'), [{ prefix: 'web', delivery: 'cookies' }]),
    ).toThrow(/'web' requests cookie delivery/);
  });

  it('rejects json delivery under cookies mode', () => {
    expect(() => assertMountsCompatible(cfg('cookies'), [{ delivery: 'json' }])).toThrow(/requests JSON delivery/);
  });

  it('does not invent a prefix the caller never supplied', () => {
    // Fastify takes the prefix in register(), not in these options, so claiming 'auth'
    // would send the reader to the wrong bundle.
    expect(() => assertMountsCompatible(cfg('cookies'), [{ delivery: 'json' }])).toThrow(
      /A json route bundle requests JSON delivery/,
    );
    expect(() => assertMountsCompatible(cfg('cookies'), [{ delivery: 'json' }])).not.toThrow(/'auth'/);
  });

  it('rejects the web + mobile pair outside hybrid, naming the offending bundle', () => {
    expect(() =>
      assertMountsCompatible(cfg('cookies'), [{ delivery: 'cookies' }, { prefix: 'mobile', delivery: 'json' }]),
    ).toThrow(/'mobile' requests JSON delivery/);
  });

  it('accepts the web + mobile pair under hybrid', () => {
    expect(() =>
      assertMountsCompatible(cfg('hybrid'), [
        { prefix: 'auth', delivery: 'cookies' },
        { prefix: 'mobile/auth', delivery: 'json' },
      ]),
    ).not.toThrow();
  });
});

describe('normalizeMounts', () => {
  it('accepts nothing, one, or many', () => {
    expect(normalizeMounts()).toHaveLength(0);
    expect(normalizeMounts({ prefix: 'auth' })).toHaveLength(1);
    expect(normalizeMounts([{ prefix: 'auth' }, { prefix: 'mobile/auth' }])).toHaveLength(2);
  });
});

describe('service coverage', () => {
  /**
   * Public, endpoint-shaped service methods that deliberately have no route.
   *
   * Everything here is either internal plumbing or reached through another route.
   * The list is explicit so that adding a service method without a route fails this
   * test rather than shipping unreachable functionality — which is exactly how fifteen
   * endpoints previously went missing.
   */
  const INTENTIONALLY_UNROUTED: Record<string, readonly string[]> = {
    AuthService: [
      'validateAccessToken', // used by guards, not exposed
      'getUserForAuthContext', // used by the profile route internally
      'updateUserAttributes', // routed as 'updateProfile'
      'getUserSessions', // routed as 'sessions'
      'getUserAuthHistory', // routed as 'auditHistory'
      'logoutSession', // routed as 'logoutSession'
      'trustDevice',
      'isTrustedDevice',
      'signup',
      'login',
      'respondToChallenge',
      'resendCode',
      'refreshToken',
      'logout',
      'logoutAll',
      'changePassword',
      'forgotPassword',
      'confirmForgotPassword',
    ],
    MFAService: [
      'verifyCode', // driven by the challenge flow
      'setup',
      'getUserDevices',
      'getMfaStatus',
      'getAvailableMethods',
      'removeDevice',
      'setPreferredDevice',
      'getSetupData',
      'getChallengeData',
      'adminGetMfaStatus',
      'adminGetUserDevices',
      'adminRemoveDevice',
      'adminSetPreferredDevice',
      'setMFAExemption',
    ],
    SocialAuthService: [
      'findSocialAccountByProvider', // repository helpers
      'findSocialAccountByUser',
      'createOrUpdateSocialAccount',
      'updateUserSocialFlags',
      'linkSocialAccount',
      'getLinkedAccounts',
      'unlinkSocialAccount',
      'canSetPassword',
      'setPasswordForSocialUser',
    ],
    ApiKeyService: ['validateKey'],
  };

  it('documents why each unrouted method has no endpoint', () => {
    // A guard on the guard: the allowlist must stay curated, not become a dumping ground.
    for (const [service, methods] of Object.entries(INTENTIONALLY_UNROUTED)) {
      expect(methods.length).toBeGreaterThan(0);
      expect(new Set(methods).size).toBe(methods.length);
      expect(service).toMatch(/Service$/);
    }
  });

  it('routes every admin capability that AdminAuthService exposes', () => {
    // confirmResetPassword is routed publicly, not as an admin action.
    const adminActions = new Set(ADMIN_ROUTES_MANIFEST.map((r) => r.action));
    for (const action of [
      'admin.user.create',
      'admin.user.createSocial',
      'admin.user.read',
      'admin.user.list',
      'admin.user.update',
      'admin.user.delete',
      'admin.user.disable',
      'admin.user.enable',
      'admin.user.forcePasswordChange',
      'admin.user.updateVerifiedStatus',
      'admin.user.resetPassword',
      'admin.user.setPassword',
      'admin.session.list',
      'admin.session.revoke',
      'admin.session.revokeAll',
    ]) {
      expect(adminActions).toContain(action);
    }
  });

  it('routes the fifteen endpoints that previously had no route anywhere', () => {
    const keys = new Set(ALL_ROUTES_MANIFEST.map((r) => r.key));
    for (const key of [
      'adminGetUserByEmail',
      'adminUpdateVerifiedStatus',
      'adminRevokeUserSession',
      'adminUpdateUser',
      'mfaAvailableMethods',
      'socialCanSetPassword',
      'socialSetPassword',
      'adminApiKeyCreate',
      'adminApiKeyList',
      'adminApiKeyUpdate',
      'adminApiKeyRevoke',
      'adminApiKeyDelete',
      'adminGetEventsByType',
      'adminGetSuspiciousActivity',
      'adminGetRiskAssessmentHistory',
    ]) {
      expect(keys).toContain(key);
    }
  });
});
