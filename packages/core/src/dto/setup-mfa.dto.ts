/**
 * DTO for setting up MFA device
 *
 * Used to initiate MFA device setup using the appropriate provider.
 * User sub is obtained from authenticated context automatically.
 *
 * @example
 * ```typescript
 * const setup = await mfaService.setup({
 *   methodName: 'totp',
 *   setupData: {}
 * });
 * ```
 */

import { IsEnum, IsString, IsOptional, IsObject, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MFAMethod } from '../enums/mfa-method.enum';

/**
 * DTO for setting up MFA device
 *
 * User self-service DTO - no sub field. Service gets user from authenticated context.
 */
export class SetupMFADTO {

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
