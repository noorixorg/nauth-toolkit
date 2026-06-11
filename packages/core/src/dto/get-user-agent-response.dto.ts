/**
 * Response DTO for getting user agent
 *
 * Used to return just the user agent string from the current request context.
 *
 * @example
 * ```typescript
 * const result = await clientInfoService.getUserAgent();
 * // Returns: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...' }
 * ```
 */

/**
 * Response DTO for user agent
 */
export class GetUserAgentResponseDTO {
  /**
   * User agent string from the request
   *
   * Returns 'unknown' if called outside request context.
   */
  userAgent!: string;
}
