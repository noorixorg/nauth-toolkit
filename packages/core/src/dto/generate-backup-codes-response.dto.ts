/**
 * Response DTO for backup code generation
 *
 * Generating codes replaces any codes the user already held, so the plaintext values
 * are returned exactly once here and only their hashes are kept at rest.
 */
export class GenerateBackupCodesResponseDTO {
  /**
   * Freshly generated single-use recovery codes, in plaintext.
   *
   * @example ['A1B2C3D4', 'E5F6G7H8']
   */
  codes!: string[];
}
