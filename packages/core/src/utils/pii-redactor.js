"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PiiRedactor = void 0;
/**
 * PII Redactor Utility
 *
 * Automatically redacts Personally Identifiable Information (PII) from log messages
 * and metadata to ensure privacy compliance (GDPR, CCPA, etc.).
 *
 * Redaction patterns:
 * - Emails: `user@example.com` → `u***@***.com`
 * - IP Addresses: `192.168.1.100` → `192.168.1.***`
 * - Tokens: `eyJhbGciOiJIUz...` → `[REDACTED_TOKEN]`
 * - Passwords: Always `[REDACTED]`
 * - Phone Numbers: `+1234567890` → `+123***7890`
 * - Names: `John Doe` → `J*** D***`
 *
 * @example
 * ```typescript
 * const redactor = new PiiRedactor();
 * const safe = redactor.redactMessage('User user@example.com logged in');
 * // Output: 'User u***@***.com logged in'
 * ```
 */
var PiiRedactor = /** @class */ (function () {
    /**
     * Constructor
     *
     * @param options - PII redaction configuration
     */
    function PiiRedactor(options) {
        // Default options with all redactions enabled
        this.options = __assign({ redactEmails: true, redactIpAddresses: true, redactTokens: true, redactPasswords: true, redactPhoneNumbers: true, redactNames: true, customRedactionFields: ['ssn', 'creditCard', 'bankAccount'] }, options);
    }
    /**
     * Redact PII from a log message
     *
     * @param message - Log message that may contain PII
     * @returns Redacted message
     */
    PiiRedactor.prototype.redactMessage = function (message) {
        var redacted = message;
        // Redact emails
        if (this.options.redactEmails) {
            redacted = this.redactEmails(redacted);
        }
        // Redact IP addresses
        if (this.options.redactIpAddresses) {
            redacted = this.redactIpAddresses(redacted);
        }
        // Redact tokens (JWT, Bearer tokens)
        if (this.options.redactTokens) {
            redacted = this.redactTokens(redacted);
        }
        // Redact phone numbers
        if (this.options.redactPhoneNumbers) {
            redacted = this.redactPhoneNumbers(redacted);
        }
        // Redact names (firstName, lastName)
        if (this.options.redactNames) {
            redacted = this.redactNames(redacted);
        }
        // Redact passwords (always)
        if (this.options.redactPasswords) {
            redacted = this.redactPasswords(redacted);
        }
        return redacted;
    };
    /**
     * Redact PII from log metadata
     *
     * @param metadata - Log metadata that may contain PII
     * @returns Redacted metadata
     */
    PiiRedactor.prototype.redactMetadata = function (metadata) {
        if (!metadata) {
            return undefined;
        }
        var redacted = __assign({}, metadata);
        // Redact IP address (keep first 3 octets for geolocation)
        if (redacted.ipAddress && this.options.redactIpAddresses) {
            redacted.ipAddress = this.redactIpAddress(redacted.ipAddress);
        }
        // Redact custom fields
        for (var _i = 0, _a = this.options.customRedactionFields; _i < _a.length; _i++) {
            var field = _a[_i];
            if (field in redacted) {
                redacted[field] = '[REDACTED]';
            }
        }
        // Recursively redact object values
        for (var _b = 0, _c = Object.entries(redacted); _b < _c.length; _b++) {
            var _d = _c[_b], key = _d[0], value = _d[1];
            if (typeof value === 'string') {
                redacted[key] = this.redactMessage(value);
            }
            else if (typeof value === 'object' && value !== null && !(value instanceof Error)) {
                // Redact nested objects (but skip Error objects)
                redacted[key] = this.redactObject(value);
            }
        }
        return redacted;
    };
    /**
     * Redact email addresses
     * @private
     */
    PiiRedactor.prototype.redactEmails = function (text) {
        // Match email pattern: user@example.com
        return text.replace(/\b([a-zA-Z0-9])([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+)\.([a-zA-Z]{2,})\b/g, function (_match, first, _local, _domain, tld) {
            // Keep first char + *** + @ + *** + . + tld
            return "".concat(first, "***@***.").concat(tld);
        });
    };
    /**
     * Redact IP addresses (keep first 3 octets)
     * @private
     */
    PiiRedactor.prototype.redactIpAddresses = function (text) {
        // IPv4: 192.168.1.100 → 192.168.1.***
        var redacted = text.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}\b/g, '$1***');
        // IPv6: Redact last 4 groups
        redacted = redacted.replace(/\b([0-9a-fA-F:]+):([0-9a-fA-F]+):([0-9a-fA-F]+):([0-9a-fA-F]+)\b/g, '$1:***:***:***');
        return redacted;
    };
    /**
     * Redact a single IP address
     * @private
     */
    PiiRedactor.prototype.redactIpAddress = function (ip) {
        // IPv4
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
            var parts = ip.split('.');
            return "".concat(parts[0], ".").concat(parts[1], ".").concat(parts[2], ".***");
        }
        // IPv6
        if (ip.includes(':')) {
            var parts = ip.split(':');
            return "".concat(parts.slice(0, 4).join(':'), ":***:***:***");
        }
        return ip;
    };
    /**
     * Redact JWT tokens and bearer tokens
     * @private
     */
    PiiRedactor.prototype.redactTokens = function (text) {
        // JWT tokens (eyJ...)
        var redacted = text.replace(/eyJ[A-Za-z0-9_-]{10,}/g, '[REDACTED_TOKEN]');
        // Bearer tokens
        redacted = redacted.replace(/Bearer\s+[A-Za-z0-9_-]{20,}/gi, 'Bearer [REDACTED_TOKEN]');
        // Generic long alphanumeric tokens (40+ chars)
        redacted = redacted.replace(/\b[A-Za-z0-9]{40,}\b/g, '[REDACTED_TOKEN]');
        return redacted;
    };
    /**
     * Redact phone numbers
     * @private
     */
    PiiRedactor.prototype.redactPhoneNumbers = function (text) {
        // E.164 format: +1234567890 → +123***7890
        return text.replace(/\+?(\d{1,3})(\d{3,})(\d{4})\b/g, function (_match, country, _middle, last) {
            return "+".concat(country, "***").concat(last);
        });
    };
    /**
     * Redact names (firstName, lastName)
     * @private
     */
    PiiRedactor.prototype.redactNames = function (text) {
        // Redact specific field patterns in JSON/logs
        var redacted = text.replace(/(firstName|lastName|first_name|last_name)["\s:=]+([^"'\s,}&]+)/gi, '$1=[REDACTED_NAME]');
        // Redact full names (pattern: "FirstName LastName" where both words are capitalized)
        // Only match when there are two consecutive capitalized words (likely a full name)
        // Exclude common technical words that shouldn't be redacted
        var commonWords = /^(User|Login|Token|Phone|Email|Admin|System|Service|Client|Server|Request|Response|Success|Error|Warning|Info|Debug|Welcome|Hello|Account|Profile|Session|Device)$/i;
        redacted = redacted.replace(/\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g, function (match, first, last) {
            // Don't redact if first word is a common technical term
            if (commonWords.test(first)) {
                return match;
            }
            return "".concat(first.charAt(0), "*** ").concat(last.charAt(0), "***");
        });
        return redacted;
    };
    /**
     * Redact passwords and password-related fields
     * @private
     */
    PiiRedactor.prototype.redactPasswords = function (text) {
        // Redact common password patterns in JSON or query params
        var redacted = text.replace(/(password|pwd|passwd|secret)["\s:=]+([^"'\s,}&]+)/gi, '$1=[REDACTED]');
        // Redact Argon2 hashes
        redacted = redacted.replace(/\$argon2[^\s"',}]+/g, '[REDACTED_HASH]');
        // Redact bcrypt hashes
        redacted = redacted.replace(/\$2[aby]\$\d+\$[./A-Za-z0-9]{53}/g, '[REDACTED_HASH]');
        return redacted;
    };
    /**
     * Recursively redact an object
     * @private
     */
    PiiRedactor.prototype.redactObject = function (obj, visited) {
        var _this = this;
        if (visited === void 0) { visited = new WeakSet(); }
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        // Circular reference detection
        if (visited.has(obj)) {
            return '[Circular Reference]';
        }
        visited.add(obj);
        try {
            if (Array.isArray(obj)) {
                return obj.map(function (item) { return _this.redactObject(item, visited); });
            }
            var redacted = {};
            for (var _i = 0, _a = Object.entries(obj); _i < _a.length; _i++) {
                var _b = _a[_i], key = _b[0], value = _b[1];
                // Check if key matches custom redaction fields
                if (this.options.customRedactionFields.includes(key.toLowerCase())) {
                    redacted[key] = '[REDACTED]';
                }
                else if (typeof value === 'string') {
                    redacted[key] = this.redactMessage(value);
                }
                else if (typeof value === 'object' && value !== null) {
                    redacted[key] = this.redactObject(value, visited);
                }
                else {
                    redacted[key] = value;
                }
            }
            return redacted;
        }
        catch (_c) {
            // If there's an error (e.g., can't stringify), return safe fallback
            return '[Object with circular references]';
        }
    };
    return PiiRedactor;
}());
exports.PiiRedactor = PiiRedactor;
