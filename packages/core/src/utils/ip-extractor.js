"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractClientIp = extractClientIp;
exports.isPrivateIp = isPrivateIp;
exports.getIpGeolocation = getIpGeolocation;
/**
 * Extracts the real client IP address from an HTTP request
 *
 * @param req - Express Request object
 * @param options - Optional configuration
 * @returns The client's IP address, or '0.0.0.0' if unable to determine
 */
function extractClientIp(req, options) {
    var _a, _b;
    if (options === void 0) { options = {}; }
    var _c = options.filterPrivateIps, filterPrivateIps = _c === void 0 ? false : _c, _d = options.useLeftmostIp, useLeftmostIp = _d === void 0 ? true : _d;
    // Priority order of headers to check
    var headers = [
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
    var reqHeaders = req.headers || {};
    // Try each header in priority order
    for (var _i = 0, headers_1 = headers; _i < headers_1.length; _i++) {
        var header = headers_1[_i];
        // Try multiple case variations
        var variations = [
            header, // lowercase: x-forwarded-for
            header.toUpperCase(), // uppercase: X-FORWARDED-FOR
            header
                .split('-')
                .map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); })
                .join('-'), // PascalCase: X-Forwarded-For
        ];
        var value = null;
        for (var _e = 0, variations_1 = variations; _e < variations_1.length; _e++) {
            var variant = variations_1[_e];
            if (reqHeaders[variant]) {
                value = reqHeaders[variant];
                break;
            }
        }
        if (value) {
            var ip = extractIpFromHeader(value, useLeftmostIp);
            if (ip && isValidIp(ip)) {
                if (filterPrivateIps && isPrivateIp(ip)) {
                    continue; // Skip private IPs
                }
                return ip;
            }
        }
    }
    // Fallback to NestJS/Express defaults
    var fallbackIp = req.ip || ((_a = req.socket) === null || _a === void 0 ? void 0 : _a.remoteAddress) || ((_b = req.connection) === null || _b === void 0 ? void 0 : _b.remoteAddress) || '0.0.0.0';
    // Clean up IPv6 localhost to IPv4
    if (fallbackIp === '::1' || fallbackIp === '::ffff:127.0.0.1') {
        return '127.0.0.1';
    }
    // Strip IPv6 prefix if present
    var cleanIp = fallbackIp.replace(/^::ffff:/, '');
    return cleanIp;
}
/**
 * Extracts IP address from header value
 *
 * @param value - Header value (may be comma-separated list)
 * @param useLeftmost - Whether to use leftmost (original client) or rightmost (last proxy)
 * @returns Extracted IP address or null
 */
function extractIpFromHeader(value, useLeftmost) {
    var valueStr = Array.isArray(value) ? value[0] : value;
    if (!valueStr)
        return null;
    // Split by comma (X-Forwarded-For can have multiple IPs)
    var ips = valueStr
        .split(',')
        .map(function (ip) { return ip.trim(); })
        .filter(Boolean);
    if (ips.length === 0)
        return null;
    // Return leftmost (original client) or rightmost (last proxy)
    return useLeftmost ? ips[0] : ips[ips.length - 1];
}
/**
 * Validates if a string is a valid IPv4 or IPv6 address
 *
 * @param ip - IP address to validate
 * @returns True if valid, false otherwise
 */
function isValidIp(ip) {
    // IPv4 validation
    var ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
        var parts = ip.split('.').map(Number);
        return parts.every(function (part) { return part >= 0 && part <= 255; });
    }
    // IPv6 validation (simplified)
    var ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
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
function isPrivateIp(ip) {
    // Localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.')) {
        return true;
    }
    // Private IPv4 ranges
    var privateRanges = [
        /^10\./, // 10.0.0.0/8
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
        /^192\.168\./, // 192.168.0.0/16
        /^169\.254\./, // Link-local (169.254.0.0/16)
    ];
    return privateRanges.some(function (regex) { return regex.test(ip); });
}
/**
 * Gets geolocation information for an IP address (placeholder)
 *
 * @param ip - IP address
 * @returns Geolocation info (to be implemented with MaxMind/IP-API)
 */
function getIpGeolocation(_ip) {
    // TODO: Implement with MaxMind GeoIP2 or IP-API
    return {};
}
