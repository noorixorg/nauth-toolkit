/**
 * Configuration interface for nauth-toolkit
 *
 * NOTE: This interface is validated at runtime using Zod.
 * See packages/core/src/schemas/auth-config.schema.ts for validation rules.
 *
 * The Zod schema validates:
 * - Required fields and types
 * - Cross-dependencies (e.g., email config requires emailProvider)
 * - Algorithm-specific requirements (JWT symmetric vs asymmetric)
 * - MFA enforcement modes and their requirements
 * - Social provider requirements
 * - GeoLocation MaxMind credentials
 *
 * Validation errors are caught at module initialization with clear, actionable messages.
 */

import { MFADeviceMethod } from '../enums/mfa-method.enum';
import { StorageAdapter } from './storage-adapter.interface';
import { EmailProvider, SMSProvider } from './provider.interface';

export interface NAuthConfig {
  /**
   * Database table prefix
   *
   * @default 'nauth_'
   *
   * @example
   * ```typescript
   * tablePrefix: 'myapp_', // Tables: myapp_users, myapp_sessions, etc.
   * ```
   */
  tablePrefix?: string;

  /**
   * JWT configuration
   */
  jwt: JwtConfig;

  /**
   * Signup configuration
   */
  signup?: SignupConfig;

  /**
   * Login configuration
   */
  login?: LoginConfig;

  /**
   * Password policy configuration
   */
  password?: PasswordConfig;

  /**
   * Account lockout configuration
   */
  lockout?: LockoutConfig;

  /**
   * Session configuration
   */
  session?: SessionConfig;

  /**
   * Security configuration
   */
  security?: SecurityConfig;

  /**
   * Lifecycle hooks
   */
  hooks?: LifecycleHooks;

  /**
   * Audit logging configuration
   *
   * Controls whether authentication and security events are logged to the audit trail.
   * When disabled, audit logs are not recorded, reducing storage costs and minor performance overhead.
   *
   * WARNING: Highly recommended for production systems. Disabling audit logs reduces security observability.
   *
   * @default { enabled: true }
   *
   * @example
   * ```typescript
   * // Enable audit logs (default - recommended for production)
   * auditLogs: {
   *   enabled: true
   * }
   *
   * // Disable audit logs (minimal overhead use cases only)
   * auditLogs: {
   *   enabled: false
   * }
   * ```
   */
  auditLogs?: {
    /**
     * Enable audit logging
     * @default true
     */
    enabled?: boolean;
    /**
     * Fire-and-forget audit mode for hot paths
     * When true, audit writes won't be awaited on request path
     */
    fireAndForget?: boolean;
  };

  /**
   * Email provider for sending verification emails, password resets, etc.
   *
   * Configure based on your needs - consumer apps choose their own env var names.
   * All values should be passed explicitly through config, not auto-loaded.
   *
   * @example
   * ```typescript
   * // Console provider (development - logs to console)
   * import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';
   * emailProvider: new ConsoleEmailProvider()
   *
   * // Nodemailer with SMTP (production)
   * import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
   * emailProvider: new NodemailerEmailProvider({
   *   transport: {
   *     host: process.env.SMTP_HOST, // Your env var name
   *     port: parseInt(process.env.SMTP_PORT || '587'),
   *     secure: process.env.SMTP_SECURE === 'true',
   *     auth: {
   *       user: process.env.SMTP_USER,
   *       pass: process.env.SMTP_PASS,
   *     },
   *   },
   *   defaults: {
   *     from: process.env.EMAIL_FROM, // e.g., "My App <noreply@example.com>"
   *   },
   * })
   * ```
   */
  emailProvider?: EmailProvider;

  /**
   * Email verification configuration
   */
  email?: EmailConfig;

  /**
   * Optional: SMS provider for sending phone verification codes
   * If not provided, uses ConsoleSMSProvider (logs to console)
   *
   * @example
   * ```typescript
   * // Use console provider (development)
   * smsProvider: new ConsoleSMSProvider()
   *
   * // Use Twilio provider (production)
   * smsProvider: new TwilioSMSProvider({ accountSid: '...', authToken: '...', fromNumber: '...' })
   * ```
   */
  smsProvider?: SMSProvider;

  /**
   * SMS template configuration
   *
   * Configure custom SMS templates and global variables for branding.
   * Templates are validated at startup to ensure required parameters are present.
   *
   * Note: Top-level branding fields (appName, companyName, etc.) are automatically
   * merged into sms.templates.globalVariables. You can override them in globalVariables if needed.
   *
   * @example Basic configuration with top-level branding
   * ```typescript
   * sms: {
   *   templates: {
   *     globalVariables: {
   *       appName: process.env.APP_NAME || 'My Application',
   *       companyName: process.env.COMPANY_NAME || 'My Company Inc.',
   *       supportPhone: process.env.SUPPORT_PHONE || '+1-800-123-4567',
   *     },
   *   },
   * }
   * ```
   *
   * @example Advanced configuration with custom templates
   * ```typescript
   * sms: {
   *   templates: {
   *     globalVariables: {
   *       appName: 'My App',
   *       companyName: 'My Company',
   *     },
   *     customTemplates: {
   *       verification: {
   *         content: '{{appName}}: Your verification code is {{code}}. Expires in {{expiryMinutes}} min.',
   *         // Must include: {{code}}, {{expiryMinutes}}
   *       },
   *       mfa: {
   *         contentPath: './sms-templates/mfa.txt.hbs',
   *         // Must include: {{code}}, {{expiryMinutes}}
   *       },
   *     },
   *   },
   * }
   * ```
   */
  sms?: {
    templates?: import('./sms-template.interface').SMSTemplateConfig;
  };

  /**
   * Phone verification configuration
   */
  phone?: PhoneConfig;

  /**
   * Storage adapter for transient state (rate limits, locks, token reuse tracking)
   *
   * WARNING: PRODUCTION REQUIREMENT - Storage adapter is REQUIRED for production deployments.
   *
   * Default Behavior:
   * - If not provided and storage entities are available: DatabaseStorageAdapter is used automatically
   * - If not provided and storage entities are NOT available: Configuration fails with helpful error message
   *
   * MemoryStorageAdapter is NOT safe for production:
   * - Data lost on server restart
   * - NOT shared across multiple server instances
   * - Rate limiting per-container (not global in multi-container setups)
   * - Token reuse detection fails in multi-server deployments
   *
   * Recommended: DatabaseStorageAdapter (default, uses existing TypeORM connection, no additional infrastructure)
   * Alternative: RedisStorageAdapter (for high-performance multi-server deployments)
   * Production: RedisClusterAdapter (for high-availability production clusters)
   *
   * @example
   * ```typescript
   * // Database adapter (default - uses existing TypeORM connection, no additional infrastructure)
   * import { createDatabaseStorageAdapter } from '@nauth-toolkit/nestjs';
   * storageAdapter: createDatabaseStorageAdapter()
   *
   * // Redis adapter (for high-performance multi-server deployments)
   * import { createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
   * storageAdapter: createRedisStorageAdapter(process.env.REDIS_URL)
   *
   * // Redis Cluster adapter (for high-availability production deployments)
   * import { createRedisClusterAdapter } from '@nauth-toolkit/nestjs';
   * storageAdapter: createRedisClusterAdapter([
   *   { url: 'redis://redis-node-1:6379' },
   *   { url: 'redis://redis-node-2:6379' },
   *   { url: 'redis://redis-node-3:6379' },
   * ])
   *
   * // Auto-detect (uses DatabaseStorageAdapter if entities available)
   * storageAdapter: undefined
   * ```
   */
  storageAdapter?: StorageAdapter;

