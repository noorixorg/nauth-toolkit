import { Repository } from 'typeorm';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { createHash } from 'crypto';
import { BaseTrustedDevice } from '../entities/trusted-device.entity';

/**
 * Trusted Device Service
 *
 * Manages device trust for "remember device" feature.
 * Devices can be trusted after successful MFA verification, allowing
 * users to skip MFA for a configured period (rememberDeviceDays).
 *
 * Security:
 * - Device tokens are server-generated UUIDs
 * - Only hash stored in database (SHA-256)
 * - Tokens persist across logouts and session expiry
 * - Independent of refresh token lifecycle
 *
 * @example
 * ```typescript
 * // Mark device as trusted after MFA
 * const deviceToken = await trustedDeviceService.createTrustedDevice(
 *   userId,
 *   deviceName,
 *   deviceType,
 *   ipAddress,
 *   userAgent,
 *   platform,
 *   browser
 * );
 *
 * // Check if device is trusted
 * const isTrusted = await trustedDeviceService.isDeviceTrusted(
 *   deviceToken,
 *   userId
 * );
 * ```
 */
export class TrustedDeviceService {
  constructor(
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
    private readonly trustedDeviceRepository?: Repository<BaseTrustedDevice>,
  ) {}

  /**
   * Create trusted device record
   *
   * Generates a secure device token, stores its hash in database,
   * and returns the plain token for client storage.
   *
   * @param userId - Internal user ID
   * @param deviceName - Optional device name
   * @param deviceType - Optional device type (mobile/desktop/tablet)
   * @param ipAddress - IP address when device was trusted
   * @param userAgent - User agent string
   * @param platform - Platform from user agent
   * @param browser - Browser from user agent
   * @returns Device token (UUID) to be stored by client
   *
   * @throws {Error} If rememberDevice is not enabled or repository not available
   */
  async createTrustedDevice(
    userId: number,
    deviceName?: string | null,
    deviceType?: string | null,
    ipAddress?: string | null,
    userAgent?: string | null,
    platform?: string | null,
    browser?: string | null,
  ): Promise<string> {
    if (!this.config.mfa?.rememberDevices || this.config.mfa.rememberDevices === 'never') {
      throw new Error('rememberDevices is not enabled in configuration');
    }

    if (!this.trustedDeviceRepository) {
      this.logger?.warn?.('TrustedDeviceRepository not available - trusted device feature disabled');
      throw new Error('TrustedDeviceRepository not available');
    }

    // Generate secure device token (UUID v4)
    const crypto = await import('crypto');
    const deviceToken = crypto.randomUUID();

    // Hash token for storage (SHA-256)
    const deviceTokenHash = this.hashDeviceToken(deviceToken);

    // Calculate expiry (now + rememberDeviceDays)
    // Only applicable if rememberDevices is not 'never'
    const rememberDeviceDays = this.config.mfa.rememberDeviceDays || 30;
    const trustedUntil = new Date();
    trustedUntil.setDate(trustedUntil.getDate() + rememberDeviceDays);

    // Check if device already trusted (by hash)
    const existing = await this.trustedDeviceRepository.findOne({
      where: {
        userId,
        deviceTokenHash,
      },
    });

    if (existing) {
      // Update existing record
      await this.trustedDeviceRepository.update(
        { userId, deviceTokenHash },
        {
          trustedUntil,
          lastUsedAt: new Date(),
          deviceName: deviceName || null,
          deviceType: deviceType || null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          platform: platform || null,
          browser: browser || null,
        },
      );
      this.logger?.debug?.(`Updated trusted device for user ${userId}`);
      return deviceToken;
    }

    // Create new trusted device record
    const trustedDevice = this.trustedDeviceRepository.create({
      userId,
      deviceTokenHash,
      deviceId: null, // Not used, kept for backward compatibility
      deviceName: deviceName || null,
      deviceType: deviceType || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      platform: platform || null,
      browser: browser || null,
      trustedUntil,
      lastUsedAt: new Date(),
    });

    await this.trustedDeviceRepository.save(trustedDevice);
    this.logger?.debug?.(`Created trusted device for user ${userId}, expires ${trustedUntil.toISOString()}`);

    return deviceToken;
  }

  /**
   * Check if device is trusted
   *
   * Validates device token against trusted devices table.
   * Updates lastUsedAt if device is found and valid.
   *
   * Security:
   * - Returns false for invalid/tampered tokens (silent - MFA required)
   * - Detection of tampered tokens should be handled by caller for audit logging
   *
   * @param deviceToken - Device token from client (plain UUID)
   * @param userId - Internal user ID
   * @returns True if device is trusted and not expired
   */
  async isDeviceTrusted(deviceToken: string | null | undefined, userId: number): Promise<boolean> {
    if (!deviceToken || !this.trustedDeviceRepository) {
      return false;
    }

    if (!this.config.mfa?.rememberDevices || this.config.mfa.rememberDevices === 'never') {
      return false;
    }

    // Hash token for lookup
    const deviceTokenHash = this.hashDeviceToken(deviceToken);

    // Find trusted device
    const trustedDevice = await this.trustedDeviceRepository.findOne({
      where: {
        userId,
        deviceTokenHash,
      },
    });

    if (!trustedDevice) {
      // Device token not found - could be tampered/fake
      // Caller should check if token was provided and audit suspicious activity
      return false;
    }

    // Check if trust has expired
    const trustedUntil = trustedDevice.trustedUntil;
    if (new Date() > new Date(trustedUntil)) {
      // Trust expired - delete record
      await this.trustedDeviceRepository.delete({
        userId,
        deviceTokenHash,
      });
      this.logger?.debug?.(`Trusted device expired for user ${userId}`);
      return false;
    }

    // Update lastUsedAt with throttling to reduce write load
    const lastUsedAt = trustedDevice.lastUsedAt;
    const now = new Date();
    const fifteenMinutesMs = 15 * 60 * 1000;
    if (!lastUsedAt || now.getTime() - new Date(lastUsedAt).getTime() > fifteenMinutesMs) {
      await this.trustedDeviceRepository.update({ userId, deviceTokenHash }, { lastUsedAt: now });
    }

    return true;
  }

