/**
 * Update User Attributes Request DTO
 *
 * Request DTO for updating user profile information (includes user sub).
 *
 * Security:
 * - User sub validated (UUID)
 * - All fields validated according to UserUpdateDTO rules
 * - Uniqueness constraints enforced
 *
 * @example
 * ```typescript
 * const result = await authService.updateUserAttributes({
 *   sub: 'user-uuid',
 *   username: 'newusername',
 *   firstName: 'John',
 *   lastName: 'Doe'
 * });
 * ```
 */

import { IsUUID, IsOptional, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserUpdateDTO } from './user-update.dto';

/**
 * Request DTO for updating user attributes (includes user sub)
 */
export class UpdateUserAttributesRequestDTO extends UserUpdateDTO {
  /**
   * User's unique identifier (UUID v4)
   *
   * Optional at controller level - filled from authenticated user's JWT.
   * Validated only when provided (service layer will ensure it's set).
   *
   * Validation:
   * - Must be a valid UUID v4 format when provided
   * - Matches DB constraint: char(36) or uuid
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @ValidateIf((o) => o.sub !== undefined && o.sub !== null && o.sub !== '')
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  @IsOptional()
  sub?: string;
}
