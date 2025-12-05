/**
 * Response DTO for getting MFA challenge data
 *
 * Used to return method-specific challenge data during MFA verification.
 * Currently only passkey method requires challenge data (WebAuthn options).
 *
 * @example
 * ```typescript
 * const challengeData = await mfaService.getChallengeData({
 *   session: 'challenge-session-token',
 *   method: 'passkey'
 * });
 * // Returns: { publicKey: { challenge: '...', ... } }
 * ```
 */

/**
 * Response DTO for challenge data
 */
export class GetChallengeDataResponseDTO {
  /**
   * Provider-specific challenge data
   *
   * For passkey: WebAuthn public key options
   * Structure: { publicKey: { challenge: string, allowCredentials: [...], ... } }
   */
  challengeData!: Record<string, unknown>;
}
