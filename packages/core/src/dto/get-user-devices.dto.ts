/**
 * DTO for getting user MFA devices
 *
 * Used to retrieve all MFA devices configured for a user.
 *
 * @example
 * ```typescript
 * const devices = await mfaService.getUserDevices({
 *   sub: 'user-uuid'
 * });
 * ```
 */

import { IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { IMFADevice } from '../interfaces/entities.interface';

/**
 * DTO for getting user MFA devices
 */
export class GetUserDevicesDTO {
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
  sub!: string;
}

/**
 * Response DTO for user MFA devices
 */
export class GetUserDevicesResponseDTO {
  /**
   * Array of user's MFA devices
   */
  devices!: IMFADevice[];
}
