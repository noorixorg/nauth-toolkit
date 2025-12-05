/**
 * Change Password Response DTO
 *
 * Response DTO for changing password.
 * No validators needed - this is generated internally by the library.
 *
 * @example
 * ```typescript
 * await authService.changePassword({
 *   sub: 'user-uuid',
 *   oldPassword: 'OldPass123!',
 *   newPassword: 'NewPass456!'
 * });
 * // Returns: { success: true }
 * ```
 */

/**
 * Response DTO for change password
 */
export class ChangePasswordResponseDTO {
  /**
   * Success indicator
   * Always true on successful password change
   *
   * @example true
   */
  success!: boolean;
}
