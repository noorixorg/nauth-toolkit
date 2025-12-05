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
