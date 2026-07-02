/**
 * Unified Challenge Response DTO with Comprehensive Validation
 *
 * Provides class-validator validation for challenge responses.
 * This is the single source of truth for challenge response validation,
 * used by both NestJS and Express adapters.
 *
 * Security Features:
 * - All string inputs have max length (prevents DoS attacks)
 * - Phone numbers validated against E.164 format
 * - Password strength enforced (8-128 chars)
 * - Conditional validation based on challenge type
 * - Enum validation prevents invalid challenge types
 *
 * @module RespondChallengeDTO
 */

import {
  IsString,
  IsEnum,
  ValidateIf,
  IsObject,
  MinLength,
  MaxLength,
  Matches,
  Length,
  IsUUID,
  IsInt,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Challenge type enum for validation
 */
export enum ChallengeType {
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  VERIFY_PHONE = 'VERIFY_PHONE',
  MFA_REQUIRED = 'MFA_REQUIRED',
  FORCE_CHANGE_PASSWORD = 'FORCE_CHANGE_PASSWORD',
  MFA_SETUP_REQUIRED = 'MFA_SETUP_REQUIRED',
}

/**
 * MFA method enum for validation
 */
export enum MFAMethodType {
  SMS = 'sms',
  EMAIL = 'email',
  TOTP = 'totp',
  PASSKEY = 'passkey',
  BACKUP = 'backup',
}

/**
 * Unified DTO for responding to authentication challenges
 *
 * Uses conditional validation (@ValidateIf) to validate fields based on challenge type.
 * This ensures proper validation while maintaining a single endpoint for all challenge types.
 *
 * Security:
 * - All strings have max length constraints matching DB limits
 * - Phone numbers validated against E.164 format (prevents SQL injection)
 * - Verification codes validated for length (4-10 chars)
 * - Passwords validated for strength requirements
 * - Session tokens validated as UUID v4 format (prevents injection)
 *
 * @example
 * ```typescript
 * @Controller('auth')
 * export class AuthController {
 *   @Post('respond-challenge')
 *   async respondToChallenge(@Body() dto: RespondChallengeDTO) {
 *     return await this.authService.respondToChallenge(dto);
 *   }
 * }
 * ```
 */
export class RespondChallengeDTO {
  /**
   * Challenge session token (UUID v4)
   * Always required
   *
   * Validation:
   * - Must be a valid UUID v4 format
   * - Generated using randomUUID() in challenge service
   * - Matches DB constraint: varchar(255) but UUID format enforced
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
   * Challenge type being responded to
   * Always required
   */
  @IsEnum(ChallengeType, {
    message:
      'Challenge type must be one of: VERIFY_EMAIL, VERIFY_PHONE, MFA_REQUIRED, FORCE_CHANGE_PASSWORD, MFA_SETUP_REQUIRED',
  })
  type!: ChallengeType;

  // ============================================================================
  // VERIFY_EMAIL / VERIFY_PHONE / MFA_REQUIRED (code-based)
  // ============================================================================

  /**
   * Verification code
   * Required for:
   * - VERIFY_EMAIL
   * - VERIFY_PHONE (when verifying code)
   * - MFA_REQUIRED (for SMS/Email/TOTP/Backup methods)
   *
   * Validation:
   * - Must be a string
   * - Length 4-10 characters (covers all code types)
   * - Alphanumeric only
   *
   * Note: NOT trimmed (codes should be exact)
   */
  @ValidateIf(
    (o) =>
      o.type === ChallengeType.VERIFY_EMAIL ||
      (o.type === ChallengeType.VERIFY_PHONE && !o.phone) ||
      (o.type === ChallengeType.MFA_REQUIRED && o.method !== MFAMethodType.PASSKEY),
  )
  @IsString({ message: 'Code must be a string' })
  @Length(4, 10, { message: 'Code must be between 4 and 10 characters' })
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Code can only contain letters and numbers' })
  code?: string;

  // ============================================================================
  // VERIFY_PHONE (phone collection)
  // ============================================================================

  /**
   * Phone number in E.164 format
   * Required for VERIFY_PHONE when collecting phone number (first step)
   *
   * Validation:
   * - Must be a string
   * - Must match E.164 format: +[country code][number]
   * - Example: +14155552671
   * - Max 20 characters (matches DB limit)
   *
   * Sanitization:
   * - Trimmed
   * - Only digits and leading + allowed
   */
  @ValidateIf((o) => o.type === ChallengeType.VERIFY_PHONE && !o.code)
  @IsString({ message: 'Phone must be a string' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be in E.164 format (e.g., +14155552671)',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  phone?: string;

  // ============================================================================
  // FORCE_CHANGE_PASSWORD
  // ============================================================================

  /**
   * New password
   * Required for FORCE_CHANGE_PASSWORD challenge
   *
   * Validation:
   * - Must be a string
   * - Min 8 characters (security requirement)
   * - Max 128 characters (prevents DoS via Argon2 hashing)
   *
   * Note: NOT trimmed (passwords can have leading/trailing spaces)
   */
  @ValidateIf((o) => o.type === ChallengeType.FORCE_CHANGE_PASSWORD)
  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  newPassword?: string;

  // ============================================================================
  // MFA_REQUIRED / MFA_SETUP_REQUIRED
  // ============================================================================

  /**
   * MFA method being used or set up
   * Required for:
   * - MFA_REQUIRED challenge (method being used for verification)
   * - MFA_SETUP_REQUIRED challenge (method being set up)
   *
   * Validation:
   * - Must be one of: sms, email, totp, passkey, backup
   */
  @ValidateIf((o) => o.type === ChallengeType.MFA_REQUIRED || o.type === ChallengeType.MFA_SETUP_REQUIRED)
  @IsEnum(MFAMethodType, { message: 'MFA method must be one of: sms, email, totp, passkey, backup' })
  method?: MFAMethodType;

  /**
   * Passkey credential
   * Required for MFA_REQUIRED when method is 'passkey'
   *
   * Validation:
   * - Must be an object
   * - Contains WebAuthn credential from navigator.credentials.get()
   */
  @ValidateIf((o) => o.type === ChallengeType.MFA_REQUIRED && o.method === MFAMethodType.PASSKEY)
  @IsObject({ message: 'Credential must be an object' })
  credential?: Record<string, unknown>;

  /**
   * Optional device ID for MFA_REQUIRED when method supports multiple devices (TOTP, Passkey)
   *
   * Validation:
   * - Must be a positive integer if provided
   * - Optional field (maintains backward compatibility)
   */
  @IsOptional()
  @ValidateIf((o) => o.type === ChallengeType.MFA_REQUIRED)
  @IsInt({ message: 'Device ID must be a number' })
  deviceId?: number;

  // ============================================================================
  // MFA_SETUP_REQUIRED
  // ============================================================================

  /**
   * MFA setup data (method-specific)
   * Required for MFA_SETUP_REQUIRED challenge
   *
   * Expected structure by method:
   * - SMS: { phone: string, code: string }
   * - Email: { code: string }
   * - TOTP: { code: string }
   * - Passkey: { credential: Record<string, unknown> }
   *
   * Validation:
   * - Must be an object
   * - Structure validated by MFA provider services
   */
  @ValidateIf((o) => o.type === ChallengeType.MFA_SETUP_REQUIRED)
  @IsObject({ message: 'Setup data must be an object' })
  setupData?: Record<string, unknown>;
}

/**
 * Helper type guards for challenge response
 *
 * Use these to narrow TypeScript types in your application logic.
 *
 * @example
 * ```typescript
 * if (RespondChallengeValidation.isEmailVerification(dto)) {
 *   // TypeScript knows dto.code is available
 * }
 * ```
 */
export namespace RespondChallengeValidation {
  export function isEmailVerification(dto: RespondChallengeDTO): boolean {
    return dto.type === ChallengeType.VERIFY_EMAIL && !!dto.code;
  }

  export function isPhoneCollection(dto: RespondChallengeDTO): boolean {
    return dto.type === ChallengeType.VERIFY_PHONE && !!dto.phone;
  }

  export function isPhoneVerification(dto: RespondChallengeDTO): boolean {
    return dto.type === ChallengeType.VERIFY_PHONE && !!dto.code;
  }

  export function isPasswordChange(dto: RespondChallengeDTO): boolean {
    return dto.type === ChallengeType.FORCE_CHANGE_PASSWORD && !!dto.newPassword;
  }

  export function isMFAVerification(dto: RespondChallengeDTO): boolean {
    return dto.type === ChallengeType.MFA_REQUIRED && !!dto.method;
  }

  export function isMFASetup(dto: RespondChallengeDTO): boolean {
    return dto.type === ChallengeType.MFA_SETUP_REQUIRED && !!dto.method && !!dto.setupData;
  }
}
