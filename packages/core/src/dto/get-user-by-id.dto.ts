/**
 * Get User By ID DTO
 *
 * Request DTO for retrieving a user by their unique identifier (sub).
 *
 * Security:
 * - UUID format validated
 * - Prevents injection attacks
 *
 * @example
 * ```typescript
 * const user = await authService.getUserById({
 *   sub: 'a21b654c-2746-4168-acee-c175083a65cd'
 * });
 * ```
 */

import { IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for getting user by ID
 */
export class GetUserByIdDTO {
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
