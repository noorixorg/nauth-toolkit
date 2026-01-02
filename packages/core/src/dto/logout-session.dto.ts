import { IsUUID, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for logging out a specific session
 *
 * @example
 * ```typescript
 * const dto = new LogoutSessionDTO();
 * dto.sub = 'user-uuid-123';
 * dto.sessionId = '456';
 * await authService.logoutSession(dto);
 * ```
 */
export class LogoutSessionDTO {
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
