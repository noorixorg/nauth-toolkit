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

import { IMFADevice } from '../interfaces/entities.interface';

/**
 * DTO for getting user MFA devices
 *
 * User self-service DTO - no sub field. Service gets user from authenticated context.
 */
export class GetUserDevicesDTO {
  // No fields - user obtained from context
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
