/**
 * Mount resolution
 *
 * Turns mount options plus the manifests into the concrete list of routes a framework
 * should register, and refuses — loudly, at startup — any configuration that would be
 * wrong at request time.
 *
 * All three adapters resolve through here, so route selection, delivery validation and
 * the admin authorization requirement behave identically on NestJS, Express and Fastify.
 *
 * @packageDocumentation
 */

import { NAuthConfig } from '../interfaces/config.interface';
import { AUTH_ROUTES_MANIFEST } from './auth-routes.manifest';
import { ADMIN_ROUTES_MANIFEST } from './admin-routes.manifest';
import { AnyNAuthRouteDefinition } from './route-manifest.types';
import { NAuthRouteServices } from './route-services';
import { DEFAULT_ROUTE_GROUPS, NAuthRouteGroup, NAuthRouteKey } from './route-keys';

/** Every shipped route, self-service first. */
export const ALL_ROUTES_MANIFEST: readonly AnyNAuthRouteDefinition[] = [
  ...AUTH_ROUTES_MANIFEST,
  ...ADMIN_ROUTES_MANIFEST,
];

/** A guard class, guard instance, or DI token (NestJS); a middleware (Express/Fastify). */
export type GuardLike = unknown;

/** How one bundle of shipped routes is mounted. */
export interface NAuthRouteMountOptions {
  /**
   * Whether to mount at all.
   * @default true
   */
  enabled?: boolean;

  /**
   * Path prefix for this bundle, relative to any framework-wide prefix.
   * @default 'auth'
   */
  prefix?: string;

  /**
   * Which groups to mount.
   * @default every group except `admin` and `apiKeysAdmin`
   */
  groups?: readonly NAuthRouteGroup[];

  /**
   * Individual routes to leave out — to hand-write them, or to not expose them at all.
   *
   * Removes the endpoint, **not the capability**: the underlying service method stays
   * callable in-process. To forbid an operation outright, deny its action in the
   * authorization provider as well.
   *
   * An unknown key is rejected at mount time, so a typo cannot silently re-expose a
   * route that was meant to be suppressed.
   */
  exclude?: readonly NAuthRouteKey[];

  /**
   * Force every route in this bundle to one delivery mode.
   *
   * Requires `tokenDelivery.method: 'hybrid'` unless it matches the configured method.
   */
  delivery?: 'json' | 'cookies';

  /** Guards applied to every route in this bundle. */
  guards?: readonly GuardLike[];

  /** Guards applied only to routes with `access: 'admin'`. */
  adminGuards?: readonly GuardLike[];

  /** Guards applied to individual routes, merged with the above. */
  routeGuards?: Partial<Record<NAuthRouteKey, readonly GuardLike[]>>;
}

/** A mount resolved against the configuration and the available services. */
export interface ResolvedRouteMount {
  /** Prefix with any leading and trailing slashes removed. */
  readonly prefix: string;
  /** The routes to register, in manifest order. */
  readonly routes: readonly AnyNAuthRouteDefinition[];
  /** Delivery mode forced on this bundle, if any. */
  readonly delivery?: 'json' | 'cookies';
  /** The original options, for adapters that need the guard lists. */
  readonly options: NAuthRouteMountOptions;
}

/**
 * Normalize one or many mount options into an array.
 *
 * @param routes - What the consumer configured
 * @returns Zero or more mount option objects
 */
export function normalizeMounts(
  routes?: NAuthRouteMountOptions | readonly NAuthRouteMountOptions[],
): readonly NAuthRouteMountOptions[] {
  if (!routes) return [];
  return Array.isArray(routes) ? routes : [routes as NAuthRouteMountOptions];
}

/**
 * Reject mounts whose delivery modes the configuration cannot serve.
 *
 * A per-route delivery override is only meaningful when both transports are live, which
 * is what `method: 'hybrid'` means. Checking here turns what would otherwise be a
 * first-request failure into a startup failure naming the offending bundle.
 *
 * @param config - The active configuration
 * @param mounts - Every bundle about to be mounted
 * @throws {Error} When a requested delivery mode conflicts with `tokenDelivery.method`
 */