  /**
   * Social login configuration
   * Configure OAuth providers for social authentication
   *
   * @example
   * ```typescript
   * social: {
   *   google: {
   *     enabled: true,
   *     clientId: process.env.GOOGLE_CLIENT_ID, // Your env var name
   *     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
   *     callbackUrl: 'https://myapp.com/auth/google/callback',
   *     autoLink: true,
   *     allowSignup: true
   *   },
   *   apple: {
   *     enabled: true,
   *     clientId: process.env.APPLE_CLIENT_ID, // Your env var name
   *     clientSecret: process.env.APPLE_CLIENT_SECRET,
   *     callbackUrl: 'https://myapp.com/auth/apple/callback',
   *     autoLink: true,
   *     allowSignup: true
   *   }
   * }
   * ```
   */
  social?: SocialConfig;

  /**
   * Multi-Factor Authentication (MFA) configuration
   *
   * Supports multiple MFA methods: TOTP (authenticator apps), SMS, Email, and Passkeys (WebAuthn).
   * Users can register multiple devices for redundancy.
   *
   * @example
   * ```typescript
   * mfa: {
   *   enabled: true,
   *   enforcement: 'OPTIONAL',
   *   allowedMethods: [MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY],
   *   issuer: 'MyApp',
   *   totp: {
   *     window: 1,
   *     stepSeconds: 30
   *   },
   *   passkey: {
   *     rpName: 'MyApp',
   *     rpId: 'myapp.com',
   *     timeout: 60000
   *   },
   *   backup: {
   *     enabled: true,
   *     codeCount: 10
   *   }
   * }
   * ```
   */
  mfa?: MFAConfig;

  /**
   * Optional: Logger configuration for nauth-toolkit internal logging
   * Compatible with NestJS LoggerService interface
   * If not provided, nauth-toolkit will be silent (no logs)
   *
   * All logs will be prefixed with "NAUTH:" for easy identification
   * PII redaction is enabled by default for security compliance
   *
   * @example
   * ```typescript
   * import { Logger } from '@nestjs/common';
   *
   * // Use NestJS built-in logger with default settings (PII redaction enabled)
   * logger: new Logger('NAuth')
   *
   * // Use custom logger with options
   * logger: {
   *   instance: new Logger('NAuth'),
   *   enablePiiRedaction: true,  // Default: true
   *   logLevel: 'debug'           // Optional: control log level
   * }
   *
   * // Disable PII redaction (for debugging - not recommended in production)
   * logger: {
   *   instance: myCustomLogger,
   *   enablePiiRedaction: false
   * }
   *
   * // No logger = silent mode (default)
   * logger: undefined
   * ```
   */
  logger?: LoggerService | NAuthLoggerConfig;

  /**
   * Token delivery configuration
   *
   * Controls how JWT tokens are delivered to clients.
   * - 'json': Return tokens in response body only (default, protocol-agnostic)
   * - 'cookies': Set tokens as httpOnly cookies only (browser web apps)
   * - 'hybrid': Strict hybrid: cookies for web origins, JSON for native; never both
   *
   * Smart defaults (non-configurable unless explicitly overridden):
   * - Cookie names: 'nauth_access_token', 'nauth_refresh_token'
   * - httpOnly: true (always)
   * - secure: true (configurable for localhost/dev)
   * - sameSite: 'strict' (configurable)
   * - path: '/' (configurable)
   *
   * @default { method: 'json' }
   *
   * @example
   * // Minimal (99% of use cases)
   * tokenDelivery: { method: 'cookies' }
   *
   * // With overrides (rare)
   * tokenDelivery: {
   *   method: 'hybrid',
   *   cookieOptions: {
   *     secure: false, // For localhost development
   *     domain: '.myapp.com', // For subdomain sharing
   *   }
   * }
   */
  tokenDelivery?: TokenDeliveryConfig;

  /**
   * Challenge configuration
   *
   * Controls challenge session behavior for authentication challenges
   * (email verification, phone verification, MFA challenges, etc.)
   *
   * @example
   * ```typescript
   * challenge: {
   *   maxAttempts: 3 // Default: 3 attempts (4th failure causes error)
   * }
   * ```
   */
  challenge?: ChallengeConfig;

  /**
   * Geolocation configuration
   *
   * Configures IP geolocation using MaxMind GeoIP2 database files.
   * Platform-agnostic - works on all platforms where Node.js runs.
   *
   * @example
   * ```typescript
   * geoLocation: {
   *   maxMind: {
   *     licenseKey: process.env.MAXMIND_LICENSE_KEY,
   *     accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0'),
   *     // dbPath not set = uses system temp directory
   *   }
   * }
   * ```
   */
  geoLocation?: GeoLocationConfig;
}

/**
 * NAuth logger configuration with PII redaction options
 */
export interface NAuthLoggerConfig {
  /**
   * Logger instance (NestJS Logger, Winston, Pino, or custom)
   */
  instance: LoggerService;

  /**
   * Enable PII redaction (default: true)
   * Automatically redacts emails, IPs, tokens, phone numbers, etc.
   *
   * WARNING: Only disable for debugging in development
   */
  enablePiiRedaction?: boolean;

  /**
   * Optional: Control minimum log level
   * If not set, all log methods will be called (logger decides what to output)
   */
  logLevel?: 'error' | 'warn' | 'log' | 'debug' | 'verbose';
}

/**
 * Logger interface compatible with NestJS LoggerService
 * Supports any logger that implements these methods
 */
export interface LoggerService {
  log(message: any, ...optionalParams: any[]): any;
  error(message: any, ...optionalParams: any[]): any;
  warn(message: any, ...optionalParams: any[]): any;
  debug?(message: any, ...optionalParams: any[]): any;
  verbose?(message: any, ...optionalParams: any[]): any;
}

export interface JwtConfig {
  /**
   * JWT algorithm
   *
   * - HS256/HS384/HS512: HMAC with SHA (symmetric key, default: HS256)
   * - RS256/RS384/RS512: RSA with SHA (asymmetric key pair)
   */
  algorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';

  /**
   * Access token configuration
   */
  accessToken: AccessTokenConfig;

  /**
   * Refresh token configuration
   */
  refreshToken: RefreshTokenConfig;

  /**
   * Token issuer
   */
  issuer?: string;

  /**
   * Token audience
   */
  audience?: string | string[];
}

export interface AccessTokenConfig {
  /**
   * Secret key for symmetric algorithms (HS256/HS384/HS512)
   * Base64-encoded string
   */
  secret?: string;

  /**
   * Private key for asymmetric algorithms (RS256/RS384/RS512)
   * PEM-encoded private key
   */
  privateKey?: string;

  /**
   * Public key for asymmetric algorithms (RS256/RS384/RS512)
   * PEM-encoded public key
   */
  publicKey?: string;

  /**
   * Token expiration time (e.g., '15m', '1h', 900)
   */
  expiresIn: string | number;
}

export interface RefreshTokenConfig {
  /**
   * Secret key for signing (typically uses HS256 for refresh tokens)
   * Base64-encoded string
   */
  secret: string;

  /**
   * Token expiration time (e.g., '30d', '7d')
   */
  expiresIn: string | number;

  /**
   * Enable token rotation (generate new refresh token on each use)
   */
  rotation?: boolean;

  /**
   * Enable refresh token reuse detection
   */
  reuseDetection?: boolean;
}

export interface SignupConfig {
  /**
   * Enable user signups
   * If false, signup endpoint will return 403 Forbidden
   *
   * Default: true
   */
  enabled?: boolean;

