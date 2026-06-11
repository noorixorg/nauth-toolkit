import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { NAuthException, getHttpStatusForErrorCode } from '@nauth-toolkit/core';

/**
 * HTTP Exception Filter for NAuthException
 *
 * **Utility filter provided by nauth-toolkit** to properly map `NAuthException` domain exceptions
 * to appropriate HTTP status codes and response formats.
 *
 * **Purpose:**
 * This filter automatically converts `NAuthException` errors to HTTP responses with correct
 * status codes using the `getHttpStatusForErrorCode()` helper function:
 * - `AUTH_INVALID_CREDENTIALS` → 401 Unauthorized
 * - `RATE_LIMIT_*` → 429 Too Many Requests
 * - `VALIDATION_FAILED` → 400 Bad Request
 * - `NOT_FOUND` → 404 Not Found
 * - `INTERNAL_ERROR` → 500 Internal Server Error
 * - etc.
 *
 * **Usage:**
 * This filter is **recommended** for most applications as it ensures proper HTTP status codes.
 * You can use it as-is, or extend it with custom logic (logging, monitoring, etc.).
 *
 * **Important:** This filter ONLY catches `NAuthException`. It will NOT interfere with
 * your application's other exception filters or error handling.
 *
 * @example
 * ```typescript
 * // Recommended: Use nauth-toolkit's filter for proper HTTP status codes
 * import { NAuthHttpExceptionFilter } from '@nauth-toolkit/nestjs';
 * app.useGlobalFilters(new NAuthHttpExceptionFilter());
 *
 * // Optional: Extend with custom logic
 * @Catch(NAuthException)
 * export class CustomNAuthFilter extends NAuthHttpExceptionFilter {
 *   catch(exception: NAuthException, host: ArgumentsHost) {
 *     // Add custom logging/monitoring
 *     this.logger.error('Auth error', exception);
 *     // Call parent for standard error handling
 *     super.catch(exception, host);
 *   }
 * }
 * ```
 *
 * **Response format:**
 * ```json
 * {
 *   "statusCode": 429,
 *   "code": "RATE_LIMIT_SMS",
 *   "message": "Too many verification SMS sent",
 *   "details": {
 *     "retryAfter": 3600,
 *     "currentCount": 4
 *   },
 *   "timestamp": "2025-10-31T12:00:00.000Z",
 *   "path": "/auth/verify-phone"
 * }
 * ```
 *
 * **Customization:**
 * If you need custom behavior, extend this class or create your own filter:
 * ```typescript
 * @Catch(NAuthException)
 * export class CustomNAuthFilter extends NAuthHttpExceptionFilter {
 *   catch(exception: NAuthException, host: ArgumentsHost) {
 *     // Add additional logging
 *     this.logger.error(exception);
 *
 *     // Call parent or implement custom logic
 *     super.catch(exception, host);
 *   }
 * }
 * ```
 */
@Catch(NAuthException)
export class NAuthHttpExceptionFilter implements ExceptionFilter<NAuthException> {
  private readonly logger = new Logger(NAuthHttpExceptionFilter.name);

  /**
   * Catch and process NAuthException
   *
   * Converts the exception to an HTTP response with appropriate status code.
   * Logs errors for debugging and monitoring.
   *
   * @param exception - The NAuthException instance
   * @param host - ArgumentsHost for accessing request/response
   */
  catch(exception: NAuthException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    // Platform-agnostic: Use generic types that work with any HTTP adapter (Express, Fastify, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = ctx.getResponse<any>();
    const request = ctx.getRequest<{
      url?: string;
      method?: string;
    }>();

    // Get HTTP status code from error code
    const statusCode = getHttpStatusForErrorCode(exception.code);

    // Build error response
    const errorResponse = {
      statusCode,
      code: exception.code,
      message: exception.message,
      details: exception.details,
      timestamp: exception.timestamp,
      path: request.url || 'unknown',
    };

    // Log error for debugging and monitoring
    // Use appropriate log level based on status code
    if (statusCode >= 500) {
      // Server errors - log as error with full details
      this.logger.error(
        `[${exception.code}] ${exception.message} - Path: ${request.url || 'unknown'} - Method: ${request.method || 'unknown'}`,
        exception.stack,
        'NAuthHttpExceptionFilter',
      );
    } else if (statusCode >= 400) {
      // Client errors - log as warn (less critical)
      this.logger.warn(
        `[${exception.code}] ${exception.message} - Path: ${request.url || 'unknown'} - Method: ${request.method || 'unknown'}`,
        'NAuthHttpExceptionFilter',
      );
    } else {
      // Other status codes - log as debug
      this.logger.debug(
        `[${exception.code}] ${exception.message} - Path: ${request.url || 'unknown'}`,
        'NAuthHttpExceptionFilter',
      );
    }

    // Send response (platform-agnostic - works with Express, Fastify, etc.)
    // Set status code first, then send JSON (avoid chaining for better compatibility)
    try {
      // Method 1: Express pattern - set status then json
      if (response.status && typeof response.status === 'function' && typeof response.json === 'function') {
        response.status(statusCode);
        response.json(errorResponse);
        return;
      }

      // Method 2: Fastify pattern - use code() method
      if (response.code && typeof response.code === 'function' && typeof response.send === 'function') {
        response.code(statusCode);
        response.send(errorResponse);
        return;
      }

      // Method 3: Direct statusCode property (Express/Fastify fallback)
      if (typeof response.statusCode !== 'undefined') {
        response.statusCode = statusCode;
      }
      if (typeof response.json === 'function') {
        response.json(errorResponse);
        return;
      }
      if (typeof response.send === 'function') {
        response.send(errorResponse);
        return;
      }

      // Method 4: Last resort - try to set status and send
      if (response.status && typeof response.status === 'function') {
        response.status(statusCode);
      }
      if (response.json && typeof response.json === 'function') {
        response.json(errorResponse);
      } else if (response.send && typeof response.send === 'function') {
        response.send(errorResponse);
      } else {
        throw new Error('No valid response method found');
      }
    } catch (error) {
      // If all else fails, log the error but don't crash
      this.logger.error(
        `Failed to send error response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
        'NAuthHttpExceptionFilter',
      );
    }
  }
}
