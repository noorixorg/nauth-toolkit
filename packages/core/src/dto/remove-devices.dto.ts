/**
 * DTO for removing MFA devices
 *
 * Used to remove all MFA devices of a specific method type for a user.
 * Automatically disables MFA if this was the last device.
 *
 * @example
 * ```typescript
 * const result = await mfaService.removeDevices({
 *   userSub: 'user-uuid',
 *   methodType: 'totp'
 * });
 * ```
 */

import { IsEnum, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MFAMethod } from '../enums/mfa-method.enum';

/**
 * DTO for removing MFA devices
 */
export class RemoveDevicesDTO {
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
  userSub!: string;

  /**
   * MFA method type to remove
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
  @IsString({ message: 'Method type must be a string' })
  @IsEnum([MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY], {
    message: 'Method type must be one of: totp, sms, email, passkey',
  })
  @MaxLength(50, { message: 'Method type must not exceed 50 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  methodType!: string;
}

/**
 * Response DTO for removing devices
 */
export class RemoveDevicesResponseDTO {
  /**
   * Number of devices deleted
   */
  deletedCount!: number;

  /**
   * Whether MFA was disabled (if this was the last device)
   */
  mfaDisabled!: boolean;
}
