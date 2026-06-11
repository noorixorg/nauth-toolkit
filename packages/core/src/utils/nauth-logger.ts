/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoggerService, NAuthLoggerConfig } from '../interfaces/config.interface';
import { PiiRedactor } from './pii-redactor';

/**
 * NAuth Logger Wrapper
 *
 * Wraps any NestJS-compatible logger and adds features:
 * 1. "NAUTH:" prefix to all messages for easy identification
 * 2. Automatic PII redaction (emails, IPs, tokens, etc.) - enabled by default
 * 3. Optional log level filtering
 * 4. Silent mode if no logger is provided
 *
 * This allows nauth-toolkit to integrate seamlessly with the consuming application's
 * logging infrastructure while maintaining security and compliance.
 *
 * @example
 * ```typescript
 * // With NestJS built-in logger (PII redaction enabled by default)
 * const logger = new NAuthLogger(new Logger('MyApp'));
 * logger.log('User user@example.com signed up');
 * // Output: [MyApp] NAUTH: User u***@***.com signed up
 *
 * // With config options
 * const logger = new NAuthLogger({
 *   instance: new Logger('MyApp'),
 *   enablePiiRedaction: true,  // Default
 *   logLevel: 'debug'
 * });
 *
 * // Disable PII redaction (debugging only)
 * const logger = new NAuthLogger({
 *   instance: myLogger,
 *   enablePiiRedaction: false
 * });
 *
 * // Silent mode (no logger provided)
 * const logger = new NAuthLogger();
 * logger.log('This will not be logged'); // No output
 * ```
 */
export class NAuthLogger implements LoggerService {
  private static readonly PREFIX = 'NAUTH:';

  private readonly logger?: LoggerService;
  private readonly piiRedactor: PiiRedactor;
  private readonly enablePiiRedaction: boolean;
  private readonly logLevel?: string;

  constructor(config?: LoggerService | NAuthLoggerConfig) {
    if (!config) {
      // Silent mode
      this.logger = undefined;
      this.enablePiiRedaction = true;
      this.piiRedactor = new PiiRedactor();
    } else if ('instance' in config) {
      // LoggerConfig object
      this.logger = config.instance;
      this.enablePiiRedaction = config.enablePiiRedaction !== false; // Default: true
      this.logLevel = config.logLevel;
      this.piiRedactor = new PiiRedactor({
        redactEmails: this.enablePiiRedaction,
        redactIpAddresses: this.enablePiiRedaction,
        redactTokens: this.enablePiiRedaction,
        redactPhoneNumbers: this.enablePiiRedaction,
        redactNames: this.enablePiiRedaction,
        redactPasswords: true, // Always redact passwords
      });
    } else {
      // LoggerService instance directly
      this.logger = config;
      this.enablePiiRedaction = true; // Default: enabled
      this.piiRedactor = new PiiRedactor();
    }
  }

  /**
   * Log a message (info level)
   */
  log(message: any, ...optionalParams: any[]): any {
    if (!this.logger || !this.shouldLog('log')) return;

    const processedMessage = this.processMessage(message);
    const processedParams = this.processParams(optionalParams);
    return this.logger.log(processedMessage, ...processedParams);
  }

  /**
   * Log an error message
   */
  error(message: any, ...optionalParams: any[]): any {
    if (!this.logger || !this.shouldLog('error')) return;

    const processedMessage = this.processMessage(message);
    const processedParams = this.processParams(optionalParams);
    return this.logger.error(processedMessage, ...processedParams);
  }

  /**
   * Log a warning message
   */
  warn(message: any, ...optionalParams: any[]): any {
    if (!this.logger || !this.shouldLog('warn')) return;

    const processedMessage = this.processMessage(message);
    const processedParams = this.processParams(optionalParams);
    return this.logger.warn(processedMessage, ...processedParams);
  }

  /**
   * Log a debug message
   */
  debug(message: any, ...optionalParams: any[]): any {
    if (!this.logger || !this.logger.debug || !this.shouldLog('debug')) return;

    const processedMessage = this.processMessage(message);
    const processedParams = this.processParams(optionalParams);
    return this.logger.debug(processedMessage, ...processedParams);
  }

  /**
   * Log a verbose message
   */
  verbose(message: any, ...optionalParams: any[]): any {
    if (!this.logger || !this.logger.verbose || !this.shouldLog('verbose')) return;

    const processedMessage = this.processMessage(message);
    const processedParams = this.processParams(optionalParams);
    return this.logger.verbose(processedMessage, ...processedParams);
  }

  /**
   * Process message: add prefix and apply PII redaction
   * @private
   */
  private processMessage(message: any): any {
    let processedMessage: string;

    if (typeof message === 'string') {
      processedMessage = message;
    } else if (typeof message === 'object') {
      // For objects, stringify then redact
      processedMessage = JSON.stringify(message);
    } else {
      processedMessage = String(message);
    }

    // Apply PII redaction if enabled
    if (this.enablePiiRedaction) {
      processedMessage = this.piiRedactor.redactMessage(processedMessage);
    }

    // Add NAUTH: prefix
    return `${NAuthLogger.PREFIX} ${processedMessage}`;
  }

  /**
   * Process optional parameters: apply PII redaction
   * @private
   */
  private processParams(params: any[]): any[] {
    if (!this.enablePiiRedaction || params.length === 0) {
      return params;
    }

    return params.map((param) => {
      if (typeof param === 'string') {
        return this.piiRedactor.redactMessage(param);
      } else if (typeof param === 'object') {
        // For objects, stringify, redact, then parse back
        try {
          const stringified = JSON.stringify(param);
          const redacted = this.piiRedactor.redactMessage(stringified);
          try {
            return JSON.parse(redacted);
          } catch {
            return redacted;
          }
        } catch {
          // Handle circular references or other JSON.stringify errors (e.g., toJSON throwing)
          return '[Object with circular reference or invalid JSON]';
        }
      }
      return param;
    });
  }

  /**
   * Check if message should be logged based on log level
   * @private
   */
  private shouldLog(level: string): boolean {
    if (!this.logLevel) return true; // No filter, log everything

    const levels = ['error', 'warn', 'log', 'debug', 'verbose'];
    const configLevel = levels.indexOf(this.logLevel);
    const messageLevel = levels.indexOf(level);

    return messageLevel <= configLevel;
  }

  /**
   * Check if logger is enabled
   */
  isEnabled(): boolean {
    return !!this.logger;
  }

  /**
   * Check if PII redaction is enabled
   */
  isPiiRedactionEnabled(): boolean {
    return this.enablePiiRedaction;
  }
}
