/**
 * Fastify mount for the shipped routes
 *
 * The counterpart to the Express mount. Owning `wrapRouteHandler` internally is what
 * removes the casts consumers previously needed when wiring routes by hand.
 *
 * @packageDocumentation
 */

import { NAuthConfig } from '../../interfaces/config.interface';
import { NAuthException, getHttpStatusForErrorCode } from '../../exceptions/nauth.exception';
import { AnyNAuthRouteDefinition } from '../route-manifest.types';
import { NAuthRouteServices, pickRouteServices } from '../route-services';
import { assertMountsCompatible, normalizeMounts, NAuthRouteMountOptions, resolveMount } from '../resolve-mount';
import { runRoute } from './run-route';

/**
 * The route-registration surface this mount uses, once narrowed.
 *
 * Not the public parameter type: Fastify's `route()` is generic, so TypeScript checks
 * it contravariantly and no structural declaration here can accept a real
 * `FastifyInstance`. The mount therefore takes `unknown` and narrows internally —
 * which is the whole point, since making consumers cast is what this replaces.
 */
interface FastifyRouteRegistrar {
  route(options: { method: string; url: string; preHandler?: unknown; handler: unknown }): unknown;
}

/**
 * Anything that can register Fastify routes — an instance, or a plugin scope.
 *
 * Deliberately `unknown`: see {@link FastifyRouteRegistrar}.
 */
export type FastifyInstanceLike = unknown;

/** The parts of an NAuth instance this mount needs. */
export interface FastifyMountInstance extends NAuthRouteServices {
  config: NAuthConfig;
  helpers: {
    public(): unknown;
    requireAuth(options?: { csrf?: boolean }): unknown;
    tokenDelivery(mode: 'json' | 'cookies'): unknown;
    requireRecaptcha?(): unknown;
    skipRecaptcha?(): unknown;
    allowApiKey?(): unknown;
    denyApiKey?(): unknown;
  };
  authorizationService?: { isConfigured(): boolean };
}

/** Minimal Fastify request shape the mount reads. */
interface FastifyReq {
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  cookies?: Record<string, string | undefined>;
}

/** Minimal Fastify reply shape the mount writes. */
interface FastifyRep {
  code(status: number): FastifyRep;
  send(body?: unknown): unknown;
  redirect(url: string): unknown;
}

/**
 * Build the preHandler chain for one route.
 *
 * @param route - The route being registered
 * @param instance - The bootstrapped NAuth instance
 * @param mount - The resolved mount
 * @returns Hooks to run before the handler
 */
function buildChain(
  route: AnyNAuthRouteDefinition,
  instance: FastifyMountInstance,
  mount: { delivery?: 'json' | 'cookies'; options: NAuthRouteMountOptions },
): unknown[] {
  const { helpers } = instance;
  const chain: unknown[] = [];

  if (route.access === 'public') {
    chain.push(helpers.public());
  } else {
    chain.push(helpers.requireAuth({ csrf: route.csrf }));
  }

  if (route.apiKey === 'deny' && helpers.denyApiKey) chain.push(helpers.denyApiKey());
  if (route.apiKey === 'allow' && helpers.allowApiKey) chain.push(helpers.allowApiKey());

  const delivery = route.delivery ?? mount.delivery;
  if (delivery) chain.push(helpers.tokenDelivery(delivery));

  if (route.recaptcha === 'require' && helpers.requireRecaptcha) chain.push(helpers.requireRecaptcha());
  if (route.recaptcha === 'skip' && helpers.skipRecaptcha) chain.push(helpers.skipRecaptcha());

  const { guards = [], adminGuards = [], routeGuards = {} } = mount.options;
  chain.push(...guards);
  if (route.access === 'admin') chain.push(...adminGuards);
  chain.push(...(routeGuards[route.key] ?? []));

  return chain;
}

/**
 * Convert a manifest path to Fastify's parameter syntax.
 *
 * The manifest uses `:param`, which Fastify also accepts, so this only normalises the
 * leading slash. Kept as a seam in case a future adapter needs a different dialect.
 *
 * @param path - Manifest path, without a leading slash
 * @returns A Fastify route URL
 */
function toFastifyUrl(path: string): string {
  return `/${path}`;
}

/**
 * Register the shipped auth routes on a Fastify instance.
 *
 * Register inside an encapsulated scope to apply a prefix:
 *
 * @param fastify - The Fastify instance or plugin scope
 * @param instance - The instance returned by `NAuth.create()`
 * @param options - Which routes to mount, and how
 * @throws {Error} When the bundle is misconfigured — see `resolveMount`
 *
 * @example
 * ```typescript
 * await fastify.register(
 *   async (scope) => registerNAuthFastifyRoutes(scope, nauth, { delivery: 'cookies' }),
 *   { prefix: '/auth' },
 * );
 * ```
 */
export function registerNAuthFastifyRoutes(
  fastify: FastifyInstanceLike,
  instance: FastifyMountInstance,
  options: NAuthRouteMountOptions = {},
): void {
  const registrar = fastify as FastifyRouteRegistrar | undefined;

  if (!registrar || typeof registrar.route !== 'function') {
    throw new Error('registerNAuthFastifyRoutes() expects a Fastify instance or plugin scope with a route() method.');
  }

  assertMountsCompatible(instance.config, normalizeMounts(options));

  const mount = resolveMount(options, {
    config: instance.config,
    services: instance,
    authorizationConfigured: instance.authorizationService?.isConfigured() ?? false,
  });

  if (!mount) return;

  const services = pickRouteServices(instance);

  for (const route of mount.routes) {
    const chain = buildChain(route, instance, mount);

    registrar.route({
      method: route.method,
      url: toFastifyUrl(route.path),
      preHandler: chain,
      handler: async (request: unknown, reply: unknown): Promise<unknown> => {
        const req = request as FastifyReq;
        const rep = reply as FastifyRep;

        try {
          const result = await runRoute(
            route,
            { body: req.body, query: req.query, params: req.params, cookies: req.cookies },
            services,
            instance.config,
          );

          if (route.redirect) {
            const { url } = (result ?? {}) as { url?: string };
            if (url) return rep.redirect(url);
          }

          return rep.code(route.status).send(result);
        } catch (error) {
          if (error instanceof NAuthException) {
            const status = getHttpStatusForErrorCode(error.code);
            return rep.code(status).send({ statusCode: status, code: error.code, message: error.message });
          }
          throw error;
        }
      },
    });
  }
}
