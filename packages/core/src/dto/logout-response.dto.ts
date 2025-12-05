/**
 * Logout Response DTO
 *
 * Response DTO for logging out from a specific session.
 * No validators needed - this is generated internally by the library.
 *
 * @example
 * ```typescript
 * await authService.logout({ forgetMe: false });
 * // Returns: { success: true }
 * ```
 */

/**
 * Response DTO for logout
 */
export class LogoutResponseDTO {
  /**
   * Success indicator
   * Always true on successful logout
   *
   * @example true
   */
  success!: boolean;
}