  /**
   * Verification method requirement
   *
   * Options:
   * - 'none': No verification required (users can login immediately)
   * - 'email': Email verification required before login (default)
   * - 'phone': Phone verification required before login
   * - 'both': BOTH email AND phone verification required
   *
   * Default: 'email'
   *
   * @example
   * ```typescript
   * // No verification (auto-activate)
   * signup: { verificationMethod: 'none' }
   *
   * // Email only (default)
   * signup: { verificationMethod: 'email' }
   *
   * // Both required
   * signup: { verificationMethod: 'both' }
   * ```
   */
  verificationMethod?: 'none' | 'email' | 'phone' | 'both';

  /**
   * Allow duplicate phone numbers
   * If true, multiple users can have the same phone number
   * Phone verification will be user-specific (requires user sub)
   *
   * Default: false
   *
   * @example
   * ```typescript
   * // Allow shared phone numbers (family accounts, etc.)
   * signup: { allowDuplicatePhones: true }
   * ```
   */
  allowDuplicatePhones?: boolean;

  /**
   * Email verification settings
   * Only relevant when verificationMethod is 'email' or 'both'
   */
  emailVerification?: {
    /**
     * Code expiry in seconds
     * @default 3600 (1 hour)
     */
    expiresIn?: number;

    /**
     * Maximum attempts to verify a single code
     * Prevents brute force attacks on verification codes
     * @default 3
     */
    maxAttempts?: number;

    /**
     * Delay between resend requests in seconds
     * Prevents users from requesting codes too frequently
     * @default 60
     */
    resendDelay?: number;

    /**
     * Maximum email verification codes per time window
     * Prevents email abuse and rate limiting
     * @default 3
     */
    rateLimitMax?: number;

    /**
     * Rate limit time window in seconds
     * The time period over which rateLimitMax applies
     * @default 3600 (1 hour)
     *
     * @example
     * ```typescript
     * // Allow 5 emails per hour
     * rateLimitMax: 5,
     * rateLimitWindow: 3600, // 1 hour
     *
     * // Allow 3 emails per 15 minutes (stricter)
     * rateLimitMax: 3,
     * rateLimitWindow: 900, // 15 minutes
     * ```
     */
    rateLimitWindow?: number;

    /**
     * Maximum verification attempts per user per time window
     * Limits how many times a user can attempt to verify their email with a code
     * @default 10
     */
    maxAttemptsPerUser?: number;

    /**
     * Maximum verification attempts per IP per time window
     * Limits how many verification attempts can be made from a single IP address
     * @default 20
     */
    maxAttemptsPerIP?: number;

    /**
     * Verification attempt rate limit window in seconds
     * The time period over which maxAttemptsPerUser and maxAttemptsPerIP apply
     * @default 3600 (1 hour)
     */
    attemptWindow?: number;
  };

  /**
   * Phone verification settings
   * Only relevant when verificationMethod is 'phone' or 'both'
   */
  phoneVerification?: {
    /**
     * OTP code length
     * @default 6
     */
    codeLength?: number;

    /**
     * Code expiry in seconds
     * @default 300 (5 minutes)
     */
    expiresIn?: number;

    /**
     * Maximum verification attempts per code
     * @default 3
     */
    maxAttempts?: number;

    /**
     * Delay between resend requests in seconds
     * Prevents users from requesting codes too frequently
     * @default 60
     */
    resendDelay?: number;

    /**
     * Maximum SMS verification codes per time window
     * Prevents SMS abuse and rate limiting
     * @default 3
     */
    rateLimitMax?: number;

    /**
     * Rate limit time window in seconds
     * The time period over which rateLimitMax applies
     * @default 3600 (1 hour)
     *
     * @example
     * ```typescript
     * // Allow 5 SMS codes per hour
     * rateLimitMax: 5,
     * rateLimitWindow: 3600, // 1 hour
     *
     * // Allow 3 SMS codes per 15 minutes (stricter)
     * rateLimitMax: 3,
     * rateLimitWindow: 900, // 15 minutes
     * ```
     */
    rateLimitWindow?: number;

    /**
     * Maximum verification attempts per user per time window
     * Limits how many times a user can attempt to verify their phone with a code
     * @default 10
     */
    maxAttemptsPerUser?: number;

    /**
     * Maximum verification attempts per IP per time window
     * Limits how many verification attempts can be made from a single IP address
     * @default 20
     */
    maxAttemptsPerIP?: number;

    /**
     * Verification attempt rate limit window in seconds
     * The time period over which maxAttemptsPerUser and maxAttemptsPerIP apply
     * @default 3600 (1 hour)
     */
    attemptWindow?: number;
  };
}

export interface LoginConfig {
  /**
   * Identifier type for login
   *
   * Controls which identifier types are accepted during login:
   * - 'email': Only email addresses accepted
   * - 'username': Only usernames accepted
   * - 'phone': Only phone numbers accepted
   * - 'email_or_username': Both email and username accepted (phone excluded)
   *
   * @default undefined (all types accepted: email, username, phone)
   *
   * @example
   * ```typescript
   * // Only allow email login
   * login: {
   *   identifierType: 'email'
   * }
   *
   * // Allow email or username (not phone)
   * login: {
   *   identifierType: 'email_or_username'
   * }
   * ```
   */
  identifierType?: 'email' | 'username' | 'phone' | 'email_or_username';
}

export interface PasswordConfig {
  /**
   * Minimum password length
   */
  minLength?: number;

  /**
   * Maximum password length
   */
  maxLength?: number;

  /**
   * Require uppercase letters
   */
  requireUppercase?: boolean;

  /**
   * Require lowercase letters
   */
  requireLowercase?: boolean;

  /**
   * Require numbers
   */
  requireNumbers?: boolean;

  /**
   * Require special characters
   */
  requireSpecialChars?: boolean;

  /**
   * Allowed special characters
   */
  specialChars?: string;

  /**
   * Prevent common passwords
   */
  preventCommon?: boolean;

  /**
   * Prevent username/email in password
   */
  preventUserInfo?: boolean;

  /**
   * Password history count (prevent reuse)
   */
  historyCount?: number;

  /**
   * Password expiry in days (0 = disabled)
   */
  expiryDays?: number;

  /**
   * Password reset (account recovery) configuration
   *
   * Controls forgot-password verification code behavior (delivery is handled by the
   * configured email/SMS providers).
   *
   * Note: Defaults are applied in service layer when not provided.
   */
  passwordReset?: {
    /**
     * Verification code length
     * @default 6
     */
    codeLength?: number;

    /**
     * Code expiry in seconds
     * @default 900 (15 minutes)
     */
    expiresIn?: number;

    /**
     * Maximum reset requests per time window
     * @default 3
     */
    rateLimitMax?: number;

    /**
     * Rate limit time window in seconds
     * @default 3600 (1 hour)
     */
    rateLimitWindow?: number;

    /**
     * Maximum code verification attempts per code
     * @default 3
     */
    maxAttempts?: number;
  };
}

export interface LockoutConfig {
  /**
   * Enable IP-based account lockout
   *
   * SECURITY: Uses IP addresses instead of user identifiers to prevent
   * attackers from locking out legitimate users by guessing their email/username.
   */
  enabled?: boolean;

  /**
   * Maximum failed login attempts per IP address
   */
  maxAttempts?: number;

  /**
   * IP lockout duration in seconds
   */
  duration?: number;

  /**
   * Reset IP counter on successful login
   */
  resetOnSuccess?: boolean;
}

export interface SessionConfig {
  /**
   * Maximum concurrent sessions per user
   */
  maxConcurrent?: number;

