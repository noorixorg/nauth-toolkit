/**
 * DTO for removing MFA devices
 *
 * Used to remove all MFA devices of a specific method type for the current authenticated user.
 * Automatically disables MFA if this was the last device.
 * User sub is obtained from authenticated context automatically.
 *
 * @example
 * ```typescript
 * const result = await mfaService.removeDevices({
 *   methodType: 'totp'
 * });
 * ```
 */

import { IsEnum, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MFAMethod } from '../enums/mfa-method.enum';

/**
 * DTO for removing MFA devices
 *
 * User self-service DTO - no userSub field. Service gets user from authenticated context.
 */
export class RemoveDevicesDTO {

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
