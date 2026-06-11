/**
 * DTO for requesting MFA challenge data
 *
 * Used to get method-specific challenge information during MFA verification.
 * Supports:
 * - Passkey: Returns WebAuthn authentication options
 * - SMS: Sends SMS code and returns masked phone number
 * - Email: Sends email code and returns masked email address
 *
 * Security:
 * - Session token length limited (prevents DoS)
 * - Method validated against enum (prevents injection)
 *
 * @example
 * ```typescript
 * // Passkey: Get WebAuthn options
 * const challengeData = await authService.getChallengeData({
 *   session: 'challenge-session-token',
 *   method: 'passkey'
 * });
 * // Returns: { challengeData: { challenge: '...', allowCredentials: [...], ... } }
 *
 * // SMS: Send code and get masked phone
 * const challengeData = await authService.getChallengeData({
 *   session: 'challenge-session-token',
 *   method: 'sms'
 * });
 * // Returns: { challengeData: '***-***-1234' }
 *
 * // Email: Send code and get masked email
 * const challengeData = await authService.getChallengeData({
 *   session: 'challenge-session-token',
 *   method: 'email'
 * });
 * // Returns: { challengeData: 'u***r@example.com' }
 * ```
 */

import { IsEnum, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * MFA method enum for challenge data
 * Supports passkey (WebAuthn options), SMS (sends code), and Email (sends code)
 */
export enum MFAChallengeMethod {
  PASSKEY = 'passkey',
  SMS = 'sms',
  EMAIL = 'email',
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
   * - Must be 'passkey' (WebAuthn options), 'sms' (sends code), or 'email' (sends code)
   */
  @IsEnum(MFAChallengeMethod, {
    message: 'Method must be: passkey, sms, or email',
  })
  method!: MFAChallengeMethod;
}
