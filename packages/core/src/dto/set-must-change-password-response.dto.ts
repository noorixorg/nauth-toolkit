/**
 * Set Must Change Password Response DTO
 *
 * Response DTO for setting must change password flag.
 * No validators needed - this is generated internally by the library.
 *
 * @example
 * ```typescript
 * await authService.setMustChangePassword({
 *   userId: 'user-uuid'
 * });
 * // Returns: { success: true }
 * ```
 */

/**
 * Response DTO for set must change password
 */
export class SetMustChangePasswordResponseDTO {
  /**
   * Success indicator
   * Always true on successful flag set
   *
   * @example true
   */
  success!: boolean;
}
