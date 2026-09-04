/**
 * Mount registration tests
 *
 * Asserts what each framework mount actually registers: paths, methods, ordering, the
 * middleware chain, and that excluded routes are absent from the route table rather
 * than merely from the resolved manifest.
 */

import { registerNAuthExpressRoutes, ExpressMountInstance } from './express';
import { registerNAuthFastifyRoutes, FastifyMountInstance } from './fastify';
import { buildRouteInput, runRoute } from './run-route';
import { NAuthConfig } from '../../interfaces/config.interface';
import { AUTH_ROUTES_MANIFEST } from '../auth-routes.manifest';
import { AnyNAuthRouteDefinition } from '../route-manifest.types';
import { NAuthRouteKey } from '../route-keys';

/** Records what a mount registers, standing in for an Express router. */
const createRouter = (): {
  router: Record<string, jest.Mock>;
  registered: Array<{ method: string; path: string; chainLength: number }>;
} => {
  const registered: Array<{ method: string; path: string; chainLength: number }> = [];
  const make =
    (method: string) =>
    (path: string, ...handlers: unknown[]): void => {
      registered.push({ method, path, chainLength: handlers.length });
    };
  return {
    router: {
      get: jest.fn(make('GET')),
      post: jest.fn(make('POST')),
      put: jest.fn(make('PUT')),
      patch: jest.fn(make('PATCH')),
      delete: jest.fn(make('DELETE')),
    },
    registered,
  };
};

const helpers = {
  public: jest.fn(() => 'public'),
  requireAuth: jest.fn(() => 'requireAuth'),
  tokenDelivery: jest.fn(() => 'tokenDelivery'),
  denyApiKey: jest.fn(() => 'denyApiKey'),
  allowApiKey: jest.fn(() => 'allowApiKey'),
};

const instance = (over: Partial<ExpressMountInstance> = {}): ExpressMountInstance =>
  ({
    config: { tokenDelivery: { method: 'hybrid' } } as NAuthConfig,
    helpers,
    authService: {},
    adminAuthService: {},
    mfaService: {},
    socialAuthService: {},
    auditService: {},
    apiKeyService: {},
    socialRedirect: {},
    authorizationService: { isConfigured: () => true },
    ...over,
  }) as unknown as ExpressMountInstance;

describe('registerNAuthExpressRoutes', () => {
  it('registers every self-service route by default', () => {
    const { router, registered } = createRouter();

    registerNAuthExpressRoutes(router as never, instance());

    expect(registered).toHaveLength(AUTH_ROUTES_MANIFEST.length);
    expect(registered.some((r) => r.method === 'POST' && r.path === '/login')).toBe(true);
    expect(registered.some((r) => r.path.startsWith('/users'))).toBe(false);
  });

  it('omits an excluded route from the route table entirely', () => {
    const { router, registered } = createRouter();

    registerNAuthExpressRoutes(router as never, instance(), { exclude: ['login'] });

    // The point of exclude is that the endpoint is unreachable, not merely unlisted.
    expect(registered.some((r) => r.path === '/login')).toBe(false);
    expect(registered.some((r) => r.path === '/signup')).toBe(true);
  });

  it('preserves manifest order, so literal paths beat parametric siblings', () => {
    const { router, registered } = createRouter();

    registerNAuthExpressRoutes(router as never, instance(), { groups: ['social'] });

    const link = registered.findIndex((r) => r.path === '/social/link');
    const verify = registered.findIndex((r) => r.path === '/social/:provider/verify');
    expect(link).toBeGreaterThanOrEqual(0);
    expect(verify).toBeGreaterThan(link);
  });

  it('uses public() for public routes and requireAuth() otherwise', () => {
    const { router } = createRouter();
    helpers.public.mockClear();
    helpers.requireAuth.mockClear();

    registerNAuthExpressRoutes(router as never, instance(), { groups: ['core'] });

    const publicCount = AUTH_ROUTES_MANIFEST.filter((r) => r.group === 'core' && r.access === 'public').length;
    expect(helpers.public).toHaveBeenCalledTimes(publicCount);
    expect(helpers.requireAuth).toHaveBeenCalled();
  });

  it('applies forced delivery to every route in the bundle', () => {
    const { router } = createRouter();
    helpers.tokenDelivery.mockClear();

    registerNAuthExpressRoutes(router as never, instance(), { groups: ['core'], delivery: 'json' });

    expect(helpers.tokenDelivery).toHaveBeenCalledWith('json');
  });

  it('adds consumer guards to the chain', () => {
    const { router, registered } = createRouter();
    const withoutGuards = createRouter();

    registerNAuthExpressRoutes(withoutGuards.router as never, instance(), { groups: ['profile'] });
    registerNAuthExpressRoutes(router as never, instance(), { groups: ['profile'], guards: ['G1', 'G2'] });

    expect(registered[0].chainLength).toBe(withoutGuards.registered[0].chainLength + 2);
  });

  it('refuses to mount admin routes with no authorization provider', () => {
    const { router } = createRouter();

    expect(() =>
      registerNAuthExpressRoutes(router as never, instance({ authorizationService: { isConfigured: () => false } }), {
        groups: ['admin'],
      }),
    ).toThrow(/requires an authorization provider/);
  });

  it('rejects an unknown exclude key', () => {
    const { router } = createRouter();

    expect(() =>
      registerNAuthExpressRoutes(router as never, instance(), { exclude: ['nope' as NAuthRouteKey] }),
    ).toThrow(/Unknown route key/);
  });
});

