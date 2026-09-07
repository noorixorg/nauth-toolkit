import { AuthChallenge } from './auth-challenge.dto';
import { IUser } from '../interfaces/entities.interface';

/**
 * User information in authentication responses
 *
 * Minimal user object returned in AuthResponseDTO.
 * Contains only essential fields needed for client applications.
 */
export interface AuthResponseUser {
  /**
   * User's unique identifier (UUID v4)
   * External identifier safe to expose in JWTs and APIs
   */
  sub: string;

  /**
   * User's email address
   */
  email: string;

  /**
   * User's first name (optional)
   */
  firstName?: string | null;

  /**
   * User's last name (optional)
   */
  lastName?: string | null;

  /**
   * User's phone number (optional)
   * E.164 format
   */
  phone?: string;

  /**
   * Email verification status
   */
  isEmailVerified: boolean;

  /**
   * Phone verification status
   */
  isPhoneVerified?: boolean;

  /**
   * List of linked social providers
   */
  socialProviders?: string[];

  /**
   * Whether this user has a password set
   * Used to determine if user can use password-based authentication
   * or is a pure social signup (no password, only social auth)
   */
  hasPasswordHash?: boolean;
}

/**
 * MFA grace period information returned in authentication responses
 *
 * Present only while MFA setup is *pending but not yet demanded* — MFA is enabled with
 * `REQUIRED` or `ADAPTIVE` enforcement, the user has neither set up MFA nor been exempted,
 * and either:
 * - the day-based `mfa.gracePeriod` window is still open, or
 * - the setup challenge was skipped for this signup via `mfa.grace.skipForSignup`, in which
 *   case `requiredAtNextLogin` is `true`.
 *
 * Clients can use this to offer an optional MFA setup flow (for example right after
 * signup) before enforcement makes setup mandatory.
 *
 * Once the grace ends, this field is absent and the flow instead returns
 * the `MFA_SETUP_REQUIRED` challenge.
 */
export interface MfaGracePeriodInfo {
  /**
   * Always true when this object is present
   *
   * The field is omitted entirely when no grace period applies, so `active` acts as
   * a discriminator for clients that keep a nullable copy of the payload.
   */
  active: boolean;

  /**
   * Timestamp at which the grace period ends and MFA setup becomes mandatory
   * ISO 8601 string
   *
   * Absent when the grace lasts only for the signup flow itself
   * (`mfa.grace.skipForSignup` with `gracePeriod: 0`) — see `requiredAtNextLogin`.
   *
   * @example "2025-02-01T00:00:00.000Z"
   */
  endsAt?: string;

  /**
   * Whole days remaining before the grace period ends
   *
   * Rounded up, so a partial final day reports as `1`.
   * `0` when the grace covers only the signup flow.
   *
   * @example 7
   */
  daysRemaining: number;

  /**
   * MFA enforcement policy that will apply once the grace period ends
   */
  enforcement: 'REQUIRED' | 'ADAPTIVE';

  /**
   * Whether MFA setup will be demanded on the user's very next login
   *
   * True when the setup challenge was suppressed purely to keep signup frictionless
   * (`mfa.grace.skipForSignup` with no day-based grace left). The client should strongly
   * encourage setting up MFA now, because the next login will block on it.
   */
  requiredAtNextLogin?: boolean;
}

/**
 * Unified Authentication Response DTO
 *
 * Used for ALL authentication operations:
 * - Email/password login
 * - User signup
 * - Social authentication (Google, Apple, Facebook)
 * - Token refresh
 * - Challenge completions
 *
 * This provides a consistent interface regardless of authentication method,
 * improving developer experience and code maintainability.
 *
 * When challenges are present, tokens will not be issued until all challenges
 * are completed. This ensures proper verification and security enforcement.
 *
 * No validators needed - this is generated internally by the library.
 */
export class AuthResponseDTO {
  /**
   * JWT access token for API authentication
   * Short-lived (typically 15 minutes)
   *
   * NOTE: Only present when authentication is complete (no pending challenges)
   */
  accessToken?: string;

  /**
   * JWT refresh token for obtaining new access tokens
   * Long-lived (typically 30 days)
   *
   * NOTE: Only present when authentication is complete (no pending challenges)
   */
  refreshToken?: string;

  /**
   * Access token expiration timestamp
   * Unix timestamp in seconds
   *
   * @example 1730000000 (represents a specific date/time)
   *
   * NOTE: Only present when authentication is complete (no pending challenges)
   */
  accessTokenExpiresAt?: number;

  /**
   * Refresh token expiration timestamp
   * Unix timestamp in seconds
   *
   * @example 1732592000 (30 days after access token)
   *
   * NOTE: Only present when authentication is complete (no pending challenges)
   */
  refreshTokenExpiresAt?: number;

  /**
   * Authentication method used to create the current session (when authentication succeeds).
   *
   * Semantics:
   * - `password`: email/username/phone + password login, or password-first flows
   * - `<provider>`: social login provider that created the session (e.g., `google`, `apple`, `facebook`)
   *
   * Notes:
   * - This is session-scoped state (not account capability). Account capabilities are expressed via:
   *   - `user.hasPasswordHash`
   *   - `user.socialProviders`
   * - Only present when authentication is complete (no pending challenges).
   */
  authMethod?: string;

