/**
 * Shared route execution
 *
 * The single place a shipped route's input is assembled, validated and handed to its
 * handler. All three mounts call this, so a NestJS request and an Express request to
 * the same route validate identically and fail identically.
 *
 * @packageDocumentation
 */

import { ensureValidatedDto } from '../../utils/dto-validator';
import { NAuthConfig } from '../../interfaces/config.interface';
import { AnyNAuthRouteDefinition, NAuthRouteContext } from '../route-manifest.types';
import { NAuthRouteServices } from '../route-services';

/** The parts of an incoming request a shipped route can read. */
export interface RouteInvocation {
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  cookies?: Record<string, string | undefined>;
}

/**
 * Assemble a route's input from the request, according to its declared source.
 *
 * Path parameters are merged *under* the body so an explicit body value wins, matching
 * how the hand-written controllers behaved.
 *
 * @param route - The route being invoked
 * @param request - The incoming request parts
 * @returns The raw input object to validate
 */
export function buildRouteInput(route: AnyNAuthRouteDefinition, request: RouteInvocation): Record<string, unknown> {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const query = request.query ?? {};
  const params = request.params ?? {};

  switch (route.source) {
    case 'body':
      return { ...body };
    case 'query':
      return { ...query };
    case 'params':
      return { ...params };
    case 'params+body':
      return { ...params, ...body };
    case 'params+query':
      return { ...params, ...query };
    case 'none':
    default:
      return {};
  }
}

/**
 * Validate and run one shipped route.
 *
 * Validation happens here rather than in a framework pipe so that Express and Fastify —
 * which have no pipe — get the same guarantee as NestJS, and so every mount produces
 * the identical `VALIDATION_FAILED` error shape.
 *
 * @param route - The route to run
 * @param request - The incoming request parts
 * @param services - The resolved service container
 * @param config - The active configuration
 * @returns Whatever the route's handler resolves to
 */
export async function runRoute(
  route: AnyNAuthRouteDefinition,
  request: RouteInvocation,
  services: NAuthRouteServices,
  config: NAuthConfig,
): Promise<unknown> {
  const input = buildRouteInput(route, request);
  const dto = route.dto ? await ensureValidatedDto(route.dto as new () => object, input) : input;

  const context: NAuthRouteContext = {
    dto: dto as object,
    params: request.params ?? {},
    query: request.query ?? {},
    cookies: request.cookies ?? {},
    services,
    config,
  };

  return (route.handler as (ctx: NAuthRouteContext) => Promise<unknown>)(context);
}
