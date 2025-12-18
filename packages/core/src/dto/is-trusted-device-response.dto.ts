/**
 * Is Trusted Device Response DTO
 *
 * Response DTO for checking if the current device is trusted.
 * No validators needed - this is generated internally by the library.
 *
 * Security:
 * - Works in both cookies mode (reads from httpOnly cookie) and JSON mode (reads from X-Device-Token header)
 * - Returns server-validated trusted status
 * - Does not expose device token value for security
 *
 * @example
 * ```typescript
 * const result = await authService.isTrustedDevice();
 * // Returns: { trusted: true }
 * ```
 */

/**
 * Response DTO for checking trusted device status
 */
export class IsTrustedDeviceResponseDTO {
  /**
   * Whether the current device is trusted
   *
   * True if the device has a valid trusted device token and trust has not expired.
   * False if no device token exists, device token is invalid, or trust has expired.
   *
   * @example true
   */
  trusted!: boolean;
}

