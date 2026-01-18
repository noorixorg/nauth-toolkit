/**
 * Admin user creation request
 *
 * Allows administrators to create user accounts with override capabilities:
 * - Bypass email/phone verification requirements
 * - Force password change on first login
 * - Auto-generate secure passwords
 *
 * @example
 * ```typescript
 * // Create user with pre-verified email
 * const request: AdminSignupRequest = {
 *   email: 'user@example.com',
 *   password: 'SecurePass123!',
 *   isEmailVerified: true,
 *   mustChangePassword: false,
 * };
 *
 * // Create user with auto-generated password
 * const request: AdminSignupRequest = {
 *   email: 'user@example.com',
 *   generatePassword: true,
 *   isEmailVerified: true,
 *   mustChangePassword: true,
 * };
 * ```
 */
export interface AdminSignupRequest {
  /**
   * User email address
   */
  email: string;

  /**
   * User password
   * Required unless generatePassword is true
   */
  password?: string;

  /**
   * Optional username
   */
  username?: string;

  /**
   * Optional first name
   */
  firstName?: string;

  /**
   * Optional last name
   */
  lastName?: string;

  /**
   * Optional phone number (E.164 format)
   */
  phone?: string;

  /**
   * Optional metadata (custom fields)
   */
  metadata?: Record<string, unknown>;

  /**
   * Bypass email verification requirement
   * Default: false
   */
  isEmailVerified?: boolean;

  /**
   * Bypass phone verification requirement
   * Default: false
   */
  isPhoneVerified?: boolean;

  /**
   * Force password change on first login
   * Default: false
   */
  mustChangePassword?: boolean;

  /**
   * Auto-generate secure password
   * Default: false
   */
  generatePassword?: boolean;
}

import type { AuthUser } from './user.types';

/**
 * Admin user creation response
 *
 * Returns the created user object (sanitized, excludes sensitive fields like passwordHash)
 * and optionally the generated password (only if generatePassword was true in the request).
 */
export interface AdminSignupResponse {
  /**
   * Created user object (same structure as AuthUser)
   */
  user: AuthUser;

  /**
   * Generated password (only present if generatePassword was true)
   * Security: This is returned once and never stored in plain text.
   */
  generatedPassword?: string;
}

/**
 * Admin social user import request
 *
 * Allows administrators to import existing social users from external platforms
 * (e.g., Cognito, Auth0) with social account linkage.
 *
 * @example
 * ```typescript
 * // Import social-only user from Cognito
 * const request: AdminSignupSocialRequest = {
 *   email: 'user@example.com',
 *   provider: 'google',
 *   providerId: 'google_12345',
 *   providerEmail: 'user@gmail.com',
 *   socialMetadata: { sub: 'google_12345', given_name: 'John' },
 * };
 *
 * // Import hybrid user with password + social
 * const request: AdminSignupSocialRequest = {
 *   email: 'user@example.com',
 *   password: 'SecurePass123!',
 *   provider: 'apple',
 *   providerId: 'apple_67890',
 * };
 * ```
 */
export interface AdminSignupSocialRequest {
  /**
   * User email address
   */
  email: string;

  /**
   * Social provider name
   */
  provider: 'google' | 'apple' | 'facebook';

  /**
   * Provider's unique user identifier
   */
  providerId: string;

  /**
   * Provider's email address (optional)
   */
  providerEmail?: string;

  /**
   * Optional username
   */
  username?: string;

  /**
   * Optional first name
   */
  firstName?: string;

  /**
   * Optional last name
   */
  lastName?: string;

  /**
   * Optional phone number (E.164 format)
   */
  phone?: string;

  /**
   * Optional password for hybrid social+password accounts
   */
  password?: string;

  /**
   * Bypass phone verification requirement
   * Default: false
   */
  isPhoneVerified?: boolean;

  /**
   * Force password change on first login
   * Default: false
   */
  mustChangePassword?: boolean;

  /**
   * Raw OAuth profile data from provider
   */
  socialMetadata?: Record<string, unknown>;

  /**
   * Optional metadata (custom fields)
   */
  metadata?: Record<string, unknown>;
}

/**
 * Admin social user import response
 *
 * Returns the created user object and social account information for confirmation.
 */
export interface AdminSignupSocialResponse {
  /**
   * Created user object (same structure as AuthUser)
   */
  user: AuthUser;

