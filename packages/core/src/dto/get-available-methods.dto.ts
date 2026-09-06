/**
 * DTO for getting available MFA methods
 *
 * Used to retrieve all registered and allowed MFA methods that can be set up for the
 * currently authenticated user.
 *
 * @example
 * ```typescript
 * const methods = await mfaService.getAvailableMethods();
 * // Returns: ['totp', 'sms', 'passkey']
 * ```
 */

/**
 * Response DTO for available MFA methods
 */
export class GetAvailableMethodsResponseDTO {
  /**
   * Array of available method names
   *
   * @example ['totp', 'sms', 'passkey', 'email']
   */
  availableMethods!: string[];
}
