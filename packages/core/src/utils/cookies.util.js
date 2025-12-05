"use strict";
/**
 * Cookie Utilities
 *
 * Helpers for clearing nauth auth cookies in HTTP responses.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAuthCookies = clearAuthCookies;
var cookie_names_util_1 = require("./cookie-names.util");
/**
 * Clear nauth auth cookies on the response.
 *
 * - Clears access token, refresh token, CSRF token cookies
 * - Optionally clears device token cookie (only when forgetDevice=true)
 * - Device token cookies persist across logout by default (remember device feature)
 * - Applies security attributes consistent with how cookies were set
 * - Uses configured cookie name prefix (default: 'nauth_')
 *
 * @param res - HTTP response object (Express or Fastify compatible)
 * @param config - NAuth configuration (optional, for cookie name resolution)
 * @param opt - Optional cookie options to match configured attributes
 * @param forgetDevice - If true, also clears device token cookie (for "forget me" logout). Default: false
 */
function clearAuthCookies(res, config, opt, forgetDevice) {
    if (forgetDevice === void 0) { forgetDevice = false; }
    // Handle old signature: clearAuthCookies(res, opt) where opt might be config or CookieOptions
    var cookieOptions;
    var nauthConfig;
    if (config && 'tokenDelivery' in config) {
        // Second param is NAuthConfig
        nauthConfig = config;
        cookieOptions = opt;
    }
    else {
        // Second param is CookieOptions (backward compatibility)
        cookieOptions = config;
    }
    var base = {
        httpOnly: true,
        secure: (cookieOptions === null || cookieOptions === void 0 ? void 0 : cookieOptions.secure) !== false,
        sameSite: ((cookieOptions === null || cookieOptions === void 0 ? void 0 : cookieOptions.sameSite) || 'strict'),
        path: (cookieOptions === null || cookieOptions === void 0 ? void 0 : cookieOptions.path) || '/',
        domain: cookieOptions === null || cookieOptions === void 0 ? void 0 : cookieOptions.domain,
        maxAge: 0,
    };
    var accessTokenName = (0, cookie_names_util_1.getAccessTokenCookieName)(nauthConfig);
    var refreshTokenName = (0, cookie_names_util_1.getRefreshTokenCookieName)(nauthConfig);
    var csrfTokenName = (0, cookie_names_util_1.getCsrfTokenCookieName)(nauthConfig);
    var deviceTokenName = (0, cookie_names_util_1.getDeviceTokenCookieName)(nauthConfig);
    // CSRF cookie options (httpOnly: false, matches how it was set)
    var csrfBase = __assign(__assign({}, base), { httpOnly: false });
    if (typeof res.cookie === 'function') {
        res.cookie(accessTokenName, '', base);
        res.cookie(refreshTokenName, '', base);
        res.cookie(csrfTokenName, '', csrfBase);
        // Only clear device token cookie if forgetDevice=true (for "forget me" logout)
        // Device tokens persist across normal logout (remember device feature)
        if (forgetDevice) {
            res.cookie(deviceTokenName, '', base); // Device token cookie (httpOnly: true)
        }
    }
    else if (typeof res.setCookie === 'function') {
        res.setCookie(accessTokenName, '', base);
        res.setCookie(refreshTokenName, '', base);
        res.setCookie(csrfTokenName, '', csrfBase);
        // Only clear device token cookie if forgetDevice=true (for "forget me" logout)
        // Device tokens persist across normal logout (remember device feature)
        if (forgetDevice) {
            res.setCookie(deviceTokenName, '', base); // Device token cookie (httpOnly: true)
        }
    }
}