  /**
   * Social account information
   */
  socialAccount: {
    /**
     * Social provider name
     */
    provider: string;

    /**
     * Provider's unique user identifier
     */
    providerId: string;

    /**
     * Provider's email address (if available)
     */
    providerEmail: string | null;
  };
}


/**
 * Date filter with operator support
 *
 * Supports gt (greater than), gte (greater than or equal), lt (less than),
 * lte (less than or equal), eq (equal) operators for date comparisons.
 */
export interface DateFilter {
  /**
   * Comparison operator
   */
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

  /**
   * Date value to compare against
   */
  value: Date | string;
}

/**
 * Get users request with filters
 *
 * Supports pagination, boolean filters, exact match filters,
 * date filters with operators, and flexible sorting.
 *
 * @example
 * ```typescript
 * const request: GetUsersRequest = {
 *   page: 1,
 *   limit: 20,
 *   isEmailVerified: true,
 *   hasSocialAuth: true,
 *   createdAt: { operator: 'gte', value: new Date('2024-01-01') },
 *   sortBy: 'email',
 *   sortOrder: 'ASC',
 * };
 * ```
 */
export interface GetUsersRequest {
  /**
   * Page number (1-indexed)
   * Default: 1
   */
  page?: number;

  /**
   * Number of records per page
   * Default: 10, Max: 100
   */
  limit?: number;

  /**
   * Filter by email address (partial match)
   */
  email?: string;

  /**
   * Filter by phone number (partial match)
   */
  phone?: string;

  /**
   * Filter by email verification status
   */
  isEmailVerified?: boolean;

  /**
   * Filter by phone verification status
   */
  isPhoneVerified?: boolean;

  /**
   * Filter by social auth presence
   */
  hasSocialAuth?: boolean;

  /**
   * Filter by account lock status
   */
  isLocked?: boolean;

  /**
   * Filter by MFA enabled status
   */
  mfaEnabled?: boolean;

  /**
   * Filter by account creation date
   */
  createdAt?: DateFilter;

  /**
   * Filter by last update date
   */
  updatedAt?: DateFilter;

  /**
   * Field to sort by
   * Default: createdAt
   */
  sortBy?: 'email' | 'createdAt' | 'updatedAt' | 'username' | 'phone';

  /**
   * Sort order
   * Default: DESC
   */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Get users response with pagination
 *
 * Uses AuthUser type - admin endpoints return the same sanitized user object as user endpoints.
 */
export interface GetUsersResponse {
  /**
   * Array of sanitized user objects (same as AuthUser)
   */
  users: AuthUser[];

  /**
   * Pagination metadata
   */
  pagination: {
    /**
     * Current page number
     */
    page: number;

    /**
     * Number of records per page
     */
    limit: number;

    /**
     * Total number of records matching the query
     */
    total: number;

    /**
     * Total number of pages
     */
    totalPages: number;
  };
}

/**
 * Delete user response
 *
 * Returns deletion confirmation with cascade cleanup information.
 */
export interface DeleteUserResponse {
  /**
   * Success indicator
   */
  success: boolean;

  /**
   * Deleted user ID
   */
  deletedUserId: string;

  /**
   * Number of related records deleted
   */
  deletedRecords: {
    /**
     * Number of sessions deleted
     */
    sessions: number;

    /**
     * Number of verification tokens deleted
     */
    verificationTokens: number;

    /**
     * Number of MFA devices deleted
     */
    mfaDevices: number;

    /**
     * Number of trusted devices deleted
     */
    trustedDevices: number;

    /**
     * Number of social accounts deleted
     */
    socialAccounts: number;

    /**
     * Number of login attempts deleted
     */
    loginAttempts: number;

    /**
     * Number of challenge sessions deleted
     */
    challengeSessions: number;

    /**
     * Number of audit logs deleted
     */
    auditLogs: number;
  };
}

/**
 * Disable user response
 *
 * Returns disable confirmation with updated user and revoked session count.
 */
export interface DisableUserResponse {
  /**
   * Success indicator
   */
  success: boolean;

  /**
   * Updated user object (same as AuthUser)
   */
  user: AuthUser;

  /**
   * Number of sessions revoked
   */
  revokedSessions: number;
}

/**
 * Enable user response
 *
 * Returns enable confirmation with updated user.
 */
export interface EnableUserResponse {
  /**
   * Success indicator
   */
  success: boolean;