  /**
   * Disallow multiple concurrent sessions
   * When enabled, only one active session is allowed per user.
   * When a user logs in on a new device/session, all other sessions are automatically logged out.
   *
   * @default false
   *
   * @example
   * ```typescript
   * // Only allow one active session per user
   * session: {
   *   disallowMultipleSessions: true
   * }
   *
   * // Allow multiple sessions (default)
   * session: {
   *   disallowMultipleSessions: false
   * }
   * ```
   */
  disallowMultipleSessions?: boolean;

  /**
   * Maximum session lifetime (hard limit)
   *
   * This is the maximum duration a session can exist, regardless of refresh token activity.
   * Even if a user actively refreshes their tokens daily, after this time they must re-authenticate.
   *
   * This provides a security boundary to force periodic re-authentication, preventing
   * indefinite sessions even for very active users.
   *
   * Format: String (e.g., '30d', '7d', '90d', '5h') or number (seconds)
   * - 's' = seconds
   * - 'm' = minutes
   * - 'h' = hours
   * - 'd' = days
   *
   * @default '30d' (30 days)
   *
   * @example
   * ```typescript
   * // 30 days (default)
   * session: {
   *   maxLifetime: '30d'
   * }
   *
   * // 90 days (more lenient)
   * session: {
   *   maxLifetime: '90d'
   * }
   *
   * // 7 days (stricter)
   * session: {
   *   maxLifetime: '7d'
   * }
   *
   * // Using seconds
   * session: {
   *   maxLifetime: 2592000 // 30 days in seconds
   * }
   * ```
   */
  maxLifetime?: string | number;
}

export interface SecurityConfig {
  /**
   * CSRF Protection Configuration
   *
   * WARNING: SECURITY - CSRF protection is REQUIRED when using cookie-based token delivery
   * (tokenDelivery.method === 'cookies' or 'hybrid' with web origins).
   *
   * CSRF protection prevents Cross-Site Request Forgery attacks when tokens are stored in cookies.
   * The CSRF Guard is automatically registered when tokenDelivery.method === 'cookies' or 'hybrid'.
   * CSRF tokens are automatically generated and set as cookies on login/refresh.
   *
   * Frontend must:
   * 1. Read CSRF token from cookie (cookieName)
   * 2. Send CSRF token in request header (headerName) for state-changing requests (POST, PUT, DELETE, PATCH)
   * 3. Skip for safe methods (GET, HEAD, OPTIONS) - these don't require CSRF token
   *
   * CSRF protection is NOT required for JSON token delivery (Bearer tokens in headers are CSRF-safe).
   *
   * @example
   * ```typescript
   * // CSRF configuration (required for cookie-based token delivery)
   * security: {
   *   csrf: {
   *     cookieName: 'csrf-token',
   *     headerName: 'x-csrf-token',
   *     tokenLength: 32,
   *     excludedPaths: ['/webhook'] // Exclude webhook endpoints
   *   }
   * }
   * ```
   */
  csrf?: {
    /**
     * Name of the CSRF cookie
     *
     * If not provided, defaults to `${tokenDelivery.cookieNamePrefix || 'nauth_'}csrf_token`
     * (e.g., 'nauth_csrf_token' with default prefix).
     *
     * The prefix ensures consistency with other auth cookie names and avoids conflicts.
     *
     * @default `${tokenDelivery.cookieNamePrefix || 'nauth_'}csrf_token`
     */
    cookieName?: string;

    /**
     * Name of the CSRF header to check
     * Default: 'x-csrf-token'
     */
    headerName?: string;

    /**
     * Length of CSRF token in bytes
     * Default: 32 (256 bits)
     */
    tokenLength?: number;

    /**
     * Excluded paths (no CSRF check)
     * Useful for webhook endpoints or public APIs
     * Default: []
     *
     * @example
     * excludedPaths: ['/webhook', '/public-api']
     */
    excludedPaths?: string[];

    /**
     * Cookie options for CSRF token
     * Default: { secure: true, sameSite: 'strict' }
     *
     * Note: httpOnly is always false (hardcoded) - CSRF token must be readable by JavaScript
     */
    cookieOptions?: {
      /**
       * Secure cookies (HTTPS only)
       * Set to false for localhost development
       * @default true
       */
      secure?: boolean;
      /**
       * SameSite cookie attribute
       * - 'strict': Most secure, cookies only sent on same-site requests
       * - 'lax': Cookies sent on same-site + top-level navigation (e.g., link from Google)
       * - 'none': Cookies sent on all requests (requires secure: true)
       * @default 'strict'
       */
      sameSite?: 'strict' | 'lax' | 'none';
      /**
       * Cookie domain (for subdomain sharing)
       * @example '.dev1.noorix.com' to share across subdomains
       */
      domain?: string;
      /**
       * Cookie path
       * @default '/'
       */
      path?: string;
    };
  };
}

export interface LifecycleHooks {
  /**
   * Before signup hook
   *
   * Allows consumer applications to implement custom checks before signup proceeds
   * (e.g., denylist, invite-only signups, external validation).
   *
   * Return `false` to block signup.
   */
  beforeSignup?: (dto: unknown) => Promise<void | false>;

  /**
   * After signup hook
   */
  afterSignup?: (user: any, metadata?: { requiresVerification?: boolean }) => Promise<void>;

  /**
   * Before login hook
   *
   * Allows consumer applications to implement custom checks before login proceeds
   * (e.g., denylist, maintenance windows, external risk checks).
   *
   * Return `false` to block login.
   */
  beforeLogin?: (identifier: string) => Promise<void | false>;

  afterLogin?: (user: any, session: any) => Promise<void>;

  /**
   * After login failed hook
   */
  afterLoginFailed?: (identifier: string, reason: string) => Promise<void>;

  /**
   * Before password change hook
   */
  beforePasswordChange?: (userId: string, oldPassword: string) => Promise<void | false>;

  /**
   * After password change hook
   */
  afterPasswordChange?: (userId: string) => Promise<void>;

  /**
   * Before account lock hook
   */
  beforeAccountLock?: (userId: string, reason: string) => Promise<void | false>;

  /**
   * After account lock hook
   */
  afterAccountLock?: (userId: string, reason: string) => Promise<void>;

  /**
   * Adaptive MFA risk detected hook
   *
   * Called when adaptive MFA evaluates a login attempt and detects risk.
   * Allows consumer app to send custom notifications, log to external systems,
   * trigger security workflows, etc.
   *
   * This hook is called BEFORE the action is enforced (allow/require_mfa/block).
   * Return false to override the adaptive decision and allow sign-in.
   *
   * @param payload - Rich context about the risk event
   * @returns void to continue with configured action, false to override and allow
   *
   * @example Email notification
   * ```typescript
   * onAdaptiveMFATriggered: async (payload) => {
   *   if (payload.riskLevel === 'high') {
   *     await emailService.send({
   *       to: payload.user.email,
   *       subject: 'Suspicious sign-in attempt detected',
   *       template: 'security-alert',
   *       data: {
   *         location: `${payload.clientInfo.ipCity}, ${payload.clientInfo.ipCountry}`,
   *         device: payload.clientInfo.deviceName,
   *         time: new Date().toISOString(),
   *         riskFactors: payload.riskFactors.join(', '),
   *       }
   *     });
   *   }
   * }
   * ```
   *
   * @example Slack notification to security team
   * ```typescript
   * onAdaptiveMFATriggered: async (payload) => {
   *   if (payload.action === 'block_signin') {
   *     await slackService.postMessage({
   *       channel: '#security-alerts',
   *       text: `High-risk sign-in blocked for ${payload.user.email}`,
   *       attachments: [{
   *         fields: [
   *           { title: 'Risk Score', value: payload.riskScore.toString() },
   *           { title: 'Risk Factors', value: payload.riskFactors.join(', ') },
   *           { title: 'Location', value: payload.clientInfo.ipCountry },
   *         ]
   *       }]
   *     });
   *   }
   * }
   * ```
   *
   * @example Custom workflow with admin review
   * ```typescript
   * onAdaptiveMFATriggered: async (payload) => {
   *   if (payload.riskScore > 80) {
   *     // Create security review ticket
   *     await securityReviewService.createTicket({
   *       userId: payload.user.sub,
   *       riskScore: payload.riskScore,
   *       riskFactors: payload.riskFactors,
   *       requiresManualReview: true,
   *     });
   *
   *     // Send push notification to admins
   *     await adminNotificationService.alert({
   *       type: 'high_risk_signin',
   *       userId: payload.user.sub,
   *     });
   *   }
   * }
   * ```
   */
  onAdaptiveMFATriggered?: (payload: AdaptiveMFARiskEventPayload) => Promise<void | false>;

