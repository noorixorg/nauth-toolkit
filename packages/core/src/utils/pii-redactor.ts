import { LogMetadata, PiiRedactionOptions } from '../interfaces/logger.interface';

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
export class PiiRedactor {
  private options: Required<PiiRedactionOptions>;

  /**
   * Constructor
   *
   * @param options - PII redaction configuration
   */
  constructor(options?: PiiRedactionOptions) {
    // Default options with all redactions enabled
    this.options = {
      redactEmails: true,
      redactIpAddresses: true,
      redactTokens: true,
      redactPasswords: true,
      redactPhoneNumbers: true,
      redactNames: true,
      customRedactionFields: ['ssn', 'creditCard', 'bankAccount'],
      ...options,
    };
  }

  /**
   * Redact PII from a log message
   *
   * @param message - Log message that may contain PII
   * @returns Redacted message
   */
  redactMessage(message: string): string {
    let redacted = message;

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
  }

  /**
   * Redact PII from log metadata
   *
   * @param metadata - Log metadata that may contain PII
   * @returns Redacted metadata
   */
  redactMetadata(metadata?: LogMetadata): LogMetadata | undefined {
    if (!metadata) {
      return undefined;
    }

    const redacted: LogMetadata = { ...metadata };

    // Redact IP address (keep first 3 octets for geolocation)
    if (redacted.ipAddress && this.options.redactIpAddresses) {
      redacted.ipAddress = this.redactIpAddress(redacted.ipAddress);
    }

    // Redact custom fields
    for (const field of this.options.customRedactionFields) {
      if (field in redacted) {
        redacted[field] = '[REDACTED]';
      }
    }

    // Recursively redact object values
    for (const [key, value] of Object.entries(redacted)) {
      if (typeof value === 'string') {
        redacted[key] = this.redactMessage(value);
      } else if (typeof value === 'object' && value !== null && !(value instanceof Error)) {
        // Redact nested objects (but skip Error objects)
        redacted[key] = this.redactObject(value);
      }
    }

    return redacted;
  }

  /**
   * Redact email addresses
   * @private
   */
  private redactEmails(text: string): string {
    // Match email pattern: user@example.com
    return text.replace(
      /\b([a-zA-Z0-9])([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+)\.([a-zA-Z]{2,})\b/g,
      (_match, first, _local, _domain, tld) => {
        // Keep first char + *** + @ + *** + . + tld
        return `${first}***@***.${tld}`;
      },
    );
  }

  /**
   * Redact IP addresses (keep first 3 octets)
   * @private
   */
  private redactIpAddresses(text: string): string {
    // IPv4: 192.168.1.100 → 192.168.1.***
    let redacted = text.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}\b/g, '$1***');

    // IPv6: Redact last 4 groups
    redacted = redacted.replace(/\b([0-9a-fA-F:]+):([0-9a-fA-F]+):([0-9a-fA-F]+):([0-9a-fA-F]+)\b/g, '$1:***:***:***');

    return redacted;
  }

  /**
   * Redact a single IP address
   * @private
   */
  private redactIpAddress(ip: string): string {
    // IPv4
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }

    // IPv6
    if (ip.includes(':')) {
      const parts = ip.split(':');
      return `${parts.slice(0, 4).join(':')}:***:***:***`;
    }

    return ip;
  }

  /**
   * Redact JWT tokens and bearer tokens
   * @private
   */
  private redactTokens(text: string): string {
    // JWT tokens (eyJ...)
    let redacted = text.replace(/eyJ[A-Za-z0-9_-]{10,}/g, '[REDACTED_TOKEN]');

    // Bearer tokens
    redacted = redacted.replace(/Bearer\s+[A-Za-z0-9_-]{20,}/gi, 'Bearer [REDACTED_TOKEN]');

    // Generic long alphanumeric tokens (40+ chars)
    redacted = redacted.replace(/\b[A-Za-z0-9]{40,}\b/g, '[REDACTED_TOKEN]');

    return redacted;
  }

  /**
   * Redact phone numbers
   * @private
   */
  private redactPhoneNumbers(text: string): string {
    // E.164 format: +1234567890 → +123***7890
    return text.replace(/\+?(\d{1,3})(\d{3,})(\d{4})\b/g, (_match, country, _middle, last) => {
      return `+${country}***${last}`;
    });
  }

  /**
   * Redact names (firstName, lastName)
   * @private
   */
  private redactNames(text: string): string {
    // Redact specific field patterns in JSON/logs
    let redacted = text.replace(
      /(firstName|lastName|first_name|last_name)["\s:=]+([^"'\s,}&]+)/gi,
      '$1=[REDACTED_NAME]',
    );

    // Redact full names (pattern: "FirstName LastName" where both words are capitalized)
    // Only match when there are two consecutive capitalized words (likely a full name)
    // Exclude common technical words that shouldn't be redacted
    const commonWords =
      /^(User|Login|Token|Phone|Email|Admin|System|Service|Client|Server|Request|Response|Success|Error|Warning|Info|Debug|Welcome|Hello|Account|Profile|Session|Device)$/i;
    redacted = redacted.replace(/\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g, (match, first, last) => {
      // Don't redact if first word is a common technical term
      if (commonWords.test(first)) {
        return match;
      }
      return `${first.charAt(0)}*** ${last.charAt(0)}***`;
    });

    return redacted;
  }

  /**
   * Redact passwords and password-related fields
   * @private
   */
  private redactPasswords(text: string): string {
    // Redact common password patterns in JSON or query params
    let redacted = text.replace(/(password|pwd|passwd|secret)["\s:=]+([^"'\s,}&]+)/gi, '$1=[REDACTED]');

    // Redact Argon2 hashes
    redacted = redacted.replace(/\$argon2[^\s"',}]+/g, '[REDACTED_HASH]');

    // Redact bcrypt hashes
    redacted = redacted.replace(/\$2[aby]\$\d+\$[./A-Za-z0-9]{53}/g, '[REDACTED_HASH]');

    return redacted;
  }

  /**
   * Recursively redact an object
   * @private
   */
  private redactObject(obj: unknown, visited = new WeakSet<object>()): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Circular reference detection
    if (visited.has(obj as object)) {
      return '[Circular Reference]';
    }
    visited.add(obj as object);

    try {
      if (Array.isArray(obj)) {
        return obj.map((item) => this.redactObject(item, visited));
      }

      const redacted: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        // Check if key matches custom redaction fields
        if (this.options.customRedactionFields.includes(key.toLowerCase())) {
          redacted[key] = '[REDACTED]';
        } else if (typeof value === 'string') {
          redacted[key] = this.redactMessage(value);
        } else if (typeof value === 'object' && value !== null) {
          redacted[key] = this.redactObject(value, visited);
        } else {
          redacted[key] = value;
        }
      }

      return redacted;
    } catch {
      // If there's an error (e.g., can't stringify), return safe fallback
      return '[Object with circular references]';
    }
  }
}
