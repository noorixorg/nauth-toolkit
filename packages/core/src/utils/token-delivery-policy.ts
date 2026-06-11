/**
 * Token Delivery Policy Resolution
 *
 * Framework-agnostic utility to determine per-request token delivery:
 * - 'cookies' for web browser origins
 * - 'json' for native/mobile or non-web clients
 *
 * Uses only generic request shape (headers.origin) to avoid express/fastify types.
 */

export interface HybridPolicy {
  /** Allowed web SPA origins (cookies) */
  webOrigins?: string[];
  /** Allowed native or non-web origins (json tokens) */
  nativeOrigins?: string[];
  /**
   * Refresh token TTL override applied when a request resolves to 'cookies' delivery.
   * Falls back to jwt.refreshToken.expiresIn when unset.
   */
  cookieRefreshExpiresIn?: string | number;
  /**
   * Refresh token TTL override applied when a request resolves to 'json' delivery.
   * Falls back to jwt.refreshToken.expiresIn when unset.
   */
  jsonRefreshExpiresIn?: string | number;
}

/**
 * Resolve effective delivery for a request in hybrid mode.
 *
 * Safe default: return 'cookies' when origin is unknown or not matched.
 * This avoids leaking tokens to browsers by default.
 */
export function resolveDeliveryForRequest(req: unknown, policy?: HybridPolicy): 'cookies' | 'json' {
  const r = req as { headers?: Record<string, unknown> } | undefined;
  const origin = (r?.headers?.origin as string) || '';

  // Prefer explicit origin classification
  if (policy?.nativeOrigins && policy.nativeOrigins.includes(origin)) {
    return 'json';
  }
  if (policy?.webOrigins && policy.webOrigins.includes(origin)) {
    return 'cookies';
  }

  // Default safe posture: treat as web (cookies only)
  return 'cookies';
}

/**
 * Minimal shape of the portions of NAuthConfig that this resolver reads.
 * Declared inline to keep this utility free of deep config-type imports.
 */
interface TokenDeliveryConfigShape {
  tokenDelivery?: {
    method?: 'json' | 'cookies' | 'hybrid';
    hybridPolicy?: HybridPolicy;
  };
}

/**
 * Shape of the wrapped NAuthRequest this resolver reads. The full
 * NAuthRequest is accepted so route-level overrides set by any adapter
 * (stored on `req.attributes`) are honored, while origin-based classification
 * still falls back to the raw request.
 */
interface NAuthRequestShape {
  attributes?: Record<string, unknown>;
  raw?: unknown;
}

/**
 * Resolve the per-request refresh token TTL override based on hybrid policy.
 *
 * Only active when `tokenDelivery.method === 'hybrid'`. Delivery classification
 * follows the same precedence as the adapter-specific delivery handlers:
 *
 *   1. Route-level override set by any adapter:
 *      - NestJS `@TokenDelivery()` decorator → `req.attributes.nauthTokenDeliveryOverride`
 *      - Express `nauth.helpers.tokenDelivery()` middleware → `req.attributes.nauthTokenDelivery`
 *      - Fastify `nauth.helpers.tokenDelivery()` hook → `req.attributes.nauthTokenDelivery`
 *      This is the common pattern for dedicated `/mobile` endpoints in hybrid mode.
 *   2. Origin-based classification via `hybridPolicy.webOrigins` /
 *      `nativeOrigins` for requests without a route-level override.
 *
 * Whichever classifies the request picks between `jsonRefreshExpiresIn` and
 * `cookieRefreshExpiresIn`.
 *
 * @returns The resolved override value, or `undefined` if no override applies
 *          (non-hybrid mode, or the matching field is unset). Callers fall
 *          back to the global `jwt.refreshToken.expiresIn` when undefined.
 */
export function resolveRefreshExpiresIn(
  req: NAuthRequestShape | undefined,
  config: TokenDeliveryConfigShape,
): string | number | undefined {
  if (config.tokenDelivery?.method !== 'hybrid') {
    return undefined;
  }

  const policy = config.tokenDelivery.hybridPolicy;
  if (!policy) {
    return undefined;
  }

  // Route-level override wins — mirrors the adapter handlers' precedence so
  // refresh TTL tracks the actual delivery mode the response will use. Both
  // attribute names are honored because Express/Fastify set
  // `nauthTokenDelivery` while NestJS sets `nauthTokenDeliveryOverride`.
  const attrs = req?.attributes;
  const attrOverride = (attrs?.['nauthTokenDelivery'] ?? attrs?.['nauthTokenDeliveryOverride']) as
    | 'json'
    | 'cookies'
    | undefined;

  const delivery = attrOverride ?? resolveDeliveryForRequest(req?.raw, policy);
  return delivery === 'json' ? policy.jsonRefreshExpiresIn : policy.cookieRefreshExpiresIn;
}