  /**
   * Sign-in blocked hook
   *
   * Called when a sign-in is blocked due to high risk.
   * Allows consumer app to implement custom blocking workflows,
   * manual review processes, or admin notifications.
   *
   * @param payload - Context about the blocked sign-in
   *
   * @example Create manual review case
   * ```typescript
   * onSignInBlocked: async (payload) => {
   *   await adminDashboardService.createReviewCase({
   *     userId: payload.user.sub,
   *     reason: 'High-risk adaptive MFA',
   *     riskScore: payload.riskScore,
   *     requiresAction: true,
   *   });
   * }
   * ```
   */
  onSignInBlocked?: (payload: SignInBlockedPayload) => Promise<void>;
}

/**
 * Email Verification Configuration
 */
export interface EmailConfig {
  /**
   * Application name (used in email templates)
   *
   * @example 'My Application'
   */
  appName?: string;

  /**
   * Company name (used in email footer)
   *
   * @example 'My Company Inc.'
   */
  companyName?: string;

  /**
   * Logo URL for email templates
   *
   * @example 'https://example.com/logo.png'
   */
  logoUrl?: string;

  /**
   * Support email address (displayed in email footer)
   *
   * @example 'support@example.com'
   */
  supportEmail?: string;

  /**
   * Dashboard URL (used in welcome emails)
   *
   * @example 'https://app.example.com/dashboard'
   */
  dashboardUrl?: string;

  /**
   * Brand color (hex code, used in email templates)
   *
   * @example '#4f46e5'
   */
  brandColor?: string;

  /**
   * Custom footer disclaimer text
   *
   * If not provided, uses default professional disclaimer.
   *
   * @example 'This email is confidential. Unsubscribe at any time.'
   */
  footerDisclaimer?: string;

  /**
   * Template configuration for email notifications
   *
   * Configure custom email templates and global variables for branding.
   * Templates are validated at startup to ensure required parameters are present.
   *
   * Note: Top-level branding fields (appName, companyName, logoUrl, etc.) are automatically
   * merged into templates.globalVariables. You can override them in globalVariables if needed.
   *
   * @example Basic configuration with top-level branding
   * ```typescript
   * email: {
   *   appName: process.env.APP_NAME || 'My Application',
   *   companyName: process.env.COMPANY_NAME || 'My Company Inc.',
   *   supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
   *   brandColor: '#4f46e5',
   *   logoUrl: 'https://example.com/logo.png'
   * }
   * ```
   *
   * @example Advanced configuration with global variables
   * ```typescript
   * email: {
   *   appName: 'My App',
   *   companyName: 'My Company',
   *   templates: {
   *     globalVariables: {
   *       // These override top-level values if both are provided
   *       appName: 'Custom App Name',
   *       customVar: 'Custom value'
   *     }
   *   }
   * }
   * ```
   *
   * @example Custom templates with file paths
   * ```typescript
   * email: {
   *   templates: {
   *     globalVariables: {
   *       appName: 'My App',
   *       supportEmail: 'support@myapp.com'
   *     },
   *     customTemplates: {
   *       verification: {
   *         htmlPath: './email-templates/verification.html.hbs',
   *         textPath: './email-templates/verification.text.hbs'
   *         // Must include: {{code}}, {{link}}, {{expiryMinutes}}
   *       },
   *       welcome: {
   *         htmlPath: './email-templates/welcome.html.hbs'
   *         // No required params
   *       }
   *     }
   *   }
   * }
   * ```
   *
   * @example Custom templates with inline content
   * ```typescript
   * email: {
   *   templates: {
   *     globalVariables: { appName: 'My App' },
   *     customTemplates: {
   *       welcome: {
   *         subject: 'Welcome to {{appName}}!',
   *         html: `
   *           <h1>Hello {{firstName}}!</h1>
   *           <p>Welcome to {{appName}}!</p>
   *         `,
   *         text: 'Hello {{firstName}}! Welcome to {{appName}}!'
   *       }
   *     }
   *   }
   * }
   * ```
   */
  templates?: import('../interfaces/template.interface').TemplateConfig;
}

/**
 * Phone Configuration
 *
 * Note: Phone verification settings have been moved to signup.phoneVerification
 * This type is kept for backwards compatibility but is now empty
 */
export type PhoneConfig = Record<string, never>;

/**
 * Social Login Configuration
 * Configure OAuth providers for social authentication
 */
export interface SocialConfig {
  /**
   * Google OAuth configuration
   */
  google?: SocialProviderConfig;

  /**
   * Apple OAuth configuration
   */
  apple?: SocialProviderConfig;

  /**
   * Facebook OAuth configuration
   */
  facebook?: SocialProviderConfig;

  /**
   * Redirect-first social login configuration (web)
   *
   * Used by framework adapters (e.g., NestJS) to perform backend-owned redirects:
   * - Start: backend redirects to provider
   * - Callback: backend sets cookies (or issues exchange token) and redirects to frontend
   */
  redirect?: SocialRedirectConfig;
}

/**
 * Social redirect configuration
 *
 * Defines how the backend should redirect back to the frontend after completing OAuth.
 *
 * Security:
 * - Prefer relative `returnTo` paths only
 * - If allowing absolute `returnTo`, enforce an origin allowlist to prevent open redirects
 */
export interface SocialRedirectConfig {
  /**
   * Frontend base URL used to resolve relative return paths.
   *
   * @example
   * ```typescript
   * frontendBaseUrl: 'https://app.example.com'
   * ```
   */
  frontendBaseUrl: string;

  /**
   * Whether absolute returnTo URLs are allowed.
   *
   * Default: false (relative-only).
   */
  allowAbsoluteReturnTo?: boolean;

  /**
   * Allowlist of origins permitted when allowAbsoluteReturnTo is true.
   *
   * @example
   * ```typescript
   * allowedReturnToOrigins: ['https://app.example.com', 'https://admin.example.com']
   * ```
   */
  allowedReturnToOrigins?: string[];
}

/**
 * Individual social provider configuration
 */
export interface SocialProviderConfig {
  /**
   * Enable this provider
   * @default false
   */
  enabled?: boolean;

  /**
   * OAuth client ID from the provider
   * Can be a single string or an array for multiple platforms (web, iOS, Android)
   * Required if enabled
   *
   * @example
   * Single client ID:
   * clientId: '12345.apps.googleusercontent.com'
   *
   * Multiple client IDs (mobile + web):
   * clientId: [
   *   '12345-web.apps.googleusercontent.com',     // Web
   *   '12345-ios.apps.googleusercontent.com',     // iOS
   *   '12345-android.apps.googleusercontent.com'  // Android
   * ]
   */
  clientId?: string | string[];

