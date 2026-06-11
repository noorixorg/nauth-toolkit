import { IsBoolean } from 'class-validator';

/**
 * Response DTO for logging out a specific session
 *
 * @example
 * ```typescript
 * const response = await authService.logoutSession(dto);
 * // response.success === true
 * ```
 */
export class LogoutSessionResponseDTO {
  /**
   * Whether the session was successfully revoked
   */
  @IsBoolean()
  success!: boolean;

  /**
   * Whether the revoked session was the current session
   */
  @IsBoolean()
  wasCurrentSession!: boolean;
}
