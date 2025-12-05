"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientInfoService = void 0;
var context_storage_1 = require("../utils/context-storage");
/**
 * Client Info Service
 *
 * Provides transparent access to client information (IP address, user agent, device info)
 * from the current request context using async local storage.
 *
 * This service eliminates the need to pass IP addresses and user agents as parameters
 * to authentication methods. The library handles this automatically, just like AWS Cognito.
 *
 * **Key Features:**
 * - Transparent access to client metadata
 * - No parameters needed in service methods
 * - Works across async boundaries
 * - Type-safe with TypeScript
 * - Thread-safe with async local storage
 * - Platform-agnostic (no framework dependencies)
 *
 * **Usage:**
 * ```typescript
 * export class AuthService {
 *   constructor(private clientInfoService: ClientInfoService) {}
 *
 *   async login(dto: LoginDTO) {
 *     // Get client info from context (no parameters needed!)
 *     const clientInfo = this.clientInfoService.get();
 *
 *     // Use it
 *     logger.debug('IP Address:', clientInfo.ipAddress);
 *     logger.debug('User Agent:', clientInfo.userAgent);
 *   }
 * }
 * ```
 *
 * **Note:**
 * This service must be called within the context of an HTTP request.
 * If called outside a request context (e.g., cron jobs, CLI), it will
 * return a default ClientInfo object with 'unknown' values.
 */
