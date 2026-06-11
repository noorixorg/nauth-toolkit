import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { NAuthException, getHttpStatusForErrorCode } from '@nauth-toolkit/core';

/**
 * Fastify error handler
 *
 * Maps NAuthException to structured HTTP error responses.
 * Must be registered with fastify.setErrorHandler(errorHandler).
 */
export async function errorHandler(
  err: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (err instanceof NAuthException) {
    const statusCode = getHttpStatusForErrorCode(err.code);
    await reply.status(statusCode).send({
      ...err.toJSON(),
      path: request.url.split('?')[0],
    });
    return;
  }

  console.error('[Error]', err);
  await reply.status(500).send({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    path: request.url.split('?')[0],
  });
}
