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
  Inject,
  BadRequestException,
  Query,
  Param,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  AuthService,
  SignupDTO,
  AdminSignupDTO,
  AdminSignupSocialDTO,
  AdminSignupSocialResponseDTO,
  AdminSignupResponseDTO,
  AdminSetPasswordDTO,
  AdminResetPasswordDTO,
  AdminResetPasswordResponseDTO,
  ConfirmAdminResetPasswordDTO,
  ConfirmAdminResetPasswordResponseDTO,
  DeleteUserDTO,
  DeleteUserResponseDTO,
  DisableUserDTO,
  DisableUserResponseDTO,
  EnableUserDTO,
  EnableUserResponseDTO,
  GetUsersDTO,
  GetUsersResponseDTO,
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
  ChangePasswordRequestDTO,
  ForgotPasswordDTO,
  ForgotPasswordResponseDTO,
  ConfirmForgotPasswordDTO,
  ConfirmForgotPasswordResponseDTO,
  LinkSocialAccountDTO,
  GetLinkedAccountsDTO,
  UnlinkSocialAccountDTO,
  GetSetupDataDTO,
  GetSetupDataResponseDTO,
  TokenDelivery,
  GetUserSessionsDTO,
  GetUserSessionsResponseDTO,
  LogoutSessionDTO,
  LogoutSessionResponseDTO,
  UpdateUserAttributesRequestDTO,
  SetPreferredMethodDTO,
  SetMFAExemptionDTO,
  GetChallengeDataDTO,
  RemoveDevicesDTO,
  SetupMFADTO,
} from '@nauth-toolkit/nestjs';

