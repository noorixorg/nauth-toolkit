import { IsEnum, IsUUID, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Authentication Challenge Types
 *
 * Represents different challenges that must be completed before
 * a user can gain full access to the system. This is similar to
 * AWS Cognito's challenge system.
 *
 * @example
 * ```typescript
 * // After login, check for challenges
 * const result = await authService.login(credentials);
 * if (result.challengeName) {
 *   // User must complete challenge before accessing system
 *   console.log('Challenge required:', result.challengeName);
 * }
 * ```
 */
export enum AuthChallenge {
  /**
   * Email verification required
   * User must verify their email address before proceeding
   */
  VERIFY_EMAIL = 'VERIFY_EMAIL',

  /**
   * Phone verification required
   * User must verify their phone number before proceeding
   */
  VERIFY_PHONE = 'VERIFY_PHONE',

  /**
   * Multi-factor authentication required
   * User must complete MFA verification (TOTP, SMS, etc.)
   * This challenge is used when user already has MFA enabled and needs to verify
   */
  MFA_REQUIRED = 'MFA_REQUIRED',

  /**
   * MFA setup required
   * User must set up multi-factor authentication before being allowed to login.
   * This occurs when enforcement is 'REQUIRED' and grace period has expired or is disabled.
   */
  MFA_SETUP_REQUIRED = 'MFA_SETUP_REQUIRED',

  /**
   * Password change required
   * User must change their password before proceeding
   * (e.g., admin-forced password reset, expired password)
   */
  FORCE_CHANGE_PASSWORD = 'FORCE_CHANGE_PASSWORD',
}

/**
 * Challenge Response DTO
 *
 * Used when a user's authentication is incomplete due to pending challenges.
 * Contains minimal information about the user and what challenges they must complete.
 *
 * Note: This is primarily a response DTO, but validation is included for completeness.
 *
 * @example
 * ```typescript
 * // Login response with challenge
 * {
 *   challengeName: 'VERIFY_EMAIL',
 *   session: 'a21b654c-2746-4168-acee-c175083a65cd',
 *   challengeParameters: {
 *     email: 'user@example.com',
 *     codeDeliveryDestination: 'u***@example.com'
 *   },
 *   userSub: 'a21b654c-2746-4168-acee-c175083a65cd'
 * }
 * ```
 */
export class AuthChallengeResponseDTO {
  /**
   * The challenge that must be completed
   *
   * Validation:
   * - Must be a valid AuthChallenge enum value
   */
  @IsEnum(AuthChallenge, {
    message: 'Challenge name must be a valid AuthChallenge enum value',
  })
  challengeName!: AuthChallenge;

  /**
   * Temporary session identifier for challenge completion (UUID v4)
   * This is NOT a full JWT token - only used for challenge verification
   *
   * Validation:
   * - Must be a valid UUID v4 format
   * - Generated using randomUUID() in challenge service
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @IsUUID('4', { message: 'Session token must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  session!: string;

  /**
   * Challenge-specific parameters
   * Contains information needed to complete the challenge
   *
   * Validation:
   * - Must be an object
   *
   * @example
   * ```typescript
   * // For VERIFY_EMAIL
   * {
   *   email: 'user@example.com',
   *   codeDeliveryDestination: 'u***@example.com'
   * }
   *
   * // For VERIFY_PHONE
   * {
   *   phone: '+1234567890',
   *   codeDeliveryDestination: '***-***-7890'
   * }
   * ```
   */
  @IsObject({ message: 'Challenge parameters must be an object' })
  challengeParameters!: Record<string, unknown>;

  /**
   * User's unique identifier (UUID v4)
   * Provided so the client knows which user is completing challenges
   *
   * Validation:
   * - Must be a valid UUID v4 format
   * - Matches DB constraint: char(36) or uuid
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  userSub!: string;
}

/**
 * Challenge Completion Request DTO
 *
 * Used to submit a response to an authentication challenge.
 *
 * Note: This is a legacy DTO. The codebase now uses RespondChallengeDTO for the unified API.
 * This DTO is kept for backwards compatibility.
 *
 * Security:
 * - Session token validated as UUID v4 format
 * - Challenge name validated against enum
 * - Challenge responses validated as object
 *
 * @example
 * ```typescript
 * // Verify email challenge
 * const request: ChallengeResponseRequestDTO = {
 *   session: 'a21b654c-2746-4168-acee-c175083a65cd',
 *   challengeName: 'VERIFY_EMAIL',
 *   challengeResponses: {
 *     code: '123456'
 *   }
 * };
 * ```
 */
export class ChallengeResponseRequestDTO {
  /**
   * Temporary session from initial auth response (UUID v4)
   *
   * Validation:
   * - Must be a valid UUID v4 format
   * - Generated using randomUUID() in challenge service
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @IsUUID('4', { message: 'Session token must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  session!: string;

  /**
   * The challenge being responded to
   *
   * Validation:
   * - Must be a valid AuthChallenge enum value
   */
  @IsEnum(AuthChallenge, {
    message: 'Challenge name must be a valid AuthChallenge enum value',
  })
  challengeName!: AuthChallenge;

  /**
   * Challenge-specific responses
   *
   * Validation:
   * - Must be an object
   * - Structure validated in service layer based on challenge type
   *
   * @example
   * ```typescript
   * // For VERIFY_EMAIL or VERIFY_PHONE
   * { code: '123456' }
   *
   * // For FORCE_CHANGE_PASSWORD
   * { newPassword: 'NewSecure123!' }
   * ```
   */
  @IsObject({ message: 'Challenge responses must be an object' })
  challengeResponses!: Record<string, unknown>;
}
