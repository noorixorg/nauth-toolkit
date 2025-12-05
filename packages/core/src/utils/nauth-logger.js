"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NAuthLogger = void 0;
var pii_redactor_1 = require("./pii-redactor");
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
var NAuthLogger = /** @class */ (function () {
    function NAuthLogger(config) {
        if (!config) {
            // Silent mode
            this.logger = undefined;
            this.enablePiiRedaction = true;
            this.piiRedactor = new pii_redactor_1.PiiRedactor();
        }
        else if ('instance' in config) {
            // LoggerConfig object
            this.logger = config.instance;
            this.enablePiiRedaction = config.enablePiiRedaction !== false; // Default: true
            this.logLevel = config.logLevel;
            this.piiRedactor = new pii_redactor_1.PiiRedactor({
                redactEmails: this.enablePiiRedaction,
                redactIpAddresses: this.enablePiiRedaction,
                redactTokens: this.enablePiiRedaction,
                redactPhoneNumbers: this.enablePiiRedaction,
                redactNames: this.enablePiiRedaction,
                redactPasswords: true, // Always redact passwords
            });
        }
        else {
            // LoggerService instance directly
            this.logger = config;
            this.enablePiiRedaction = true; // Default: enabled
            this.piiRedactor = new pii_redactor_1.PiiRedactor();
        }
    }
    /**
     * Log a message (info level)
     */
    NAuthLogger.prototype.log = function (message) {
        var _a;
        var optionalParams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            optionalParams[_i - 1] = arguments[_i];
        }
        if (!this.logger || !this.shouldLog('log'))
            return;
        var processedMessage = this.processMessage(message);
        var processedParams = this.processParams(optionalParams);
        return (_a = this.logger).log.apply(_a, __spreadArray([processedMessage], processedParams, false));
    };
    /**
     * Log an error message
     */
    NAuthLogger.prototype.error = function (message) {
        var _a;
        var optionalParams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            optionalParams[_i - 1] = arguments[_i];
        }
        if (!this.logger || !this.shouldLog('error'))
            return;
        var processedMessage = this.processMessage(message);
        var processedParams = this.processParams(optionalParams);
        return (_a = this.logger).error.apply(_a, __spreadArray([processedMessage], processedParams, false));
    };
    /**
     * Log a warning message
     */
    NAuthLogger.prototype.warn = function (message) {
        var _a;
        var optionalParams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            optionalParams[_i - 1] = arguments[_i];
        }
        if (!this.logger || !this.shouldLog('warn'))
            return;
        var processedMessage = this.processMessage(message);
        var processedParams = this.processParams(optionalParams);
        return (_a = this.logger).warn.apply(_a, __spreadArray([processedMessage], processedParams, false));
    };
    /**
     * Log a debug message
     */
    NAuthLogger.prototype.debug = function (message) {
        var _a;
        var optionalParams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            optionalParams[_i - 1] = arguments[_i];
        }
        if (!this.logger || !this.logger.debug || !this.shouldLog('debug'))
            return;
        var processedMessage = this.processMessage(message);
        var processedParams = this.processParams(optionalParams);
        return (_a = this.logger).debug.apply(_a, __spreadArray([processedMessage], processedParams, false));
    };
    /**
     * Log a verbose message
     */
    NAuthLogger.prototype.verbose = function (message) {
        var _a;
        var optionalParams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            optionalParams[_i - 1] = arguments[_i];
        }
        if (!this.logger || !this.logger.verbose || !this.shouldLog('verbose'))
            return;
        var processedMessage = this.processMessage(message);
        var processedParams = this.processParams(optionalParams);
        return (_a = this.logger).verbose.apply(_a, __spreadArray([processedMessage], processedParams, false));
    };
    /**
     * Process message: add prefix and apply PII redaction
     * @private
     */
    NAuthLogger.prototype.processMessage = function (message) {
        var processedMessage;
        if (typeof message === 'string') {
            processedMessage = message;
        }
        else if (typeof message === 'object') {
            // For objects, stringify then redact
            processedMessage = JSON.stringify(message);
        }
        else {
            processedMessage = String(message);
        }
        // Apply PII redaction if enabled
        if (this.enablePiiRedaction) {
            processedMessage = this.piiRedactor.redactMessage(processedMessage);
        }
        // Add NAUTH: prefix
        return "".concat(NAuthLogger.PREFIX, " ").concat(processedMessage);
    };
    /**
     * Process optional parameters: apply PII redaction
     * @private
     */
    NAuthLogger.prototype.processParams = function (params) {
        var _this = this;
        if (!this.enablePiiRedaction || params.length === 0) {
            return params;
        }
        return params.map(function (param) {
            if (typeof param === 'string') {
                return _this.piiRedactor.redactMessage(param);
            }
            else if (typeof param === 'object') {
                // For objects, stringify, redact, then parse back
                try {
                    var stringified = JSON.stringify(param);
                    var redacted = _this.piiRedactor.redactMessage(stringified);
                    try {
                        return JSON.parse(redacted);
                    }
                    catch (_a) {
                        return redacted;
                    }
                }
                catch (_b) {
                    // Handle circular references or other JSON.stringify errors (e.g., toJSON throwing)
                    return '[Object with circular reference or invalid JSON]';
                }
            }
            return param;
        });
    };
    /**
     * Check if message should be logged based on log level
     * @private
     */
    NAuthLogger.prototype.shouldLog = function (level) {
        if (!this.logLevel)
            return true; // No filter, log everything
        var levels = ['error', 'warn', 'log', 'debug', 'verbose'];
        var configLevel = levels.indexOf(this.logLevel);
        var messageLevel = levels.indexOf(level);
        return messageLevel <= configLevel;
    };
    /**
     * Check if logger is enabled
     */
    NAuthLogger.prototype.isEnabled = function () {
        return !!this.logger;
    };
    /**
     * Check if PII redaction is enabled
     */
    NAuthLogger.prototype.isPiiRedactionEnabled = function () {
        return this.enablePiiRedaction;
    };
    NAuthLogger.PREFIX = 'NAUTH:';
    return NAuthLogger;
}());
exports.NAuthLogger = NAuthLogger;
