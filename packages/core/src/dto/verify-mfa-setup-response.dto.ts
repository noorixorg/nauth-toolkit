/**
 * Response DTO for verifying MFA setup
 *
 * Returned when an authenticated user completes MFA device setup verification.
 *
 * @example
 * ```typescript
 * const result = await provider.verifySetup(setupData);
 * // Returns: { deviceId: 123 }
 * ```
 */
export class VerifyMFASetupResponseDTO {
  /**
   * ID of the newly created MFA device
   */
  deviceId!: number;
}