describe('registerNAuthFastifyRoutes', () => {
  it('registers routes with method and url', () => {
    const routes: Array<{ method: string; url: string }> = [];
    const fastify = { route: jest.fn((opts: { method: string; url: string }) => routes.push(opts)) };

    registerNAuthFastifyRoutes(fastify as never, instance() as unknown as FastifyMountInstance, {
      groups: ['core'],
    });

    expect(routes.some((r) => r.method === 'POST' && r.url === '/login')).toBe(true);
    expect(routes.some((r) => r.method === 'GET' && r.url === '/logout')).toBe(true);
  });

  it('honours exclude', () => {
    const routes: Array<{ url: string }> = [];
    const fastify = { route: jest.fn((opts: { url: string }) => routes.push(opts)) };

    registerNAuthFastifyRoutes(fastify as never, instance() as unknown as FastifyMountInstance, {
      groups: ['core'],
      exclude: ['login'],
    });

    expect(routes.some((r) => r.url === '/login')).toBe(false);
  });
});

describe('buildRouteInput', () => {
  const route = (source: AnyNAuthRouteDefinition['source']): AnyNAuthRouteDefinition =>
    ({ source }) as AnyNAuthRouteDefinition;

  it('reads from the declared source only', () => {
    const request = { body: { a: 1 }, query: { b: 2 }, params: { c: '3' } };

    expect(buildRouteInput(route('body'), request)).toEqual({ a: 1 });
    expect(buildRouteInput(route('query'), request)).toEqual({ b: 2 });
    expect(buildRouteInput(route('params'), request)).toEqual({ c: '3' });
    expect(buildRouteInput(route('none'), request)).toEqual({});
  });

  it('merges params under body so an explicit body value wins', () => {
    const merged = buildRouteInput(route('params+body'), { params: { sub: 'from-path' }, body: { sub: 'from-body' } });
    expect(merged).toEqual({ sub: 'from-body' });
  });
});

describe('runRoute', () => {
  it('validates the DTO before invoking the handler', async () => {
    const handler = jest.fn().mockResolvedValue({ ok: true });
    const login = AUTH_ROUTES_MANIFEST.find((r) => r.key === 'login') as AnyNAuthRouteDefinition;

    await expect(
      runRoute({ ...login, handler } as AnyNAuthRouteDefinition, { body: {} }, {} as never, {} as NAuthConfig),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('falls back to the configured refresh cookie name, not a hardcoded one', async () => {
    const refresh = AUTH_ROUTES_MANIFEST.find((r) => r.key === 'refresh') as AnyNAuthRouteDefinition;
    const refreshToken = jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'b' });
    const config = { tokenDelivery: { cookieNamePrefix: 'myapp_' } } as NAuthConfig;

    await runRoute(
      refresh,
      { body: {}, cookies: { myapp_refresh_token: 'from-cookie' } },
      { authService: { refreshToken } } as never,
      config,
    );

    // Hardcoding 'nauth_refresh_token' is the bug this route exists to fix.
    expect(refreshToken).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'from-cookie' }));
  });
});
