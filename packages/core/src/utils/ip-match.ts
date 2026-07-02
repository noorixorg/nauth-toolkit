/**
 * IP Allowlist Matching
 *
 * Utilities for matching a source IP against an allowlist entry that may be an
 * exact IPv4/IPv6 address or an IPv4 CIDR range. Used to enforce per-API-key IP
 * restrictions.
 *
 * @remarks
 * IPv4 CIDR ranges (e.g. `10.0.0.0/8`) and exact IPv4/IPv6 addresses are supported.
 * IPv6 CIDR ranges are not expanded; provide exact IPv6 addresses instead.
 */

/**
 * Validate a dotted-quad IPv4 string (octet range enforced).
 */
function isIpv4(value: string): boolean {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4.test(value)) {
    return false;
  }
  return value
    .split('.')
    .map(Number)
    .every((part) => part >= 0 && part <= 255);
}

/**
 * Validate whether a string is a plausible IPv4 or IPv6 address.
 *
 * Accepts IPv4, IPv4-mapped IPv6 (e.g. `::ffff:192.168.0.1`), and general IPv6.
 * Rejects malformed IPv6 with more than one `::` compression.
 */
function isIpAddress(value: string): boolean {
  if (isIpv4(value)) {
    return true;
  }
  // IPv4-mapped IPv6, e.g. ::ffff:203.0.113.4
  const mapped = value.match(/^::ffff:(.+)$/i);
  if (mapped) {
    return isIpv4(mapped[1]);
  }
  // General IPv6: at most one "::" compression allowed.
  if ((value.match(/::/g) ?? []).length > 1) {
    return false;
  }
  const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6.test(value);
}

/**
 * Validate whether a string is a valid IP address or IPv4 CIDR range.
 *
 * @param entry - Candidate allowlist entry
 * @returns true if the entry is a usable IP or IPv4 CIDR
 *
 * @example
 * ```typescript
 * isValidIpOrCidr('203.0.113.4');   // true
 * isValidIpOrCidr('10.0.0.0/8');    // true
 * isValidIpOrCidr('not-an-ip');     // false
 * ```
 */
export function isValidIpOrCidr(entry: string): boolean {
  if (typeof entry !== 'string' || entry.trim().length === 0) {
    return false;
  }
  const trimmed = entry.trim();
  if (trimmed.includes('/')) {
    const [base, prefixStr] = trimmed.split('/');
    const prefix = Number(prefixStr);
    // Only IPv4 CIDR is supported for range matching.
    if (!isIpv4(base)) {
      return false;
    }
    return Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
  }
  return isIpAddress(trimmed);
}

/**
 * Convert an IPv4 dotted-quad string to a 32-bit unsigned integer.
 */
function ipv4ToInt(ip: string): number | null {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4.test(ip)) {
    return null;
  }
  const parts = ip.split('.').map(Number);
  if (!parts.every((p) => p >= 0 && p <= 255)) {
    return null;
  }
  // Unsigned 32-bit via >>> 0
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Determine whether a source IP matches a single allowlist entry.
 *
 * Supports:
 * - Exact IPv4/IPv6 match (case-insensitive for IPv6)
 * - IPv4 CIDR range match (e.g. `10.0.0.0/8`)
 *
 * @param ip - Source IP of the request
 * @param entry - Allowlist entry (IP or IPv4 CIDR)
 * @returns true if the IP is covered by the entry
 *
 * @example
 * ```typescript
 * ipMatchesEntry('10.1.2.3', '10.0.0.0/8'); // true
 * ipMatchesEntry('203.0.113.4', '203.0.113.4'); // true
 * ```
 */
export function ipMatchesEntry(ip: string, entry: string): boolean {
  if (!ip || !entry) {
    return false;
  }
  const normalizedIp = ip.trim().replace(/^::ffff:/i, '');
  const normalizedEntry = entry.trim();

  if (normalizedEntry.includes('/')) {
    const [base, prefixStr] = normalizedEntry.split('/');
    const prefix = Number(prefixStr);
    const ipInt = ipv4ToInt(normalizedIp);
    const baseInt = ipv4ToInt(base);
    if (ipInt === null || baseInt === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      return false;
    }
    if (prefix === 0) {
      return true;
    }
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (baseInt & mask);
  }

  // Exact match (case-insensitive to accommodate IPv6 hex casing)
  return normalizedIp.toLowerCase() === normalizedEntry.replace(/^::ffff:/i, '').toLowerCase();
}
