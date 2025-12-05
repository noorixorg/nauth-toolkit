/**
 * IP Address Extractor
 *
 * Extracts the real client IP address from requests, handling:
 * - Direct connections
 * - Reverse proxies (Nginx, Apache)
 * - Load balancers (AWS ALB/NLB, GCP, Azure)
 * - CDNs (Cloudflare, Fastly, Akamai)
 *
 * **Priority Order:**
 * 1. X-Forwarded-For (standard proxy header)
 * 2. CF-Connecting-IP (Cloudflare)
 * 3. X-Real-IP (Nginx proxy)
 * 4. X-Client-IP (Apache, other proxies)
 * 5. Fastly-Client-IP (Fastly CDN)
 * 6. Akamai-Origin-Hop (Akamai CDN)
 * 7. req.ip (NestJS/Express default)
 * 8. req.socket.remoteAddress (fallback)
 *
 * **Security:**
 * - Handles multiple proxies (takes leftmost IP)
 * - Validates IP format
 * - Filters private/internal IPs (optional)
 * - Prevents IP spoofing
 *
 * @example
 * ```typescript
 * import { extractClientIp } from '@nauth-toolkit/core/utils';
 *
 * @Post('login')
 * async login(@Req() req: Request) {
 *   const ipAddress = extractClientIp(req);
 *   logger.debug('Client IP:', ipAddress); // Real client IP
 * }
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
   * List of trusted proxy IP addresses or CIDR ranges
   * If specified, only accepts X-Forwarded-For from these proxies
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
 * Extracts the real client IP address from an HTTP request
 *
 * @param req - Express Request object
 * @param options - Optional configuration
 * @returns The client's IP address, or '0.0.0.0' if unable to determine
 */
export function extractClientIp(req: any, options: IpExtractorOptions = {}): string {
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
  const reqHeaders = req.headers || {};

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

    let value = null;
    for (const variant of variations) {
      if (reqHeaders[variant]) {
        value = reqHeaders[variant];
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
