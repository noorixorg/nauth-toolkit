import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Redirect,
  Inject,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  Public,
  SocialRedirectHandler,
  AuthResponseDTO,
  SocialCallbackFormDTO,
  SocialCallbackQueryDTO,
  SocialExchangeDTO,
  StartSocialRedirectQueryDTO,
  VerifyTokenDTO,
  TokenDelivery,
} from '@nauth-toolkit/nestjs';
import { GoogleSocialAuthService } from '@nauth-toolkit/social-google/nestjs';
import { AppleSocialAuthService } from '@nauth-toolkit/social-apple/nestjs';
import { FacebookSocialAuthService } from '@nauth-toolkit/social-facebook/nestjs';

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
  constructor(
    private readonly socialRedirect: SocialRedirectHandler,
    @Optional()
    @Inject(GoogleSocialAuthService)
    private readonly googleAuth?: GoogleSocialAuthService,
    @Optional()
    @Inject(AppleSocialAuthService)
    private readonly appleAuth?: AppleSocialAuthService,
    @Optional()
    @Inject(FacebookSocialAuthService)
    private readonly facebookAuth?: FacebookSocialAuthService,
  ) {}

  /**
   * Verify native social token from mobile apps (Capacitor/React Native)
   *
   * Endpoint: `POST /auth/social/:provider/verify`
   *
   * Supports:
   * - Google: expects `idToken` (JWT) and optional `accessToken`
   * - Apple: expects `idToken` (JWT) and optional `profileData` (first-time signin)
   * - Facebook:
   *   - Classic: expects `accessToken` (opaque string)
   *   - Limited Login (iOS): expects `idToken` (JWT)
   *
   * @param dto - Native token payload from the mobile SDK
   * @returns Authentication response with JWT tokens and user info
   */
  @Public()
  @Post(':provider/verify')
  async verifyNative(@Body() dto: VerifyTokenDTO): Promise<AuthResponseDTO> {
    const provider = dto.provider;

    // ============================================================================
    // Provider Routing
    // ============================================================================
    if (provider === 'google') {
      if (!this.googleAuth) throw new BadRequestException('Google OAuth is not configured');
      return await this.googleAuth.verifyToken(dto);
    }

    if (provider === 'apple') {
      if (!this.appleAuth) throw new BadRequestException('Apple OAuth is not configured');
      return await this.appleAuth.verifyToken(dto);
    }

    if (provider === 'facebook') {
      if (!this.facebookAuth) throw new BadRequestException('Facebook OAuth is not configured');
      const token = dto.idToken || dto.accessToken;
      if (!token) throw new BadRequestException('Either idToken or accessToken is required for facebook');

      return await this.facebookAuth.verifyToken(dto);
    }

    throw new BadRequestException(`Unsupported provider: ${provider}`);
  }

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
    // Parse oauthParams from JSON string if provided
    let oauthParams: Record<string, string> | undefined;
    if (query.oauthParams) {
      try {
        oauthParams = JSON.parse(query.oauthParams);
      } catch {
        throw new BadRequestException('Invalid oauthParams format - must be valid JSON');
      }
    }

    const result = await this.socialRedirect.start({
      provider,
      returnTo: query.returnTo,
      appState: query.appState,
      action: query.action,
      oauthParams,
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
    if (result.authResponse) {
      return { url: result.redirectUrl, ...result.authResponse };
    }
    return { url: result.redirectUrl };
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
    if (result.authResponse) {
      return { url: result.redirectUrl, ...result.authResponse };
    }
    return { url: result.redirectUrl };
  }

  /**
   * Exchange exchangeToken to AuthResponse (used by json/hybrid and cookies-with-challenge).
   */
  @Public()
  @Post('exchange')
  @TokenDelivery('json')
  async exchange(@Body() dto: SocialExchangeDTO): Promise<AuthResponseDTO> {
    return await this.socialRedirect.exchange(dto.exchangeToken);
  }

  // ============================================================================
  // Mobile/JSON Mode Routes (explicit @TokenDelivery for hybrid backend)
  // ============================================================================

  /**
   * Start redirect-first social login (mobile/JSON mode).
   * Explicitly uses JSON token delivery for hybrid backend.
   */
  @Public()
  @TokenDelivery('json')
  @Redirect()
  @Get(':provider/redirect/mobile')
  async startMobile(
    @Param('provider') provider: string,
    @Query() query: StartSocialRedirectQueryDTO,
    @Req() req: FastifyRequest,
  ): Promise<{ url: string }> {
    // Parse oauthParams from JSON string if provided
    let oauthParams: Record<string, string> | undefined;
    if (query.oauthParams) {
      try {
        oauthParams = JSON.parse(query.oauthParams);
      } catch {
        throw new BadRequestException('Invalid oauthParams format - must be valid JSON');
      }
    }

    const result = await this.socialRedirect.start({
      provider,
      returnTo: query.returnTo,
      appState: query.appState,
      action: query.action,
      oauthParams,
      req,
    });
    return { url: result.redirectUrl };
  }

  /**
   * OAuth callback for providers that redirect with query params (mobile/JSON mode).
   * Explicitly uses JSON token delivery for hybrid backend.
   */
  @Public()
  @TokenDelivery('json')
  @Redirect()
  @Get(':provider/callback/mobile')
  async callbackGetMobile(
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
    if (result.authResponse) {
      return { url: result.redirectUrl, ...result.authResponse };
    }
    return { url: result.redirectUrl };
  }

  /**
   * OAuth callback for Apple form_post (mobile/JSON mode).
   * Explicitly uses JSON token delivery for hybrid backend.
   */
  @Public()
  @TokenDelivery('json')
  @Redirect()
  @Post(':provider/callback/mobile')
  async callbackPostMobile(
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
    if (result.authResponse) {
      return { url: result.redirectUrl, ...result.authResponse };
    }
    return { url: result.redirectUrl };
  }

  /**
   * Verify native Google token from mobile apps (Capacitor/React Native)
   *
   * Mobile apps use native SDKs to get ID tokens and send them directly to backend
   * for verification. This endpoint verifies the token and returns JWT tokens.
   *
   * @param dto - VerifyTokenDTO containing idToken, optional accessToken, and profileData
   * @returns Authentication response with JWT tokens and user info
   *
   * @example
   * ```typescript
   * POST /auth/social/google/verify
   * {
   *   "idToken": "eyJhbGciOiJSUzI1NiIs...",
   *   "accessToken": "ya29.a0AfH6SMC..."
   * }
   * ```
   */
  @Public()
  @Post('google/verify')
  async verifyGoogle(@Body() dto: VerifyTokenDTO): Promise<AuthResponseDTO> {
    if (!this.googleAuth) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    return await this.googleAuth.verifyToken(dto);
  }
}