  /**
   * OAuth client secret from the provider
   * Required if enabled
   */
  clientSecret?: string;

  /**
   * OAuth callback URL
   * Must match the URL registered with the provider
   *
   * @example
   * 'https://myapp.com/auth/google/callback'
   */
  callbackUrl?: string;

  /**
   * OAuth scopes to request
   * Provider-specific scopes for accessing user data
   *
   * @default ['openid', 'email', 'profile']
   */
  scopes?: string[];

  /**
   * Auto-link social accounts to existing users by verified email
   * If true, when a user signs in with social provider and their email
   * matches an existing verified user, the accounts will be automatically linked
   *
   * @default true
   */
  autoLink?: boolean;

  /**
   * Allow creating new users via social signup
   * If false, only existing users can link their social accounts
   *
   * @default true
   */
  allowSignup?: boolean;
}

/**
 * Multi-Factor Authentication (MFA) Configuration
 *
 * Configure MFA enforcement and allowed methods for your application.
 * Supports TOTP (authenticator apps), SMS, Email, and Passkeys (WebAuthn).
 */
export interface MFAConfig {
  /**
   * Enable MFA system
   * @default false
   */
  enabled?: boolean;

  /**
   * MFA enforcement policy
   *
   * - 'OPTIONAL': Users can choose to enable MFA (default)
   * - 'REQUIRED': All users must enable MFA within grace period
   * - 'ADAPTIVE': MFA required based on risk factors (future: conditional triggers)
   *
   * @default 'OPTIONAL'
   */
  enforcement?: 'OPTIONAL' | 'REQUIRED' | 'ADAPTIVE';

  /**
   * Grace period in days before MFA enforcement applies
   * Only relevant when enforcement is 'REQUIRED'
   * Users can login without MFA during this period
   *
   * @default 7
   */
  gracePeriod?: number;

  /**
   * Allowed MFA methods
   * Users can register any of these methods
   *
   * - 'totp': Time-based One-Time Password (Google Authenticator, Authy, etc.)
   * - 'sms': SMS verification codes
   * - 'email': Email verification codes
   * - 'passkey': WebAuthn/FIDO2 passkeys (biometric, security keys)
   *
   * @default [MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY]
   */
  allowedMethods?: Array<MFADeviceMethod>;

  /**
   * Require MFA for social login
   *
   * Controls whether MFA is required when users authenticate via
   * social providers (Google, Apple, Facebook).
   *
   * - false: Skip MFA entirely for social login (default - common industry practice)
   *   Social users will NOT be required to setup or verify MFA.
   *   Rationale: Social providers already have strong authentication (often with 2FA),
   *   and OAuth flow itself provides security layer. Better UX with fewer steps.
   *
   * - true: Require MFA for social login (higher security)
   *   Social users will be required to setup and verify MFA just like password users.
   *   Rationale: Defense-in-depth. Even if social account is compromised,
   *   attacker cannot access your app without MFA.
   *
   * @default false
   *
   * @example
   * ```typescript
   * // Skip MFA entirely for social login (default - common practice)
   * mfa: {
   *   requireForSocialLogin: false
   * }
   *
   * // Require MFA for all logins including social (higher security)
   * mfa: {
   *   requireForSocialLogin: true
   * }
   * ```
   */
  requireForSocialLogin?: boolean;

  /**
   * Trusted device behavior
   *
   * Controls how devices are marked as trusted for MFA bypass:
   * - 'never': No trusted device feature (default - most secure)
   * - 'always': Automatically trust devices after successful login (no user interaction)
   * - 'user_opt_in': User must explicitly opt-in via API call after login
   *
   * When a device is trusted:
   * - Device token is stored as httpOnly cookie (web) or returned in response (mobile)
   * - Device token persists across logouts and session expiry
   * - Device token is independent of refresh token lifecycle
   * - Trusted devices can skip MFA (if bypassMFAForTrustedDevices is enabled)
   *
   * @default 'never'
   *
   * @example
   * ```typescript
   * // Always trust devices automatically (best UX)
   * mfa: {
   *   rememberDevices: 'always',
   *   rememberDeviceDays: 30,
   *   bypassMFAForTrustedDevices: true
   * }
   *
   * // User opt-in (user controls trust)
   * mfa: {
   *   rememberDevices: 'user_opt_in',
   *   rememberDeviceDays: 30,
   *   bypassMFAForTrustedDevices: true
   * }
   * ```
   */
  rememberDevices?: 'always' | 'user_opt_in' | 'never';

  /**
   * Days to remember trusted devices
   * Only relevant if rememberDevices is not 'never'
   *
   * @default 30
   */
  rememberDeviceDays?: number;

  /**
   * Bypass MFA verification for trusted devices
   *
   * When true, trusted devices can skip MFA verification.
   * This only applies when rememberDevices is not 'never' and device is marked as trusted.
   *
   * Note: Does NOT apply to ADAPTIVE enforcement mode, which follows its own risk-based logic.
   *
   * Security considerations:
   * - Default false: Require MFA even for trusted devices (more secure)
   * - true: Skip MFA for trusted devices (better UX, lower security)
   * - Recommended: Set to false for high-security applications
   *
   * @default false
   */
  bypassMFAForTrustedDevices?: boolean;

  /**
   * Issuer name for TOTP QR codes
   * Displayed in authenticator apps
   *
   * @default 'nauth-toolkit'
   */
  issuer?: string;

  /**
   * TOTP-specific configuration
   */
  totp?: TOTPConfig;

  /**
   * Passkey/WebAuthn-specific configuration
   */
  passkey?: PasskeyConfig;

  /**
   * Backup codes configuration
   * Recovery codes for when users lose access to their MFA devices
   */
  backup?: BackupCodesConfig;

  /**
   * Adaptive MFA configuration (future: conditional MFA based on risk)
   * NOTE: PLACEHOLDER - Full implementation in future phase
   */
  adaptive?: AdaptiveMFAConfig;
}

/**
 * TOTP (Time-based One-Time Password) Configuration
 * Used for authenticator apps like Google Authenticator, Authy, 1Password
 */
export interface TOTPConfig {
  /**
   * Time window for TOTP validation
   * Number of steps to check before/after current time
   * Higher values are more lenient but less secure
   *
   * @default 1 (checks current + 1 step before/after = 3 total)
   */
  window?: number;

  /**
   * Time step in seconds
   * Standard TOTP uses 30 seconds
   *
   * @default 30
   */
  stepSeconds?: number;

  /**
   * Number of digits in generated code
   *
   * @default 6
   */
  digits?: number;

  /**
   * Hash algorithm for TOTP
   *
   * @default 'sha1' (most compatible with authenticator apps)
   */
  algorithm?: 'sha1' | 'sha256' | 'sha512';
}

/**
 * Passkey/WebAuthn Configuration
 * Used for biometric authentication and hardware security keys
 */
export interface PasskeyConfig {
  /**
   * Relying Party name (displayed during passkey creation)
   * Should be your application name
   *
   * @example 'MyApp', 'Acme Corporation'
   */
  rpName: string;

  /**
   * Relying Party ID (domain without protocol/port)
   * Must match the domain serving your application
   *
   * @example 'myapp.com', 'example.com'
   */
  rpId: string;

  /**
   * Expected origin for WebAuthn operations
   * Must include protocol and optionally port
   *
   * @example 'https://myapp.com', 'http://localhost:3000'
   */
  origin?: string | string[];