var ClientInfoService = /** @class */ (function () {
    function ClientInfoService() {
        // No dependencies - uses static ContextStorage
    }
    /**
     * Get client information from the current request context
     *
     * This method retrieves client metadata that was automatically extracted
     * by ClientInfoInterceptor and stored in async local storage.
     *
     * @returns Response DTO with client information
     *
     * @example
     * ```typescript
     * const result = this.clientInfoService.get();
     * logger.debug('IP Address:', result.ipAddress);  // 192.168.1.100
     * logger.debug('User Agent:', result.userAgent);  // Mozilla/5.0 ...
     * ```
     *
     * @example
     * ```typescript
     * // If called outside request context (e.g., cron job)
     * const result = this.clientInfoService.get();
     * logger.debug('IP Address:', result.ipAddress);  // 'unknown'
     * ```
     */
    ClientInfoService.prototype.get = function () {
        var clientInfo = context_storage_1.ContextStorage.get('CLIENT_INFO');
        // If no client info in context (e.g., cron job, CLI), return default
        if (!clientInfo) {
            return {
                ipAddress: 'unknown',
                userAgent: 'unknown',
            };
        }
        return clientInfo;
    };
    /**
     * Get IP address from the current request context
     *
     * Convenience method to get just the IP address without the full ClientInfo object.
     *
     * @returns Response DTO with IP address
     *
     * @example
     * ```typescript
     * const result = this.clientInfoService.getIpAddress();
     * logger.debug('IP Address:', result.ipAddress);  // 192.168.1.100
     * ```
     */
    ClientInfoService.prototype.getIpAddress = function () {
        return {
            ipAddress: this.get().ipAddress,
        };
    };
    /**
     * Get user agent from the current request context
     *
     * Convenience method to get just the user agent without the full ClientInfo object.
     *
     * @returns Response DTO with user agent
     *
     * @example
     * ```typescript
     * const result = this.clientInfoService.getUserAgent();
     * logger.debug('User Agent:', result.userAgent);  // Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
     * ```
     */
    ClientInfoService.prototype.getUserAgent = function () {
        return {
            userAgent: this.get().userAgent,
        };
    };
    /**
     * Get device token from the current request context
     *
     * Convenience method to get just the device token (for trusted device feature).
     *
     * @returns Response DTO with device token
     *
     * @example
     * ```typescript
     * const result = this.clientInfoService.getDeviceToken();
     * if (result.deviceToken) {
     *   logger.debug('Device token:', result.deviceToken);
     * }
     * ```
     */
    ClientInfoService.prototype.getDeviceToken = function () {
        return {
            deviceToken: this.get().deviceToken,
        };
    };
    /**
     * Get device ID from the current request context (deprecated)
     *
     * @deprecated Use getDeviceToken() instead. deviceId was removed from ClientInfo for security.
     * @returns Always undefined (deviceId not available from clientInfo - use session.deviceId if needed)
     *
     * @example
     * ```typescript
     * const deviceId = this.clientInfoService.getDeviceId();
     * // Always returns undefined
     * ```
     */
    ClientInfoService.prototype.getDeviceId = function () {
        // deviceId removed from ClientInfo interface - use session.deviceId if needed
        return undefined;
    };
    /**
     * Get session ID from the current request context
     *
     * Convenience method to get just the session ID (extracted from JWT token after authentication).
     *
     * @returns Response DTO with session ID
     *
     * @example
     * ```typescript
     * const result = this.clientInfoService.getSessionId();
     * if (result.sessionId) {
     *   logger.debug('Session ID:', result.sessionId);
     * }
     * ```
     */
    ClientInfoService.prototype.getSessionId = function () {
        return {
            sessionId: this.get().sessionId,
        };
    };
    /**
     * Get response object from the current request context
     *
     * Returns the HTTP response object that was stored by the framework interceptor.
     * Used internally by services to perform response operations like clearing cookies.
     *
     * @returns Response object with cookie manipulation methods, or null if not available
     * @internal - Used by core services, not by application code
     *
     * @example
     * ```typescript
     * const response = this.clientInfoService.getResponse();
     * if (response?.clearCookie) {
     *   response.clearCookie('my_cookie');
     * }
     * ```
     */
    ClientInfoService.prototype.getResponse = function () {
        return context_storage_1.ContextStorage.get('HTTP_RESPONSE') || null;
    };
    /**
     * Parse user-agent string to extract browser, platform, and device information
     *
     * This method is used internally by interceptors to populate ClientInfo.
     * Services should use ClientInfoService.get() to access parsed information.
     *
     * @param userAgent - User-agent string from HTTP request
     * @returns Parsed user-agent information
     * @internal - Used by interceptors, not by application code
     */
    ClientInfoService.prototype.parseUserAgent = function (userAgent) {
        if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
            return {
                browser: null,
                platform: null,
                deviceType: null,
                deviceName: null,
            };
        }
        var ua = userAgent.toLowerCase();
        // ============================================================================
        // Detect Device Type
        // ============================================================================
        var deviceType = null;
        // Mobile devices
        if (/mobile|android|iphone|ipod|blackberry|opera|mini|windows\s+phone|palm|iemobile/i.test(ua)) {
            // Tablets
            if (/tablet|ipad|playbook|silk|kindle/i.test(ua)) {
                deviceType = 'tablet';
            }
            else {
                deviceType = 'mobile';
            }
        }
        else {
            deviceType = 'desktop';
        }
        // ============================================================================
        // Detect Platform/OS
        // ============================================================================
        var platform = null;
        if (/windows/i.test(ua)) {
            if (/windows nt 10/i.test(ua)) {
                platform = 'Windows 10';
            }
            else if (/windows nt 11/i.test(ua)) {
                platform = 'Windows 11';
            }
            else if (/windows nt 6.3/i.test(ua)) {
                platform = 'Windows 8.1';
            }
            else if (/windows nt 6.2/i.test(ua)) {
                platform = 'Windows 8';
            }
            else if (/windows nt 6.1/i.test(ua)) {
                platform = 'Windows 7';
            }
            else {
                platform = 'Windows';
            }
        }
        else if (/macintosh|mac os x/i.test(ua)) {
            var match = ua.match(/mac os x (\d+)[._](\d+)/);
            if (match) {
                var major = parseInt(match[1], 10);
                // Convert to macOS version names (approximate)
                if (major >= 13) {
                    platform = 'macOS Ventura+';
                }
                else if (major >= 12) {
                    platform = 'macOS Monterey';
                }
                else if (major >= 11) {
                    platform = 'macOS Big Sur';
                }
                else {
                    platform = 'macOS';
                }
            }
            else {
                platform = 'macOS';
            }
        }
        else if (/iphone|ipad|ipod/i.test(ua)) {
            var match = ua.match(/os (\d+)[._](\d+)/);
            if (match) {
                platform = "iOS ".concat(match[1], ".").concat(match[2]);
            }
            else {
                platform = 'iOS';
            }
        }
        else if (/android/i.test(ua)) {
            var match = ua.match(/android (\d+)[._](\d+)/);
            if (match) {
                platform = "Android ".concat(match[1], ".").concat(match[2]);
            }
            else {
                platform = 'Android';
            }
        }
        else if (/linux/i.test(ua)) {
            platform = 'Linux';
        }
        else if (/ubuntu/i.test(ua)) {
            platform = 'Ubuntu';
        }
        else if (/fedora/i.test(ua)) {
            platform = 'Fedora';
        }
        else {
            platform = null;
        }
        // ============================================================================
        // Detect Browser
        // ============================================================================
        var browser = null;
        if (/edg/i.test(ua)) {
            browser = 'Edge';
        }
        else if (/chrome/i.test(ua) && !/edg/i.test(ua)) {
            var match = ua.match(/chrome\/(\d+)/);
            browser = match ? "Chrome ".concat(match[1]) : 'Chrome';
        }
        else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
            var match = ua.match(/version\/(\d+)/);
            browser = match ? "Safari ".concat(match[1]) : 'Safari';
        }
        else if (/firefox/i.test(ua)) {
            var match = ua.match(/firefox\/(\d+)/);
            browser = match ? "Firefox ".concat(match[1]) : 'Firefox';
        }
        else if (/opera|opr/i.test(ua)) {
            browser = 'Opera';
        }
        else if (/msie|trident/i.test(ua)) {
            browser = 'Internet Explorer';
        }
        else if (/brave/i.test(ua)) {
            browser = 'Brave';
        }
        else {
            browser = null;
        }
        // ============================================================================
        // Generate Device Name
        // ============================================================================
        var deviceName = null;
        if (browser && platform) {
            deviceName = "".concat(browser, " on ").concat(platform);
        }
        else if (browser) {
            deviceName = browser;
        }
        else if (platform) {
            deviceName = platform;
        }
        // Special cases for mobile devices
        if (deviceType === 'mobile' || deviceType === 'tablet') {
            if (/iphone/i.test(ua)) {
                var modelMatch = ua.match(/iphone(\d+),?(\d+)?/);
                if (modelMatch) {
                    deviceName = "iPhone ".concat(modelMatch[1]).concat(modelMatch[2] ? " ".concat(modelMatch[2]) : '', " on ").concat(platform || 'iOS');
                }
                else {
                    deviceName = "iPhone on ".concat(platform || 'iOS');
                }
            }
            else if (/ipad/i.test(ua)) {
                deviceName = "iPad on ".concat(platform || 'iOS');
            }
            else if (/android/i.test(ua)) {
                deviceName = "".concat(browser || 'Android', " on ").concat(platform || 'Android');
            }
        }
        return {
            browser: browser,
            platform: platform,
            deviceType: deviceType,
            deviceName: deviceName,
        };
    };
    return ClientInfoService;
}());
exports.ClientInfoService = ClientInfoService;
