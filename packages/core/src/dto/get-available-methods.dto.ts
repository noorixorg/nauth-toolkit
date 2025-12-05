/**
 * DTO for getting available MFA methods
 *
 * Used to retrieve all registered and allowed MFA methods that can be set up for a user.
 *
 * @example
 * ```typescript
 * const methods = await mfaService.getAvailableMethods({
 *   sub: 'user-uuid'
 * });
 * // Returns: ['totp', 'sms', 'passkey']
 * ```
 */

import { IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for getting available MFA methods
 */
export class GetAvailableMethodsDTO {
  /**
   * User's unique identifier (UUID v4)
   *
   * Validation:
   * - Must be a valid UUID v4 format
   * - Matches DB constraint: char(36) or uuid
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  sub!: string;
}

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
