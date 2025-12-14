import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
  Res,
  Inject,
  BadRequestException,
  Query,
  Param,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  AuthService,
  SignupDTO,
  LoginDTO,
  AuthResponseDTO,
  AuthGuard,
  CurrentUser,
  Public,
  IUser,
  NAuthConfig,
  RespondChallengeDTO,
  TokenResponse,
  MFAService,
  AuthAuditService,
  SocialAuthService,
  LogoutDTO,
  RefreshTokenDTO,
  LogoutAllDTO,
  ResendCodeDTO,
  SetMustChangePasswordDTO,
  GetSocialAuthUrlDTO,
  HandleSocialCallbackDTO,
  LinkSocialAccountDTO,
  GetLinkedAccountsDTO,
  UnlinkSocialAccountDTO,
  MFAChallengeMethod,
  GetSetupDataDTO,
  GetSetupDataResponseDTO,
} from '@nauth-toolkit/nestjs';

/**
 * Unified Authentication Controller (Clean Architecture)
 *
 * 8 endpoints total:
 * - 5 primary endpoints (signup, login, respond-challenge, refresh, logout)
 * - 3 helper endpoints (setup-data, challenge-data, resend)
 *
 * All business logic is in nauth-toolkit library.
 * This controller is a thin proxy that validates DTOs and delegates to services.
 *
 * @example
 * ```typescript
 * // Signup
 * POST /auth/signup { email, password }
 *
 * // Respond to challenge
 * POST /auth/respond-challenge { session, type: 'VERIFY_EMAIL', code: '123456' }
 *
 * // Get MFA setup data
 * POST /auth/challenge/setup-data { session, method: 'totp' }
 * ```
 */
