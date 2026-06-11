/**
 * Response DTO for getting IP address
 *
 * Used to return just the IP address from the current request context.
 *
 * @example
 * ```typescript
 * const result = await clientInfoService.getIpAddress();
 * // Returns: { ipAddress: '192.168.1.100' }
 * ```
 */

/**
 * Response DTO for IP address
 */
export class GetIpAddressResponseDTO {
  /**
   * Client IP address
   *
   * Extracted from X-Forwarded-For, CF-Connecting-IP, etc.
   * Returns 'unknown' if called outside request context.
   */
  ipAddress!: string;
}
