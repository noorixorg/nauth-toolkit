"use strict";
/**
 * CSRF Protection Service
 *
 * Handles CSRF token generation and validation for cookie-based authentication.
 * Uses cryptographically secure random tokens.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CsrfService = void 0;
var crypto = require("crypto");
var CsrfService = /** @class */ (function () {
    function CsrfService(config) {
        var _a, _b, _c, _d, _e, _f;
        this.cookieName = ((_b = (_a = config.security) === null || _a === void 0 ? void 0 : _a.csrf) === null || _b === void 0 ? void 0 : _b.cookieName) || 'nauth_csrf_token';
        this.headerName = ((_d = (_c = config.security) === null || _c === void 0 ? void 0 : _c.csrf) === null || _d === void 0 ? void 0 : _d.headerName) || 'x-csrf-token';
        this.cookieOptions = ((_f = (_e = config.security) === null || _e === void 0 ? void 0 : _e.csrf) === null || _f === void 0 ? void 0 : _f.cookieOptions) || {};
    }
    /**
     * Generate a new CSRF token
     * @returns Random 32-byte token as hex string
     */
    CsrfService.prototype.generateToken = function () {
        return crypto.randomBytes(32).toString('hex');
    };
    /**
     * Validate CSRF token
     * Compares token from request header with token from cookie.
     * Uses constant-time comparison to prevent timing attacks.
     */
    CsrfService.prototype.validateToken = function (headerToken, cookieToken) {
        if (!headerToken || !cookieToken) {
            return false;
        }
        // Constant-time comparison
        return crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken));
    };
    CsrfService.prototype.getCookieName = function () {
        return this.cookieName;
    };
    CsrfService.prototype.getHeaderName = function () {
        return this.headerName;
    };
    CsrfService.prototype.getCookieOptions = function () {
        return this.cookieOptions;
    };
    return CsrfService;
}());
exports.CsrfService = CsrfService;