  /**
   * Validate device token and detect tampering attempts
   *
   * Checks if device token is valid and returns validation result.
   * Used to detect suspicious tampered/fake token attempts for audit logging.
   *
   * @param deviceToken - Device token from client (can be null/undefined)
   * @param userId - Internal user ID
   * @returns Validation result with suspicious flag
   */
  async validateDeviceToken(
    deviceToken: string | null | undefined,
    userId: number,
  ): Promise<{ isValid: boolean; isSuspicious: boolean }> {
    // No token provided - not suspicious (user just doesn't have trusted device)
    if (!deviceToken) {
      return { isValid: false, isSuspicious: false };
    }

    // Check if trusted
    const isTrusted = await this.isDeviceTrusted(deviceToken, userId);

    // If token was provided but not trusted, it's suspicious (tampered/fake)
    const isSuspicious = !isTrusted && deviceToken !== null && deviceToken !== undefined;

    return { isValid: isTrusted, isSuspicious };
  }

  /**
   * Revoke trusted device
   *
   * Removes device from trusted devices table.
   * Used when user explicitly untrusts a device.
   *
   * @param deviceToken - Device token to revoke
   * @param userId - Internal user ID
   */
  async revokeTrustedDevice(deviceToken: string, userId: number): Promise<void> {
    if (!this.trustedDeviceRepository) {
      return;
    }

    const deviceTokenHash = this.hashDeviceToken(deviceToken);
    await this.trustedDeviceRepository.delete({
      userId,
      deviceTokenHash,
    });

    this.logger?.debug?.(`Revoked trusted device for user ${userId}`);
  }

  /**
   * Revoke one trusted device by its record id
   *
   * The device list deliberately never exposes token hashes, so a management UI can only
   * identify a device by id - this is the revoke path that pairs with it. The delete is
   * scoped by `userId` as well as `id`, so one user cannot revoke another's device.
   *
   * @param deviceId - Trusted device record id
   * @param userId - Internal user ID that must own the device
   * @returns Whether a device was deleted
   */
  async revokeTrustedDeviceById(deviceId: number, userId: number): Promise<boolean> {
    if (!this.trustedDeviceRepository) {
      return false;
    }

    const result = await this.trustedDeviceRepository.delete({ id: deviceId, userId });
    const deleted = typeof result.affected === 'number' ? result.affected > 0 : false;

    if (deleted) {
      this.logger?.debug?.(`Revoked trusted device ${deviceId} for user ${userId}`);
    }

    return deleted;
  }

  /**
   * Get user's trusted devices
   *
   * Returns list of trusted devices for management UI.
   *
   * @param userId - Internal user ID
   * @returns Array of trusted device records (without tokens)
   */
  async getUserTrustedDevices(userId: number): Promise<Omit<BaseTrustedDevice, 'deviceTokenHash'>[]> {
    if (!this.trustedDeviceRepository) {
      return [];
    }

    const devices = await this.trustedDeviceRepository.find({
      where: { userId },
      order: { lastUsedAt: 'DESC' },
    });

    // Filter expired devices
    const now = new Date();
    const validDevices = devices.filter((d) => new Date(d.trustedUntil) > now);

    // Return without sensitive data
    return validDevices.map((d) => {
      const { deviceTokenHash, ...rest } = d;
      return rest;
    });
  }

  /**
   * Revoke all trusted devices for a user
   *
   * Removes all trusted devices for the user.
   * Used when user performs global logout with forgetDevices flag.
   *
   * @param userId - Internal user ID
   * @returns Object containing count and device information before deletion
   */
  async revokeAllTrustedDevices(userId: number): Promise<{
    revokedCount: number;
    devices: Array<{
      id: number | string;
      deviceName: string | null;
      lastUsedAt: Date | null;
      trustedUntil: Date | null;
    }>;
  }> {
    if (!this.trustedDeviceRepository) {
      return { revokedCount: 0, devices: [] };
    }

    // Get devices before deletion for audit logging
    const devices = await this.trustedDeviceRepository.find({
      where: { userId },
      order: { lastUsedAt: 'DESC' },
    });

    // Extract device information (without sensitive token hash)
    // Note: ipAddress, browser, platform, deviceType are automatically captured by audit service via client info
    // Only include unique identifiers and historical timestamps
    const deviceInfo = devices.map((d) => ({
      id: d.id,
      deviceName: d.deviceName ?? null, // User-given name (may differ from current device name)
      lastUsedAt: d.lastUsedAt ?? null, // Historical timestamp
      trustedUntil: d.trustedUntil ?? null, // Expiry date
    }));

    // Delete all devices
    const result = await this.trustedDeviceRepository.delete({ userId });
    const deletedCount = typeof result.affected === 'number' ? result.affected : 0;
    this.logger?.debug?.(`Revoked ${deletedCount} trusted device(s) for user ${userId}`);
    return { revokedCount: deletedCount, devices: deviceInfo };
  }

  /**
   * Hash device token (SHA-256)
   *
   * @private
   */
  private hashDeviceToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
