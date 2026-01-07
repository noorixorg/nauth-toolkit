/**
 * DTO for setting up MFA device
 *
 * Used to initiate MFA device setup using the appropriate provider.
 *
 * @example
 * ```typescript
 * const setup = await mfaService.setup({
 *   sub: 'user-uuid',
 *   methodName: 'totp',
 *   setupData: {}
 * });
 * ```
 */

import { IsEnum, IsString, IsUUID, IsOptional, IsObject, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { MFAMethod } from '../enums/mfa-method.enum';

/**
 * DTO for setting up MFA device
 */
export class SetupMFADTO {
  /**
   * User's unique identifier (UUID v4)
   *
   * Optional at controller level - filled from authenticated user's JWT.
   * Validated only when provided (service layer will ensure it's set).
   *
   * Validation:
   * - Must be a valid UUID v4 format when provided
   * - Matches DB constraint: char(36) or uuid
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @ValidateIf((o) => o.sub !== undefined && o.sub !== null && o.sub !== '')
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  @IsOptional()
  sub?: string;

  /**
   * MFA method name
   *
   * Validation:
   * - Must be one of: totp, sms, email, passkey
   * - Max 50 characters
   *
   * Sanitization:
   * - Trimmed and lowercased
   *
   * @example "totp"
   */
  @IsString({ message: 'Method name must be a string' })
  @IsEnum([MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY], {
    message: 'Method name must be one of: totp, sms, email, passkey',
  })
  @MaxLength(50, { message: 'Method name must not exceed 50 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  methodName!: string;

  /**
   * Optional provider-specific setup data
   *
   * Validation:
   * - Must be an object if provided
   * - Structure validated by MFA provider services
   *
   * @example { phoneNumber: '+1234567890' } for SMS
   */
  @IsOptional()
  @IsObject({ message: 'Setup data must be an object' })
  setupData?: Record<string, unknown>;
}

/**
 * Response DTO for MFA setup
 */
export class SetupMFAResponseDTO {
  /**
   * Provider-specific setup response
   *
   * Structure varies by method:
   * - TOTP: { secret, qrCode, manualEntryKey }
   * - SMS: { maskedPhone }
   * - Passkey: WebAuthn registration options
   */
  setupData!: Record<string, unknown>;
}
