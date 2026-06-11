/**
 * DTO for getting user MFA devices
 *
 * Used to retrieve all MFA devices configured for the current authenticated user.
 * User sub is obtained from authenticated context automatically.
 *
 * @example
 * ```typescript
 * const devices = await mfaService.getUserDevices({});
 * ```
 */

import { IsNotEmpty, IsString } from 'class-validator';
import { MFADeviceResponseDTO } from './mfa-device-response.dto';

/**
 * DTO for getting user MFA devices
 *
 * User self-service DTO - no sub field. Service gets user from authenticated context.
 */
export class GetUserDevicesDTO {
  // No fields - user obtained from context
}

/**
 * Admin DTO for getting a specific user's MFA devices
 *
 * Admin operation - requires target user's sub identifier.
 *
 * @example
 * ```typescript
 * const devices = await mfaService.adminGetUserDevices({ sub: 'user-uuid' });
 * ```
 */
export class AdminGetUserDevicesDTO {
  /**
   * Target user's unique identifier (sub)
   */
  @IsNotEmpty({ message: 'User sub is required' })
  @IsString({ message: 'User sub must be a string' })
  sub!: string;
}

/**
 * Response DTO for user MFA devices
 *
 */
export class GetUserDevicesResponseDTO {
  /**
   * Array of user's MFA devices (outward-facing format)
   */
  devices!: MFADeviceResponseDTO[];
}
