/**
 * Update User Attributes DTO
 *
 * Request DTO for users to update their own profile information.
 *
 * Security:
 * - Uses authenticated user context for sub
 * - All fields validated according to UserUpdateDTO rules
 * - Uniqueness constraints enforced
 *
 * @example
 * ```typescript
 * const result = await authService.updateUserAttributes({
 *   username: 'newusername',
 *   firstName: 'John',
 *   lastName: 'Doe',
 * });
 * ```
 */

import { UserUpdateDTO } from './user-update.dto';

/**
 * Request DTO for updating user attributes (self-service, no sub)
 */
export class UpdateUserAttributesDTO extends UserUpdateDTO {}
