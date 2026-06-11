import { Request, Response, NextFunction } from 'express';
import { NAuthException, getHttpStatusForErrorCode } from '@nauth-toolkit/core';

/**
 * Express error handler middleware
 *
 * Maps NAuthException to structured HTTP error responses.
 * Must be registered LAST with app.use(errorHandler).
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof NAuthException) {
    const statusCode = getHttpStatusForErrorCode(err.code);
    res.status(statusCode).json({ ...err.toJSON(), path: req.path });
    return;
  }

  console.error('[Error]', err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    path: req.path,
  });
}
