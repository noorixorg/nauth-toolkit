import { IsUUID, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for revoking a specific user session (admin-only)
 *
 * @example
 * ```typescript
 * const dto = new AdminRevokeSessionDTO();
 * dto.sub = 'user-uuid-123';
 * dto.sessionId = '456';
 * await adminAuthService.revokeUserSession(dto);
 * ```
 */
export class AdminRevokeSessionDTO {
  /**
   * User sub (UUID) - must match the session owner
   */
  @IsUUID('4')
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toLowerCase())
  sub!: string;

  /**
   * Session ID to revoke
   */
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}
