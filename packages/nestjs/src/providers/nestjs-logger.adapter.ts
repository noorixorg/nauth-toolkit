import { Injectable, Logger } from '@nestjs/common';
import { LoggerProvider, LogMetadata, LogLevel, PiiRedactor } from '@nauth-toolkit/core';

/**
 * NestJS Logger Adapter
 *
 * Default logger adapter that uses NestJS's built-in Logger.
 * Automatically redacts PII from all log messages and metadata.
 *
 * **Features:**
 * - Uses NestJS Logger (familiar to NestJS developers)
 * - Automatic PII redaction (emails, IPs, tokens, passwords)
 * - Structured logging with metadata
 * - Color-coded output in development
 * - JSON output in production (via NestJS config)
 *
 * **Usage:**
 * ```typescript
 * // Default (automatically used if no logger provided)
 * AuthModule.forRoot({
 *   logger: {
 *     provider: new NestJsLoggerAdapter(),
 *   },
 * })
 *
 * // With custom configuration
 * AuthModule.forRoot({
 *   logger: {
 *     provider: new NestJsLoggerAdapter({
 *       context: 'CustomAuth',
 *       enablePiiRedaction: true,
 *     }),
 *   },
 * })
 * ```
 *
 * @example
 * ```typescript
 * const logger = new NestJsLoggerAdapter();
 *
 * logger.log('User logged in', {
 *   userId: '123',
 *   email: 'user@example.com',  // Redacted to u***@***.com
 *   ipAddress: '192.168.1.100'  // Redacted to 192.168.1.***
 * });
 * ```
 */
@Injectable()
export class NestJsLoggerAdapter implements LoggerProvider {
  private readonly logger: Logger;
  private readonly piiRedactor: PiiRedactor;
  private readonly enablePiiRedaction: boolean;

  /**
   * Constructor
   *
   * @param options - Logger configuration options
   */
  constructor(options?: { context?: string; enablePiiRedaction?: boolean; piiRedactionOptions?: any }) {
    // Initialize NestJS Logger with context
    this.logger = new Logger(options?.context || 'nauth-toolkit');

    // Initialize PII redactor
    this.enablePiiRedaction = options?.enablePiiRedaction !== false; // Default: true
    this.piiRedactor = new PiiRedactor(options?.piiRedactionOptions);
  }

  /**
   * Log debug message (lowest priority)
   *
   * Used for detailed debugging information.
   * Only logged if log level is set to 'debug'.
   *
   * @param message - Log message
   * @param metadata - Additional context (PII will be redacted)
   */
  debug(message: string, metadata?: LogMetadata): void {
    const safeMessage = this.enablePiiRedaction ? this.piiRedactor.redactMessage(message) : message;
    const safeMetadata = this.enablePiiRedaction ? this.piiRedactor.redactMetadata(metadata) : metadata;

    if (safeMetadata) {
      this.logger.debug(`${safeMessage} ${JSON.stringify(safeMetadata)}`);
    } else {
      this.logger.debug(safeMessage);
    }
  }

  /**
   * Log informational message
   *
   * Used for general informational messages about system operation.
   *
   * @param message - Log message
   * @param metadata - Additional context (PII will be redacted)
   */
  log(message: string, metadata?: LogMetadata): void {
    const safeMessage = this.enablePiiRedaction ? this.piiRedactor.redactMessage(message) : message;
    const safeMetadata = this.enablePiiRedaction ? this.piiRedactor.redactMetadata(metadata) : metadata;

    if (safeMetadata) {
      this.logger.log(`${safeMessage} ${JSON.stringify(safeMetadata)}`);
    } else {
      this.logger.log(safeMessage);
    }
  }

  /**
   * Log warning message
   *
   * Used for potentially harmful situations.
   *
   * @param message - Log message
   * @param metadata - Additional context (PII will be redacted)
   */
  warn(message: string, metadata?: LogMetadata): void {
    const safeMessage = this.enablePiiRedaction ? this.piiRedactor.redactMessage(message) : message;
    const safeMetadata = this.enablePiiRedaction ? this.piiRedactor.redactMetadata(metadata) : metadata;

    if (safeMetadata) {
      this.logger.warn(`${safeMessage} ${JSON.stringify(safeMetadata)}`);
    } else {
      this.logger.warn(safeMessage);
    }
  }

  /**
   * Log error message (highest priority)
   *
   * Used for error events that might still allow the application to continue.
   *
   * @param message - Log message
   * @param metadata - Additional context (PII will be redacted)
   */
  error(message: string, metadata?: LogMetadata): void {
    const safeMessage = this.enablePiiRedaction ? this.piiRedactor.redactMessage(message) : message;
    const safeMetadata = this.enablePiiRedaction ? this.piiRedactor.redactMetadata(metadata) : metadata;

    if (safeMetadata && safeMetadata.error instanceof Error) {
      // Log error stack trace separately
      this.logger.error(safeMessage, safeMetadata.error.stack);

      // Log remaining metadata
      const { error, ...rest } = safeMetadata;
      if (Object.keys(rest).length > 0) {
        this.logger.error(JSON.stringify(rest));
      }
    } else if (safeMetadata) {
      this.logger.error(`${safeMessage} ${JSON.stringify(safeMetadata)}`);
    } else {
      this.logger.error(safeMessage);
    }
  }

  /**
   * Set log level at runtime
   *
   * Note: NestJS Logger doesn't directly support runtime log level changes,
   * but you can use Logger.overrideLogger() globally.
   *
   * @param level - Log level to set
   */
  setLogLevel(level: LogLevel): void {
    // NestJS Logger uses global log levels
    // This is a placeholder for future enhancement
    this.logger.log(`Log level set to: ${level}`);
  }

  /**
   * Check if a log level is enabled
   *
   * @param level - Log level to check
   * @returns True if the level is enabled
   */
  isLevelEnabled(_level: LogLevel): boolean {
    // NestJS Logger doesn't expose this directly
    // Default: all levels enabled
    return true;
  }
}
