/**
 * Route manifest types
 *
 * One framework-agnostic description of every shipped route, from which the NestJS,
 * Express and Fastify mounts are all derived. Nothing here imports a framework: a route
 * definition is data plus a handler closure over the service container.
 *
 * @packageDocumentation
 */

import { AuthAction } from '../interfaces/authorization-provider.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthRouteGroup, NAuthRouteKey } from './route-keys';
import { NAuthRouteServices } from './route-services';

/** HTTP methods the manifest uses. */
export type NAuthRouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * How a route is gated.
 *
 * - `public` — no credential required. The guard chain still runs, so a signed-in caller
 *   is identified, but an anonymous one is served rather than rejected.
 * - `authenticated` — a valid session (or an opted-in API key) is required.
 * - `admin` — authenticated, plus the configured authorization provider must permit the
 *   route's {@link NAuthRouteDefinition.action}. Mounting an admin route without a
 *   provider is refused at startup.
 */
export type NAuthRouteAccess = 'public' | 'authenticated' | 'admin';

/**
 * Where a route's payload comes from.
 *
 * `params+body` merges path parameters over the body, which is how routes addressed by
 * `:sub` or `:deviceId` receive both the target and the payload in one DTO.
 */
export type NAuthRouteSource = 'body' | 'query' | 'params' | 'params+body' | 'params+query' | 'none';

/** Which optional service a route needs, so a mount can fail loudly when it is absent. */
export type NAuthRouteRequirement =
  | 'mfaService'
  | 'socialAuthService'
  | 'auditService'
  | 'apiKeyService'
  | 'socialRedirect';

/**
 * Everything a route handler may touch.
 *
 * Deliberately narrow: handlers receive resolved services and a validated DTO, never a
 * framework request. Anything a handler needs beyond this belongs on the DTO.
 */
export interface NAuthRouteContext<TDto extends object = object> {
  /** The validated request DTO, or `{}` for routes that take no input. */
  readonly dto: TDto;
  /** Raw path parameters, for handlers that need them separately from the DTO. */
  readonly params: Record<string, string>;
  /** Parsed query parameters. */
  readonly query: Record<string, unknown>;
  /** Request cookies, so `refresh` can fall back to the configured refresh cookie. */
  readonly cookies: Record<string, string | undefined>;
  /** The resolved service container. */
  readonly services: NAuthRouteServices;
  /** The active configuration. */
  readonly config: NAuthConfig;
}

/**
 * A single shipped route.
 *
 * @typeParam TDto - The request DTO this route validates and hands to its handler
 * @typeParam TResponse - What the handler resolves to, kept precise so OpenAPI
 *                        generation can describe responses without re-deriving them
 */
export interface NAuthRouteDefinition<TDto extends object = object, TResponse = unknown> {
  /** Stable identifier, and the value passed to `exclude`. */
  readonly key: NAuthRouteKey;

  /** Bundle membership. Orthogonal to {@link access}. */
  readonly group: NAuthRouteGroup;

  readonly method: NAuthRouteMethod;

  /** Path relative to the mount prefix. Colon-style parameters, no leading slash. */
  readonly path: string;

  readonly access: NAuthRouteAccess;

  /**
   * The privileged operation this route performs.
   *
   * Required for `access: 'admin'`. The service authorizes it independently; the route
   * carries it so a mount can reject an admin bundle with no provider before serving
   * a single request.
   */
  readonly action?: AuthAction;

  /** Success status code. */
  readonly status: number;

  readonly source: NAuthRouteSource;

  /**
   * DTO class validated before the handler runs.
   *
   * Validation happens at the mount layer so Express and Fastify — which have no
   * validation pipe — get the same guarantee as NestJS.
   */
  readonly dto?: new () => TDto;

  /** Route-level reCAPTCHA posture. Omit to inherit the global configuration. */
  readonly recaptcha?: 'require' | 'skip';

  /**
   * Force a delivery mode regardless of the mount's.
   *
   * Only for routes that are meaningless under the other transport — the social
   * exchange endpoint, which exists to hand tokens to a JSON client.
   */
  readonly delivery?: 'json' | 'cookies';

  /** Set false to bypass the deferred CSRF check, as logout-style routes do. */
  readonly csrf?: boolean;

  /** Whether an API-key-authenticated caller may use this route. */
  readonly apiKey?: 'allow' | 'deny';

  /** True when the handler returns a redirect target rather than a response body. */
  readonly redirect?: boolean;

  /** Optional service this route depends on. */
  readonly requires?: NAuthRouteRequirement;

  /** Performs the work. Receives resolved services and the validated DTO. */
  readonly handler: (ctx: NAuthRouteContext<TDto>) => Promise<TResponse>;
}

/**
 * A route definition with its concrete DTO type erased.
 *
 * Manifests are heterogeneous arrays, so they are typed with this. The generic form is
 * preserved at each definition site by {@link defineRoute}, which is where type checking
 * actually matters.
 */
export type AnyNAuthRouteDefinition = NAuthRouteDefinition<never, unknown>;

/**
 * Define a route with its DTO and response types checked.
 *
 * Identity at runtime; it exists so each definition is checked against its own DTO
 * while the resulting array stays assignable to a single manifest type.
 *
 * @param route - The route definition
 * @returns The same definition, type-erased for storage in a manifest
 *
 * @example
 * ```typescript
 * defineRoute({
 *   key: 'login', group: 'core', method: 'POST', path: 'login',
 *   access: 'public', status: 200, source: 'body', dto: LoginDTO,
 *   handler: ({ dto, services }) => services.authService.login(dto),
 * })
 * ```
 */
export function defineRoute<TDto extends object, TResponse>(
  route: NAuthRouteDefinition<TDto, TResponse>,
): AnyNAuthRouteDefinition {
  return route as unknown as AnyNAuthRouteDefinition;
}
