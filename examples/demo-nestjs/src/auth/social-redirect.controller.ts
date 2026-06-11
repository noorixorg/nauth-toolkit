import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Redirect,
  Inject,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import {
  Public,
  SocialRedirectHandler,
  AuthResponseDTO,
  SocialCallbackFormDTO,
  SocialCallbackQueryDTO,
  SocialRedirectCallbackResponseDTO,
  SocialExchangeDTO,
  StartSocialRedirectQueryDTO,
  StartSocialRedirectResponseDTO,
  VerifyTokenDTO,
  TokenDelivery,
} from '@nauth-toolkit/nestjs';
import { GoogleSocialAuthService } from '@nauth-toolkit/social-google/nestjs';
import { AppleSocialAuthService } from '@nauth-toolkit/social-apple/nestjs';
import { FacebookSocialAuthService } from '@nauth-toolkit/social-facebook/nestjs';

/**
 * Social Redirect Controller (Consumer-owned)
 *
 * Thin wrapper over SocialRedirectHandler. Delivery, deviceToken and cookies
 * are handled by the SDK via ContextStorage; the controller only passes provider and DTOs.
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
    @Query() dto: StartSocialRedirectQueryDTO,
  ): Promise<StartSocialRedirectResponseDTO> {
    return await this.socialRedirect.start(provider, dto);
  }

  /**
   * OAuth callback for providers that redirect with query params (Google/Facebook).
   */
  @Public()
  @Redirect()
  @Get(':provider/callback')
  async callbackGet(
    @Param('provider') provider: string,
    @Query() dto: SocialCallbackQueryDTO,
  ): Promise<SocialRedirectCallbackResponseDTO> {
    return await this.socialRedirect.callback(provider, dto);
  }

  /**
   * OAuth callback for Apple form_post.
   */
  @Public()
  @Redirect()
  @Post(':provider/callback')
  async callbackPost(
    @Param('provider') provider: string,
    @Body() dto: SocialCallbackFormDTO,
  ): Promise<SocialRedirectCallbackResponseDTO> {
    return await this.socialRedirect.callback(provider, dto);
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
   */
  @Public()
  @TokenDelivery('json')
  @Redirect()
  @Get(':provider/redirect/mobile')
  async startMobile(
    @Param('provider') provider: string,
    @Query() dto: StartSocialRedirectQueryDTO,
  ): Promise<StartSocialRedirectResponseDTO> {
    return await this.socialRedirect.start(provider, dto);
  }

  /**
   * OAuth callback for providers that redirect with query params (mobile/JSON mode).
   */
  @Public()
  @TokenDelivery('json')
  @Redirect()
  @Get(':provider/callback/mobile')
  async callbackGetMobile(
    @Param('provider') provider: string,
    @Query() dto: SocialCallbackQueryDTO,
  ): Promise<SocialRedirectCallbackResponseDTO> {
    return await this.socialRedirect.callback(provider, dto);
  }

  /**
   * OAuth callback for Apple form_post (mobile/JSON mode).
   */
  @Public()
  @TokenDelivery('json')
  @Redirect()
  @Post(':provider/callback/mobile')
  async callbackPostMobile(
    @Param('provider') provider: string,
    @Body() dto: SocialCallbackFormDTO,
  ): Promise<SocialRedirectCallbackResponseDTO> {
    return await this.socialRedirect.callback(provider, dto);
  }

  /**
   * Verify native Google token from mobile apps (Capacitor/React Native)
   *
   * @param dto - VerifyTokenDTO containing idToken, optional accessToken, and profileData
   * @returns Authentication response with JWT tokens and user info
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
