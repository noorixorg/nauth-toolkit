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
  AdminAuthService,
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
  AdminLogoutAllDTO,
  ResendCodeDTO,
  SetMustChangePasswordDTO,
  ChangePasswordDTO,
  ChangePasswordResponseDTO,
  ForgotPasswordDTO,
  ForgotPasswordResponseDTO,
  ConfirmForgotPasswordDTO,
  ConfirmForgotPasswordResponseDTO,
  LinkSocialAccountDTO,
  UnlinkSocialAccountDTO,
  GetSetupDataDTO,
  GetSetupDataResponseDTO,
  TokenDelivery,
  GetUserSessionsDTO,
  GetUserSessionsResponseDTO,
  LogoutSessionDTO,
  LogoutSessionResponseDTO,
  UpdateUserAttributesDTO,
  SetPreferredMethodDTO,
  AdminSetPreferredMethodDTO,
  SetMFAExemptionDTO,
  GetChallengeDataDTO,
  RemoveDevicesDTO,
  AdminRemoveDevicesDTO,
  SetupMFADTO,
  SetupMFAResponseDTO,
  GetMFAStatusResponseDTO,
  AdminSetPasswordResponseDTO,
  SetMustChangePasswordResponseDTO,
  LogoutResponseDTO,
  LogoutAllResponseDTO,
  TrustDeviceResponseDTO,
  IsTrustedDeviceResponseDTO,
  GetChallengeDataResponseDTO,
  ResendCodeResponseDTO,
  SetPreferredMethodResponseDTO,
  RemoveDevicesResponseDTO,
  SetMFAExemptionResponseDTO,
  GetLinkedAccountsResponseDTO,
  LinkSocialAccountResponseDTO,
  UnlinkSocialAccountResponseDTO,
  AdminGetMFAStatusDTO,
  GetUserByIdDTO,
  GetUserAuthHistoryDTO,
  GetUserAuthHistoryResponseDTO,
  AdminGetUserAuthHistoryDTO,
  UserResponseDto,
  IMFADevice,
  RequireRecaptcha,
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
    protected readonly adminAuthService: AdminAuthService,
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
    dto.baseUrl = 'https://localhost:4200/reset-password';
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
  @RequireRecaptcha()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDTO): Promise<AuthResponseDTO> {
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
    return await this.adminAuthService.signup(dto);
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
    return await this.adminAuthService.signupSocial(dto);
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
  async adminSetPassword(@Body() dto: AdminSetPasswordDTO): Promise<AdminSetPasswordResponseDTO> {
    return await this.adminAuthService.setPassword(dto);
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
  @TokenDelivery('cookies')
  @HttpCode(HttpStatus.OK)
  async adminResetPassword(@Body() dto: AdminResetPasswordDTO): Promise<AdminResetPasswordResponseDTO> {
    return this.adminAuthService.resetPassword(dto);
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
    return this.adminAuthService.confirmResetPassword(dto);
  }

  /**
   * Admin: Get a user by sub
   *
   * Returns a single user by `sub` (UUID).
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param sub - User UUID (sub)
   * @returns User response DTO or null if not found
   */
  @Get('admin/users/:sub')
  @HttpCode(HttpStatus.OK)
  async getUserBySub(@Param() dto: GetUserByIdDTO): Promise<UserResponseDto | null> {
    return await this.adminAuthService.getUserById(dto);
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
  async deleteUser(@Param() dto: DeleteUserDTO): Promise<DeleteUserResponseDTO> {
    return await this.adminAuthService.deleteUser(dto);
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
  async disableUser(
    @Param() params: DisableUserDTO,
    @Body() body: { reason?: string },
  ): Promise<DisableUserResponseDTO> {
    return await this.adminAuthService.disableUser({ ...params, reason: body?.reason });
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
  async forcePasswordChange(@Param() dto: SetMustChangePasswordDTO): Promise<SetMustChangePasswordResponseDTO> {
    return await this.adminAuthService.setMustChangePassword(dto);
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
  async enableUser(@Param() dto: EnableUserDTO): Promise<EnableUserResponseDTO> {
    return await this.adminAuthService.enableUser(dto);
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
  async adminGetUserSessions(@Param() dto: GetUserSessionsDTO): Promise<GetUserSessionsResponseDTO> {
    return await this.adminAuthService.getUserSessions(dto);
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
   * @param dto - AdminLogoutAllDTO with optional forgetDevices flag
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
    @Param() params: Pick<AdminLogoutAllDTO, 'sub'>,
    @Body() body: Pick<AdminLogoutAllDTO, 'forgetDevices'>,
  ): Promise<LogoutAllResponseDTO> {
    return await this.adminAuthService.logoutAll({ sub: params.sub, forgetDevices: body?.forgetDevices });
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
    return await this.adminAuthService.getUsers(query);
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
  // @RequireRecaptcha()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDTO): Promise<AuthResponseDTO> {
    return await this.authService.login(dto);
  }

  @Public()
  @TokenDelivery('json')
  @Post('login/mobile')
  @HttpCode(HttpStatus.OK)
  async loginMobile(@Body() dto: LoginDTO): Promise<AuthResponseDTO> {
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
    return await this.authService.respondToChallenge(dto);
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
    return await this.authService.respondToChallenge(dto);
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
    @Body() dto: RefreshTokenDTO | undefined,
    @Req() req: FastifyRequest & { cookies?: Record<string, string> },
  ): Promise<TokenResponse> {
    // Cookies mode: the request body can be `undefined` (no JSON body).
    // Ensure we never dereference an undefined DTO.
    const dtoToUse: RefreshTokenDTO = dto ?? ({} as RefreshTokenDTO);

    if (!dtoToUse.refreshToken || (typeof dtoToUse.refreshToken === 'string' && dtoToUse.refreshToken.trim() === '')) {
      dtoToUse.refreshToken = req?.cookies?.['nauth_refresh_token'];
    }
    return await this.authService.refreshToken(dtoToUse);
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
  async logout(@Query('forgetMe') forgetMe?: string): Promise<LogoutResponseDTO> {
    // Session ID is automatically extracted from JWT token context by the library
    const dto = new LogoutDTO();
    if (forgetMe === 'true' || forgetMe === '1') {
      dto.forgetMe = true;
    }
    // Automatically clears cookies via ClientInfoService context
    return await this.authService.logout(dto);
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
  async logoutMobile(@Query('forgetMe') forgetMe?: string): Promise<LogoutResponseDTO> {
    const dto = new LogoutDTO();
    if (forgetMe === 'true' || forgetMe === '1') {
      dto.forgetMe = true;
    }
    return await this.authService.logout(dto);
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
  async logoutAll(@Body() dto: LogoutAllDTO): Promise<LogoutAllResponseDTO> {
    // Automatically clears cookies via ClientInfoService context
    return await this.authService.logoutAll(dto);
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
  async getUserSessions(): Promise<GetUserSessionsResponseDTO> {
    return await this.authService.getUserSessions();
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
  async logoutSession(@Param('sessionId') sessionId: string): Promise<LogoutSessionResponseDTO> {
    const dto = new LogoutSessionDTO();
    dto.sessionId = sessionId;
    return await this.authService.logoutSession(dto);
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
  async trustDevice(): Promise<TrustDeviceResponseDTO> {
    // Session ID is automatically extracted from JWT token context by the library
    return await this.authService.trustDevice();
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
  async isTrustedDevice(): Promise<IsTrustedDeviceResponseDTO> {
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
  async getChallengeData(@Body() dto: GetChallengeDataDTO): Promise<GetChallengeDataResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

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
  async resendCode(@Body() dto: ResendCodeDTO): Promise<ResendCodeResponseDTO> {
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
  async updateProfile(@Body() dto: UpdateUserAttributesDTO) {
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
  async changePassword(@Body() dto: ChangePasswordDTO): Promise<ChangePasswordResponseDTO> {
    return await this.authService.changePassword(dto);
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

  // NOTE: requestPasswordChange removed - SetMustChangePasswordDTO requires sub (admin API)
  // Use admin endpoint: POST /auth/admin/users/:sub/force-password-change

  // ============================================================================
  // MFA Management Endpoints
  // ============================================================================

  /**
   * Get MFA status for current user
   *
   * @param user - Current user (from JWT)
   * @returns MFA status including enabled methods, configured devices, etc.
   */
  /**
   * Get MFA status for current user
   *
   * @returns MFA status including enabled methods, configured devices, etc.
   */
  @Get('mfa/status')
  async getMfaStatus(): Promise<GetMFAStatusResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    return await this.mfaService.getMfaStatus();
  }

  /**
   * Get MFA status for a user (Admin API)
   *
   * Admin-only endpoint. Requires sub in request body.
   *
   * @param dto - GetMFAStatusDTO with user sub
   * @returns MFA status including enabled methods, configured devices, etc.
   */
  @Get('admin/users/:sub/mfa/status')
  @HttpCode(HttpStatus.OK)
  async adminGetMfaStatus(@Param() dto: AdminGetMFAStatusDTO): Promise<GetMFAStatusResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    return await this.mfaService.adminGetMfaStatus(dto);
  }

  /**
   * Set preferred MFA method for a user (Admin API)
   *
   * Admin-only endpoint. Requires `sub` and `methodType` in request body.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   */
  @Post('admin/mfa/preferred-method')
  @HttpCode(HttpStatus.OK)
  async adminSetPreferredMFAMethod(@Body() dto: AdminSetPreferredMethodDTO): Promise<SetPreferredMethodResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }
    return await this.mfaService.adminSetPreferredMethod(dto);
  }

  /**
   * Remove MFA devices by method type for a user (Admin API)
   *
   * Admin-only endpoint. Requires `sub` and `methodType` in request body.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   */
  @Post('admin/mfa/remove-devices')
  @HttpCode(HttpStatus.OK)
  async adminRemoveMFAMethod(@Body() dto: AdminRemoveDevicesDTO): Promise<RemoveDevicesResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }
    return await this.mfaService.adminRemoveDevices(dto);
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
  async getMFASetupData(@Body() dto: SetupMFADTO): Promise<SetupMFAResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    const result = await this.mfaService.setup(dto);
    return result;
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
  async verifyMFASetup(@Body() dto: SetupMFADTO): Promise<{ deviceId: number }> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    const provider = this.mfaService.getProvider(dto.methodName);
    const deviceId = await provider.verifySetup(dto.setupData);

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
  async getMFADevices(): Promise<IMFADevice[]> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    const devicesResponse = await this.mfaService.getUserDevices({});
    return devicesResponse.devices;
  }

  /**
   * Set preferred MFA method
   *
   * @param user - Current user (from JWT)
   * @param body - Preferred method
   * @returns Success message
   */

  @Post('mfa/preferred-method')
  async setPreferredMFAMethod(@Body() dto: SetPreferredMethodDTO): Promise<SetPreferredMethodResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    return await this.mfaService.setPreferredMethod(dto);
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
  async removeMFAMethod(@Param('method') method: string): Promise<RemoveDevicesResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    const dto: RemoveDevicesDTO = {
      methodType: method,
    };
    return await this.mfaService.removeDevices(dto);
  }

  /**
   * Grant or revoke MFA exemption for a user (Admin API)
   *
   * SECURITY: This is an admin-only operation.
   * Admins can grant/revoke MFA exemption for any user.
   *
   * **SECURITY WARNING:** This endpoint has NO built-in authentication.
   * You MUST protect it with your own admin authentication guard.
   *
   * @param dto - Exemption request with sub, exempt flag, reason, and grantedBy
   * @returns Updated exemption status
   */
  @Post('admin/mfa/exemption')
  @HttpCode(HttpStatus.OK)
  async setMFAExemption(
    @Body() dto: SetMFAExemptionDTO,
    @CurrentUser() adminUser: IUser,
  ): Promise<SetMFAExemptionResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    // Admin API - sub comes from DTO (target user)
    // grantedBy: use admin's sub when not provided (for mfaExemptGrantedBy and audit performedBy)
    if (!dto.grantedBy) {
      dto.grantedBy = adminUser?.sub ?? null;
    }
    return await this.mfaService.setMFAExemption(dto);
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
  async getLinkedAccounts(): Promise<GetLinkedAccountsResponseDTO> {
    if (!this.socialAuthService) {
      throw new BadRequestException('Social auth service is not available');
    }

    return await this.socialAuthService.getLinkedAccounts({});
  }

  /**
   * Link social account to current user
   *
   * @param user - Current user (from JWT)
   * @param body - OAuth callback parameters
   * @returns Success message
   */

  @Post('social/link')
  async linkSocialAccount(@Body() dto: LinkSocialAccountDTO): Promise<LinkSocialAccountResponseDTO> {
    if (!this.socialAuthService) {
      throw new BadRequestException('Social auth service is not available');
    }

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
  async unlinkSocialAccount(@Body() dto: UnlinkSocialAccountDTO): Promise<UnlinkSocialAccountResponseDTO> {
    if (!this.socialAuthService) {
      throw new BadRequestException('Social auth service is not available');
    }

    return await this.socialAuthService.unlinkSocialAccount(dto);
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

  /**
   * Get authentication audit history for current user
   *
   * @param query - GetUserAuthHistoryDTO with filtering options (sub set from context)
   * @returns Paginated audit history
   */
  @Get('audit/history')
  async getAuditHistory(@Query() query: GetUserAuthHistoryDTO): Promise<GetUserAuthHistoryResponseDTO> {
    return await this.authService.getUserAuthHistory(query);
  }

  /**
   * Get authentication audit history for a user (Admin API)
   *
   * Admin-only endpoint. Requires sub in query parameters.
   *
   * @param query - AdminGetUserAuthHistoryDTO with sub and filtering options
   * @returns Paginated audit history
   */
  @Get('admin/audit/history')
  async adminGetAuditHistory(@Query() query: AdminGetUserAuthHistoryDTO): Promise<GetUserAuthHistoryResponseDTO> {
    if (!this.auditService) {
      throw new BadRequestException('Audit service is not available');
    }

    // Admin API - sub comes from query parameters (target user)
    return await this.auditService.getUserAuthHistory(query);
  }
}

// ============================================================================
// Mobile JSON API (Capacitor / Native Clients)
// ============================================================================

/**
 * Mobile Authentication Controller (JSON token delivery)
 *
 * Playwright's `json` project expects the following endpoints:
 * - POST /mobile/auth/signup
 * - POST /mobile/auth/login
 * - POST /mobile/auth/refresh
 *
 * These endpoints mirror the core AuthService methods, but always use `@TokenDelivery('json')`.
 */
@UseGuards(AuthGuard)
@Controller('mobile/auth')
export class MobileAuthController {
  constructor(protected readonly authService: AuthService) {}

  /**
   * Mobile signup (JSON token delivery)
   */
  @Public()
  @TokenDelivery('json')
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDTO): Promise<AuthResponseDTO> {
    return await this.authService.signup(dto);
  }

  /**
   * Mobile login (JSON token delivery).
   *
   * With enforceFor: ['cookies'], JSON routes are already exempt from reCAPTCHA.
   * @SkipRecaptcha() is shown here for when you need to explicitly skip in other configs.
   */
  @Public()
  @TokenDelivery('json')
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDTO): Promise<AuthResponseDTO> {
    return await this.authService.login(dto);
  }

  /**
   * Mobile refresh (JSON token delivery)
   */
  @Public()
  @TokenDelivery('json')
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDTO): Promise<TokenResponse> {
    return await this.authService.refreshToken(dto);
  }
}
