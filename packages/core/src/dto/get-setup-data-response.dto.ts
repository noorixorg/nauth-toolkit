/**
 * Response DTO for getting MFA setup data
 *
 * Used to return method-specific setup data during MFA enrollment.
 * Structure varies by method (TOTP returns QR code, Passkey returns options, etc.).
 *
 * @example
 * ```typescript
 * const setupData = await mfaService.getSetupData({
 *   session: 'challenge-session-token',
 *   method: 'totp'
 * });
 * // Returns: { secret: '...', qrCode: '...', manualEntryKey: '...' }
 * ```
 */

/**
 * Response DTO for setup data
 */
export class GetSetupDataResponseDTO {
  /**
   * Provider-specific setup data
   *
   * Structure varies by method:
   * - TOTP: { secret: string, qrCode: string, manualEntryKey: string }
   * - SMS: { maskedPhone: string }
   * - Email: { maskedEmail: string }
   * - Passkey: WebAuthn registration options
   */
  setupData!: Record<string, unknown>;
}
