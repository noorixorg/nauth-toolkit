/**
 * Shipped auth routes
 *
 * A framework-agnostic description of every endpoint the toolkit can serve, plus the
 * resolution logic all three adapters share. Mount these instead of hand-writing
 * controllers; `exclude` individual keys where you need your own behaviour.
 *
 * @packageDocumentation
 */

export * from './route-keys';
export * from './route-manifest.types';
export * from './route-services';
export * from './resolve-mount';
export { AUTH_ROUTES_MANIFEST } from './auth-routes.manifest';
export { ADMIN_ROUTES_MANIFEST } from './admin-routes.manifest';
export { registerNAuthExpressRoutes } from './mount/express';
export type { ExpressRouterLike, ExpressMountInstance } from './mount/express';
export { registerNAuthFastifyRoutes } from './mount/fastify';
export type { FastifyInstanceLike, FastifyMountInstance } from './mount/fastify';
export { runRoute, buildRouteInput } from './mount/run-route';
export type { RouteInvocation } from './mount/run-route';
