import { SetMetadata } from '@nestjs/common';

/**
 * Route-level override for token delivery mode
 *
 * Forces a specific token delivery for an endpoint regardless of global config:
 * - 'cookies' → set httpOnly cookies and strip tokens from response body
 * - 'json'    → return tokens in response body and do not set cookies
 *
 * @example
 * ```typescript
 * @Public()
 * @Post('login/web')
 * @TokenDelivery('cookies')
 * async loginWeb(@Body() dto: LoginDTO) { return this.authService.login(dto); }
 *
 * @Public()
 * @Post('login/mobile')
 * @TokenDelivery('json')
 * async loginMobile(@Body() dto: LoginDTO) { return this.authService.login(dto); }
 * ```
 */
export type RouteDelivery = 'cookies' | 'json';

export const TOKEN_DELIVERY_KEY = 'NAUTH_ROUTE_DELIVERY';

export const TokenDelivery = (mode: RouteDelivery) => SetMetadata(TOKEN_DELIVERY_KEY, mode);
