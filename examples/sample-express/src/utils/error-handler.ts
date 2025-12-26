/**
 * Error Handler Middleware
 *
 * Catches and formats errors for Express responses.
 */

import { Request, Response, NextFunction } from 'express';
import { NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

/**
 * Express error handler middleware
 *
 * Catches NAuthException and formats error responses.
 *
 * @param error - Error object
 * @param req - Express request
 * @param res - Express response
 * @param next - Next function
 */
export function errorHandler(error: any, _req: Request, res: Response, _next: NextFunction): void {
  // Handle NAuthException
  if (error instanceof NAuthException) {
    const statusCode = getHttpStatusCode(error.code);
    res.status(statusCode).json({
      statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp,
      path: _req.originalUrl || _req.url || 'unknown',
    });
    return;
  }

  // Handle other errors
  // ============================================================================
  // Logging
  // ============================================================================
  // Intentionally avoid console.* per project rules.
  // The enclosing app should log unhandled errors via its configured logger.
  res.status(500).json({
    statusCode: 500,
    code: AuthErrorCode.INTERNAL_ERROR,
    message: 'Internal server error',
    timestamp: new Date().toISOString(),
    path: _req.originalUrl || _req.url || 'unknown',
  });
}

/**
 * Map NAuth error codes to HTTP status codes
 *
 * @param code - Auth error code
 * @returns HTTP status code
 */
function getHttpStatusCode(code: AuthErrorCode): number {
  switch (code) {
    case AuthErrorCode.TOKEN_INVALID:
    case AuthErrorCode.TOKEN_EXPIRED:
    case AuthErrorCode.TOKEN_REUSE_DETECTED:
    case AuthErrorCode.SESSION_NOT_FOUND:
    case AuthErrorCode.SESSION_EXPIRED:
      return 401;

    case AuthErrorCode.FORBIDDEN:
    case AuthErrorCode.ACCOUNT_INACTIVE:
    case AuthErrorCode.ACCOUNT_LOCKED:
      return 403;

    case AuthErrorCode.NOT_FOUND:
      return 404;

    case AuthErrorCode.EMAIL_EXISTS:
    case AuthErrorCode.USERNAME_EXISTS:
    case AuthErrorCode.PHONE_EXISTS:
      return 409;

    case AuthErrorCode.RATE_LIMIT_SMS:
    case AuthErrorCode.RATE_LIMIT_EMAIL:
    case AuthErrorCode.RATE_LIMIT_LOGIN:
    case AuthErrorCode.RATE_LIMIT_RESEND:
      return 429;

    case AuthErrorCode.VALIDATION_FAILED:
    case AuthErrorCode.INVALID_CREDENTIALS:
    case AuthErrorCode.PASSWORD_INCORRECT:
    case AuthErrorCode.CSRF_TOKEN_MISSING:
    case AuthErrorCode.CSRF_TOKEN_INVALID:
    case AuthErrorCode.BEARER_NOT_ALLOWED:
    case AuthErrorCode.COOKIES_NOT_ALLOWED:
      return 400;

    case AuthErrorCode.INTERNAL_ERROR:
    default:
      return 500;
  }
}
