import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { IClientInfo } from '@nauth-toolkit/core';

/**
 * Client Info Parameter Decorator
 *
 * Injects client information (IP address, user agent, device info) into controller methods.
 * The data is automatically extracted by ClientInfoInterceptor.
 *
 * This provides a clean, type-safe way to access client metadata without manual extraction.
 *
 * @returns ClientInfo object with ipAddress, userAgent, and optional device info
 *
 * @example
 * // Basic usage - get full client info
 * @Post('login')
 * async login(@Body() dto: LoginDTO, @ClientInfo() clientInfo: IClientInfo) {
 *   // clientInfo.ipAddress - automatically extracted
 *   // clientInfo.userAgent - automatically extracted
 *   // clientInfo.deviceId - from request body or header (optional)
 *   return this.authService.login(dto, clientInfo);
 * }
 *
 * @example
 * // Get specific field
 * @Post('signup')
 * async signup(@Body() dto: SignupDTO, @ClientInfo('ipAddress') ip: string) {
 *   // Just the IP address
 *   return this.authService.signup(dto, ip);
 * }
 *
 * @example
 * // Use in custom controllers
 * @Controller('auth')
 * export class MyAuthController {
 *   @Post('login')
 *   async login(@Body() dto: LoginDTO, @ClientInfo() clientInfo: IClientInfo) {
 *     // No manual IP extraction needed!
 *     return this.authService.login(dto, clientInfo);
 *   }
 * }
 */
export const ClientInfo = createParamDecorator((data: keyof IClientInfo | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const clientInfo: IClientInfo = request.clientInfo;

  // If no specific field requested, return full object
  if (!data) {
    return clientInfo;
  }

  // Return specific field
  return clientInfo?.[data];
});
