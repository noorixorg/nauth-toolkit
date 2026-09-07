/**
 * IP Address Extractor
 *
 * Reads a client IP from proxy/CDN forwarding headers (`X-Forwarded-For`, `CF-Connecting-IP`,
 * `X-Real-IP`, …), falling back to `req.ip` / `req.socket.remoteAddress`.
 *
 * !!! SECURITY WARNING — DO NOT use the result for security decisions !!!
 *
 * Every forwarding header this reads is **client-settable**. Unless `trustedProxies` is set
 * AND enforced, this returns whatever the caller put in the header, so it CANNOT be trusted
 * for anything an attacker benefits from forging: IP-based account lockout, rate limiting,
 * geolocation trust, or audit provenance. (Note: `trustedProxies` is accepted for forward
 * compatibility but is **not currently enforced** by this function — see below.)
 *
 * For a spoof-resistant client IP, use the framework-resolved `req.ip` with a correctly
 * configured `trust proxy` (Express) / `trustProxy` (Fastify), which only honours forwarding
 * headers for hops the operator has explicitly trusted and otherwise falls back to the socket
 * peer. That is what the toolkit's own request handlers and guards do.
 *
 * This helper remains only for callers that must read a *best-effort, untrusted* forwarded IP
 * for non-security purposes (e.g. display/logging behind a proxy you already trust at the
 * network layer).
 *
 * @example
 * ```typescript
 * // NON-SECURITY, best-effort only:
 * const forwardedIp = extractClientIp(req);
 * logger.debug('Reported client IP (untrusted):', forwardedIp);
 * ```
 */

// No need to import Request from express - we use 'any' to avoid dependency

/**
 * Options for IP extraction
 */
export interface IpExtractorOptions {
  /**
   * Whether to filter out private/internal IP addresses
   * Defaults to false
   */
  filterPrivateIps?: boolean;

  /**
   * List of trusted proxy IP addresses or CIDR ranges.
   *
   * NOTE: currently accepted for forward compatibility but **not enforced** by
   * {@link extractClientIp}. Do not rely on this to restrict which peers may set
   * forwarding headers — configure your framework's `trust proxy` / `trustProxy` and read
   * `req.ip` instead.
   */
  trustedProxies?: string[];

  /**
   * Whether to use the leftmost IP in X-Forwarded-For
   * (true = original client, false = rightmost/last proxy)
   * Defaults to true
   */
  useLeftmostIp?: boolean;
}

/**
 * Minimal request shape required for IP extraction.
 *
 * We keep this intentionally framework-agnostic (no Express/Fastify types) to avoid
 * adding hard dependencies from core.
 */
interface IpRequestLike extends Record<string, unknown> {
  headers?: Record<string, unknown>;
  ip?: string;
  socket?: { remoteAddress?: string };
  connection?: { remoteAddress?: string };
}

/**
 * Extracts the real client IP address from an HTTP request
 *
 * @param req - Express Request object
 * @param options - Optional configuration
 * @returns The client's IP address, or '0.0.0.0' if unable to determine
 */
export function extractClientIp(req: IpRequestLike, options: IpExtractorOptions = {}): string {
  const { filterPrivateIps = false, useLeftmostIp = true } = options;

  // Priority order of headers to check
  const headers = [
    'x-forwarded-for', // Standard proxy header (comma-separated)
    'cf-connecting-ip', // Cloudflare
    'x-real-ip', // Nginx
    'x-client-ip', // Apache, other proxies
    'fastly-client-ip', // Fastly CDN
    'akamai-origin-hop', // Akamai CDN
    'true-client-ip', // Cloudflare Enterprise
    'x-original-forwarded-for', // AWS ALB
  ];

  // Ensure headers object exists
  const reqHeaders: Record<string, unknown> = req.headers || {};

  // Try each header in priority order
  for (const header of headers) {
    // Try multiple case variations
    const variations = [
      header, // lowercase: x-forwarded-for
      header.toUpperCase(), // uppercase: X-FORWARDED-FOR
      header
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-'), // PascalCase: X-Forwarded-For
    ];

    let value: string | string[] | null = null;
    for (const variant of variations) {
      const candidate = reqHeaders[variant];
      if (typeof candidate === 'string' || Array.isArray(candidate)) {
        value = candidate;
        break;
      }
    }

    if (value) {
      const ip = extractIpFromHeader(value, useLeftmostIp);
      if (ip && isValidIp(ip)) {
        if (filterPrivateIps && isPrivateIp(ip)) {
          continue; // Skip private IPs
        }
        return ip;
      }
    }
  }

  // Fallback to NestJS/Express defaults
  const fallbackIp = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '0.0.0.0';

  // Clean up IPv6 localhost to IPv4
  if (fallbackIp === '::1' || fallbackIp === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }

  // Strip IPv6 prefix if present
  const cleanIp = fallbackIp.replace(/^::ffff:/, '');

  return cleanIp;
}

/**
 * Extracts IP address from header value
 *
 * @param value - Header value (may be comma-separated list)
 * @param useLeftmost - Whether to use leftmost (original client) or rightmost (last proxy)
 * @returns Extracted IP address or null
 */
function extractIpFromHeader(value: string | string[], useLeftmost: boolean): string | null {
  const valueStr = Array.isArray(value) ? value[0] : value;

  if (!valueStr) return null;

  // Split by comma (X-Forwarded-For can have multiple IPs)
  const ips = valueStr
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (ips.length === 0) return null;

  // Return leftmost (original client) or rightmost (last proxy)
  return useLeftmost ? ips[0] : ips[ips.length - 1];
}

/**
 * Validates if a string is a valid IPv4 or IPv6 address
 *
 * @param ip - IP address to validate
 * @returns True if valid, false otherwise
 */
function isValidIp(ip: string): boolean {
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every((part) => part >= 0 && part <= 255);
  }

  // IPv6 validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip);
}

/**
 * Checks if an IP address is private/internal
 *
 * Detects:
 * - Localhost (127.0.0.0/8, ::1)
 * - Private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - Link-local addresses (169.254.0.0/16)
 *
 * @param ip - IP address to check
 * @returns True if private, false otherwise
 *
 * @example
 * ```typescript
 * isPrivateIp('192.168.1.1'); // true
 * isPrivateIp('8.8.8.8'); // false
 * ```
 */
export function isPrivateIp(ip: string): boolean {
  // Localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.')) {
    return true;
  }

  // Private IPv4 ranges
  const privateRanges = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^169\.254\./, // Link-local (169.254.0.0/16)
  ];

  return privateRanges.some((regex) => regex.test(ip));
}

/**
 * Gets geolocation information for an IP address (placeholder)
 *
 * @param ip - IP address
 * @returns Geolocation info (to be implemented with MaxMind/IP-API)
 */
export function getIpGeolocation(_ip: string): { country?: string; city?: string } {
  // TODO: Implement with MaxMind GeoIP2 or IP-API
  return {};
}
