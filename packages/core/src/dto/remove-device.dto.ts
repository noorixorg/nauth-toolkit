/**
 * DTO for removing a single MFA device by ID
 *
 * Used to remove one enrolled MFA device for the current authenticated user.
 * This is important when users can register multiple devices per method
 * (e.g., multiple TOTP authenticators and multiple passkeys).
 *
 * @example
 * ```typescript
 * const result = await mfaService.removeDevice({ deviceId: 123 });
 * // { removedDeviceId: 123, removedMethod: 'passkey', mfaDisabled: false }
 * ```
 */

import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { MFADeviceMethod } from '../enums/mfa-method.enum';

/**
 * DTO for removing a single MFA device
 */
export class RemoveDeviceDTO {
  /**
   * MFA device ID to remove
   *
   * Validation:
   * - Must be a positive integer
   *
   * Sanitization:
   * - Strings are converted to numbers (useful for path params)
   *
   * @example 123
   */
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
  })
  @IsInt({ message: 'Device ID must be an integer' })
  @Min(1, { message: 'Device ID must be a positive integer' })
  deviceId!: number;
}

/**
 * Response DTO for removing a single MFA device
 */
export class RemoveDeviceResponseDTO {
  /**
   * ID of the removed device
   */
  removedDeviceId!: number;

  /**
   * MFA method type of the removed device
   */
  removedMethod!: MFADeviceMethod;

  /**
   * Whether MFA was disabled (when this was the last remaining device)
   */
  mfaDisabled!: boolean;
}
