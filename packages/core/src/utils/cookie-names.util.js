"use strict";
/**
 * Cookie Name Utilities
 *
 * Provides consistent cookie name generation using the configured prefix.
 * All cookie names are prefixed to avoid conflicts with other cookies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCookieNamePrefix = getCookieNamePrefix;
exports.getAccessTokenCookieName = getAccessTokenCookieName;
exports.getRefreshTokenCookieName = getRefreshTokenCookieName;
exports.getDeviceTokenCookieName = getDeviceTokenCookieName;
exports.getCsrfTokenCookieName = getCsrfTokenCookieName;
/**
 * Get the cookie name prefix from config
 * @param config - NAuth configuration
 * @returns Cookie name prefix (default: 'nauth_')
 */
function getCookieNamePrefix(config) {
    var _a;
    return ((_a = config === null || config === void 0 ? void 0 : config.tokenDelivery) === null || _a === void 0 ? void 0 : _a.cookieNamePrefix) || 'nauth_';
}
/**
 * Get the access token cookie name
 * @param config - NAuth configuration
 * @returns Access token cookie name (default: 'nauth_access_token')
 */
function getAccessTokenCookieName(config) {
    var prefix = getCookieNamePrefix(config);
    return "".concat(prefix, "access_token");
}
/**
 * Get the refresh token cookie name
 * @param config - NAuth configuration
 * @returns Refresh token cookie name (default: 'nauth_refresh_token')
 */
function getRefreshTokenCookieName(config) {
    var prefix = getCookieNamePrefix(config);
    return "".concat(prefix, "refresh_token");
}
/**
 * Get the device token cookie name
 * @param config - NAuth configuration
 * @returns Device token cookie name (default: 'nauth_device_id')
 */
function getDeviceTokenCookieName(config) {
    var prefix = getCookieNamePrefix(config);
    return "".concat(prefix, "device_id");
}
/**
 * Get the CSRF token cookie name
 *
 * If explicitly configured via security.csrf.cookieName, uses that value.
 * Otherwise, uses the prefix: `${prefix}csrf_token`
 *
 * @param config - NAuth configuration
 * @returns CSRF token cookie name (default: 'nauth_csrf_token')
 */
function getCsrfTokenCookieName(config) {
    var _a, _b;
    // If explicitly configured, use it
    if ((_b = (_a = config === null || config === void 0 ? void 0 : config.security) === null || _a === void 0 ? void 0 : _a.csrf) === null || _b === void 0 ? void 0 : _b.cookieName) {
        return config.security.csrf.cookieName;
    }
    // Otherwise, use prefix
    var prefix = getCookieNamePrefix(config);
    return "".concat(prefix, "csrf_token");
}
