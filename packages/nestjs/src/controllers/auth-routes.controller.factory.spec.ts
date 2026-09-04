/**
 * Generated controller tests
 *
 * Asserts what Nest actually maps, using the framework's own route explorer rather than
 * inspecting the manifest — the point is that these routes reach the HTTP layer with
 * the right paths, methods and metadata.
 */

import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { resolveMount, AUTH_ROUTES_MANIFEST, NAuthConfig, ResolvedRouteMount } from '@nauth-toolkit/core';
import { createNAuthRoutesController } from './auth-routes.controller.factory';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TOKEN_DELIVERY_KEY } from '../decorators/token-delivery.decorator';
import { DENY_API_KEY_KEY } from '../decorators/api-key.decorator';

/** Resolve a mount with every optional service present. */
const mountOf = (options: Parameters<typeof resolveMount>[0] = {}): ResolvedRouteMount =>
  resolveMount(options, {
    config: { tokenDelivery: { method: 'hybrid' } } as NAuthConfig,
    services: {
      mfaService: {} as never,
      socialAuthService: {} as never,
      auditService: {} as never,
      apiKeyService: {} as never,
      socialRedirect: {} as never,
    },
    authorizationConfigured: true,
  }) as ResolvedRouteMount;

/** Read the route metadata Nest would read off one generated handler. */
const routeMeta = (
  controller: unknown,
  key: string,
): { path?: string; method?: number; status?: number; isPublic?: boolean; delivery?: string; denyApiKey?: boolean } => {
  const handler = (controller as { prototype: Record<string, unknown> }).prototype[key];
  return {
    path: Reflect.getMetadata(PATH_METADATA, handler as object),
    method: Reflect.getMetadata(METHOD_METADATA, handler as object),
    status: Reflect.getMetadata(HTTP_CODE_METADATA, handler as object),
    isPublic: Reflect.getMetadata(IS_PUBLIC_KEY, handler as object),
    delivery: Reflect.getMetadata(TOKEN_DELIVERY_KEY, handler as object),
    denyApiKey: Reflect.getMetadata(DENY_API_KEY_KEY, handler as object),
  };
};

describe('createNAuthRoutesController', () => {
  it('mounts the controller at the bundle prefix', () => {
    const controller = createNAuthRoutesController(mountOf({ prefix: 'auth' }));
    expect(Reflect.getMetadata(PATH_METADATA, controller as object)).toBe('auth');
  });

  it('generates a handler per route with the right path, method and status', () => {
    const controller = createNAuthRoutesController(mountOf({ groups: ['core'] }));

    const login = routeMeta(controller, 'login');
    expect(login.path).toBe('login');
    expect(login.method).toBe(1); // RequestMethod.POST
    expect(login.status).toBe(200);

    const signup = routeMeta(controller, 'signup');
    expect(signup.status).toBe(201);

    const logout = routeMeta(controller, 'logout');
    expect(logout.method).toBe(0); // RequestMethod.GET
  });

  it('marks exactly the public routes with @Public()', () => {
    const mount = mountOf({ groups: ['core'] });
    const controller = createNAuthRoutesController(mount);

    for (const route of mount.routes) {
      expect(routeMeta(controller, route.key).isPublic).toBe(route.access === 'public' ? true : undefined);
    }
  });

  it('writes the forced delivery mode onto every handler', () => {
    // Per-handler rather than class-level: the guards and interceptor read this from
    // context.getHandler() only, so class metadata would be ignored.
    const mount = mountOf({ groups: ['core'], delivery: 'json' });
    const controller = createNAuthRoutesController(mount);

    for (const route of mount.routes) {
      expect(routeMeta(controller, route.key).delivery).toBe('json');
    }
  });

  it('denies API-key auth on admin routes', () => {
    const controller = createNAuthRoutesController(mountOf({ groups: ['admin'] }));
    expect(routeMeta(controller, 'adminDeleteUser').denyApiKey).toBe(true);
  });

  it('omits excluded routes from the generated class entirely', () => {
    const controller = createNAuthRoutesController(mountOf({ groups: ['core'], exclude: ['login'] }));
    const proto = (controller as { prototype: Record<string, unknown> }).prototype;

    expect(proto.login).toBeUndefined();
    expect(typeof proto.signup).toBe('function');
  });

  it('registers routes in manifest order so literal paths precede parametric ones', () => {
    const controller = createNAuthRoutesController(mountOf({ groups: ['social'] }));
    const names = Object.getOwnPropertyNames((controller as { prototype: object }).prototype);

    expect(names.indexOf('socialLink')).toBeLessThan(names.indexOf('socialVerify'));
  });

  it('produces distinct classes for two mounts, with disjoint prefixes', () => {
    const web = createNAuthRoutesController(mountOf({ prefix: 'auth', delivery: 'cookies' }));
    const mobile = createNAuthRoutesController(mountOf({ prefix: 'mobile/auth', delivery: 'json' }));

    expect(web).not.toBe(mobile);
    expect((web as { name: string }).name).not.toBe((mobile as { name: string }).name);
    expect(Reflect.getMetadata(PATH_METADATA, web as object)).toBe('auth');
    expect(Reflect.getMetadata(PATH_METADATA, mobile as object)).toBe('mobile/auth');
    expect(routeMeta(web, 'login').delivery).toBe('cookies');
    expect(routeMeta(mobile, 'login').delivery).toBe('json');
  });

  it('covers the whole self-service manifest by default', () => {
    const controller = createNAuthRoutesController(mountOf());
    const proto = (controller as { prototype: object }).prototype;
    const generated = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');

    expect(generated).toHaveLength(AUTH_ROUTES_MANIFEST.length);
  });
});
