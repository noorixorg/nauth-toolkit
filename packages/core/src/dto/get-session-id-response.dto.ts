/**
 * Response DTO for getting session ID
 *
 * Used to return just the session ID from the current request context.
 * Session ID is extracted from JWT token payload after authentication.
 *
 * @example
 * ```typescript
 * const result = await clientInfoService.getSessionId();
 * // Returns: { sessionId: 123 } or { sessionId: undefined }
 * ```
 */

/**
 * Response DTO for session ID
 */
export class GetSessionIdResponseDTO {
  /**
   * Current session ID (if available from authenticated request)
   *
   * Extracted from JWT token payload after authentication.
   * Optional - undefined if not available.
   */
  sessionId?: number;
}