  /**
   * Timeout for passkey operations in milliseconds
   *
   * @default 60000 (60 seconds)
   */
  timeout?: number;

  /**
   * Require user verification (biometric/PIN)
   * 'required' | 'preferred' | 'discouraged'
   *
   * @default 'preferred'
   */
  userVerification?: 'required' | 'preferred' | 'discouraged';

  /**
   * Authenticator attachment preference
   * - 'platform': Built-in authenticators (Touch ID, Face ID, Windows Hello)
   * - 'cross-platform': Removable authenticators (USB security keys)
   *
   * @default undefined (allow both)
   */
  authenticatorAttachment?: 'platform' | 'cross-platform';
}

/**
 * Backup/Recovery Codes Configuration
 * Single-use codes for account recovery when MFA devices are unavailable
 */
export interface BackupCodesConfig {
  /**
   * Enable backup codes
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * Number of backup codes to generate
   *
   * @default 10
   */
  codeCount?: number;

  /**
   * Length of each backup code (characters)
   *
   * @default 8
   */
  codeLength?: number;
}

/**
 * Adaptive MFA Configuration
 *
 * Configures risk-based authentication that evaluates login context
 * (device, IP, location) against user history to determine MFA requirements.
 *
 * Risk levels are evaluated in order: low → medium → high.
 * Each level can have different actions (allow, require_mfa, block_signin).
 *
 * @example
 * ```typescript
 * adaptive: {
 *   triggers: ['new_device', 'new_ip', 'new_country'],
 *   riskLevels: {
 *     low: { maxScore: 20, action: 'allow', notifyUser: false },
 *     medium: { maxScore: 50, action: 'require_mfa', notifyUser: true },
 *     high: { maxScore: 100, action: 'block_signin', notifyUser: true }
 *   },
 *   blockedSignIn: {
 *     blockDuration: 60, // minutes
 *     message: 'Sign-in blocked due to suspicious activity'
 *   }
 * }
 * ```
 */
export interface AdaptiveMFAConfig {
  /**
   * Risk factors that trigger MFA requirement
   *
   * Triggers that are evaluated during authentication:
   * - 'new_device': First login from unknown device
   * - 'new_ip': Login from new IP address
   * - 'new_country': Login from different country
   * - 'impossible_travel': Geographic distance/time anomaly
   * - 'suspicious_activity': Unusual behavior patterns
   * - 'recent_password_reset': Password was reset/changed after last successful login
   *
   * @default ['new_device', 'new_ip', 'new_country']
   */
  triggers?: Array<
    'new_device' | 'new_ip' | 'new_country' | 'impossible_travel' | 'suspicious_activity' | 'recent_password_reset'
  >;

  /**
   * Risk score threshold (0-100) to require MFA
   *
   * @default 50
   */
  riskThreshold?: number;

  /**
   * Custom risk factor weights (overrides defaults)
   *
   * Default weights:
   * - new_device: 25
   * - new_ip: 15
   * - new_country: 25
   * - impossible_travel: 40
   * - suspicious_activity: 30
   * - incomplete_location_data: 20
   *
   * @example
   * ```typescript
   * riskWeights: {
   *   new_device: 25,
   *   new_country: 30,
   *   incomplete_location_data: 25
   * }
   * ```
   */
  riskWeights?: Record<string, number>;

  /**
   * Risk level thresholds and actions
   *
   * Defines score ranges and what action to take at each level.
   * Scores are evaluated in order: low → medium → high.
   *
   * @default
   * ```typescript
   * {
   *   low: { maxScore: 20, action: 'allow', notifyUser: false },
   *   medium: { maxScore: 50, action: 'require_mfa', notifyUser: true },
   *   high: { maxScore: 100, action: 'require_mfa', notifyUser: true }
   * }
   * ```
   *
   * @example High-security configuration
   * ```typescript
   * riskLevels: {
   *   low: { maxScore: 20, action: 'allow', notifyUser: false },
   *   medium: { maxScore: 50, action: 'require_mfa', notifyUser: true },
   *   high: { maxScore: 100, action: 'block_signin', notifyUser: true }
   * }
   * ```
   */
  riskLevels?: {
    low?: RiskLevelConfig;
    medium?: RiskLevelConfig;
    high?: RiskLevelConfig;
  };

  /**
   * Blocked sign-in behavior
   *
   * Configuration for when high-risk sign-ins are blocked.
   */
  blockedSignIn?: {
    /**
     * Duration (in minutes) to block user before allowing retry
     * If not set, block is permanent until manual review
     *
     * @default undefined (permanent until manual review)
     */
    blockDuration?: number;

    /**
     * Custom message to show user when blocked
     *
     * @default 'Sign-in blocked due to suspicious activity. Please contact support.'
     */
    message?: string;

    /**
     * Error code to return when blocked
     *
     * @default 'SIGNIN_BLOCKED_HIGH_RISK'
     */
    errorCode?: string;
  };

  /**
   * Maximum realistic travel speed in km/h for impossible travel detection
   *
   * Used to determine if geographic distance between two locations
   * is impossible given the time elapsed.
   *
   * @default 900 (commercial airliner speed)
   */
  maxTravelSpeed?: number;

  /**
   * Minimum time (hours) required between country changes when city data is missing
   *
   * Conservative threshold for detecting suspicious country changes when
   * MaxMind doesn't provide city-level data. If countries differ and either
   * city is unknown, flag as suspicious if time < threshold.
   *
   * @default 2 (2 hours minimum between country changes)
   *
   * @example
   * ```typescript
   * countryChangeThreshold: 3 // Require 3 hours minimum between country changes
   * ```
   */
  countryChangeThreshold?: number;

  /**
   * Time window (hours) to check for suspicious activity
   *
   * How far back to look for suspicious audit events (failed logins,
   * token reuse, etc.) when evaluating risk.
   *
   * @default 1 (1 hour)
   */
  suspiciousActivityWindow?: number;
}

/**
 * Risk level configuration
 *
 * Defines behavior for a specific risk level (low, medium, high).
 *
 * @example
 * ```typescript
 * {
 *   maxScore: 50,
 *   action: 'require_mfa',
 *   notifyUser: true
 * }
 * ```
 */
export interface RiskLevelConfig {
  /**
   * Maximum risk score for this level (0-100)
   *
   * Scores are evaluated in order: low → medium → high.
   * Example: If low.maxScore = 20 and medium.maxScore = 50:
   * - Score 0-20: low
   * - Score 21-50: medium
   * - Score 51-100: high
   */
  maxScore: number;

  /**
   * Action to take when risk score falls in this level
   *
   * - 'allow': Allow sign-in without MFA (normal flow)
   * - 'require_mfa': Require MFA verification before allowing sign-in
   * - 'block_signin': Block sign-in entirely (return error)
   *
   * @default 'allow' for low, 'require_mfa' for medium/high
   */
  action?: 'allow' | 'require_mfa' | 'block_signin';

  /**
   * Whether to notify user of this risk event
   *
   * Triggers onAdaptiveMFATriggered lifecycle hook when true.
   *
   * @default false for low, true for medium/high
   */
  notifyUser?: boolean;
}

/**
 * Adaptive MFA risk event payload
 *
 * Rich context provided to lifecycle hooks when adaptive MFA evaluates
 * a login attempt and detects risk factors.
 *
 * @example
 * ```typescript
 * onAdaptiveMFATriggered: async (payload) => {
 *   console.log(`Risk score: ${payload.riskScore}`);
 *   console.log(`Risk factors: ${payload.riskFactors.join(', ')}`);
 *   console.log(`Action: ${payload.action}`);
 * }
 * ```
 */
