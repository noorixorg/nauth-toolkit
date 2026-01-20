import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for reCAPTCHA control
 */
export const REQUIRE_RECAPTCHA_KEY = 'NAUTH_REQUIRE_RECAPTCHA';

/**
 * Require reCAPTCHA validation for this route
 *
 * Explicitly marks a route as requiring reCAPTCHA validation.
 * Useful for:
 * - Login/signup endpoints
 * - Password reset requests
 * - Account deletion
 * - Any public endpoint vulnerable to bot attacks
 *
 * @example
 * ```typescript
 * @Public()
 * @Post('login')
 * @RequireRecaptcha()
 * async login(@Body() dto: LoginDTO) {
 *   return this.authService.login(dto);
 * }
 * ```
 */
export const RequireRecaptcha = () => SetMetadata(REQUIRE_RECAPTCHA_KEY, true);
