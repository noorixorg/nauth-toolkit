/**
 * Logging Provider Interface
 *
 * Allows users to plug in their own logging solution (Winston, Pino, etc.)
 * while nauth-toolkit automatically redacts PII (Personally Identifiable Information).
 *
 * Key features:
 * - Standard log levels (debug, log, warn, error)
 * - Automatic PII redaction (emails, passwords, tokens, IPs)
 * - Structured logging support
 * - Contextual logging with metadata
 *
 * @example
 * ```typescript
 * // Use default NestJS logger
 * AuthModule.forRoot({
 *   logger: new NestJsLoggerAdapter(),
 * })
 *
 * // Use Winston
 * AuthModule.forRoot({
 *   logger: new WinstonLoggerAdapter(winstonInstance),
 * })
 *
 * // Use Pino
 * AuthModule.forRoot({
 *   logger: new PinoLoggerAdapter(pinoInstance),
 * })
 * ```
 */

/**
 * Log Level
 *
 * Standard logging levels in order of severity
 */
export enum LogLevel {
  DEBUG = 'debug',
  LOG = 'log',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log Metadata
 *
 * Additional context for log entries.
 * All values are automatically redacted if they contain PII.
 */
export interface LogMetadata {
  /**
   * User ID (non-PII, safe to log)
   */
  userId?: string;

  /**
   * Session ID (non-PII, safe to log)
   */
  sessionId?: string;

  /**
   * Request ID for tracing
   */
  requestId?: string;

  /**
   * Event type (e.g., 'login', 'signup', 'password_change')
   */
  event?: string;

  /**
   * IP address (will be redacted to first 3 octets)
   */
  ipAddress?: string;

  /**
   * Device information (non-PII)
   */
  deviceType?: string;

  /**
   * Error details
   */
  error?: Error | string;

  /**
   * Duration in milliseconds (for performance tracking)
   */
  duration?: number;

  /**
   * Additional custom metadata
   */
  [key: string]: unknown;
}

/**
 * Logger Provider Interface
 *
 * Contract that all logging providers must implement.
 * nauth-toolkit will call these methods and automatically redact PII.
 *
 * @example
 * ```typescript
 * class CustomLogger implements LoggerProvider {
 *   debug(message: string, metadata?: LogMetadata): void {
 *     myLogger.debug(message, metadata);
 *   }
 *
 *   log(message: string, metadata?: LogMetadata): void {
 *     myLogger.info(message, metadata);
 *   }
 *
 *   warn(message: string, metadata?: LogMetadata): void {
 *     myLogger.warn(message, metadata);
 *   }
 *
 *   error(message: string, metadata?: LogMetadata): void {
 *     myLogger.error(message, metadata);
 *   }
 * }
 * ```
 */
export interface LoggerProvider {
  /**
   * Log debug message (lowest priority)
   *
   * Used for detailed debugging information.
   *
   * @param message - Log message
   * @param metadata - Additional context (PII will be redacted)
   */
  debug(message: string, metadata?: LogMetadata): void;

  /**
   * Log informational message
   *
   * Used for general informational messages about system operation.
   *
   * @param message - Log message
   * @param metadata - Additional context (PII will be redacted)
   */
  log(message: string, metadata?: LogMetadata): void;

  /**
   * Log warning message
   *
   * Used for potentially harmful situations.
   *
   * @param message - Log message
   * @param metadata - Additional context (PII will be redacted)
   */
  warn(message: string, metadata?: LogMetadata): void;

  /**
   * Log error message (highest priority)
   *
   * Used for error events that might still allow the application to continue.
   *
   * @param message - Log message
   * @param metadata - Additional context (PII will be redacted)
   */
  error(message: string, metadata?: LogMetadata): void;
}

/**
 * PII Redaction Options
 *
 * Configure what PII should be redacted from logs
 */
export interface PiiRedactionOptions {
  /**
   * Redact email addresses
   * @default true
   *
   * Example: `user@example.com` → `u***@***.com`
   */
  redactEmails?: boolean;

  /**
   * Redact full IP addresses (keep first 3 octets)
   * @default true
   *
   * Example: `192.168.1.100` → `192.168.1.***`
   */
  redactIpAddresses?: boolean;

  /**
   * Redact tokens and secrets
   * @default true
   *
   * Example: `eyJhbGciOiJIUzI1...` → `eyJ***...***`
   */
  redactTokens?: boolean;

  /**
   * Redact passwords and password hashes
   * @default true
   *
   * Never log passwords! Always redacted.
   */
  redactPasswords?: boolean;

  /**
   * Redact phone numbers
   * @default true
   *
   * Example: `+1234567890` → `+123***7890`
   */
  redactPhoneNumbers?: boolean;

  /**
   * Redact names (firstName, lastName)
   * @default true
   *
   * Example: `John Doe` → `J*** D***`
   */
  redactNames?: boolean;

  /**
   * Custom fields to redact
   *
   * Field names that should be fully redacted if present in metadata.
   *
   * @default ['ssn', 'creditCard', 'bankAccount']
   */
  customRedactionFields?: string[];
}

/**
 * Logger Configuration
 *
 * Configuration for the logging system
 */
export interface LoggerConfig {
  /**
   * Logger provider instance
   *
   * @default NestJsLoggerAdapter (built-in)
   */
  provider?: LoggerProvider;

  /**
   * Minimum log level to output
   *
   * @default LogLevel.LOG
   */
  level?: LogLevel;

  /**
   * Enable PII redaction
   *
   * @default true (always enabled in production)
   */
  enablePiiRedaction?: boolean;

  /**
   * PII redaction options
   */
  piiRedactionOptions?: PiiRedactionOptions;

  /**
   * Log authentication events
   *
   * @default true
   */
  logAuthEvents?: boolean;

  /**
   * Log security events (lockouts, suspicious activity)
   *
   * @default true
   */
  logSecurityEvents?: boolean;

  /**
   * Log performance metrics
   *
   * @default false
   */
  logPerformance?: boolean;
}