export interface AdaptiveMFARiskEventPayload {
  /**
   * User being authenticated
   */
  user: {
    sub: string;
    email: string;
    username?: string;
    phoneNumber?: string;
  };

  /**
   * Risk assessment results
   */
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];

  /**
   * Action that will be taken
   */
  action: 'allow' | 'require_mfa' | 'block_signin';

  /**
   * Client context (IP, device, location, etc.)
   */
  clientInfo: {
    ipAddress?: string;
    ipCountry?: string;
    ipCity?: string;
    deviceId?: string;
    deviceName?: string;
    deviceType?: string;
    userAgent?: string;
    platform?: string;
    browser?: string;
  };

  /**
   * Authentication context
   */
  authMethod: string; // 'password', 'google', 'apple', etc.

  /**
   * Timestamp of the event
   */
  timestamp: Date;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Sign-in blocked event payload
 *
 * Extended payload for when a sign-in is blocked due to high risk.
 * Includes blocking details (duration, expiration, message).
 */
export interface SignInBlockedPayload extends AdaptiveMFARiskEventPayload {
  /**
   * Block duration (in minutes) if temporary, undefined if permanent
   */
  blockDuration?: number;

  /**
   * When the block will expire (if temporary)
   */
  blockExpiresAt?: Date;

  /**
   * Message shown to user
   */
  message: string;
}

/**
 * Token Delivery Configuration
 *
 * Controls how JWT tokens are delivered to clients across different
 * transports. Defaults to 'json' to remain protocol-agnostic.
 */
export interface TokenDeliveryConfig {
  /**
   * Delivery method for tokens
   * - 'json': Response body only (default)
   * - 'cookies': httpOnly cookies only (browser web apps)
   * - 'hybrid': Cookies first (web), then Authorization header (mobile)
   *
   * @default 'json'
   */
  method?: 'json' | 'cookies' | 'hybrid';

  /**
   * Cookie name prefix for all authentication cookies
   *
   * All cookie names are prefixed with this value to avoid conflicts with other cookies.
   * Default: 'nauth_'
   *
   * Cookie names generated:
   * - `${prefix}access_token` (default: 'nauth_access_token')
   * - `${prefix}refresh_token` (default: 'nauth_refresh_token')
   * - CSRF cookie name is also prefixed (configured via security.csrf.cookieName)
   *
   * @default 'nauth_'
   *
   * @example
   * ```typescript
   * // Custom prefix
   * cookieNamePrefix: 'myapp_'
   * // Results in: 'myapp_access_token', 'myapp_refresh_token'
   * ```
   */
  cookieNamePrefix?: string;

  /**
   * Advanced cookie options (rarely needed)
   *
   * Smart defaults:
   * - Names: 'nauth_access_token', 'nauth_refresh_token' (prefixed by cookieNamePrefix)
   * - httpOnly: true (always)
   * - secure: true (configurable below for localhost/dev)
   * - sameSite: 'strict' (configurable below)
   * - path: '/' (configurable below)
   */
  cookieOptions?: {
    /**
     * Use secure cookies (HTTPS only)
     * @default true
     */
    secure?: boolean;

    /**
     * SameSite cookie attribute
     * @default 'strict'
     */
    sameSite?: 'strict' | 'lax' | 'none';

    /**
     * Cookie path
     * @default '/'
     */
    path?: string;

    /**
     * Cookie domain (for subdomain sharing)
     * @example '.myapp.com'
     */
    domain?: string;
  };

  /**
   * Strict hybrid policy (origin-based) used when method === 'hybrid'.
   * webOrigins → cookies; nativeOrigins → json
   */
  hybridPolicy?: {
    webOrigins?: string[];
    nativeOrigins?: string[];
  };
}

/**
 * Challenge Configuration
 *
 * Controls challenge session behavior for authentication challenges
 * (email verification, phone verification, MFA challenges, etc.)
 */
export interface ChallengeConfig {
  /**
   * Maximum allowed attempts per challenge session
   *
   * Users get this many attempts before the challenge session is invalidated.
   * The (maxAttempts + 1)th failure will cause "Maximum challenge attempts exceeded" error.
   *
   * @default 3
   *
   * @example
   * ```typescript
   * challenge: {
   *   maxAttempts: 3 // User gets 3 attempts, 4th failure causes error
   * }
   * ```
   */
  maxAttempts?: number;
}

/**
 * Geolocation configuration
 *
 * Configures IP geolocation using MaxMind GeoIP2 database files.
 * Platform-agnostic - works on all platforms where Node.js runs.
 *
 * @example
 * ```typescript
 * geoLocation: {
 *   maxMind: {
 *     licenseKey: process.env.MAXMIND_LICENSE_KEY, // Your env var name
 *     accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0'),
 *     // dbPath not set = uses system temp directory
 *   }
 * }
 * ```
 */
export interface GeoLocationConfig {
  /**
   * MaxMind GeoIP2 configuration
   */
  maxMind?: {
    /**
     * Directory path where MaxMind .mmdb files are stored or should be downloaded
     *
     * **Usage Modes:**
     * 1. **Auto-download mode**: Point to directory, toolkit downloads files
     * 2. **External management mode**: Point to directory with existing files, toolkit uses them
     * 3. **Default**: System temp directory (ephemeral, cleared on reboot)
     *
     * **Examples:**
     *
     * Auto-download to custom path:
     * ```typescript
     * maxMind: {
     *   dbPath: '/app/data/maxmind',
     *   licenseKey: '...',
     *   accountId: 123,
     *   autoDownloadOnStartup: true
     * }
     * ```
     *
     * Use existing files (consumer manages downloads):
     * ```typescript
     * maxMind: {
     *   dbPath: '/app/data/maxmind',
     *   // No licenseKey/accountId needed - toolkit just loads existing files
     *   skipDownloads: true // Disable all download functionality
     * }
     * ```
     *
     * Default temp directory (auto-download):
     * ```typescript
     * maxMind: {
     *   licenseKey: '...',
     *   accountId: 123
     *   // dbPath defaults to os.tmpdir() + '/nauth_maxmind'
     * }
     * ```
     *
     * Works on all platforms (Mac, Linux, Windows, Docker, serverless).
     */
    dbPath?: string;

    /**
     * Skip all database downloads (consumer manages updates externally)
     *
     * If true, toolkit will only load existing .mmdb files from dbPath.
     * Useful when:
     * - Using MaxMind's geoipupdate tool
     * - Managing downloads via external cron jobs
     * - Databases are pre-installed in containers
     * - Databases come from shared volumes/NFS
     *
     * When true, licenseKey and accountId are not required.
     * Service will log a warning if no database files are found.
     *
     * @default false
     */
    skipDownloads?: boolean;

    /**
     * MaxMind license key (required for downloading databases, not needed if skipDownloads is true)
     */
    licenseKey?: string;

    /**
     * MaxMind account ID (required for downloading databases, not needed if skipDownloads is true)
     */
    accountId?: number;

    /**
     * Auto-download on startup if files don't exist
     * Default: false
     *
     * WARNING: Only enable if using distributed storage adapter (Redis/Database)
     * to prevent concurrent downloads in multi-server deployments.
     *
     * Ignored if skipDownloads is true.
     */
    autoDownloadOnStartup?: boolean;

    /**
     * Edition IDs to download
     * Default: ['GeoLite2-City', 'GeoLite2-Country']
     *
     * Ignored if skipDownloads is true.
     */
    editions?: string[];
  };
}
