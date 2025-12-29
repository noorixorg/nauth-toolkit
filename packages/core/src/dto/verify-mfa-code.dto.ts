/**
 * DTO for verifying MFA code
 *
 * Used to verify MFA code using the appropriate provider.
 * Routes verification to the correct provider based on method name.
 *
 * @example
 * ```typescript
 * const isValid = await mfaService.verifyCode({
 *   sub: 'user-uuid',
 *   methodName: 'totp',
 *   code: '123456',
 *   deviceId: 1
 * });
 * ```
 */

import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsInt,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MFAMethod } from '../enums/mfa-method.enum';

/**
 * DTO for verifying MFA code
 */
export class VerifyMFACodeDTO {
  /**
   * User's unique identifier (UUID v4)
   *
   * Validation:
   * - Must be a valid UUID v4 format
   * - Matches DB constraint: char(36) or uuid
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
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
  sub!: string;

  /**
   * MFA method name
   *
   * Validation:
   * - Must be one of: totp, sms, email, passkey, backup
   * - Max 50 characters
   *
   * Sanitization:
   * - Trimmed and lowercased
   *
   * @example "totp"
   */
  @IsString({ message: 'Method name must be a string' })
  @IsEnum([MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY, MFAMethod.BACKUP], {
    message: 'Method name must be one of: totp, sms, email, passkey, backup',
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
   * Verification code or credential (provider-specific)
   *
   * Validation:
   * - Must be a string or object depending on method
   * - For TOTP/SMS/Email: string code
   * - For Passkey: credential object
   * - For Backup: string code
   */
  @ValidateIf((dto: VerifyMFACodeDTO) => dto.methodName === MFAMethod.PASSKEY)
  @IsObject({ message: 'code must be a passkey credential object for passkey method' })
  @ValidateIf((dto: VerifyMFACodeDTO) => dto.methodName !== MFAMethod.PASSKEY)
  @IsString({ message: 'code must be a string for this MFA method' })
  @IsNotEmpty({ message: 'code is required' })
  @MaxLength(2048, { message: 'code must not exceed 2048 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  code!: string | Record<string, unknown>;

  /**
   * Optional device ID
   *
   * Validation:
   * - Must be a positive integer if provided
   */
  @IsOptional()
  @IsInt({ message: 'Device ID must be a number' })
  deviceId?: number;
}

/**
 * Response DTO for MFA code verification
 */
export class VerifyMFACodeResponseDTO {
  /**
   * Whether verification succeeded
   */
  valid!: boolean;
}