@Controller('auth')
export class CustomAuthController {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly authService: AuthService,
    @Inject('NAUTH_CONFIG')
    protected readonly nauthConfig: NAuthConfig,
    @Inject(MFAService)
    protected readonly mfaService?: MFAService,
    @Inject(AuthAuditService)
    protected readonly auditService?: AuthAuditService,
    @Inject(SocialAuthService)
    protected readonly socialAuthService?: SocialAuthService,
  ) {}

  // ============================================================================
  // PRIMARY FLOW (5 endpoints)
  // ============================================================================

  /**
   * User signup
   *
   * Creates a new user account. May return a challenge if verification is required.
   *
   * @param dto - Signup credentials
   * @returns Auth response (tokens or challenge)
   *
   * @example
   * ```typescript
   * POST /auth/signup
   * { "email": "user@example.com", "password": "SecurePass123!" }
   * ```
   */
  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDTO): Promise<AuthResponseDTO> {
    this.logger.log(`Signup attempt: ${dto.email}`);
    return await this.authService.signup(dto);
  }

  /**
   * User login
   *
   * Authenticates user with email/password. May return a challenge if verification/MFA is required.
   *
   * @param dto - Login credentials
   * @returns Auth response (tokens or challenge)
   *
   * @example
   * ```typescript
   * POST /auth/login
   * { "identifier": "user@example.com", "password": "SecurePass123!" }
   * ```
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDTO): Promise<AuthResponseDTO> {
    this.logger.log(`Login attempt: ${dto.identifier}`);
    return await this.authService.login(dto);
  }

  /**
   * Respond to authentication challenge (UNIFIED API)
   *
   * Single endpoint for completing ANY challenge type:
   * - VERIFY_EMAIL: Verify email with code
   * - VERIFY_PHONE: Collect phone or verify phone with code
   * - MFA_REQUIRED: Verify MFA (SMS/TOTP/Passkey/Backup)
   * - FORCE_CHANGE_PASSWORD: Change password
   * - MFA_SETUP_REQUIRED: Set up MFA device
   *
   * @param dto - Challenge response with type-specific data
   * @returns Auth response (tokens or next challenge)
   *
   * @example
   * ```typescript
   * // Email verification
   * POST /auth/respond-challenge
   * { "session": "...", "type": "VERIFY_EMAIL", "code": "123456" }
   *
   * // Phone collection
   * POST /auth/respond-challenge
   * { "session": "...", "type": "VERIFY_PHONE", "phone": "+1234567890" }
   *
   * // MFA verification (TOTP)
   * POST /auth/respond-challenge
   * { "session": "...", "type": "MFA_REQUIRED", "method": "totp", "code": "123456" }
   *
   * // MFA setup (TOTP)
   * POST /auth/respond-challenge
   * { "session": "...", "type": "MFA_SETUP_REQUIRED", "method": "totp", "setupData": { "code": "123456" } }
   * ```
   */
  @Public()
  @Post('respond-challenge')
  @HttpCode(HttpStatus.OK)
  async respondToChallenge(@Body() dto: RespondChallengeDTO): Promise<AuthResponseDTO> {
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.logger.log(`[${requestId}] Challenge response: type=${dto.type}, session=${dto.session?.substring(0, 8)}...`);
    try {
      const result = await this.authService.respondToChallenge(dto);
      this.logger.log(`[${requestId}] Challenge response completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(
        `[${requestId}] Challenge response failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Refresh access token
   *
   * Issues a new access token using a valid refresh token.
   *
   * @param body - Optional refresh token in body
   * @param req - Request object (may contain refresh token in cookie)
   * @returns New token pair
   *
   * @example
   * ```typescript
   * POST /auth/refresh
   * { "refreshToken": "..." }
   * ```
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: FastifyRequest & { cookies?: Record<string, string> },
  ): Promise<TokenResponse> {
    // Try body first (if provided and not empty), then cookies
    // Empty string in body indicates cookie mode - backend should get token from cookie
    const token =
      body?.refreshToken && body.refreshToken.trim() !== '' ? body.refreshToken : req?.cookies?.['nauth_refresh_token'];

    if (!token) {
      throw new BadRequestException('Refresh token is required');
    }

    this.logger.log('Token refresh attempt');
    const dto = new RefreshTokenDTO();
    dto.refreshToken = token;
    return await this.authService.refreshToken(dto);
  }

  /**
   * Logout user and revoke session
   *
   * Uses GET request to avoid CSRF token issues.
   * Cookies are automatically cleared by AuthService.logout()
   * No need to manually call clearAuthCookies!
   *
   * @param user - Current user (from JWT)
   * @param forgetMe - If true, also untrust the device (require MFA on next login)
   * @returns Success message
   *
   * @example
   * ```typescript
   * GET /auth/logout?forgetMe=true
   * ```
   */
  @UseGuards(AuthGuard)
  @Get('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: IUser, @Query('forgetMe') forgetMe?: string): Promise<{ message: string }> {
    // Session ID is automatically extracted from JWT token context by the library
    const dto = new LogoutDTO();
    if (forgetMe === 'true' || forgetMe === '1') {
      dto.forgetMe = true;
    }
    // Optional: validate user sub matches authenticated user
    dto.sub = user.sub;

    // ✅ Automatically clears cookies via ClientInfoService context
    await this.authService.logout(dto);
    this.logger.log(`User logged out: ${user.email}`);

    return { message: 'Logged out successfully' };
  }

  /**
   * Global signout (revoke all user sessions)
   *
   * Revokes all active sessions for the current user across all devices.
   * Useful for security scenarios like password change or suspected account compromise.
   *
   * @param user - Current user (from JWT)
   * @returns Success message with number of sessions revoked
   */
  @UseGuards(AuthGuard)
  /**
   * Global signout (revoke all sessions)
   *
   * Requires authentication - user must be logged in.
   * Optionally revokes all trusted devices if forgetDevices flag is set.
   *
   * @param user - Current user (from JWT)
   * @param body - Optional request body with forgetDevices flag
   * @returns Number of sessions revoked
   */
  @UseGuards(AuthGuard)
  @Post('logout/all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: IUser,
    @Body() body?: { forgetDevices?: boolean },
  ): Promise<{ message: string; revokedCount: number }> {
    // ✅ Automatically clears cookies via ClientInfoService context
    const dto = new LogoutAllDTO();
    dto.sub = user.sub;
    if (body?.forgetDevices !== undefined) {
      dto.forgetDevices = body.forgetDevices;
    }
    const result = await this.authService.logoutAll(dto);
    const message = body?.forgetDevices
      ? `All sessions and trusted devices revoked successfully (${result.revokedCount} session(s))`
      : `All sessions revoked successfully (${result.revokedCount} session(s))`;
    this.logger.log(`Global signout: ${user.email} (${result.revokedCount} session(s) revoked)`);

    return {
      message,
      revokedCount: result.revokedCount,
    };
  }

  /**
   * Trust current device (user opt-in)
   *
   * Creates a trusted device token for the current session's device.
   * Only available when rememberDevices === 'user_opt_in'.
   *
   * @param user - Current user (from JWT)
   * @param req - Request object (for session ID)
   * @returns Device token
   */
  @UseGuards(AuthGuard)
  @Post('trust-device')
  @HttpCode(HttpStatus.OK)
  async trustDevice(@CurrentUser() user: IUser): Promise<{ deviceToken: string }> {
    // Session ID is automatically extracted from JWT token context by the library
    const result = await this.authService.trustDevice();
    this.logger.log(`Device trusted for user: ${user.email}`);
    return result;
  }

  /**
   * Check if current device is trusted
   *
   * Returns whether the device associated with the current authenticated session
   * is trusted. Works for both cookies mode (reads from httpOnly cookie) and
   * JSON mode (reads from X-Device-Token header).
   *
   * @param user - Current user (from JWT)
   * @returns Trusted device status
   */
  @UseGuards(AuthGuard)
  @Get('is-trusted-device')
  @HttpCode(HttpStatus.OK)
  async isTrustedDevice(): Promise<{ trusted: boolean }> {
    const result = await this.authService.isTrustedDevice();
    return result;
  }

  // ============================================================================
  // HELPER ENDPOINTS (3 endpoints)
  // ============================================================================

  /**
   * Get MFA setup data during MFA_SETUP_REQUIRED challenge
   *
   * Returns provider-specific setup data:
   * - TOTP: QR code, secret, manual entry key
   * - SMS: Masked phone number
   * - Passkey: WebAuthn registration options
   *
   * @param body - Session and MFA method
   * @returns Setup data (provider-specific)
   *
   * @example
   * ```typescript
   * POST /auth/challenge/setup-data
   * { "session": "...", "method": "totp" }
   * // Returns: { secret: "...", qrCode: "data:image/png;base64,...", manualEntryKey: "..." }
   * ```
   */
  @Public()
  @Post('challenge/setup-data')
  @HttpCode(HttpStatus.OK)
  async getSetupData(@Body() dto: GetSetupDataDTO): Promise<GetSetupDataResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    this.logger.log(`Get setup data: method=${dto.method}`);
    return await this.mfaService.getSetupData(dto);
  }

  /**
   * Get MFA challenge data during MFA_REQUIRED challenge
   *
   * Currently only used for passkey authentication to get WebAuthn options.
   * SMS/TOTP codes are sent automatically when the challenge is created.
   *
   * @param body - Session and MFA method
   * @returns Challenge data (WebAuthn options for passkey)
   *
   * @example
   * ```typescript
   * POST /auth/challenge/challenge-data
   * { "session": "...", "method": "passkey" }
   * // Returns: { challenge: "...", allowCredentials: [...], ... }
   * ```
   */
  @Public()
  @Post('challenge/challenge-data')
  @HttpCode(HttpStatus.OK)
  async getChallengeData(@Body() body: { session: string; method: MFAChallengeMethod }): Promise<unknown> {
    if (!body.session || !body.method) {
      throw new BadRequestException('Session and method are required');
    }

    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    this.logger.log(`Get challenge data: method=${body.method}`);
    return await this.mfaService.getChallengeData({
      session: body.session,
      method: body.method,
    });
  }

  /**
   * Resend verification code for current challenge
   *
   * Determines challenge type from session and resends the appropriate code:
   * - VERIFY_EMAIL: Resends email verification code
   * - VERIFY_PHONE: Resends SMS verification code
   * - MFA_REQUIRED: Resends MFA code (for SMS MFA only)
   *
   * Rate limits are enforced by the verification services.
   *
   * @param body - Challenge session token
   * @returns Destination info (masked email/phone)
   *
   * @example
   * ```typescript
   * POST /auth/challenge/resend
   * { "session": "..." }
   * // Returns: { destination: "u***r@example.com" }
   * ```
   */
  @Public()
  @Post('challenge/resend')
  @HttpCode(HttpStatus.OK)
  async resendCode(@Body() body: { session: string }): Promise<{ destination: string }> {
    if (!body.session) {
      throw new BadRequestException('Session is required');
    }

    this.logger.log('Resend verification code');
    const dto = new ResendCodeDTO();
    dto.session = body.session;
    return await this.authService.resendCode(dto);
  }

  // ============================================================================
  // User Profile (Bonus - not counted in 8 endpoints)
  // ============================================================================

  /**
   * Get current user profile
   *
   * @param user - Current user (from JWT)
   * @returns User profile
   */
  @UseGuards(AuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: IUser): Promise<IUser> {
    return user;
  }

  /**
   * Update current user profile
   */
  @UseGuards(AuthGuard)
  @Put('profile')
  async updateProfile(@CurrentUser() user: IUser, @Body() body: any) {
    const dto = {
      sub: user.sub,
      ...body,
    };
    return await this.authService.updateUserAttributes(dto);
  }

  /**
   * Request password change on next login
   *
   * Sets the mustChangePassword flag for the current user.
   * User will be required to change their password on next login.
   *
   * @param user - Current user (from JWT)
   * @returns Success message
   */
  @UseGuards(AuthGuard)
  @Post('request-password-change')
  @HttpCode(HttpStatus.OK)
  async requestPasswordChange(@CurrentUser() user: IUser): Promise<{ message: string }> {
    const dto = new SetMustChangePasswordDTO();
    dto.userId = user.sub;
    await this.authService.setMustChangePassword(dto);
    this.logger.log(`Password change requested for user: ${user.email}`);
    return { message: 'You will be required to change your password on your next login' };
  }

  // ============================================================================
  // MFA Management Endpoints
  // ============================================================================

  /**
   * Get MFA status for current user
   *
   * @param user - Current user (from JWT)
   * @returns MFA status including enabled methods, configured devices, etc.
   */
  @UseGuards(AuthGuard)
  @Get('mfa/status')
  async getMFAStatus(@CurrentUser() user: IUser): Promise<{
    enabled: boolean;
    required: boolean;
    methods: string[];
    availableMethods: string[];
    hasBackupCodes: boolean;
    preferredMethod?: string;
    mfaExempt: boolean;
    mfaExemptReason: string | null;
    mfaExemptGrantedAt: Date | null;
  }> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    const status = await this.mfaService.getMFAStatus(user);
    return {
      enabled: status.enabled,
      required: status.required,
      methods: status.configuredMethods,
      availableMethods: status.availableMethods,
      hasBackupCodes: status.hasBackupCodes,
      preferredMethod: status.preferredMethod,
      mfaExempt: status.mfaExempt,
      mfaExemptReason: status.mfaExemptReason,
      mfaExemptGrantedAt: status.mfaExemptGrantedAt,
    };
  }

  /**
   * Get MFA setup data for authenticated user (protected endpoint)
   *
   * Used when authenticated users want to add MFA devices from dashboard.
   * Different from challenge-based setup which is used during login/signup.
   *
   * @param user - Current user (from JWT)
   * @param body - MFA method to set up
   * @returns Setup data (provider-specific)
   */
  @UseGuards(AuthGuard)
  @Post('mfa/setup-data')
  async getMFASetupData(
    @CurrentUser() user: IUser,
    @Body() body: { method: 'sms' | 'email' | 'totp' | 'passkey' },
  ): Promise<unknown> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    const provider = this.mfaService.getProvider(body.method);
    return await provider.setup(user);
  }

  /**
   * Verify and complete MFA setup for authenticated user (protected endpoint)
   *
   * Used when authenticated users are completing MFA setup from dashboard.
   *
   * @param user - Current user (from JWT)
   * @param body - Verification data (method-specific)
   * @returns Success response with device ID
   */
  @UseGuards(AuthGuard)
  @Post('mfa/verify-setup')
  async verifyMFASetup(
    @CurrentUser() user: IUser,
    @Body() body: { method: 'sms' | 'totp' | 'passkey'; setupData: Record<string, unknown>; deviceName?: string },
  ): Promise<{ deviceId: number }> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    const provider = this.mfaService.getProvider(body.method);
    const deviceId = await provider.verifySetup(user, body.setupData, body.deviceName);

    // Note: Backup codes are generated separately via generateBackupCodes() if needed
    // They are not returned from verifySetup for security reasons
    return {
      deviceId,
    };
  }

  /**
   * Get MFA devices for current user
   *
   * @param user - Current user (from JWT)
   * @returns Array of MFA devices
   */
  @UseGuards(AuthGuard)
  @Get('mfa/devices')
  async getMFADevices(@CurrentUser() user: IUser): Promise<any[]> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    const devices = await this.mfaService.getUserDevices({ sub: user.sub });
    return devices.devices.map((device) => ({
      id: device.id,
      type: device.type,
      name: device.name,
      isPrimary: device.isPrimary || false,
      isActive: device.isActive,
      createdAt: device.createdAt,
    }));
  }

  /**
   * Set preferred MFA method
   *
   * @param user - Current user (from JWT)
   * @param body - Preferred method
   * @returns Success message
   */
  @UseGuards(AuthGuard)
  @Post('mfa/preferred-method')
  async setPreferredMFAMethod(
    @CurrentUser() user: IUser,
    @Body() body: { method: string },
  ): Promise<{ message: string }> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    await this.mfaService.setPreferredMethod({
      userSub: user.sub,
      methodType: body.method,
    });
    return { message: 'Preferred MFA method updated successfully' };
  }

  /**
   * Remove MFA devices by method type
   *
   * Removes all active MFA devices of the specified method type for the current user.
   * Automatically disables MFA if this was the last device.
   *
   * @param user - Current user (from JWT)
   * @param method - MFA method type to remove (totp, sms, email, passkey)
   * @returns Response with deletedCount and mfaDisabled status
   *
   * @example
   * ```typescript
   * DELETE /auth/mfa/method/totp
   * // Returns: { deletedCount: 1, mfaDisabled: false, message: "MFA method removed successfully" }
   * ```
   */
  @UseGuards(AuthGuard)
  @Delete('mfa/method/:method')
  @HttpCode(HttpStatus.OK)
  async removeMFAMethod(
    @CurrentUser() user: IUser,
    @Param('method') method: string,
  ): Promise<{ message: string; deletedCount: number; mfaDisabled: boolean }> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    const result = await this.mfaService.removeDevices({
      userSub: user.sub,
      methodType: method,
    });

    return {
      message: 'MFA method removed successfully',
      deletedCount: result.deletedCount,
      mfaDisabled: result.mfaDisabled,
    };
  }

  /**
   * Grant or revoke MFA exemption for current user
   *
   * ⚠️ SECURITY NOTE: In production, this should be an admin-only operation.
   * This endpoint allows users to grant/revoke their own exemption for testing purposes.
   *
   * @param user - Current user (from JWT)
   * @param body - Exemption request (exempt: boolean, reason?: string)
   * @returns Updated exemption status
   */
  @UseGuards(AuthGuard)
  @Post('mfa/exemption')
  @HttpCode(HttpStatus.OK)
  async setMFAExemption(
    @CurrentUser() user: IUser,
    @Body() body: { exempt: boolean; reason?: string },
  ): Promise<{
    message: string;
    mfaExempt: boolean;
    mfaExemptReason: string | null;
    mfaExemptGrantedAt: Date | null;
  }> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    await this.mfaService.setMFAExemption({
      userSub: user.sub,
      exempt: body.exempt,
      reason: body.reason || null,
      grantedBy: user.email || null, // Use user's email as grantedBy for audit trail
    });

    // Get updated MFA status to return exemption fields
    const status = await this.mfaService.getMFAStatus(user);

    return {
      message: body.exempt ? 'MFA exemption granted successfully' : 'MFA exemption revoked successfully',
      mfaExempt: status.mfaExempt,
      mfaExemptReason: status.mfaExemptReason,
      mfaExemptGrantedAt: status.mfaExemptGrantedAt,
    };
  }

  // ============================================================================
  // Social Authentication Endpoints
  // ============================================================================

  /**
   * Get social authentication URL
   *
   * Returns the OAuth authorization URL for the specified provider.
   *
   * @param body - Provider name and optional state
   * @returns OAuth authorization URL
   *
   * @example
   * ```typescript
   * POST /auth/social/auth-url
   * { "provider": "google", "state": "random-state-123" }
   * ```
   */
  @Public()
  @Post('social/auth-url')
  @HttpCode(HttpStatus.OK)
  async getSocialAuthUrl(@Body() body: GetSocialAuthUrlDTO): Promise<{ url: string }> {
    if (!this.socialAuthService) {
      throw new BadRequestException('Social auth service is not available');
    }

    const dto = Object.assign(new GetSocialAuthUrlDTO(), body);
    const { url } = await this.socialAuthService.getSocialAuthUrl(dto);
    return { url };
  }

  /**
   * Handle social authentication callback (GET - OAuth redirect)
   *
   * OAuth providers redirect to this endpoint with code and state in query params.
   * This endpoint then redirects to the frontend with the same parameters.
   *
   * @param provider - Provider name from route
   * @param query - OAuth callback query parameters
   * @param req - Request object (may contain auth header for linking)
   * @param res - Response object for redirect
   * @returns Redirect to frontend
   *
   * @example
   * ```typescript
   * GET /auth/social/google/callback?code=...&state=...
   * ```
   */
  @Public()
  @Get('social/:provider/callback')
  async handleSocialCallbackRedirect(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

    // Check if user is authenticated (linking scenario)
    const authHeader = (req.headers as any).authorization;
    if (authHeader?.startsWith('Bearer ')) {
      // Authenticated user - redirect to frontend for linking
      const redirectUrl = `${frontendUrl}/auth/callback?provider=${provider}&code=${code}&state=${state}&action=link`;
      return res.status(302).redirect(redirectUrl);
    }

    // Not authenticated - login flow
    const redirectUrl = `${frontendUrl}/auth/callback?provider=${provider}&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    return res.status(302).redirect(redirectUrl);
  }

  /**
   * Handle social authentication callback (POST)
   *
   * Processes the OAuth callback and authenticates the user.
   * Returns unified auth response (tokens or challenge).
   *
   * @param body - OAuth callback parameters
   * @returns Unified authentication response
   *
   * @example
   * ```typescript
   * POST /auth/social/callback
   * { "provider": "google", "code": "...", "state": "..." }
   * ```
   */
  @Public()
  @Post('social/callback')
  @HttpCode(HttpStatus.OK)
  async handleSocialCallback(@Body() body: HandleSocialCallbackDTO): Promise<AuthResponseDTO> {
    if (!this.socialAuthService) {
      throw new BadRequestException('Social auth service is not available');
    }

    this.logger.log(`Social login callback: ${body.provider}`);
    const dto = Object.assign(new HandleSocialCallbackDTO(), body);
    return await this.socialAuthService.handleSocialCallback(dto);
  }

  // ============================================================================
  // Social Account Management Endpoints
  // ============================================================================

  /**
   * Get linked social accounts for current user
   *
   * @param user - Current user (from JWT)
   * @returns Array of linked social account providers
   */
  @UseGuards(AuthGuard)
  @Get('social/linked')
  async getLinkedAccounts(@CurrentUser() user: IUser): Promise<{ providers: string[] }> {
    if (!this.socialAuthService) {
      throw new BadRequestException('Social auth service is not available');
    }

    const dto = Object.assign(new GetLinkedAccountsDTO(), { userId: user.sub });
    const accounts = await this.socialAuthService.getLinkedAccounts(dto);
    return {
      providers: accounts.accounts.map((account) => account.provider),
    };
  }

  /**
   * Link social account to current user
   *
   * @param user - Current user (from JWT)
   * @param body - OAuth callback parameters
   * @returns Success message
   */
  @UseGuards(AuthGuard)
  @Post('social/link')
  async linkSocialAccount(
    @CurrentUser() user: IUser,
    @Body() body: { provider: string; code: string; state: string },
  ): Promise<{ message: string }> {
    if (!this.socialAuthService) {
      throw new BadRequestException('Social auth service is not available');
    }

    const dto = Object.assign(new LinkSocialAccountDTO(), {
      userId: user.sub,
      provider: body.provider,
      code: body.code,
      state: body.state,
    });
    return await this.socialAuthService.linkSocialAccount(dto);
  }

  /**
   * Unlink social account from current user
   *
   * @param user - Current user (from JWT)
   * @param body - Provider to unlink
   * @returns Success message
   */
  @UseGuards(AuthGuard)
  @Post('social/unlink')
  async unlinkSocialAccount(
    @CurrentUser() user: IUser,
    @Body() body: { provider: string },
  ): Promise<{ message: string }> {
    if (!this.socialAuthService) {
      throw new BadRequestException('Social auth service is not available');
    }

    const dto = Object.assign(new UnlinkSocialAccountDTO(), { userId: user.sub, provider: body.provider });
    await this.socialAuthService.unlinkSocialAccount(dto);
    return { message: 'Social account unlinked successfully' };
  }

  // ============================================================================
  // Audit Trail Endpoints
  // ============================================================================

  /**
   * Get authentication audit history for current user
   *
   * @param user - Current user (from JWT)
   * @param query - Pagination and filter parameters
   * @returns Paginated audit history
   */
  @UseGuards(AuthGuard)
  @Get('audit/history')
  async getAuditHistory(
    @CurrentUser() user: IUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('eventTypes') eventTypes?: string,
    @Query('eventStatus') eventStatus?: string,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    if (!this.auditService) {
      throw new BadRequestException('Audit service is not available');
    }

    const history = await this.auditService.getUserAuthHistory({
      userSub: user.sub,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      eventTypes: eventTypes ? (eventTypes.split(',') as any) : undefined,
      eventStatus: eventStatus ? (eventStatus.split(',') as any) : undefined,
    });

    return {
      data: history.data,
      total: history.total,
      page: history.page,
      limit: history.limit,
      totalPages: history.totalPages,
    };
  }
}
