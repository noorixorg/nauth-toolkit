/**
 * Response DTO for getting device token
 *
 * Used to return just the device token from the current request context.
 * Device token is used for trusted device feature.
 *
 * @example
 * ```typescript
 * const result = await clientInfoService.getDeviceToken();
 * // Returns: { deviceToken: 'device-token-123' } or { deviceToken: undefined }
 * ```
 */

/**
 * Response DTO for device token
 */
export class GetDeviceTokenResponseDTO {
  /**
   * Device token for trusted device feature
   *
   * Extracted from cookie (nauth_device_id) or header (X-Device-Token).
   * Optional - undefined if not present.
   */
  deviceToken?: string;
}
