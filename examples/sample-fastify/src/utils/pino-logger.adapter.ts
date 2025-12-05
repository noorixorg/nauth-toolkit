/**
 * Pino Logger Adapter for NAuth Toolkit
 *
 * Implements the LoggerService interface to integrate Pino logger with nauth-toolkit.
 * Supports pino-pretty for development-friendly formatted output.
 */

import type { LoggerService } from '@nauth-toolkit/core';
import pino, { Logger } from 'pino';

/**
 * Creates a Pino logger adapter that implements LoggerService interface
 *
 * Maps Pino's log levels to NestJS LoggerService methods:
 * - log() -> info level
 * - error() -> error level
 * - warn() -> warn level
 * - debug() -> debug level
 * - verbose() -> trace level
 *
 * @param pinoLogger - Pino logger instance
 * @returns LoggerService adapter compatible with nauth-toolkit
 */
export function createPinoLoggerAdapter(pinoLogger: Logger): LoggerService {
  return {
    /**
     * Log info-level messages
     *
     * @param message - Log message
     * @param optionalParams - Additional parameters
     */
    log(message: any, ...optionalParams: any[]): void {
      if (optionalParams.length > 0) {
        pinoLogger.info({ params: optionalParams }, message);
      } else {
        pinoLogger.info(message);
      }
    },

    /**
     * Log error-level messages
     *
     * @param message - Error message
     * @param optionalParams - Additional parameters (errors, stack traces, etc.)
     */
    error(message: any, ...optionalParams: any[]): void {
      // Pino expects error objects in a specific format
      const errorObj = optionalParams.find((p) => p instanceof Error);
      const otherParams = optionalParams.filter((p) => !(p instanceof Error));

      if (errorObj) {
        pinoLogger.error(
          {
            err: errorObj,
            ...(otherParams.length > 0 && { params: otherParams }),
          },
          message,
        );
      } else if (otherParams.length > 0) {
        pinoLogger.error({ params: otherParams }, message);
      } else {
        pinoLogger.error(message);
      }
    },

    /**
     * Log warn-level messages
     *
     * @param message - Warning message
     * @param optionalParams - Additional parameters
     */
    warn(message: any, ...optionalParams: any[]): void {
      if (optionalParams.length > 0) {
        pinoLogger.warn({ params: optionalParams }, message);
      } else {
        pinoLogger.warn(message);
      }
    },

    /**
     * Log debug-level messages
     *
     * @param message - Debug message
     * @param optionalParams - Additional parameters
     */
    debug(message: any, ...optionalParams: any[]): void {
      if (optionalParams.length > 0) {
        pinoLogger.debug({ params: optionalParams }, message);
      } else {
        pinoLogger.debug(message);
      }
    },

    /**
     * Log verbose/trace-level messages
     *
     * @param message - Verbose message
     * @param optionalParams - Additional parameters
     */
    verbose(message: any, ...optionalParams: any[]): void {
      if (optionalParams.length > 0) {
        pinoLogger.trace({ params: optionalParams }, message);
      } else {
        pinoLogger.trace(message);
      }
    },
  };
}

/**
 * Creates a Pino logger with pino-pretty transport for development
 *
 * In development, uses pino-pretty for human-readable output.
 * In production, uses standard JSON output.
 *
 * @param options - Pino logger options
 * @returns Configured Pino logger instance
 */
export function createPinoLogger(options?: pino.LoggerOptions): Logger {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const baseOptions: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    ...options,
  };

  // Use pino-pretty in development for better readability
  if (isDevelopment) {
    return pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  // Production: use standard JSON output
  return pino(baseOptions);
}

