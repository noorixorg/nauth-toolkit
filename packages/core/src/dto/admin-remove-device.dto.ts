import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { RemoveDeviceResponseDTO } from './remove-device.dto';

/**
 * Admin DTO for removing a single MFA device by device ID.
 *
 * Admin APIs are allowed to target any user's device.
 * This DTO is intentionally minimal: it only requires the `deviceId`.
 *
 * @example
 * ```typescript
 * const result = await mfaService.adminRemoveDevice({ deviceId: 123 });
 * ```
 */
export class AdminRemoveDeviceDTO {
  /**
   * MFA device numeric ID.
   *
   * @example 123
   */
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
  })
  @IsInt({ message: 'deviceId must be an integer' })
  @Min(1, { message: 'deviceId must be at least 1' })
  deviceId!: number;
}

export { RemoveDeviceResponseDTO };
