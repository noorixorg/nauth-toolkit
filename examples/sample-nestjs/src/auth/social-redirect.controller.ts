import { Controller, Get, Post, Param, Query, Body, Req, Redirect } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Public, SocialRedirectHandler, AuthResponseDTO } from '@nauth-toolkit/nestjs';
import {
  SocialCallbackFormDTO,
  SocialCallbackQueryDTO,
  SocialExchangeDTO,
  StartSocialRedirectQueryDTO,
} from './dto/social-redirect.dto';

/**
 * Social Redirect Controller (Consumer-owned)
 *
 * This controller intentionally lives in the consumer app to match the architecture:
 * - `@nauth-toolkit/core` provides the handler (framework-neutral)
 * - Consumer app defines HTTP routes and delegates to the handler
 *
 * @example
 * ```typescript
 * // Start
 * GET /auth/social/google/redirect?returnTo=/auth/callback&appState=12345
 *
 * // Callback (provider -> backend)
 * GET /auth/social/google/callback?code=...&state=...
 *
 * // Frontend receives
 * 302 -> https://frontend/auth/callback?appState=12345
 * ```
 */
@Controller('auth/social')
export class SocialRedirectController {
  constructor(private readonly socialRedirect: SocialRedirectHandler) {}

  /**
   * Start redirect-first social login.
   */
  @Public()
  @Redirect()
  @Get(':provider/redirect')
  async start(
    @Param('provider') provider: string,
    @Query() query: StartSocialRedirectQueryDTO,
    @Req() req: FastifyRequest,
  ): Promise<{ url: string }> {
    const result = await this.socialRedirect.start({
      provider,
      returnTo: query.returnTo,
      appState: query.appState,
      action: query.action,
      req,
    });
    return { url: result.redirectUrl };
  }

  /**
   * OAuth callback for providers that redirect with query params (Google/Facebook).
   */
  @Public()
  @Redirect()
  @Get(':provider/callback')
  async callbackGet(
    @Param('provider') provider: string,
    @Query() query: SocialCallbackQueryDTO,
    @Req() req: FastifyRequest,
  ): Promise<{ url: string } & Partial<AuthResponseDTO>> {
    const result = await this.socialRedirect.callback({
      provider,
      code: query.code,
      state: query.state,
      error: query.error,
      errorDescription: query.error_description,
      req,
    });
    // NOTE: `authResponse` is optional and only present for cookies+token success.
    // We intentionally avoid forcing the consumer controller to manually set cookies.
    const authResponse = (result as unknown as { authResponse?: AuthResponseDTO }).authResponse;
    return { url: result.redirectUrl, ...(authResponse ?? {}) };
  }

  /**
   * OAuth callback for Apple `form_post`.
   */
  @Public()
  @Redirect()
  @Post(':provider/callback')
  async callbackPost(
    @Param('provider') provider: string,
    @Body() body: SocialCallbackFormDTO,
    @Req() req: FastifyRequest,
  ): Promise<{ url: string } & Partial<AuthResponseDTO>> {
    const result = await this.socialRedirect.callback({
      provider,
      code: body.code,
      state: body.state,
      error: body.error,
      errorDescription: body.error_description,
      req,
    });
    // NOTE: `authResponse` is optional and only present for cookies+token success.
    // We intentionally avoid forcing the consumer controller to manually set cookies.
    const authResponse = (result as unknown as { authResponse?: AuthResponseDTO }).authResponse;
    return { url: result.redirectUrl, ...(authResponse ?? {}) };
  }

  /**
   * Exchange exchangeToken to AuthResponse (used by json/hybrid and cookies-with-challenge).
   */
  @Public()
  @Post('exchange')
  async exchange(@Body() dto: SocialExchangeDTO): Promise<AuthResponseDTO> {
    return await this.socialRedirect.exchange(dto.exchangeToken);
  }
}
