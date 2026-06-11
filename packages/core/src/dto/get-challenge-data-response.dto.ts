/**
 * Response DTO for getting MFA challenge data
 *
 * Used to return method-specific challenge data during MFA verification.
 * Supports multiple MFA methods:
 * - Passkey: Returns WebAuthn authentication options (object)
 * - SMS: Returns masked phone number where code was sent (string)
 * - Email: Returns masked email address where code was sent (string)
 *
 * @example
 * ```typescript
 * // Passkey: WebAuthn options
 * const challengeData = await mfaService.getChallengeData({
 *   session: 'challenge-session-token',
 *   method: 'passkey'
 * });
 * // Returns: { challengeData: { publicKey: { challenge: '...', ... } } }
 *
 * // SMS: Masked phone number
 * const challengeData = await mfaService.getChallengeData({
 *   session: 'challenge-session-token',
 *   method: 'sms'
 * });
 * // Returns: { challengeData: '***-***-1234' }
 *
 * // Email: Masked email address
 * const challengeData = await mfaService.getChallengeData({
 *   session: 'challenge-session-token',
 *   method: 'email'
 * });
 * // Returns: { challengeData: 'u***r@example.com' }
 * ```
 */

/**
 * Response DTO for challenge data
 */
export class GetChallengeDataResponseDTO {
  /**
   * Provider-specific challenge data
   *
   * Type varies by method:
   * - Passkey: WebAuthn public key options object
   *   Structure: { publicKey: { challenge: string, allowCredentials: [...], ... } }
   * - SMS: Masked phone number string (e.g., '***-***-1234')
   * - Email: Masked email address string (e.g., 'u***r@example.com')
   *
   * Note: Type is `Record<string, unknown>` which accommodates both object and string types.
   * Frontend should check `typeof challengeData === 'string'` to determine if it's SMS/Email (string) or Passkey (object).
   */
  challengeData!: Record<string, unknown>;
}
