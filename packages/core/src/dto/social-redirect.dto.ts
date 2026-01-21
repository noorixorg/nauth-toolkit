import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for starting the redirect-first social login flow
 *
 * Used when initiating a backend-first OAuth redirect flow where the provider
 * redirects back to the backend callback endpoint.
 *
 * @example
 * ```typescript
 * // GET /auth/social/google/redirect?returnTo=/auth/callback&appState=12345&action=login
 * ```
 */
export class StartSocialRedirectQueryDTO {
  /**
   * Frontend path or absolute URL to redirect to after authentication completes
   *
   * Validation:
   * - Optional field
   * - Max 2048 characters
   *
   * Sanitization:
   * - Trimmed
   *
   * @example '/auth/callback'
   * @example 'https://myapp.com/auth/callback'
   */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  returnTo?: string;

  /**
   * Opaque, non-secret state to round-trip back to the frontend
   *
   * This value is stored during the OAuth flow and returned to the frontend
   * after authentication completes. Use it to maintain UI state across the redirect.
   *
   * Validation:
   * - Optional field
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   *
   * @example '12345'
   * @example 'page=dashboard&mode=dark'
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  appState?: string;

  /**
   * Redirect action type
   *
   * - `login`: Standard social login/signup (default)
   * - `link`: Link social account to existing authenticated user
   *
   * Validation:
   * - Optional field
   * - Must be either 'login' or 'link'
   *
   * @example 'login'
   * @example 'link'
   */
  @IsOptional()
  @IsIn(['login', 'link'])
  action?: 'login' | 'link';

  /**
   * Additional OAuth parameters to pass to the provider
   *
   * Allows per-request customization of OAuth flow (e.g., force account chooser).
   * These parameters override config defaults and are appended to the authorization URL.
   *
   * Pass as JSON string in query parameter.
   *
   * Validation:
   * - Optional field
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   *
   * @example Google - Force account chooser
   * ```
   * GET /auth/social/google/redirect?oauthParams={"prompt":"select_account"}
   * ```
   *
   * @example Facebook - Rerequest permissions
   * ```
   * GET /auth/social/facebook/redirect?oauthParams={"auth_type":"rerequest"}
   * ```
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  oauthParams?: string;
}

/**
 * DTO for OAuth callbacks via GET query parameters
 *
 * Used by providers that redirect with query params (Google, Facebook).
 * This DTO handles both successful callbacks and error scenarios.
 *
 * @example
 * ```typescript
 * // Successful callback
 * // GET /auth/social/google/callback?code=ABC123&state=xyz789
 *
 * // Error callback
 * // GET /auth/social/google/callback?error=access_denied&error_description=User+cancelled
 * ```
 */
export class SocialCallbackQueryDTO {
  /**
   * OAuth authorization code from provider
   *
   * Validation:
   * - Optional field
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code?: string;

  /**
   * OAuth state parameter for CSRF protection
   *
   * Validation:
   * - Optional field
   * - Max 500 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  state?: string;

  /**
   * Provider error code (if user cancels or error occurs)
   *
   * Validation:
   * - Optional field
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   *
   * @example 'access_denied'
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  error?: string;

  /**
   * Provider error description
   *
   * Validation:
   * - Optional field
   * - Max 4000 characters
   *
   * Sanitization:
   * - Trimmed
   *
   * @example 'User cancelled the authentication request'
   */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  error_description?: string;

  /**
   * Google-specific: OAuth scope parameter
   *
   * Google often includes this in the callback. Explicitly allowed to avoid
   * validation errors when using whitelist + forbidNonWhitelisted validation.
   *
   * Validation:
   * - Optional field
   * - Max 4000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  scope?: string;

  /**
   * Google-specific: Authenticated user index
   *
   * Validation:
   * - Optional field
   * - Max 50 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  authuser?: string;

  /**
   * Google-specific: Hosted domain parameter
   *
   * Validation:
   * - Optional field
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  hd?: string;

  /**
   * Google-specific: Prompt parameter
   *
   * Validation:
   * - Optional field
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  prompt?: string;

  /**
   * Provider-specific: Session state parameter
   *
   * Some providers include this for session management.
   *
   * Validation:
   * - Optional field
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  session_state?: string;

  /**
   * Provider-specific: Error URI parameter
   *
   * Some providers include a URI with more error details.
   *
   * Validation:
   * - Optional field
   * - Max 4000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  error_uri?: string;
}

/**
 * DTO for Apple form_post OAuth callbacks
 *
 * Apple uses POST form_post response mode instead of query parameters.
 * This DTO handles the form data sent to the callback endpoint.
 *
 * @example
 * ```typescript
 * // POST /auth/social/apple/callback
 * // Content-Type: application/x-www-form-urlencoded
 * // code=ABC123&state=xyz789
 * ```
 */
export class SocialCallbackFormDTO {
  /**
   * OAuth authorization code from provider
   *
   * Validation:
   * - Optional field
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code?: string;

  /**
   * OAuth state parameter for CSRF protection
   *
   * Validation:
   * - Optional field
   * - Max 500 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  state?: string;

  /**
   * Provider error code (if user cancels or error occurs)
   *
   * Validation:
   * - Optional field
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  error?: string;

  /**
   * Provider error description
   *
   * Validation:
   * - Optional field
   * - Max 4000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  error_description?: string;

  /**
   * Provider callback extras (for validation compatibility)
   *
   * Included for parity with GET callback DTO to avoid strict validation issues.
   *
   * Validation:
   * - Optional field
   * - Max 4000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  scope?: string;

  /**
   * Provider-specific parameter
   *
   * Validation:
   * - Optional field
   * - Max 50 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  authuser?: string;

  /**
   * Provider-specific parameter
   *
   * Validation:
   * - Optional field
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  hd?: string;

  /**
   * Provider-specific parameter
   *
   * Validation:
   * - Optional field
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  prompt?: string;
}
