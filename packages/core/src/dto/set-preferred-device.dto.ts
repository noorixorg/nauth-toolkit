import { IsInt, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for setting a user's preferred MFA device.
 *
 * This updates which device is used by default during MFA challenges.
 * The preferred device is marked with `isPrimary` in the database.
 *
 * @example
 * ```typescript
 * const dto: SetPreferredDeviceDTO = { deviceId: 123 };
 * await mfaService.setPreferredDevice(dto);
 * ```
 */
export class SetPreferredDeviceDTO {
  /**
   * MFA device ID to set as preferred
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
  @IsPositive({ message: 'Device ID must be positive' })
  deviceId!: number;
}

/**
 * Response DTO for setting preferred MFA device.
 *
 * @example
 * ```typescript
 * {
 *   message: "Preferred MFA device updated"
 * }
 * ```
 */
export class SetPreferredDeviceResponseDTO {
  /**
   * Success message
   *
   * @example "Preferred MFA device updated"
   */
  message!: string;
}
