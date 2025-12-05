"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
/**
 * Log Level
 *
 * Standard logging levels in order of severity
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["LOG"] = "log";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
