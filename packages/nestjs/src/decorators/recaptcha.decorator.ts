import { SetMetadata } from '@nestjs/common';

/**
 * Metadata keys for reCAPTCHA control
 */
export const SKIP_RECAPTCHA_KEY = 'NAUTH_SKIP_RECAPTCHA';
export const REQUIRE_RECAPTCHA_KEY = 'NAUTH_REQUIRE_RECAPTCHA';

/**
 * Skip reCAPTCHA validation for this route
 *
 * Use when a specific route should bypass reCAPTCHA even if globally enabled.
 * Useful for:
 * - Admin routes
 * - Mobile-only endpoints (device attestation preferred)
 * - Internal API calls
 *
 * @example
 * ```typescript
 * @Public()
 * @Post('login/admin')
 * @SkipRecaptcha()
 * async adminLogin(@Body() dto: LoginDTO) {
 *   return this.authService.login(dto);
 * }
 * ```
 */
export const SkipRecaptcha = () => SetMetadata(SKIP_RECAPTCHA_KEY, true);

/**
 * Require reCAPTCHA validation for this route
 *
 * Use when a specific route must enforce reCAPTCHA even if not globally enabled
 * or not in the enforceFor array. Useful for:
 * - High-risk operations (password reset, account deletion)
 * - Public endpoints that need bot protection
 * - Testing reCAPTCHA integration
 *
 * @example
 * ```typescript
 * @Public()
 * @Post('password/reset')
 * @RequireRecaptcha()
 * async resetPassword(@Body() dto: ResetPasswordDTO) {
 *   return this.authService.resetPassword(dto);
 * }
 * ```
 */
export const RequireRecaptcha = () => SetMetadata(REQUIRE_RECAPTCHA_KEY, true);
