/**
 * Trust Device Response DTO
 *
 * Response DTO for trusting a device.
 * No validators needed - this is generated internally by the library.
 *
 * Security:
 * - Device token should be stored securely on client
 * - Used for MFA bypass on trusted devices
 *
 * @example
 * ```typescript
 * const result = await authService.trustDevice();
 * // Returns: { deviceToken: 'device-token-string' }
 * ```
 */

/**
 * Response DTO for trust device
 */
export class TrustDeviceResponseDTO {
  /**
   * Device trust token
   *
   * Note: Store this token securely on the client device
   *
   * @example "device-token-uuid-string"
   */
  deviceToken!: string;
}