  /**
   * Updated user object (same as AuthUser)
   */
  user: AuthUser;
}

/**
 * Admin password reset request
 *
 * Request for admin-initiated password reset workflow.
 * Allows resetting a user's password by sub (UUID).
 *
 * @example
 * ```typescript
 * // With link for consumer app custom UI
 * const request: AdminResetPasswordRequest = {
 *   sub: 'a21b654c-2746-4168-acee-c175083a65cd',
 *   baseUrl: 'https://myapp.com/reset-password',
 *   deliveryMethod: 'email',
 *   revokeSessions: true,
 * };
 *
 * // Code only (no link)
 * const request: AdminResetPasswordRequest = {
 *   sub: 'a21b654c-2746-4168-acee-c175083a65cd',
 *   deliveryMethod: 'email',
 * };
 * ```
 */
export interface AdminResetPasswordRequest {
  /**
   * User sub (UUID v4)
   */
  sub: string;

  /**
   * Delivery method for reset code
   * Default: 'email'
   */
  deliveryMethod?: 'email' | 'sms';

  /**
   * Base URL for building reset link
   * Optional: Allows consumer apps to build custom reset UI
   */
  baseUrl?: string;

  /**
   * Code expiry in seconds
   * Default: 3600 (1 hour)
   * Min: 300 (5 minutes), Max: 86400 (24 hours)
   */
  codeExpiresIn?: number;

  /**
   * Revoke all active sessions immediately (before sending email)
   * Default: false
   */
  revokeSessions?: boolean;

  /**
   * Reason for admin-initiated reset (for audit trail)
   * Max: 500 characters
   */
  reason?: string;
}

/**
 * Admin password reset response
 *
 * Response for admin-initiated password reset request.
 */
export interface AdminResetPasswordResponse {
  /**
   * Success indicator
   */
  success: boolean;

  /**
   * Masked destination where code was sent
   * Example: "u***r@example.com" | "***-***-5678"
   */
  destination?: string;

  /**
   * Delivery medium used
   */
  deliveryMedium?: 'email' | 'sms';

  /**
   * Code expiry in seconds
   */
  expiresIn?: number;

  /**
   * Number of sessions revoked (if revokeSessions was true)
   */
  sessionsRevoked?: number;
}

/**
 * Session information in user sessions response
 */
export interface UserSessionInfo {
  /**
   * Session ID
   */
  sessionId: string;

  /**
   * Device ID
   */
  deviceId: string | null;

  /**
   * Device name
   */
  deviceName: string | null;

  /**
   * Device type
   */
  deviceType: string | null;

  /**
   * Platform
   */
  platform: string | null;

  /**
   * Browser
   */
  browser: string | null;

  /**
   * IP address
   */
  ipAddress: string | null;

  /**
   * IP country
   */
  ipCountry: string | null;

  /**
   * IP city
   */
  ipCity: string | null;

  /**
   * Last activity timestamp
   */
  lastActivityAt: Date | string;

  /**
   * Session creation timestamp
   */
  createdAt: Date | string;

  /**
   * Session expiration timestamp
   */
  expiresAt: Date | string;

  /**
   * Whether session is remembered
   */
  isRemembered: boolean;

  /**
   * Whether this is the current session
   */
  isCurrent: boolean;

  /**
   * Authentication method used for this session
   * Examples: 'password', 'social', 'admin', 'admin-social'
   */
  authMethod: string | null;

  /**
   * OAuth provider name (only present for social logins)
   * Examples: 'google', 'facebook', 'github', 'apple'
   */
  authProvider: string | null;
}

/**
 * Get user sessions response
 */
export interface GetUserSessionsResponse {
  /**
   * Array of user sessions
   */
  sessions: UserSessionInfo[];
}

/**
 * Admin audit history request
 *
 * Request for getting user authentication history (admin-only).
 *
 * @example
 * ```typescript
 * const request: AdminAuditHistoryRequest = {
 *   sub: 'user-uuid',
 *   page: 1,
 *   limit: 50,
 *   eventType: 'LOGIN_SUCCESS',
 *   eventStatus: 'SUCCESS',
 * };
 * ```
 */
export interface AdminAuditHistoryRequest {
  /**
   * User's unique identifier (UUID v4)
   * Required for admin operations
   */
  sub: string;

  /**
   * Page number (1-indexed)
   */
  page?: number;

  /**
   * Number of records per page
   */
  limit?: number;

  /**
   * Filter by event type
   */
  eventType?: string;

  /**
   * Filter by event status
   */
  eventStatus?: string;
}
