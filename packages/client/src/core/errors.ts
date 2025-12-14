import { NAuthError, NAuthErrorCode } from '../types/error.types';

/**
 * Client-side error wrapper for SDK operations.
 *
 * Mirrors the backend NAuthException structure for consistent error handling.
 *
 * @example
 * ```typescript
 * try {
 *   await client.login({ identifier: 'user@example.com', password: 'wrong' });
 * } catch (error) {
 *   if (error instanceof NAuthClientError) {
 *     console.log(error.code); // 'AUTH_INVALID_CREDENTIALS'
 *     console.log(error.message); // 'Invalid credentials'
 *     console.log(error.timestamp); // '2025-12-06T...'
 *
 *     // Check specific error code
 *     if (error.isCode(NAuthErrorCode.RATE_LIMIT_LOGIN)) {
 *       const retryAfter = error.details?.retryAfter as number;
 *       console.log(`Rate limited. Retry in ${retryAfter}s`);
 *     }
 *   }
 * }
 * ```
 */
export class NAuthClientError extends Error implements NAuthError {
  public readonly code: NAuthErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly statusCode?: number;
  public readonly timestamp: string;
  public readonly isNetworkError: boolean;

  /**
   * Create a new client error.
   *
   * @param code - Error code from NAuthErrorCode enum
   * @param message - Human-readable error message
   * @param options - Optional metadata including details, statusCode, timestamp, and network error flag
   */
  constructor(
    code: NAuthErrorCode,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      statusCode?: number;
      timestamp?: string;
      isNetworkError?: boolean;
    },
  ) {
    super(message);
    this.code = code;
    this.details = options?.details;
    this.statusCode = options?.statusCode;
    this.timestamp = options?.timestamp || new Date().toISOString();
    this.isNetworkError = options?.isNetworkError ?? false;
    this.name = 'NAuthClientError';
    Object.setPrototypeOf(this, NAuthClientError.prototype);
  }

  /**
   * Check if error matches a specific error code.
   *
   * @param code - Error code to check against
   * @returns True if the error code matches
   *
   * @example
   * ```typescript
   * if (error.isCode(NAuthErrorCode.RATE_LIMIT_SMS)) {
   *   // Handle SMS rate limit
   * }
   * ```
   */
  isCode(code: NAuthErrorCode): boolean {
    return this.code === code;
  }

  /**
   * Get error details/metadata.
   *
   * @returns Error details object or undefined
   *
   * @example
   * ```typescript
   * const details = error.getDetails();
   * if (details?.retryAfter) {
   *   console.log(`Retry after ${details.retryAfter} seconds`);
   * }
   * ```
   */
  getDetails(): Record<string, unknown> | undefined {
    return this.details;
  }

  /**
   * Get the error code.
   *
   * @returns The error code enum value
   */
  getCode(): NAuthErrorCode {
    return this.code;
  }

  /**
   * Serialize error to JSON object.
   *
   * @returns Plain object representation
   *
   * @example
   * ```typescript
   * const errorJson = error.toJSON();
   * // { code: 'AUTH_INVALID_CREDENTIALS', message: '...', timestamp: '...', details: {...} }
   * ```
   */
  toJSON(): {
    code: string;
    message: string;
    timestamp: string;
    details?: Record<string, unknown>;
    statusCode?: number;
  } {
    return {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      details: this.details,
      statusCode: this.statusCode,
    };
  }
}
