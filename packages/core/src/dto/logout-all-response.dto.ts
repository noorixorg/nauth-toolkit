/**
 * Logout All Response DTO
 *
 * Response DTO for logging out from all sessions.
 * No validators needed - this is generated internally by the library.
 *
 * @example
 * ```typescript
 * const result = await authService.logoutAll({ sub: 'user-uuid' });
 * // Returns: { revokedCount: 5 }
 * ```
 */

/**
 * Response DTO for logout all sessions
 */
export class LogoutAllResponseDTO {
  /**
   * Number of sessions revoked
   *
   * @example 5
   */
  revokedCount!: number;
}
