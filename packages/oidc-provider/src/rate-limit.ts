import type { StorageAdapter } from '@nauth-toolkit/core';

/** Limits for one endpoint. */
export interface OIDCEndpointLimit {
  /** Maximum requests allowed in the window. */
  max: number;
  /** Window length, in seconds. */
  windowSeconds: number;
}

/**
 * Per-endpoint limits for the provider.
 *
 * Endpoints not listed are unlimited.
 */
export interface OIDCRateLimitConfig {
  /** `/oauth/authorize`, keyed by client id and source IP. */
  authorize?: OIDCEndpointLimit;
  /** `/oauth/token`, keyed by source IP. The brute-force surface that matters most. */
  token?: OIDCEndpointLimit;
  /** `/oauth/token/introspection`. Often on a gateway's hot path — set generously or leave unset. */
  introspection?: OIDCEndpointLimit;
}

/** Sensible starting limits, applied when a section is configured with no values. */
const DEFAULTS: Required<OIDCRateLimitConfig> = {
  authorize: { max: 60, windowSeconds: 60 },
  token: { max: 60, windowSeconds: 60 },
  introspection: { max: 600, windowSeconds: 60 },
};

/** The request shape this middleware inspects. */
interface RateLimitedRequest {
  url?: string;
  method?: string;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

/** The response shape this middleware writes a rejection to. */
interface RateLimitedResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

/**
 * Rate limiting for the OpenID Connect provider's endpoints.
 *
 * `oidc-provider` ships none, and the provider is mounted outside nauth's guard chain,
 * so nothing else covers these paths either. `POST /token` in particular is an
 * unauthenticated brute-force surface against client secrets and authorization codes.
 *
 * Counting uses the storage adapter's atomic `incr`, which is the same primitive the
 * rest of the toolkit rate-limits with, so it holds across instances rather than per
 * process.
 *
 * Mount it immediately **before** the provider, so a rejected request never reaches it.
 *
 * @example
 * ```typescript
 * app.use(createOIDCRateLimiter(nauth.storage, { token: { max: 30, windowSeconds: 60 } }));
 * mountOIDCProviderExpress(app, provider);
 * ```
 */
export function createOIDCRateLimiter(
  storage: StorageAdapter,
  config: OIDCRateLimitConfig = {},
  options: { pathPrefix?: string } = {},
): (req: RateLimitedRequest, res: RateLimitedResponse, next: () => void) => void {
  const prefix = options.pathPrefix ?? '/oidc';

  const limits: { path: string; name: string; limit: OIDCEndpointLimit }[] = [];
  if (config.authorize) {
    limits.push({ path: `${prefix}/auth`, name: 'authorize', limit: { ...DEFAULTS.authorize, ...config.authorize } });
  }
  if (config.token) {
    limits.push({ path: `${prefix}/token`, name: 'token', limit: { ...DEFAULTS.token, ...config.token } });
  }
  if (config.introspection) {
    limits.push({
      path: `${prefix}/token/introspection`,
      name: 'introspection',
      limit: { ...DEFAULTS.introspection, ...config.introspection },
    });
  }

  return (req, res, next): void => {
    if (limits.length === 0) {
      next();
      return;
    }

    const path = (req.url ?? '').split('?')[0];
    // Longest path first, so /token/introspection is not swallowed by /token.
    const match = [...limits].sort((a, b) => b.path.length - a.path.length).find((l) => path === l.path);
    if (!match) {
      next();
      return;
    }

    const key = `oidc:rl:${match.name}:${clientIp(req)}`;

    void storage
      .incr(key, match.limit.windowSeconds)
      .then((count) => {
        if (count <= match.limit.max) {
          next();
          return;
        }
        // RFC 6749 §5.2 has no rate-limit error, so this is a plain 429 with
        // Retry-After rather than an OAuth error body.
        res.statusCode = 429;
        res.setHeader('content-type', 'application/json');
        res.setHeader('retry-after', String(match.limit.windowSeconds));
        res.setHeader('cache-control', 'no-store');
        res.end(
          JSON.stringify({
            error: 'temporarily_unavailable',
            error_description: 'Too many requests. Try again shortly.',
          }),
        );
      })
      .catch(() => {
        // Storage being unavailable must not take the provider down with it.
        next();
      });
  };
}

/**
 * Best-effort source address, preferring the proxy's forwarded value.
 */
function clientIp(req: RateLimitedRequest): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (first) {
    return first.split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}