/**
 * Unified Authentication Controller (Clean Architecture)
 *
 * Primary endpoints:
 * - signup, login, respond-challenge, refresh, logout
 * - forgot-password, forgot-password/confirm
 *
 * Helper endpoints:
 * - setup-data, challenge-data, resend
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

@UseGuards(AuthGuard)
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
  // Account Recovery (Forgot Password)
  // ============================================================================

  /**
   * Request password reset code.
   *
   * Non-enumerating: backend should return success even if user does not exist.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDTO): Promise<ForgotPasswordResponseDTO> {
    return await this.authService.forgotPassword(dto);
  }

  /**
   * Confirm password reset code and set new password.
   */
  @Public()
  @Post('forgot-password/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmForgotPassword(@Body() dto: ConfirmForgotPasswordDTO): Promise<ConfirmForgotPasswordResponseDTO> {
    return await this.authService.confirmForgotPassword(dto);
  }

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
   * Administrative user creation
   *
   * Allows administrators to create user accounts with override capabilities:
   * - Bypass email/phone verification requirements
   * - Force password change on first login
   * - Auto-generate secure passwords
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param dto - Admin signup DTO with override flags
   * @returns Created user object and optionally generated password
   *
   * @example
   * ```typescript
   * POST /auth/admin/signup
   * {
   *   "email": "user@example.com",
   *   "password": "SecurePass123!",
   *   "isEmailVerified": true,
   *   "mustChangePassword": false
   * }
   * ```
   */
  @Post('admin/signup')
  @HttpCode(HttpStatus.CREATED)
  async adminSignup(@Body() dto: AdminSignupDTO): Promise<AdminSignupResponseDTO> {
    this.logger.log(`Admin signup attempt: ${dto.email}`);
    // NOTE: No @Public() decorator - endpoint should be protected by admin guard
    // This is intentionally unprotected at the framework level - users must add their own guard
    return await this.authService.adminSignup(dto);
  }

  /**
   * Administrative social user import
   *
   * Allows administrators to import existing social users from external platforms
   * (e.g., Cognito, Auth0) with social account linkage.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param dto - Admin social signup DTO with provider information
   * @returns Created user object and social account confirmation
   *
   * @example
   * ```typescript
   * POST /auth/admin/signup-social
   * {
   *   "email": "user@example.com",
   *   "provider": "google",
   *   "providerId": "google_12345",
   *   "providerEmail": "user@gmail.com",
   *   "isEmailVerified": true
   * }
   * ```
   */
  @Post('admin/signup-social')
  @HttpCode(HttpStatus.CREATED)
  async adminSignupSocial(@Body() dto: AdminSignupSocialDTO): Promise<AdminSignupSocialResponseDTO> {
    this.logger.log(`Admin social signup attempt: ${dto.email}, provider: ${dto.provider}`);
    return await this.authService.adminSignupSocial(dto);
  }

  /**
   * Administrative password reset (direct set)
   *
   * Allows administrators to set a new password for any user.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param dto - Admin set password DTO
   * @returns Success confirmation
   */
  @Post('admin/set-password')
  @HttpCode(HttpStatus.OK)
  async adminSetPassword(@Body() dto: AdminSetPasswordDTO): Promise<{ success: boolean }> {
    this.logger.log(`Admin set password attempt for: ${dto.identifier}`);
    await this.authService.adminSetPassword(dto);
    return { success: true };
  }

  /**
   * Admin initiates password reset workflow
   *
   * Sends verification code (and optional link) to user via email/SMS.
   * User completes reset using confirmAdminResetPassword endpoint.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param dto - Admin reset password DTO
   * @returns Response with masked destination and expiry
   */
  @Post('admin/reset-password/initiate')
  @HttpCode(HttpStatus.OK)
  async adminResetPassword(@Body() dto: AdminResetPasswordDTO): Promise<AdminResetPasswordResponseDTO> {
    this.logger.log(`Admin reset password for: ${dto.identifier}`);
    return this.authService.adminResetPassword(dto);
  }

  /**
   * User completes admin-initiated password reset
   *
   * Public endpoint (user uses code/token from email).
   * Accepts either code (from email/SMS) or token (from link).
   *
   * @param dto - Confirm admin reset password DTO
   * @returns Success confirmation
   */
  @Post('admin/reset-password/confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  async confirmAdminResetPassword(
    @Body() dto: ConfirmAdminResetPasswordDTO,
  ): Promise<ConfirmAdminResetPasswordResponseDTO> {
    this.logger.log(`Confirm admin reset for: ${dto.identifier}`);
    return this.authService.confirmAdminResetPassword(dto);
  }

  /**
   * Delete user with cascade cleanup
   *
   * Permanently deletes user and ALL associated data including sessions, tokens, devices, etc.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param sub - User UUID from path parameter
   * @returns Deletion confirmation with cascade counts
   */
  @Delete('admin/users/:sub')
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('sub') sub: string): Promise<DeleteUserResponseDTO> {
    this.logger.log(`Admin delete user attempt: ${sub}`);
    const dto = new DeleteUserDTO();
    dto.sub = sub;
    return await this.authService.deleteUser(dto);
  }

  /**
   * Disable user account (permanent lock)
   *
   * Permanently locks user account and revokes all active sessions.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param sub - User UUID from path parameter
   * @param dto - DisableUserDTO with optional reason
   * @returns Lock confirmation with revoked session count
   */
  @Post('admin/users/:sub/disable')
  @HttpCode(HttpStatus.OK)
  async disableUser(@Param('sub') sub: string, @Body() dto: DisableUserDTO): Promise<DisableUserResponseDTO> {
    this.logger.log(`Admin disable user attempt: ${sub}`);
    dto.sub = sub;
    return await this.authService.disableUser(dto);
  }

  /**
   * Force password change on next login
   *
   * Requires user to change their password on their next login attempt.
   * User will receive FORCE_CHANGE_PASSWORD challenge when they try to login.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param sub - User UUID from path parameter
   * @returns Success confirmation
   */
  @Post('admin/users/:sub/force-password-change')
  @HttpCode(HttpStatus.OK)
  async forcePasswordChange(@Param('sub') sub: string): Promise<{ success: boolean }> {
    this.logger.log(`Admin force password change attempt: ${sub}`);
    const dto = new SetMustChangePasswordDTO();
    dto.userId = sub;
    await this.authService.setMustChangePassword(dto);
    return { success: true };
  }

  /**
   * Enable (unlock) user account
   *
   * Unlocks a previously locked user account by clearing all lock fields.
   * This reverses the effect of disableUser() or rate-limit lockouts.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param sub - User UUID from path parameter
   * @returns Unlock confirmation with updated user
   */
  @Post('admin/users/:sub/enable')
  @HttpCode(HttpStatus.OK)
  async enableUser(@Param('sub') sub: string): Promise<EnableUserResponseDTO> {
    this.logger.log(`Admin enable user attempt: ${sub}`);
    const dto = new EnableUserDTO();
    dto.sub = sub;
    return await this.authService.enableUser(dto);
  }

  /**
   * Admin: Get user's active sessions
   *
   * Returns a list of all active sessions for any user.
   * Administrators can view session information for any user by providing their sub.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param sub - User UUID from path parameter
   * @returns List of active sessions with metadata
   *
   * @example
   * ```typescript
   * GET /auth/admin/users/:sub/sessions
   * // Returns: { sessions: [{ sessionId, deviceInfo, ipAddress, lastActivity }] }
   * ```
   */
  @Get('admin/users/:sub/sessions')
  @HttpCode(HttpStatus.OK)
  async adminGetUserSessions(@Param('sub') sub: string): Promise<GetUserSessionsResponseDTO> {
    this.logger.log(`Admin get sessions for user: ${sub}`);
    const dto = new GetUserSessionsDTO();
    dto.sub = sub;
    const result = await this.authService.getUserSessions(dto);
    this.logger.log(`Retrieved ${result.sessions.length} session(s) for user: ${sub}`);
    return result;
  }

  /**
   * Admin: Force logout all sessions for a user
   *
   * Administratively revokes all active sessions for any user across all devices.
   * Optionally revokes all trusted devices if forgetDevices flag is set.
   *
   * Useful for security scenarios:
   * - Account compromise suspected
   * - User requested account reset
   * - Administrative security action
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param sub - User UUID from path parameter
   * @param dto - LogoutAllDTO with optional forgetDevices flag
   * @returns Number of sessions revoked
   *
   * @example
   * ```typescript
   * POST /auth/admin/users/:sub/logout-all
   * { "forgetDevices": true }
   * // Returns: { revokedCount: 3 }
   * ```
   */
  @Post('admin/users/:sub/logout-all')
  @HttpCode(HttpStatus.OK)
  async adminLogoutAll(
    @Param('sub') sub: string,
    @Body() dto: LogoutAllDTO,
  ): Promise<{ message: string; revokedCount: number }> {
    this.logger.log(`Admin force logout all sessions for user: ${sub}`);
    dto.sub = sub;
    const result = await this.authService.logoutAll(dto);
    const message = dto.forgetDevices
      ? `All sessions and trusted devices revoked for user (${result.revokedCount} session(s))`
      : `All sessions revoked for user (${result.revokedCount} session(s))`;
    this.logger.log(`Admin: Revoked ${result.revokedCount} session(s) for user: ${sub}`);

    return {
      message,
      revokedCount: result.revokedCount,
    };
  }

  /**
   * Get paginated list of users with advanced filtering
   *
   * Supports filtering by email, phone, verification status, social auth, lock status, MFA, and dates.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param query - Query parameters for filtering and pagination
   * @returns Paginated user list with metadata
   */
  @Get('admin/users')
  @HttpCode(HttpStatus.OK)
  async getUsers(@Query() query: GetUsersDTO): Promise<GetUsersResponseDTO> {
    this.logger.log(`Admin get users request`);
    return await this.authService.getUsers(query);
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

  @Public()
  @TokenDelivery('json')
  @Post('login/mobile')
  @HttpCode(HttpStatus.OK)
  async loginMobile(@Body() dto: LoginDTO): Promise<AuthResponseDTO> {
    this.logger.log(`Login attempt (mobile): ${dto.identifier}`);
    return await this.authService.login(dto);
  }

  /**
   * User signup (MOBILE/JSON MODE)
   *
   * @param dto - Signup credentials
   * @returns Auth response (tokens or challenge)
   */
  @Public()
  @TokenDelivery('json')
  @Post('signup/mobile')
  @HttpCode(HttpStatus.CREATED)
  async signupMobile(@Body() dto: SignupDTO): Promise<AuthResponseDTO> {
    this.logger.log(`Signup attempt (mobile): ${dto.email}`);
    return await this.authService.signup(dto);
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
   * Respond to authentication challenge (MOBILE/JSON MODE)
   *
   * Mobile version with @TokenDelivery('json') for JSON-based clients.
   *
   * @param dto - Challenge response with type-specific data
   * @returns Auth response (tokens in body or next challenge)
   */
  @Public()
  @TokenDelivery('json')
  @Post('respond-challenge/mobile')
  @HttpCode(HttpStatus.OK)
  async respondToChallengeMobile(@Body() dto: RespondChallengeDTO): Promise<AuthResponseDTO> {
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.logger.log(
      `[${requestId}] Challenge response (mobile): type=${dto.type}, session=${dto.session?.substring(0, 8)}...`,
    );
    try {
      const result = await this.authService.respondToChallenge(dto);
      this.logger.log(`[${requestId}] Challenge response (mobile) completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(
        `[${requestId}] Challenge response (mobile) failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    @Body() dto: RefreshTokenDTO,
    @Req() req: FastifyRequest & { cookies?: Record<string, string> },
  ): Promise<TokenResponse> {
    // Try body first (if provided and not empty), then cookies
    // Empty string or undefined in body indicates cookie mode - backend should get token from cookie
    if (!dto.refreshToken || (typeof dto.refreshToken === 'string' && dto.refreshToken.trim() === '')) {
      dto.refreshToken = req?.cookies?.['nauth_refresh_token'];
    }

    if (!dto.refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    this.logger.log('Token refresh attempt');
    return await this.authService.refreshToken(dto);
  }

  /**
   * Refresh access token (MOBILE/JSON MODE)
   *
   * @param dto - Refresh token DTO
   * @returns New token pair
   */
  @Public()
  @TokenDelivery('json')
  @Post('refresh/mobile')
  @HttpCode(HttpStatus.OK)
  async refreshMobile(@Body() dto: RefreshTokenDTO): Promise<TokenResponse> {
    if (!dto.refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }
    this.logger.log('Token refresh attempt (mobile)');
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

    // Automatically clears cookies via ClientInfoService context
    await this.authService.logout(dto);
    this.logger.log(`User logged out: ${user.email}`);

    return { message: 'Logged out successfully' };
  }

  /**
   * Logout user (MOBILE/JSON MODE)
   *
   * @param user - Current user (from JWT)
   * @param forgetMe - If true, also untrust the device
   * @returns Success message
   */

  @TokenDelivery('json')
  @Get('logout/mobile')
  @HttpCode(HttpStatus.OK)
  async logoutMobile(@CurrentUser() user: IUser, @Query('forgetMe') forgetMe?: string): Promise<{ message: string }> {
    const dto = new LogoutDTO();
    if (forgetMe === 'true' || forgetMe === '1') {
      dto.forgetMe = true;
    }
    dto.sub = user.sub;
    await this.authService.logout(dto);
    this.logger.log(`User logged out (mobile): ${user.email}`);
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

  @Post('logout/all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: IUser,
    @Body() dto: LogoutAllDTO,
  ): Promise<{ message: string; revokedCount: number }> {
    // Automatically clears cookies via ClientInfoService context
    dto.sub = user.sub;
    const result = await this.authService.logoutAll(dto);
    const message = dto.forgetDevices
      ? `All sessions and trusted devices revoked successfully (${result.revokedCount} session(s))`
      : `All sessions revoked successfully (${result.revokedCount} session(s))`;
    this.logger.log(`Global signout: ${user.email} (${result.revokedCount} session(s) revoked)`);

    return {
      message,
      revokedCount: result.revokedCount,
    };
  }

  /**
   * Get user's active sessions
   *
   * Returns a list of all active sessions for the authenticated user across all devices.
   * Includes session metadata like device info, IP address, location, and last activity.
   * Current session is marked with `isCurrent: true`.
   *
   * Requires authentication - user must be logged in.
   *
   * @param user - Current user (from JWT)
   * @returns List of active sessions with metadata
   *
   * @example
   * ```typescript
   * GET /auth/sessions
   * // Returns: { sessions: [{ sessionId, deviceInfo, ipAddress, lastActivity, isCurrent }] }
   * ```
   */

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  async getUserSessions(@CurrentUser() user: IUser): Promise<GetUserSessionsResponseDTO> {
    const dto = new GetUserSessionsDTO();
    dto.sub = user.sub;
    const result = await this.authService.getUserSessions(dto);
    this.logger.log(`Retrieved ${result.sessions.length} session(s) for user: ${user.email}`);
    return result;
  }

  /**
   * Logout from specific session
   *
   * Revokes a specific session by session ID. User can only logout their own sessions.
   * Session ownership is verified automatically.
   *
   * Useful for "sign out from device" functionality in user dashboards.
   *
   * Requires authentication - user must be logged in.
   *
   * @param user - Current user (from JWT)
   * @param sessionId - Session ID to revoke
   * @returns Success confirmation
   *
   * @example
   * ```typescript
   * DELETE /auth/sessions/123
   * // Returns: { success: true, wasCurrentSession: false }
   * ```
   */

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async logoutSession(
    @CurrentUser() user: IUser,
    @Param('sessionId') sessionId: string,
  ): Promise<LogoutSessionResponseDTO> {
    const dto = new LogoutSessionDTO();
    dto.sub = user.sub;
    dto.sessionId = sessionId;
    const result = await this.authService.logoutSession(dto);
    this.logger.log(`Session ${sessionId} revoked for user: ${user.email} (current: ${result.wasCurrentSession})`);
    return result;
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
  async getChallengeData(@Body() dto: GetChallengeDataDTO): Promise<unknown> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    this.logger.log(`Get challenge data: method=${dto.method}`);
    return await this.mfaService.getChallengeData(dto);
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
  async resendCode(@Body() dto: ResendCodeDTO): Promise<{ destination: string }> {
    this.logger.log('Resend verification code');
    // DTO is automatically validated by NAuthValidationPipe
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

  @Get('profile')
  async getProfile(@CurrentUser() user: IUser): Promise<IUser> {
    return user;
  }

  /**
   * Update current user profile
   */

  @Put('profile')
  async updateProfile(@CurrentUser() user: IUser, @Body() dto: UpdateUserAttributesRequestDTO) {
    // #region agent log
    const http = await import('http');
    const logData = JSON.stringify({
      location: 'auth.controller.ts:updateProfile',
      message: 'Received profile update',
      data: { dtoKeys: Object.keys(dto || {}), dtoValues: dto, userSub: user.sub },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'E',
    });
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 7242,
        path: '/ingest/97f9fe53-6a8b-43e2-ae9b-4b2d0f725816',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      () => {},
    );
    req.on('error', () => {});
    req.write(logData);
    req.end();
    // #endregion

    dto.sub = user.sub;
    return await this.authService.updateUserAttributes(dto);
  }

  /**
   * Change user password
   *
   * Allows authenticated users to change their password by providing
   * their current password and a new password.
   *
   * @param user - Current user (from JWT)
   * @param body - Current and new password (accepts both 'oldPassword' and 'currentPassword' for compatibility)
   * @returns Success message
   */

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: IUser,
    @Body() dto: ChangePasswordRequestDTO,
  ): Promise<{ message: string }> {
    dto.sub = user.sub;
    await this.authService.changePassword(dto);
    this.logger.log(`Password changed for user: ${user.email}`);
    return { message: 'Password changed successfully' };
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

  @Post('mfa/setup-data')
  async getMFASetupData(@CurrentUser() user: IUser, @Body() dto: SetupMFADTO): Promise<unknown> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    dto.sub = user.sub;
    const provider = this.mfaService.getProvider(dto.methodName);
    return await provider.setup(user, dto.setupData);
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

  @Post('mfa/verify-setup')
  async verifyMFASetup(@CurrentUser() user: IUser, @Body() dto: SetupMFADTO): Promise<{ deviceId: number }> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    dto.sub = user.sub;
    const provider = this.mfaService.getProvider(dto.methodName);
    const deviceId = await provider.verifySetup(user, dto.setupData);

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

  @Post('mfa/preferred-method')
  async setPreferredMFAMethod(
    @CurrentUser() user: IUser,
    @Body() dto: SetPreferredMethodDTO,
  ): Promise<{ message: string }> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    dto.userSub = user.sub;
    await this.mfaService.setPreferredMethod(dto);
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

  @Delete('mfa/method/:method')
  @HttpCode(HttpStatus.OK)
  async removeMFAMethod(
    @CurrentUser() user: IUser,
    @Param('method') method: string,
  ): Promise<{ message: string; deletedCount: number; mfaDisabled: boolean }> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    const dto = new RemoveDevicesDTO();
    dto.userSub = user.sub;
    dto.methodType = method;
    const result = await this.mfaService.removeDevices(dto);

    return {
      message: 'MFA method removed successfully',
      deletedCount: result.deletedCount,
      mfaDisabled: result.mfaDisabled,
    };
  }

  /**
   * Grant or revoke MFA exemption for current user
   *
   * SECURITY NOTE: In production, this should be an admin-only operation.
   * This endpoint allows users to grant/revoke their own exemption for testing purposes.
   *
   * @param user - Current user (from JWT)
   * @param body - Exemption request (exempt: boolean, reason?: string)
   * @returns Updated exemption status
   */

  @Post('mfa/exemption')
  @HttpCode(HttpStatus.OK)
  async setMFAExemption(
    @CurrentUser() user: IUser,
    @Body() dto: SetMFAExemptionDTO,
  ): Promise<{
    message: string;
    mfaExempt: boolean;
    mfaExemptReason: string | null;
    mfaExemptGrantedAt: Date | null;
  }> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    dto.userSub = user.sub;
    dto.grantedBy = user.email || null; // Use user's email as grantedBy for audit trail
    await this.mfaService.setMFAExemption(dto);

    // Get updated MFA status to return exemption fields
    const status = await this.mfaService.getMFAStatus(user);

    return {
      message: dto.exempt ? 'MFA exemption granted successfully' : 'MFA exemption revoked successfully',
      mfaExempt: status.mfaExempt,
      mfaExemptReason: status.mfaExemptReason,
      mfaExemptGrantedAt: status.mfaExemptGrantedAt,
    };
  }

  // ============================================================================
  // Social Authentication Endpoints
  // ============================================================================

  /**
   * NOTE: Social redirect-first endpoints are now owned by the toolkit (consumer stays lightweight).
   *
   * Use:
   * - GET /auth/social/:provider/redirect
   * - GET|POST /auth/social/:provider/callback
   * - POST /auth/social/exchange (json/hybrid)
   *
   * Implemented by `@nauth-toolkit/nestjs` (SocialRedirectController).
   */

  // ============================================================================
  // Social Account Management Endpoints
  // ============================================================================

  /**
   * Get linked social accounts for current user
   *
   * @param user - Current user (from JWT)
   * @returns Array of linked social account providers
   */

  @Get('social/linked')
  async getLinkedAccounts(@CurrentUser() user: IUser): Promise<{ providers: string[] }> {
    if (!this.socialAuthService) {
      throw new BadRequestException('Social auth service is not available');
    }

    const dto = new GetLinkedAccountsDTO();
    dto.userId = user.sub;
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

  @Post('social/link')
  async linkSocialAccount(@CurrentUser() user: IUser, @Body() dto: LinkSocialAccountDTO): Promise<{ message: string }> {
    if (!this.socialAuthService) {
      throw new BadRequestException('Social auth service is not available');
    }

    dto.userId = user.sub;
    return await this.socialAuthService.linkSocialAccount(dto);
  }

  /**
   * Unlink social account from current user
   *
   * @param user - Current user (from JWT)
   * @param body - Provider to unlink
   * @returns Success message
   */

  @Post('social/unlink')
  async unlinkSocialAccount(
    @CurrentUser() user: IUser,
    @Body() dto: UnlinkSocialAccountDTO,
  ): Promise<{ message: string }> {
    if (!this.socialAuthService) {
      throw new BadRequestException('Social auth service is not available');
    }

    dto.userId = user.sub;
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
