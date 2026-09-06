/**
 * Trusted device management DTOs
 *
 * Cover listing and revoking the trusted devices that let a user skip MFA on a device
 * they have vouched for. Enrolling a device is `TrustDeviceResponseDTO`; these are the
 * management operations that pair with it.
 */

import { IsInt, IsPositive, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * A single trusted device, without any token material.
 *
 * Deliberately omits `deviceTokenHash`: the plaintext token is held only by the device
 * itself, and its hash is never useful to a client.
 */
export class TrustedDeviceResponseDTO {
  /** Record id. Identifies the device when revoking it. */
  id!: number;

  /** Client-supplied device identifier, when the client sends one. */
  deviceId?: string | null;

  /** Human-readable device label. */
  deviceName?: string | null;

  /** Device form factor (e.g. `mobile`, `desktop`). */
  deviceType?: string | null;

  /** IP address the device was trusted from. */
  ipAddress?: string | null;

  /** Operating system reported by the device. */
  platform?: string | null;

  /** Browser reported by the device. */
  browser?: string | null;

  /** When the trust expires. Devices past this point are never listed. */
  trustedUntil!: Date;

  /** When the device last authenticated, or null if never since being trusted. */
  lastUsedAt?: Date | null;

  /** When the device was trusted. */
  createdAt!: Date;
}

/**
 * Response DTO listing trusted devices.
 */
export class ListTrustedDevicesResponseDTO {
  /** Trusted devices that have not expired, most recently used first. */
  trustedDevices!: TrustedDeviceResponseDTO[];
}

/**
 * Request DTO for revoking one of the caller's own trusted devices.
 */
export class RevokeTrustedDeviceDTO {
  /**
   * Trusted device record id.
   *
   * Validation:
   * - Must be a positive integer
   */
  @IsInt({ message: 'Device id must be an integer' })
  @IsPositive({ message: 'Device id must be a positive integer' })
  @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value))
  deviceId!: number;
}

/**
 * Response DTO for revoking a single trusted device.
 */
export class RevokeTrustedDeviceResponseDTO {
  /** Whether a matching device was found and revoked. */
  success!: boolean;
}

/**
 * Response DTO for revoking every trusted device.
 */
export class RevokeAllTrustedDevicesResponseDTO {
  /** How many devices were revoked. */
  revokedCount!: number;
}

/**
 * DTO for administrative trusted-device management (list / revoke all) by user sub
 *
 * Revoking a single device also needs the device id, so that uses
 * {@link AdminRevokeTrustedDeviceDTO} instead.
 */
export class AdminManageTrustedDevicesDTO {
  /**
   * Target user identifier (UUID v4)
   *
   * Validation:
   * - Must be valid UUID v4 format
   *
   * Sanitization:
   * - Trimmed and lowercased
   */
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  sub!: string;
}

/**
 * Request DTO for revoking one of another user's trusted devices (admin).
 */
export class AdminRevokeTrustedDeviceDTO {
  /**
   * Target user identifier (UUID v4)
   *
   * Validation:
   * - Must be valid UUID v4 format
   *
   * Sanitization:
   * - Trimmed and lowercased
   */
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  sub!: string;

  /**
   * Trusted device record id.
   *
   * Validation:
   * - Must be a positive integer
   */
  @IsInt({ message: 'Device id must be an integer' })
  @IsPositive({ message: 'Device id must be a positive integer' })
  @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value))
  deviceId!: number;
}
