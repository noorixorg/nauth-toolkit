/**
 * Response DTO for listing MFA providers
 *
 * Used to return all registered MFA provider method names.
 *
 * @example
 * ```typescript
 * const providers = await mfaService.listProviders();
 * // Returns: { providers: ['totp', 'sms', 'passkey'] }
 * ```
 */

/**
 * Response DTO for listing providers
 */
export class ListProvidersResponseDTO {
  /**
   * Array of registered provider method names
   *
   * @example ['totp', 'sms', 'passkey']
   */
  providers!: string[];
}
