/**
 * Error Handler for Fastify
 *
 * Catches and formats errors for Fastify responses.
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

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

/**
 * Fastify error handler
 *
 * @param error - Error object
 * @param request - Fastify request
 * @param reply - Fastify reply
 */
export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply): void {
  // Handle NAuthException
  if (error instanceof NAuthException) {
    const nauthError = error as NAuthException;
    const statusCode = getHttpStatusCode(nauthError.code);
    reply.code(statusCode).send({
      error: nauthError.message,
      code: nauthError.code,
      details: nauthError.details,
    });
    return;
  }

  // Handle other errors
  console.error('Unhandled error:', error);
  reply.code(500).send({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
