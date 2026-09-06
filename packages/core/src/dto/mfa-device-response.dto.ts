/**
 * Outward-facing MFA Device Response DTO
 *
 * This DTO is used for all API responses that return device information.
 * It maps internal `isPrimary` to external `isPreferred` to avoid exposing
 * internal database field names.
 *
 * @example
 * ```typescript
 * const device: MFADeviceResponseDTO = {
 *   id: 1,
 *   type: 'totp',
 *   name: 'My Phone',
 *   isPreferred: true,
 *   isActive: true,
 *   createdAt: new Date()
 * };
 * ```
 */

import { MFADeviceMethod } from '../enums/mfa-method.enum';
import { IMFADevice } from '../interfaces/entities.interface';

/**
 * Outward-facing MFA device information
 *
 * Note: Uses `isPreferred` instead of internal `isPrimary` field
 */
export class MFADeviceResponseDTO {
  /**
   * Unique device identifier
   */
  id!: number;

  /**
   * MFA method type (totp, sms, email, passkey)
   */
  type!: MFADeviceMethod;

  /**
   * Device name (user-assigned)
   */
  name!: string;

  /**
   * Whether this is the preferred device for this method
   * Maps from internal `isPrimary` field
   */
  isPreferred!: boolean;

  /**
   * Whether device is currently active
   */
  isActive!: boolean;

  /**
   * Device creation timestamp
   */
  createdAt!: Date;

  /**
   * Convert internal device entity to outward-facing DTO
   *
   * @param device - Internal device entity
   * @returns Outward-facing device DTO
   */
  static fromEntity(device: IMFADevice): MFADeviceResponseDTO {
    const dto = new MFADeviceResponseDTO();
    dto.id = device.id;
    dto.type = device.type;
    dto.name = device.name;
    // Coerced rather than compared or passed through: a driver that hands back 1/0 for a
    // boolean column would otherwise make `isPreferred` permanently false and leak a
    // number out of a field this DTO declares as a boolean.
    dto.isPreferred = !!device.isPrimary;
    dto.isActive = !!device.isActive;
    dto.createdAt = device.createdAt;
    return dto;
  }

  /**
   * Convert array of internal device entities to outward-facing DTOs
   *
   * @param devices - Array of internal device entities
   * @returns Array of outward-facing device DTOs
   */
  static fromEntities(devices: IMFADevice[]): MFADeviceResponseDTO[] {
    return devices.map((device) => MFADeviceResponseDTO.fromEntity(device));
  }
}
