import { IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { RemoveDevicesDTO, RemoveDevicesResponseDTO } from './remove-devices.dto';

/**
 * Admin DTO for removing MFA devices for a specific user
 *
 * Admin APIs must explicitly target a user via `sub`.
 * This DTO mirrors {@link RemoveDevicesDTO} but adds `sub`.
 *
 * @example
 * ```typescript
 * const result = await mfaService.adminRemoveDevices({
 *   sub: 'a21b654c-2746-4168-acee-c175083a65cd',
 *   methodType: 'totp',
 * });
 * ```
 */
export class AdminRemoveDevicesDTO extends RemoveDevicesDTO {
  /**
   * Target user's unique identifier (UUID v4)
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
}

export { RemoveDevicesResponseDTO };

