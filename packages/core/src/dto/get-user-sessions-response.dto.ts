import { IsString, IsBoolean, IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Session information in user sessions response
 */
export class UserSessionInfo {
  /**
   * Session ID
   */
  @IsString()
  sessionId!: string;

  /**
   * Device ID
   */
  @IsString()
  @IsOptional()
  deviceId!: string | null;

  /**
   * Device name
   */
  @IsString()
  @IsOptional()
  deviceName!: string | null;

  /**
   * Device type
   */
  @IsString()
  @IsOptional()
  deviceType!: string | null;

  /**
   * Platform
   */
  @IsString()
  @IsOptional()
  platform!: string | null;

  /**
   * Browser
   */
  @IsString()
  @IsOptional()
  browser!: string | null;

  /**
   * IP address
   */
  @IsString()
  @IsOptional()
  ipAddress!: string | null;

  /**
   * IP country
   */
  @IsString()
  @IsOptional()
  ipCountry!: string | null;

  /**
   * IP city
   */
  @IsString()
  @IsOptional()
  ipCity!: string | null;

  /**
   * Last activity timestamp
   */
  @IsDate()
  @Type(() => Date)
  lastActivityAt!: Date;

  /**
   * Session creation timestamp
   */
  @IsDate()
  @Type(() => Date)
  createdAt!: Date;

  /**
   * Session expiration timestamp
   */
  @IsDate()
  @Type(() => Date)
  expiresAt!: Date;

  /**
   * Whether session is remembered
   */
  @IsBoolean()
  isRemembered!: boolean;

  /**
   * Whether this is the current session
   */
  @IsBoolean()
  isCurrent!: boolean;

  /**
   * Authentication method used for this session
   * Examples: 'password', 'social', 'admin', 'admin-social'
   * For social logins, check authProvider for the specific OAuth provider
   */
  @IsString()
  @IsOptional()
  authMethod!: string | null;

  /**
   * OAuth provider name (only present for social logins)
   * Examples: 'google', 'facebook', 'github', 'apple'
   */
  @IsString()
  @IsOptional()
  authProvider!: string | null;
}

/**
 * Response DTO for getting user sessions
 *
 * @example
 * ```typescript
 * const response = await authService.getUserSessions(dto);
 * // response.sessions = [{ sessionId: '123', authMethod: 'password', ... }, ...]
 * ```
 */
export class GetUserSessionsResponseDTO {
  /**
   * Array of user sessions
   */
  sessions!: UserSessionInfo[];
}
