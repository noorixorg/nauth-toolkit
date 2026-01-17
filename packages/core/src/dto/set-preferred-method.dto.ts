/**
 * DTO for setting preferred MFA method
 *
 * Used to set the preferred MFA method for the current authenticated user.
 * Updates the user's preferred method and device primary flags.
 * User sub is obtained from authenticated context automatically.
 *
 * @example
 * ```typescript
 * await mfaService.setPreferredMethod({
 *   methodType: 'totp'
 * });
 * ```
 */

import { IsEnum, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MFAMethod } from '../enums/mfa-method.enum';

/**
 * DTO for setting preferred MFA method
 *
 * User self-service DTO - no userSub field. Service gets user from authenticated context.
 */
export class SetPreferredMethodDTO {
  /**
   * MFA method type to set as preferred
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
 * Response DTO for setting preferred method
 */
export class SetPreferredMethodResponseDTO {
  /**
   * Success message
   */
  message!: string;
}
