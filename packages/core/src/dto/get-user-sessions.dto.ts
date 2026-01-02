import { IsUUID, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for getting user sessions
 *
 * @example
 * ```typescript
 * const dto = new GetUserSessionsDTO();
 * dto.sub = 'user-uuid-123';
 * const sessions = await authService.getUserSessions(dto);
 * ```
 */
export class GetUserSessionsDTO {
  /**
   * User sub (UUID)
   */
  @IsUUID('4')
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toLowerCase())
  sub!: string;
}
