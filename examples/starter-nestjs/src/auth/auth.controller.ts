import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Inject,
  BadRequestException,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AuthService,
  SignupDTO,
  LoginDTO,
  AuthResponseDTO,
  AuthGuard,
  CurrentUser,
  Public,
  IUser,
  RespondChallengeDTO,
  TokenResponse,
  MFAService,
  LogoutDTO,
  RefreshTokenDTO,
  LogoutResponseDTO,
  ResendCodeDTO,
  ResendCodeResponseDTO,
  ForgotPasswordDTO,
  ForgotPasswordResponseDTO,
  ConfirmForgotPasswordDTO,
  ConfirmForgotPasswordResponseDTO,
  GetSetupDataDTO,
  GetSetupDataResponseDTO,
  GetUserSessionsResponseDTO,
  UserResponseDTO,
  ChangePasswordDTO,
  ChangePasswordResponseDTO,
} from '@nauth-toolkit/nestjs';

/**
 * Authentication controller — core auth endpoints.
 *
 * The @UseGuards(AuthGuard) at class level protects all routes by default.
 * Routes that should be public are marked with @Public().
 *
 * All business logic lives in nauth-toolkit — this controller is a thin
 * wrapper that validates incoming DTOs and delegates to AuthService.
 *
 * @example
 * POST /auth/signup        { email, password }
 * POST /auth/login         { identifier, password }
 * POST /auth/respond-challenge { session, type: 'VERIFY_EMAIL', code: '123456' }
 */
@UseGuards(AuthGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(MFAService)
    private readonly mfaService?: MFAService,
  ) {}

  // ============================================================================
  // Public endpoints — signup, login, challenge, forgot password
  // ============================================================================

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDTO): Promise<AuthResponseDTO> {
    return await this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDTO): Promise<AuthResponseDTO> {
    return await this.authService.login(dto);
  }

  /**
   * Respond to any authentication challenge.
   *
   * Handles all challenge types with a single endpoint:
   * - VERIFY_EMAIL: { session, type: 'VERIFY_EMAIL', code: '123456' }
   * - MFA_REQUIRED: { session, type: 'MFA_REQUIRED', method: 'totp', code: '123456' }
   * - MFA_SETUP_REQUIRED: { session, type: 'MFA_SETUP_REQUIRED', method: 'totp', setupData: { code: '123456' } }
   * - FORCE_CHANGE_PASSWORD: { session, type: 'FORCE_CHANGE_PASSWORD', newPassword: '...' }
   */
  @Public()
  @Post('respond-challenge')
  @HttpCode(HttpStatus.OK)
  async respondToChallenge(@Body() dto: RespondChallengeDTO): Promise<AuthResponseDTO> {
    return await this.authService.respondToChallenge(dto);
  }

  /**
   * Refresh access token.
   * Reads from cookie (hybrid/cookie mode) or request body (JSON mode).
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDTO | undefined, @Req() req: Request): Promise<TokenResponse> {
    const dtoToUse: RefreshTokenDTO = dto ?? ({} as RefreshTokenDTO);
    if (!dtoToUse.refreshToken) {
      dtoToUse.refreshToken = req?.cookies?.['nauth_refresh_token'];
    }
    return await this.authService.refreshToken(dtoToUse);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDTO): Promise<ForgotPasswordResponseDTO> {
    dto.baseUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:4200'}/auth/reset-password`;
    return await this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('forgot-password/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmForgotPassword(@Body() dto: ConfirmForgotPasswordDTO): Promise<ConfirmForgotPasswordResponseDTO> {
    return await this.authService.confirmForgotPassword(dto);
  }

  // ============================================================================
  // Challenge helpers — resend code, get TOTP setup data
  // ============================================================================

  @Public()
  @Post('challenge/resend')
  @HttpCode(HttpStatus.OK)
  async resendCode(@Body() dto: ResendCodeDTO): Promise<ResendCodeResponseDTO> {
    return await this.authService.resendCode(dto);
  }

  /**
   * Get MFA setup data during MFA_SETUP_REQUIRED challenge.
   *
   * For TOTP: returns a QR code and manual entry key.
   * POST { session, method: 'totp' }
   */
  @Public()
  @Post('challenge/setup-data')
  @HttpCode(HttpStatus.OK)
  async getSetupData(@Body() dto: GetSetupDataDTO): Promise<GetSetupDataResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }
    return await this.mfaService.getSetupData(dto);
  }

  // ============================================================================
  // Authenticated endpoints — require a valid JWT
  // ============================================================================

  @Get('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Query() dto: LogoutDTO): Promise<LogoutResponseDTO> {
    return await this.authService.logout(dto);
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: IUser): Promise<UserResponseDTO> {
    return UserResponseDTO.fromEntity(user);
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  async getUserSessions(): Promise<GetUserSessionsResponseDTO> {
    return await this.authService.getUserSessions();
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDTO): Promise<ChangePasswordResponseDTO> {
    return await this.authService.changePassword(dto);
  }
}
