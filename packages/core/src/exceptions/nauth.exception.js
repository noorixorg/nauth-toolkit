"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NAuthException = void 0;
exports.getHttpStatusForErrorCode = getHttpStatusForErrorCode;
var error_codes_enum_1 = require("../enums/error-codes.enum");
/**
 * Custom exception for nauth-toolkit
 *
 * **Framework-Agnostic Design:**
 * This exception extends standard `Error`, not `HttpException`, making it
 * usable in any context:
 * - HTTP APIs (REST, NestJS)
 * - WebSocket connections
 * - GraphQL resolvers
 * - gRPC services
 * - Message queue workers
 * - CLI tools
 * - Standalone services
 *
 * **Consumer Responsibility:**
 * The consumer application decides how to map these domain exceptions
 * to their transport layer (HTTP status codes, WebSocket events, etc.)
 *
 * **Structured Error Data:**
 * Provides error code, message, and optional metadata. Consumer can
 * transform this into any response format needed.
 *
 * @example
 * ```typescript
 * // Throw domain exception
 * throw new NAuthException(
 *   AuthErrorCode.RATE_LIMIT_SMS,
 *   'Too many verification SMS sent',
 *   { retryAfter: 3600, maxAttempts: 3 }
 * );
 *
 * // Consumer maps to HTTP (if using HTTP)
 * catch (error) {
 *   if (error instanceof NAuthException) {
 *     const statusCode = this.mapErrorCodeToHttpStatus(error.code);
 *     return res.status(statusCode).json({
 *       code: error.code,
 *       message: error.message,
 *       details: error.details,
 *       timestamp: new Date().toISOString()
 *     });
 *   }
 * }
 *
 * // Or map to WebSocket
 * catch (error) {
 *   if (error instanceof NAuthException) {
 *     socket.emit('error', {
 *       code: error.code,
 *       message: error.message,
 *       details: error.details
 *     });
 *   }
 * }
 * ```
 */
var NAuthException = /** @class */ (function (_super) {
    __extends(NAuthException, _super);
    /**
     * Create a new NAuthException
     *
     * @param code - Error code from AuthErrorCode enum
     * @param message - Human-readable error message
     * @param details - Optional metadata (retryAfter, validation errors, etc.)
     *
     * @example
     * ```typescript
     * throw new NAuthException(
     *   AuthErrorCode.INVALID_CREDENTIALS,
     *   'Invalid email or password'
     * );
     *
     * throw new NAuthException(
     *   AuthErrorCode.RATE_LIMIT_SMS,
     *   'Too many SMS sent',
     *   { retryAfter: 3600, currentCount: 4 }
     * );
     * ```
     */
    function NAuthException(code, message, details) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.details = details;
        _this.timestamp = new Date().toISOString();
        _this.name = 'NAuthException';
        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(_this, NAuthException.prototype);
        // Capture stack trace (excluding constructor call)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(_this, _this.constructor);
        }
        return _this;
    }
    /**
     * Get the error code
     *
     * @returns Error code
     */
    NAuthException.prototype.getCode = function () {
        return this.code;
    };
    /**
     * Get error details/metadata
     *
     * @returns Error details or undefined
     */
    NAuthException.prototype.getDetails = function () {
        return this.details;
    };
    /**
     * Check if error is a specific code
     *
     * @param code - Error code to check
     * @returns True if error matches code
     *
     * @example
     * ```typescript
     * try {
     *   await sendSMS();
     * } catch (error) {
     *   if (error instanceof NAuthException && error.isCode(AuthErrorCode.RATE_LIMIT_SMS)) {
     *     // Handle rate limit specifically
     *   }
     * }
     * ```
     */
    NAuthException.prototype.isCode = function (code) {
        return this.code === code;
    };
    /**
     * Serialize error to plain object
     *
     * Useful for logging, HTTP responses, or any serialization needs.
     *
     * @returns Plain object representation
     *
     * @example
     * ```typescript
     * catch (error) {
     *   if (error instanceof NAuthException) {
     *     console.log(error.toJSON());
     *     // { code: 'RATE_LIMIT_SMS', message: '...', details: {...}, timestamp: '...' }
     *   }
     * }
     * ```
     */
    NAuthException.prototype.toJSON = function () {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp,
        };
    };
    return NAuthException;
}(Error));
exports.NAuthException = NAuthException;
/**
 * Helper function to map error codes to suggested HTTP status codes
 *
 * **Optional** - Consumer can use this or define their own mapping.
 * Provided as a convenience for HTTP-based applications.
 *
 * @param code - Error code
 * @returns Suggested HTTP status code
 *
 * @example
 * ```typescript
 * // In NestJS exception filter
 * catch (exception: NAuthException, host: ArgumentsHost) {
 *   const statusCode = getHttpStatusForErrorCode(exception.code);
 *   const response = host.switchToHttp().getResponse();
 *   response.status(statusCode).json(exception.toJSON());
 * }
 * ```
 */
function getHttpStatusForErrorCode(code) {
    // Rate limits
    if (code.startsWith('RATE_LIMIT_'))
        return 429;
    // Authentication errors
    if (code.startsWith('AUTH_')) {
        if (code === error_codes_enum_1.AuthErrorCode.ACCOUNT_INACTIVE || code === error_codes_enum_1.AuthErrorCode.ACCOUNT_LOCKED)
            return 403;
        return 401;
    }
    // Signup conflicts
    if (code === error_codes_enum_1.AuthErrorCode.EMAIL_EXISTS ||
        code === error_codes_enum_1.AuthErrorCode.USERNAME_EXISTS ||
        code === error_codes_enum_1.AuthErrorCode.PHONE_EXISTS)
        return 409;
    if (code === error_codes_enum_1.AuthErrorCode.SIGNUP_DISABLED)
        return 403;
    // Validation errors
    if (code.startsWith('VALIDATION_') || code.startsWith('INVALID_'))
        return 400;
    // Not found
    if (code === error_codes_enum_1.AuthErrorCode.NOT_FOUND)
        return 404;
    // Forbidden
    if (code === error_codes_enum_1.AuthErrorCode.FORBIDDEN)
        return 403;
    // Server errors
    if (code === error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR || code === error_codes_enum_1.AuthErrorCode.SERVICE_UNAVAILABLE)
        return 500;
    // Default to 400
    return 400;
}
