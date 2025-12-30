import { IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';
import { UserResponseDto } from './user-response.dto';

/**
 * DTO for administrative permanent account locking
 *
 * Locks user account permanently (lockedUntil=NULL) and revokes all active sessions.
 * Uses existing rate-limit lock fields (isLocked, lockReason, lockedAt, lockedUntil).
 *
 * Permanent vs Temporary locks:
 * - Rate limiting: lockedUntil = future date (temporary auto-unlock)
 * - Admin disableUser: lockedUntil = NULL (permanent manual lock)
 *
 * @example
 * ```typescript
 * const result = await authService.disableUser({
 *   sub: 'user-uuid-123',
 *   reason: 'Suspicious activity detected'
 * });
 * ```
 */
export class DisableUserDTO {
  /**
   * User UUID (sub) to disable
   *
   * Must be valid UUID format
   */
  @IsString()
  @IsUUID()
  sub!: string;

  /**
   * Optional reason for locking account
   *
   * Recorded in lockReason field and audit trail.
   * Max 500 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * Response DTO for administrative account locking
 *
 * @example
 * ```typescript
 * {
 *   success: true,
 *   user: { sub: '...', email: '...', isLocked: true, ... },
 *   revokedSessions: 3
 * }
 * ```
 */
export class DisableUserResponseDTO {
  /**
   * Lock success flag
   */
  success!: boolean;

  /**
   * Sanitized user object with updated lock status
   */
  user!: UserResponseDto;

  /**
   * Number of sessions revoked (forced logout)
   */
  revokedSessions!: number;
}