  /**
   * Whether the current device is already trusted
   *
   * When true, the device has a valid trusted device token and UI should NOT show
   * "trust device" popup.
   *
   * When false and rememberDevices === 'user_opt_in', UI can show popup after login
   * to allow user to opt-in for device trust.
   *
   * When rememberDevices === 'always', this will always be true after successful login.
   *
   * NOTE: Only present when authentication is complete (no pending challenges)
   */
  trusted?: boolean;

  /**
   * Device token for trusted device feature (UUID v4)
   *
   * Server-generated UUID token for identifying trusted devices.
   * Only returned when rememberDevices is not 'never' and device is trusted.
   *
   * Delivery by mode:
   * - **cookies mode**: Token set as `nauth_device_token` httpOnly cookie (not in response body)
   * - **json/hybrid mode**: Token returned in response body for mobile apps
   *
   * Mobile apps should:
   * - Store token in secure storage (iOS Keychain / Android EncryptedSharedPreferences)
   * - Send token in `X-Device-Token` header on subsequent logins
   * - Token persists across app restarts and survives logout
   *
   * Web apps:
   * - Token automatically handled via httpOnly cookie (cookies mode)
   * - No manual handling required
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   *
   * NOTE: Only present when authentication is complete (no pending challenges)
   * WARNING: For JSON mode, ensure secure storage - token in response body can be intercepted
   */
  deviceToken?: string;

  /**
   * User information
   * Standardized across all authentication methods
   *
   * NOTE: Only present when authentication is complete (no pending challenges)
   */
  user?: AuthResponseUser;

  // ============================================================================
  // Challenge System (Similar to AWS Cognito)
  // ============================================================================

  /**
   * Challenge that must be completed before authentication is granted
   *
   * When present, the user must complete this challenge using the
   * challenge completion endpoint before they can access the system.
   *
   * Tokens (accessToken, refreshToken) will NOT be present when a challenge exists.
   *
   * @example 'VERIFY_EMAIL' | 'VERIFY_PHONE' | 'MFA_REQUIRED'
   */
  challengeName?: AuthChallenge;

  /**
   * Temporary session identifier for challenge completion (UUID v4)
   *
   * This is NOT a JWT token - it's a temporary identifier that must be
   * submitted when completing the challenge. It expires after a short time
   * (typically 15 minutes) or after successful challenge completion.
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   *
   * NOTE: Only present when challengeName is set
   */
  session?: string;

  /**
   * Challenge-specific parameters
   *
   * Contains information needed to complete the challenge, such as:
   * - Masked email/phone for delivery confirmation
   * - Challenge type details
   * - Instructions for the user
   *
   * NOTE: Only present when challengeName is set
   *
   * @example
   * ```typescript
   * {
   *   email: 'user@example.com',
   *   codeDeliveryDestination: 'u***@example.com'
   * }
   * ```
   */
  challengeParameters?: Record<string, unknown>;

  /**
   * User's unique identifier (UUID v4)
   * Present in both successful auth and challenge responses
   * Helps the client track which user is authenticating
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  sub?: string;

  /**
   * MFA grace period status
   *
   * Present on both challenge and success responses whenever the user is inside an
   * active grace period for a pending MFA setup. Absent otherwise.
   *
   * Typical use: after signup, the client sees this field and can offer an optional
   * MFA setup flow instead of waiting for enforcement to force it on a later login.
   *
   * @example
   * ```typescript
   * {
   *   active: true,
   *   endsAt: '2025-02-01T00:00:00.000Z',
   *   daysRemaining: 7,
   *   enforcement: 'REQUIRED'
   * }
   * ```
   */
  mfaGracePeriod?: MfaGracePeriodInfo;
}

/**
 * Token Response DTO
 *
 * Returned by token refresh operations
 * Contains new access and refresh tokens with expiration times
 */
export interface TokenResponse {
  /**
   * New JWT access token
   */
  accessToken: string;

  /**
   * New JWT refresh token
   */
  refreshToken: string;

  /**
   * Access token expiration (Unix timestamp in seconds)
   */
  accessTokenExpiresAt: number;

  /**
   * Refresh token expiration (Unix timestamp in seconds)
   */
  refreshTokenExpiresAt: number;
}

/**
 * Convert IUser entity to AuthResponseUser interface
 *
 * Extracts only the fields needed for authentication responses,
 * excluding sensitive and internal fields.
 *
 * @param user - User entity from database (IUser interface)
 * @returns AuthResponseUser object with sanitized user data
 */
export function toAuthResponseUser(user: IUser): AuthResponseUser {
  return {
    sub: user.sub,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? undefined,
    isEmailVerified: user.isEmailVerified,
    isPhoneVerified: user.isPhoneVerified ?? undefined,
    socialProviders: user.socialProviders && user.socialProviders.length > 0 ? user.socialProviders : undefined,
    hasPasswordHash: !!user.passwordHash,
  };
}
