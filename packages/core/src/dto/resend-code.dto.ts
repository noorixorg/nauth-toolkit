/**
 * DTO for resending verification code
 *
 * Used to resend email/SMS verification codes during challenges:
 * - Email verification (VERIFY_EMAIL)
 * - Phone verification (VERIFY_PHONE)
 * - MFA verification (MFA_REQUIRED with SMS/Email method)
 *
 * Security:
 * - Session token length limited (prevents DoS)
 * - Rate limiting enforced in service layer
 *
 * @example
 * ```typescript
 * const result = await authService.resendCode({
 *   session: 'challenge-session-token'
 * });
 * // Returns: { destination: 'u***r@example.com' }
 * ```
 */

import { IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for resending verification code
 */
export class ResendCodeDTO {
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
}
