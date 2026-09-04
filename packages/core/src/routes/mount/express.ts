/**
 * Express mount for the shipped routes
 *
 * Registers the resolved manifest on a router you own. Structurally typed so core keeps
 * its zero framework imports — the Express adapter takes the same approach.
 *
 * @packageDocumentation
 */

import { NAuthConfig } from '../../interfaces/config.interface';
import { NAuthException, getHttpStatusForErrorCode } from '../../exceptions/nauth.exception';
import { AnyNAuthRouteDefinition } from '../route-manifest.types';
import { NAuthRouteServices, pickRouteServices } from '../route-services';
import { assertMountsCompatible, normalizeMounts, NAuthRouteMountOptions, resolveMount } from '../resolve-mount';
import { runRoute } from './run-route';

/** The slice of an Express router the mount registers on. */
export interface ExpressRouterLike {
  get(path: string, ...handlers: unknown[]): unknown;
  post(path: string, ...handlers: unknown[]): unknown;
  put(path: string, ...handlers: unknown[]): unknown;
  patch(path: string, ...handlers: unknown[]): unknown;
  delete(path: string, ...handlers: unknown[]): unknown;
}

/** The parts of an NAuth instance this mount needs. */
export interface ExpressMountInstance extends NAuthRouteServices {
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

/** Minimal Express request shape the mount reads. */
interface ExpressReq {
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  cookies?: Record<string, string | undefined>;
}

/** Minimal Express response shape the mount writes. */
interface ExpressRes {
  status(code: number): ExpressRes;
  json(body: unknown): unknown;
  redirect(url: string): unknown;
}

/**
 * Build the middleware chain for one route from the instance's helpers.
 *
 * Order matters: access gating first, then the route's delivery and reCAPTCHA posture,
 * then any consumer guards, so a guard runs with the user already attached.
 *
 * @param route - The route being registered
 * @param instance - The bootstrapped NAuth instance
 * @param mount - The resolved mount, for its forced delivery and guard lists
 * @returns The middleware to place before the handler
 */
function buildChain(
  route: AnyNAuthRouteDefinition,
  instance: ExpressMountInstance,
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
 * Register the shipped auth routes on an Express router.
 *
 * The router is mounted by the caller, so `prefix` is only used for error messages and
 * for validating the bundle — mount the returned router where you want the paths.
 *
 * @param router - An Express `Router()` or the application itself
 * @param instance - The instance returned by `NAuth.create()`
 * @param options - Which routes to mount, and how
 * @throws {Error} When the bundle is misconfigured — see `resolveMount`
 *
 * @example
 * ```typescript
 * app.use('/auth', registerNAuthExpressRoutes(express.Router(), nauth, { delivery: 'cookies' }));
 * ```
 */
export function registerNAuthExpressRoutes(
  router: ExpressRouterLike,
  instance: ExpressMountInstance,
  options: NAuthRouteMountOptions = {},
): void {
  assertMountsCompatible(instance.config, normalizeMounts(options));

  const mount = resolveMount(options, {
    config: instance.config,
    services: instance,
    authorizationConfigured: instance.authorizationService?.isConfigured() ?? false,
  });

  if (!mount) return;

  const services = pickRouteServices(instance);

  for (const route of mount.routes) {
    const path = `/${route.path}`;
    const chain = buildChain(route, instance, mount);

    const handler = async (req: ExpressReq, res: ExpressRes, next: (err?: unknown) => void): Promise<void> => {
      try {
        const result = await runRoute(
          route,
          { body: req.body, query: req.query, params: req.params, cookies: req.cookies },
          services,
          instance.config,
        );

        if (route.redirect) {
          const { url } = (result ?? {}) as { url?: string };
          if (url) {
            res.redirect(url);
            return;
          }
        }

        res.status(route.status).json(result);
      } catch (error) {
        // Map NAuth errors here so a consumer needs no bespoke error handler for the
        // shipped routes; anything else is passed on untouched.
        if (error instanceof NAuthException) {
          res.status(getHttpStatusForErrorCode(error.code)).json({
            statusCode: getHttpStatusForErrorCode(error.code),
            code: error.code,
            message: error.message,
          });
          return;
        }
        next(error);
      }
    };

    const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    router[method](path, ...chain, handler);
  }
}
