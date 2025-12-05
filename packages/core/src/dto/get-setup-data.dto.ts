/**
 * DTO for requesting MFA setup data
 *
 * Used to get method-specific setup information during MFA enrollment.
 * For example, TOTP setup returns QR code and secret.
 *
 * Security:
 * - Session token length limited (prevents DoS)
 * - Method validated against enum (prevents injection)
 *
 * @example
 * ```typescript
 * const setupData = await authService.getSetupData({
 *   session: 'challenge-session-token',
 *   method: 'totp'
 * });
 * // Returns: { secret: '...', qrCode: '...' }
 * ```
 */

import { IsEnum, IsUUID, IsOptional, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';
import { MFAMethod } from '../enums/mfa-method.enum';

/**
 * DTO for getting MFA setup data
 */
export class GetSetupDataDTO {
  /**
   * Challenge session token (UUID v4)
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
   * MFA method to set up
   *
   * Validation:
   * - Must be one of: sms, email, totp, passkey
   */
  @IsEnum([MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.TOTP, MFAMethod.PASSKEY], {
    message: 'Method must be one of: sms, email, totp, passkey',
  })
  method!: MFAMethod;

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
