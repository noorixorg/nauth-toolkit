import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for logging out a specific session
 *
 * @example
 * ```typescript
 * const dto = new LogoutSessionDTO();
 * dto.sessionId = '456';
 * await authService.logoutSession(dto);
 * ```
 */
export class LogoutSessionDTO {
  /**
   * Session ID to revoke
   */
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}
