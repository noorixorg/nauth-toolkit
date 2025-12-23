import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * StartSocialRedirectQueryDTO
 *
 * Query DTO for starting the redirect-first social login flow.
 *
 * @example
 * ```typescript
 * // GET /auth/social/google/redirect?returnTo=/auth/callback&appState=12345
 * ```
 */
export class StartSocialRedirectQueryDTO {
  /**
   * Frontend path or absolute URL to redirect to after authentication completes.
   *
   * Recommended: relative path only (e.g. `/auth/callback`).
   */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  returnTo?: string;

  /**
   * Opaque, non-secret state to round-trip back to the frontend.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  appState?: string;

  /**
   * Redirect action.
   */
  @IsOptional()
  @IsIn(['login', 'link'])
  action?: 'login' | 'link';
}

/**
 * SocialCallbackQueryDTO
 *
 * Query DTO for GET OAuth callbacks (providers redirect with query params).
 */
export class SocialCallbackQueryDTO {
  /** OAuth authorization code */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code?: string;

  /** OAuth state parameter */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  state?: string;

  /**
   * Google callback extras (ignored by nauth-toolkit).
   *
   * Google often includes these query params on the redirect back:
   * - scope
   * - authuser
   * - hd
   * - prompt
   *
   * Since the sample app uses whitelist+forbidNonWhitelisted validation globally,
   * we must explicitly allow them here to avoid 400 responses.
   */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  scope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  authuser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  hd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  prompt?: string;

  /** Some providers may include a session state parameter (ignored). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  session_state?: string;

  /** Some providers may include error URI (ignored). */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  error_uri?: string;

  /** Provider error (if user cancels, etc.) */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  error?: string;

  /** Provider error description */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  error_description?: string;
}

/**
 * SocialCallbackFormDTO
 *
 * Body DTO for Apple `form_post` callbacks.
 */
export class SocialCallbackFormDTO {
  /** OAuth authorization code */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code?: string;

  /** OAuth state parameter */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  state?: string;

  /**
   * Provider callback extras (ignored).
   *
   * Included for parity with GET callback DTO and to avoid strict validation issues.
   */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  scope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  authuser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  hd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  prompt?: string;

  /** Provider error (if user cancels, etc.) */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  error?: string;

  /** Provider error description */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  error_description?: string;
}

/**
 * SocialExchangeDTO
 *
 * Body DTO for exchanging an exchange token (json/hybrid and cookies-with-challenge flows).
 *
 * @example
 * ```typescript
 * // POST /auth/social/exchange
 * // { exchangeToken: '...' }
 * ```
 */
export class SocialExchangeDTO {
  /** One-time exchange token issued during callback redirect */
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  exchangeToken!: string;
}
