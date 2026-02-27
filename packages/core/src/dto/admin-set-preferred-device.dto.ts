import { IsInt, IsPositive, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for admin setting a user's preferred MFA device.
 *
 * @example
 * ```typescript
 * const dto: AdminSetPreferredDeviceDTO = {
 *   sub: 'user-uuid',
 *   deviceId: 123
 * };
 * ```
 */
export class AdminSetPreferredDeviceDTO {
  /**
   * User identifier (UUID).
   */
  @IsString({ message: 'User identifier must be a string' })
  sub!: string;

  /**
   * MFA device ID to set as preferred.
   * Automatically converted from string path parameters to number.
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
 * Response DTO for admin setting preferred device.
 */
export class AdminSetPreferredDeviceResponseDTO {
  /**
   * Success message.
   */
  message!: string;
}