export function assertMountsCompatible(config: NAuthConfig, mounts: readonly NAuthRouteMountOptions[]): void {
  const method = config.tokenDelivery?.method ?? 'json';

  for (const mount of mounts) {
    const delivery = mount.delivery;
    if (!delivery) continue;

    // Only name a prefix the caller actually supplied. On Fastify the prefix belongs to
    // `register()`, not to these options, so defaulting to 'auth' here would point the
    // reader at the wrong bundle.
    const bundle = mount.prefix ? `Route bundle '${mount.prefix}'` : `A ${delivery} route bundle`;

    if (delivery === 'cookies' && method === 'json') {
      throw new Error(
        `${bundle} requests cookie delivery, but tokenDelivery.method is 'json'. ` +
          `Set tokenDelivery.method to 'cookies' or 'hybrid'.`,
      );
    }
    if (delivery === 'json' && method === 'cookies') {
      throw new Error(
        `${bundle} requests JSON delivery, but tokenDelivery.method is 'cookies'. ` +
          `Set tokenDelivery.method to 'hybrid' to serve both transports.`,
      );
    }
  }

  // No further check is needed for "two bundles wanting different modes": the only way
  // to request both is one 'json' and one 'cookies' bundle, and unless the method is
  // 'hybrid' one of them has already failed above with a message naming it.
}

/** What `resolveMount` needs to know about the environment it is mounting into. */
export interface ResolveMountEnvironment {
  /** The active configuration. */
  config: NAuthConfig;
  /** Which optional services exist, so routes requiring an absent one are dropped. */
  services?: Partial<NAuthRouteServices>;
  /**
   * Whether an authorization provider is configured.
   *
   * Mounting an admin group without one is refused: with no role model in the toolkit,
   * those routes would otherwise be reachable by any authenticated caller.
   */
  authorizationConfigured?: boolean;
}

/**
 * Resolve one mount into the routes a framework should register.
 *
 * @param options - The bundle's options
 * @param env - Configuration, available services, and whether authorization is configured
 * @returns The resolved mount, or `undefined` when the bundle is disabled
 * @throws {Error} On an unknown `exclude` key, or an admin group with no authorization provider
 */
export function resolveMount(
  options: NAuthRouteMountOptions,
  env: ResolveMountEnvironment,
): ResolvedRouteMount | undefined {
  if (options.enabled === false) return undefined;

  const prefix = (options.prefix ?? 'auth').replace(/^\/+|\/+$/g, '');
  const groups = options.groups ?? DEFAULT_ROUTE_GROUPS;
  const exclude = new Set<string>(options.exclude ?? []);

  // A typo here would silently keep a route the consumer believed they had removed,
  // which is the one failure mode this feature must not have.
  if (exclude.size > 0) {
    const known = new Set(ALL_ROUTES_MANIFEST.map((r) => r.key));
    const unknown = [...exclude].filter((key) => !known.has(key as NAuthRouteKey));
    if (unknown.length > 0) {
      throw new Error(
        `Unknown route key(s) in exclude: ${unknown.join(', ')}. ` +
          `Check the spelling against the shipped route keys.`,
      );
    }
  }

  const groupSet = new Set(groups);
  const wantsAdmin = groups.some((g) => g === 'admin' || g === 'apiKeysAdmin');

  if (wantsAdmin && !env.authorizationConfigured) {
    throw new Error(
      `Route bundle '${prefix}' mounts administrative routes, which requires an authorization provider. ` +
        `nauth-toolkit ships no role model, so without one these endpoints would be reachable by ANY ` +
        `authenticated user. Pass 'authorization' to NAuth.create() (or AuthModule.forRoot()).`,
    );
  }

  const routes = ALL_ROUTES_MANIFEST.filter((route) => {
    if (!groupSet.has(route.group)) return false;
    if (exclude.has(route.key)) return false;
    // Drop routes whose optional service is absent rather than failing per-request.
    if (route.requires && !env.services?.[route.requires]) return false;
    return true;
  });

  return { prefix, routes, delivery: options.delivery, options };
}
