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

/**
 * Social OAuth controller — handles redirect-first OAuth flows.
 *
 * Redirect flow:
 * 1. Frontend calls GET /auth/social/google/redirect?returnTo=/dashboard
 * 2. Backend redirects to Google's OAuth page
 * 3. Google redirects back to GET /auth/social/google/callback
 * 4. Backend redirects frontend to returnTo URL with tokens set in cookies
 *
 * To add more providers:
 *   - Import AppleSocialAuthService and inject it with @Optional()
 *   - Import FacebookSocialAuthService and inject it with @Optional()
 */
@Controller('auth/social')
export class SocialRedirectController {
  constructor(
    private readonly socialRedirect: SocialRedirectHandler,
    @Optional()
    @Inject(GoogleSocialAuthService)
    private readonly googleAuth?: GoogleSocialAuthService,
  ) {}

  /**
   * Start redirect-first social login.
   * Redirects the browser to the OAuth provider (e.g. Google sign-in page).
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
   * OAuth callback — handles GET-based callbacks (Google, Facebook).
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
   * OAuth callback — handles POST-based callbacks (Apple form_post).
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
   * Exchange a social exchangeToken for full auth tokens.
   * Used in hybrid/JSON mode after the OAuth redirect completes.
   */
  @Public()
  @Post('exchange')
  @TokenDelivery('json')
  async exchange(@Body() dto: SocialExchangeDTO): Promise<AuthResponseDTO> {
    return await this.socialRedirect.exchange(dto.exchangeToken);
  }

  /**
   * Verify a native Google token from mobile apps.
   * For Capacitor/React Native apps using the Google SDK directly.
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
