/**
 * Admin Update User Attributes DTO
 *
 * Request DTO for administrators to update a user's profile information.
 *
 * Security:
 * - Requires target user sub (UUID)
 * - All fields validated according to UserUpdateDTO rules
 * - Uniqueness constraints enforced
 *
 * @example
 * ```typescript
 * const result = await adminAuthService.updateUserAttributes({
 *   sub: 'user-uuid',
 *   username: 'newusername',
 *   firstName: 'John',
 *   lastName: 'Doe',
 * });
 * ```
 */

import { IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserUpdateDTO } from './user-update.dto';

/**
 * Request DTO for admin updating user attributes (includes sub)
 */
export class AdminUpdateUserAttributesDTO extends UserUpdateDTO {
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
