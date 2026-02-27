import { IsString, IsUUID } from 'class-validator';
import { UserResponseDTO } from './user-response.dto';

/**
 * DTO for administrative account unlocking
 *
 * Unlocks a previously locked user account by clearing lock fields.
 * This reverses the effect of disableUser() or rate-limit lockouts.
 *
 * @example
 * ```typescript
 * const result = await authService.enableUser({
 *   sub: 'user-uuid-123'
 * });
 * ```
 */
export class EnableUserDTO {
  /**
   * User UUID (sub) to enable
   *
   * Must be valid UUID format
   */
  @IsString()
  @IsUUID()
  sub!: string;
}

/**
 * Response DTO for administrative account unlocking
 *
 * @example
 * ```typescript
 * {
 *   success: true,
 *   user: { sub: '...', email: '...', isLocked: false, ... }
 * }
 * ```
 */
export class EnableUserResponseDTO {
  /**
   * Unlock success flag
   */
  success!: boolean;

  /**
   * Sanitized user object with updated lock status
   */
  user!: UserResponseDTO;
}
