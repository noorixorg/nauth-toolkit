/**
 * DTO for requesting MFA challenge data
 *
 * Used to get method-specific challenge information during MFA verification.
 * Currently only passkey method requires challenge data (WebAuthn options).
 *
 * Security:
 * - Session token length limited (prevents DoS)
 * - Method validated against enum (prevents injection)
 *
 * @example
 * ```typescript
 * const challengeData = await authService.getChallengeData({
 *   session: 'challenge-session-token',
 *   method: 'passkey'
 * });
 * // Returns: { publicKey: { challenge: '...', ... } }
 * ```
 */

import { IsEnum, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * MFA method enum for challenge data
 * Currently only passkey requires challenge data
 */
export enum MFAChallengeMethod {
  PASSKEY = 'passkey',
}

/**
 * DTO for getting MFA challenge data
 */
export class GetChallengeDataDTO {
  /**
   * Challenge session token (UUID v4)
   *
   * Validation:
   * - Must be a valid UUID v4 format
   * - Generated using randomUUID() in challenge service
   * - Matches DB constraint: varchar(255) but UUID format enforced
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @IsUUID('4', { message: 'Session token must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  session!: string;

  /**
   * MFA method requiring challenge data
   *
   * Validation:
   * - Must be 'passkey' (only method that needs challenge data)
   */
  @IsEnum(MFAChallengeMethod, {
    message: 'Method must be: passkey',
  })
  method!: MFAChallengeMethod;
}
