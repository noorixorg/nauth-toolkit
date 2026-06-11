/**
 * Resend Code Response DTO
 *
 * Response DTO for resending verification codes.
 * No validators needed - this is generated internally by the library.
 *
 * Security:
 * - Email/phone masked for privacy
 * - Only shows destination, not full details
 *
 * @example
 * ```typescript
 * const result = await authService.resendCode({ session: 'session-uuid' });
 * // Returns: { destination: 'u***r@example.com' }
 * ```
 */

/**
 * Response DTO for resend code
 */
export class ResendCodeResponseDTO {
  /**
   * Masked destination where code was sent
   *
   * Format:
   * - Email: "u***r@example.com"
   * - Phone: "+1***5678"
   *
   * @example "u***r@example.com"
   */
  destination!: string;
}
