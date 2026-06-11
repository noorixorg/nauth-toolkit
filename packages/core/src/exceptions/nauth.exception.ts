import { AuthErrorCode } from '../enums/error-codes.enum';

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
export class NAuthException extends Error {
  /**
   * Error code for programmatic handling
   */
  public readonly code: AuthErrorCode;

  /**
   * Additional error details/metadata
   */
  public readonly details?: Record<string, unknown>;

  /**
   * Timestamp when error was created
   */
  public readonly timestamp: string;

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
  constructor(code: AuthErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);

    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.name = 'NAuthException';

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, NAuthException.prototype);

    // Capture stack trace (excluding constructor call)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get the error code
   *
   * @returns Error code
   */
  getCode(): AuthErrorCode {
    return this.code;
  }

  /**
   * Get error details/metadata
   *
   * @returns Error details or undefined
   */
  getDetails(): Record<string, unknown> | undefined {
    return this.details;
  }

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
  isCode(code: AuthErrorCode): boolean {
    return this.code === code;
  }

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
  toJSON(): { code: string; message: string; details?: Record<string, unknown>; timestamp: string } {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

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
export function getHttpStatusForErrorCode(code: AuthErrorCode): number {
  // Rate limits
  if (code.startsWith('RATE_LIMIT_')) return 429;

  // Authentication errors
  if (code.startsWith('AUTH_')) {
    if (code === AuthErrorCode.ACCOUNT_INACTIVE || code === AuthErrorCode.ACCOUNT_LOCKED) return 403;
    return 401;
  }

  // Signup conflicts
  if (
    code === AuthErrorCode.EMAIL_EXISTS ||
    code === AuthErrorCode.USERNAME_EXISTS ||
    code === AuthErrorCode.PHONE_EXISTS
  )
    return 409;
  if (code === AuthErrorCode.SIGNUP_DISABLED) return 403;

  // Validation errors
  if (code.startsWith('VALIDATION_') || code.startsWith('INVALID_')) return 400;

  // Not found
  if (code === AuthErrorCode.NOT_FOUND) return 404;

  // Forbidden
  if (code === AuthErrorCode.FORBIDDEN) return 403;

  // Server errors
  if (code === AuthErrorCode.INTERNAL_ERROR || code === AuthErrorCode.SERVICE_UNAVAILABLE) return 500;

  // Default to 400
  return 400;
}
