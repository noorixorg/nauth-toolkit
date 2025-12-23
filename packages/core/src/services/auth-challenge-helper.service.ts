import { Repository } from 'typeorm';
import { BaseMFADevice } from '../entities';
import { AuthResponseDTO } from '../dto/auth-response.dto';
import { AuthChallenge } from '../dto/auth-challenge.dto';
import { SendVerificationEmailDTO } from '../dto/verify-email.dto';
import { SendVerificationSMSDTO } from '../dto/verify-phone.dto';
import { IUser, IMFADevice } from '../interfaces/entities.interface';
import { ChallengeService } from './challenge.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { EmailVerificationService } from './email-verification.service';
import { PhoneVerificationService } from './phone-verification.service';
import { ClientInfoService } from './client-info.service';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { MFAMethod, MFADeviceMethod, MFAVerificationMethod, MFADeviceMethods } from '../enums/mfa-method.enum';
import { AuthFlowStateMachineService } from './auth-flow-state-machine.service';
import { AuthFlowContextBuilder } from './auth-flow-context-builder.service';
import { AuthFlowState, AuthFlowContext } from './auth-flow-state-machine.types';

/**
 * Helper service for challenge-response authentication flows
 *
 * This service determines if a user needs to complete challenges
 * before full authentication can be granted, and generates appropriate
 * responses including MFA challenges.
 *
 * @example
 * ```typescript
 * const response = await challengeHelper.determineAuthResponse(
 *   user,
 *   'login',
 *   { ipAddress: '1.2.3.4' }
 * );
 * ```
 */
export class AuthChallengeHelperService {
  constructor(
    private readonly challengeService: ChallengeService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly mfaDeviceRepository: Repository<BaseMFADevice>,
    private readonly logger: NAuthLogger,
    private readonly stateMachine: AuthFlowStateMachineService,
    private readonly contextBuilder: AuthFlowContextBuilder,
    private readonly clientInfoService: ClientInfoService,
    private readonly emailVerificationService?: EmailVerificationService,
    private readonly phoneVerificationService?: PhoneVerificationService, // Optional - only available when SMS provider is configured
  ) {}

  // ============================================================================
  // OLD METHODS DELETED - Replaced by state machine
  // ============================================================================
  // determinePendingChallenges() - DELETED (replaced by state machine)
  // isMFASetupRequired() - DELETED (replaced by state machine)
  // checkMFARequirement() - DELETED (replaced by state machine)
  // All challenge determination is now handled by determineAuthResponse() using state machine

  /**
   * Create challenge response for authentication
   *
   * Generates a challenge session and returns challenge details to client.
   * Sends verification codes when challenges are created to ensure sequential flow.
   *
   * @param user - User who needs to complete challenges
   * @param challengeName - Type of challenge
   * @param config - Auth configuration
   * @param authMethod - Authentication method ('password' or 'social')
   * @param authProvider - Provider name for social auth (e.g., 'google', 'facebook')
   * @returns Challenge response DTO
   *
   * @example
   * ```typescript
   * const response = await challengeHelper.createChallengeResponse(
   *   user,
   *   AuthChallenge.VERIFY_EMAIL,
   *   config,
   *   'social',
   *   'google'
   * );
   * ```
   */
  async createChallengeResponse(
    user: IUser,
    challengeName: AuthChallenge,
    config: NAuthConfig,
    authMethod: 'password' | 'social' = 'password',
    authProvider?: string,
    skipAutoSend?: boolean,
  ): Promise<AuthResponseDTO> {
    // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
    // Note: ClientInfoService is used transparently by ChallengeService and AuditService

    // ============================================================================
    // STEP 1: Create challenge session FIRST (before sending codes)
    // ============================================================================
    // This ensures the session exists before any verification codes are sent.
    // Creating the session first is critical for proper audit trail and session tracking.
    this.logger?.debug?.(
      `Creating challenge with authMethod=${authMethod}, authProvider=${authProvider || 'none'} for user ${user.sub}`,
    );

    // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
    const challengeSession = await this.challengeService.createChallengeSession(user, challengeName, {
      email: user.email,
      phone: user.phone,
      authMethod, // Store auth method for challenge completion flow
      authProvider, // Store provider for social auth (e.g., 'google', 'facebook')
    });

    // ============================================================================
    // STEP 2: Send verification codes AFTER session is created
    // ============================================================================
    // This ensures codes are sent at the right time:
    // - Email code sent when VERIFY_EMAIL challenge is created
    // - Phone code sent when VERIFY_PHONE challenge is created (after email is verified)
    // This prevents sending both codes at once, avoiding user confusion.
    // Challenges are sequential: first VERIFY_EMAIL, then VERIFY_PHONE
    if (challengeName === AuthChallenge.VERIFY_EMAIL && this.emailVerificationService) {
      this.logger?.log?.(`Sending verification email to: ${user.email}`);
      // Fire and forget - don't block challenge response
      const emailDto = Object.assign(new SendVerificationEmailDTO(), {
        sub: user.sub,
        baseUrl: undefined,
        challengeSessionId: challengeSession.id, // Link verification token to this challenge session
      });
      this.emailVerificationService
        .sendVerificationEmail(emailDto)
        .then(() => {
          this.logger?.log?.(`Verification email sent successfully to: ${user.email}`);
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger?.error?.(`Failed to send verification email to ${user.email}: ${errorMessage}`);
        });
    }

    // Skip auto-send if SMS was already sent (e.g., during phone collection)
    if (!skipAutoSend && challengeName === AuthChallenge.VERIFY_PHONE && this.phoneVerificationService && user.phone) {
      this.logger?.log?.(`Sending verification SMS to: ${user.phone}`);
      // Fire and forget - don't block challenge response
      const smsDto = Object.assign(new SendVerificationSMSDTO(), {
        sub: user.sub,
        skipAlreadyVerifiedCheck: false, // Explicitly set to false for phone verification (not MFA)
        challengeSessionId: challengeSession.id, // Link verification token to this challenge session
      });
      this.phoneVerificationService
        .sendVerificationSMS(smsDto)
        .then(() => {
          this.logger?.log?.(`Verification SMS sent successfully to: ${user.phone}`);
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger?.error?.(`Failed to send verification SMS to ${user.phone}: ${errorMessage}`);
        });
    }

    // ============================================================================
    // STEP 3: Send MFA challenge code for MFA_REQUIRED (if SMS is preferred method)
    // ============================================================================
    // When user logs in and MFA verification is required, automatically send SMS code
    // if SMS is their preferred MFA method. This provides better UX by not requiring
    // a separate API call to trigger code sending.
    //
    // Note: MFA_REQUIRED challenges are handled by createMFAChallengeResponse()
    // which includes auto-send SMS logic

    // Build challenge parameters
    // Note: Type is Record<string, unknown> to allow arrays (e.g., allowedMethods for MFA)
    const challengeParameters: Record<string, unknown> = {};

    switch (challengeName) {
      case AuthChallenge.VERIFY_EMAIL:
        challengeParameters.email = user.email;
        challengeParameters.codeDeliveryDestination = this.challengeService.maskEmail(user.email);
        break;

      case AuthChallenge.VERIFY_PHONE:
        challengeParameters.phone = user.phone || undefined;
        challengeParameters.codeDeliveryDestination = user.phone
          ? this.challengeService.maskPhone(user.phone)
          : undefined;
        // If no phone, indicate user must provide it first
        if (!user.phone) {
          challengeParameters.requiresPhoneCollection = 'true';
          challengeParameters.instructions = 'You must add a phone number and verify it to continue';
        }
        break;

      case AuthChallenge.MFA_REQUIRED:
        challengeParameters.instructions = 'Multi-factor authentication is required';
        // Include masked phone if SMS is preferred method
        if (user.preferredMfaMethod === 'sms' && user.phone) {
          challengeParameters.codeDeliveryDestination = this.challengeService.maskPhone(user.phone);
        }
        // Include masked email if Email is preferred method
        if (user.preferredMfaMethod === 'email' && user.email) {
          challengeParameters.codeDeliveryDestination = this.challengeService.maskEmail(user.email);
        }
        break;

      case AuthChallenge.MFA_SETUP_REQUIRED: {
        const allowedMethods = config.mfa?.allowedMethods || [...MFADeviceMethods];
        challengeParameters.allowedMethods = allowedMethods;
        challengeParameters.instructions = 'Multi-factor authentication setup is required before you can login';
        break;
      }

      case AuthChallenge.FORCE_CHANGE_PASSWORD:
        challengeParameters.instructions = 'You must change your password before continuing';
        break;
    }

    const response: AuthResponseDTO = {
      challengeName,
      session: challengeSession.sessionToken,
      challengeParameters,
      userSub: user.sub,
    };

    return response;
  }

  // ============================================================================
  // MFA Challenge Support
  // ============================================================================
  // checkMFARequirement() - DELETED (replaced by state machine)
  // All MFA requirement checking is now handled by state machine in determineAuthResponse()

  /**
   * Create MFA setup challenge response
   *
   * Generates challenge session for MFA setup requirement.
   * User must set up MFA before being allowed to login.
   *
   * @param user - User requiring MFA setup
   * @param config - Auth configuration
   * @param authMethod - Authentication method ('password' or 'social')
   * @param authProvider - Provider name for social auth (e.g., 'google', 'facebook')
   * @returns MFA setup challenge response
   *
   * @example
   * ```typescript
   * const response = await challengeHelper.createMFASetupChallengeResponse(
   *   user,
   *   config,
   *   'social',
   *   'google'
   * );
   * // Returns: { challengeName: 'MFA_SETUP_REQUIRED', session: '...', challengeParameters: {...} }
   * ```
   */
  async createMFASetupChallengeResponse(
    user: IUser,
    config: NAuthConfig,
    authMethod: 'password' | 'social' = 'password',
    authProvider?: string,
  ): Promise<AuthResponseDTO> {
    // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
    // Note: ClientInfoService is used transparently by ChallengeService and AuditService
    this.logger?.log?.(`Creating MFA setup challenge for user: ${user.sub}`);

    const allowedMethods = config.mfa?.allowedMethods || [...MFADeviceMethods];

    // Create challenge session with auth context
    this.logger?.debug?.(
      `Creating MFA setup challenge with authMethod=${authMethod}, authProvider=${authProvider || 'none'} for user ${user.sub}`,
    );

    // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
    const challengeSession = await this.challengeService.createChallengeSession(
      user,
      AuthChallenge.MFA_SETUP_REQUIRED,
      {
        allowedMethods,
        requiresSetup: true,
        authMethod, // Store auth method for challenge completion flow
        authProvider, // Store provider for social auth
      },
    );

    this.logger?.log?.(`MFA setup challenge created for user: ${user.sub}`);

    // Return challenge response
    return {
      challengeName: AuthChallenge.MFA_SETUP_REQUIRED,
      session: challengeSession.sessionToken,
      challengeParameters: {
        allowedMethods,
        instructions: 'Multi-factor authentication setup is required before you can login',
      },
      userSub: user.sub,
    } as AuthResponseDTO;
  }

  /**
   * Create MFA challenge response
   *
   * Generates challenge session for MFA verification.
   * Returns available MFA methods and challenge parameters.
   *
   * @param user - User requiring MFA
   * @returns MFA challenge response
   * @remarks Client info (ipAddress, userAgent) is automatically extracted from ClientInfoService context
   *
   * @example
   * ```typescript
   * const response = await challengeHelper.createMFAChallengeResponse(
   *   user,
   *   '1.2.3.4',
   *   'Mozilla/5.0...'
   * );
   * // Returns: { challengeName: 'MFA_REQUIRED', session: '...', challengeParameters: {...} }
   * ```
   */
  async createMFAChallengeResponse(user: IUser): Promise<AuthResponseDTO> {
    // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
    // Note: ClientInfoService is used transparently by ChallengeService and AuditService
    this.logger?.log?.(`Creating MFA challenge for user: ${user.sub}`);

    // Get user's active MFA devices
    const devices = (await this.mfaDeviceRepository.find({
      where: { userId: user.id, isActive: true },
      order: { isPrimary: 'DESC', lastUsedAt: 'DESC' },
    })) as unknown as IMFADevice[];

    if (devices.length === 0) {
      this.logger?.warn?.(`User has MFA enabled but no active devices: ${user.sub}`);
      // User has MFA enabled but no devices - should not happen
      // Allow login and let them set up MFA
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'MFA enabled but no devices configured');
    }

    // Get available methods (device types only - no backup)
    const deviceMethods = [...new Set(devices.map((d) => d.type))] as MFADeviceMethod[];

    // Build full available methods list (including backup if available)
    const availableMethods: MFAVerificationMethod[] = [...deviceMethods];
    if (user.backupCodes && user.backupCodes.length > 0) {
      availableMethods.push(MFAMethod.BACKUP);
    }

    // Debug logging for troubleshooting
    this.logger?.debug?.(
      `MFA challenge for user ${user.sub}: preferredMfaMethod=${user.preferredMfaMethod}, deviceMethods=[${deviceMethods.join(', ')}], devices=[${devices.map((d) => `${d.type}${d.isPrimary ? '(primary)' : ''}`).join(', ')}]`,
    );

    // Determine preferred method - prioritize user.preferredMfaMethod over primaryDevice
    // This ensures that when user explicitly sets a preferred method, it's respected
    let preferredMethod: string;

    // Normalize preferred method to lowercase for comparison (database might store in different case)
    const normalizedPreferredMethod = user.preferredMfaMethod?.toLowerCase();

    // Check if user has a preferred method and it's available
    if (
      normalizedPreferredMethod &&
      (normalizedPreferredMethod === MFAMethod.TOTP ||
        normalizedPreferredMethod === MFAMethod.SMS ||
        normalizedPreferredMethod === MFAMethod.EMAIL ||
        normalizedPreferredMethod === MFAMethod.PASSKEY) &&
      deviceMethods.some((m) => m.toLowerCase() === normalizedPreferredMethod)
    ) {
      // User has explicitly set a preferred method and it's available
      // Find the actual method from deviceMethods to ensure case consistency
      preferredMethod =
        deviceMethods.find((m) => m.toLowerCase() === normalizedPreferredMethod) || normalizedPreferredMethod;
      this.logger?.debug?.(
        `Using user preferred MFA method: ${preferredMethod} (from user.preferredMfaMethod: ${user.preferredMfaMethod})`,
      );
    } else {
      // Fallback to primary device or first available method
      const primaryDevice = devices.find((d) => d.isPrimary);
      preferredMethod = primaryDevice?.type || deviceMethods[0];
      this.logger?.debug?.(
        `Using fallback MFA method: ${preferredMethod} (preferred: ${user.preferredMfaMethod}, available: ${deviceMethods.join(', ')})`,
      );
    }

    // Get masked phone if SMS is available
    let maskedPhone: string | undefined;
    const smsDevice = devices.find((d) => d.type === MFAMethod.SMS && d.phoneNumber);
    if (smsDevice?.phoneNumber) {
      const digits = smsDevice.phoneNumber.replace(/\D/g, '');
      maskedPhone = digits.length >= 4 ? `***-***-${digits.slice(-4)}` : smsDevice.phoneNumber;
    }

    // Get masked email if Email is available
    let maskedEmail: string | undefined;
    const emailDevice = devices.find((d) => d.type === MFAMethod.EMAIL && d.email);
    const emailToMask = emailDevice?.email || user.email; // Fallback to user.email if device doesn't have it
    if (emailToMask) {
      // Mask email: show first char and domain (e.g., u***r@example.com)
      const [localPart, domain] = emailToMask.split('@');
      if (localPart && domain) {
        const firstChar = localPart[0];
        const lastChar = localPart[localPart.length - 1];
        maskedEmail = localPart.length > 2 ? `${firstChar}***${lastChar}@${domain}` : `${firstChar}***@${domain}`;
      } else {
        maskedEmail = emailToMask;
      }
    }

    // Create challenge session
    // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
    // Store preferred method in metadata for resend endpoint to know which method to use
    const challengeSession = await this.challengeService.createChallengeSession(user, AuthChallenge.MFA_REQUIRED, {
      availableMethods,
      preferredMethod,
      maskedPhone,
      maskedEmail,
      method: preferredMethod, // Store method in metadata for resend endpoint
    });

    this.logger?.log?.(`MFA challenge created for user: ${user.sub}`);

    // ============================================================================
    // Auto-send SMS code if SMS is the preferred method
    // ============================================================================
    // Automatically send SMS code if:
    // 1. SMS is user's preferred MFA method, OR
    // 2. SMS is the ONLY MFA method they have setup
    //
    // This provides better UX by not requiring a separate API call to trigger code sending.
    const smsIsPreferred = preferredMethod.toLowerCase() === 'sms';
    const smsIsOnly = deviceMethods.length === 1 && deviceMethods[0].toLowerCase() === 'sms';

    if ((smsIsPreferred || smsIsOnly) && this.phoneVerificationService && user.phone) {
      this.logger?.log?.(
        `Auto-sending MFA SMS code to user ${user.sub} (preferred=${smsIsPreferred}, only=${smsIsOnly})`,
      );
      // Fire and forget - don't block challenge response
      // Use PhoneVerificationService which handles SMS sending, rate limits, and token storage
      // skipAlreadyVerifiedCheck=true because phone is already verified but we need MFA code
      const smsDto = Object.assign(new SendVerificationSMSDTO(), {
        sub: user.sub,
        skipAlreadyVerifiedCheck: true,
        challengeSessionId: challengeSession.id, // Link MFA SMS code to this challenge session
      });
      this.phoneVerificationService
        .sendVerificationSMS(smsDto)
        .then(() => {
          this.logger?.log?.(`MFA SMS code sent successfully to user ${user.sub}`);
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger?.error?.(`Failed to send MFA SMS code to user ${user.sub}: ${errorMessage}`);
        });
    } else {
      this.logger?.debug?.(
        `Skipped auto-send MFA SMS for user ${user.sub}: ` +
          `phoneService=${!!this.phoneVerificationService}, ` +
          `preferredMethod=${preferredMethod}, ` +
          `smsIsPreferred=${smsIsPreferred}, ` +
          `smsIsOnly=${smsIsOnly}, ` +
          `deviceMethods=[${deviceMethods.join(', ')}], ` +
          `phone=${!!user.phone}`,
      );
    }

    // ============================================================================
    // Auto-send Email code if Email is the preferred method
    // ============================================================================
    // Automatically send Email code if:
    // 1. Email is user's preferred MFA method, OR
    // 2. Email is the ONLY MFA method they have setup
    //
    // This provides better UX by not requiring a separate API call to trigger code sending.
    const emailIsPreferred = preferredMethod.toLowerCase() === 'email';
    const emailIsOnly = deviceMethods.length === 1 && deviceMethods[0].toLowerCase() === 'email';

    if ((emailIsPreferred || emailIsOnly) && this.emailVerificationService && user.email) {
      this.logger?.log?.(
        `Auto-sending MFA Email code to user ${user.sub} (preferred=${emailIsPreferred}, only=${emailIsOnly})`,
      );
      // Fire and forget - don't block challenge response
      // Use EmailVerificationService which handles email sending, rate limits, and token storage
      // skipAlreadyVerifiedCheck=true because email is already verified but we need MFA code
      const emailDto = Object.assign(new SendVerificationEmailDTO(), {
        sub: user.sub,
        baseUrl: undefined,
        skipAlreadyVerifiedCheck: true,
        challengeSessionId: challengeSession.id, // Link MFA email code to this challenge session
      });
      this.emailVerificationService
        .sendVerificationEmail(emailDto)
        .then(() => {
          this.logger?.log?.(`MFA Email code sent successfully to user ${user.sub}`);
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger?.error?.(`Failed to send MFA Email code to user ${user.sub}: ${errorMessage}`);
        });
    } else {
      this.logger?.debug?.(
        `Skipped auto-send MFA Email for user ${user.sub}: ` +
          `emailService=${!!this.emailVerificationService}, ` +
          `preferredMethod=${preferredMethod}, ` +
          `emailIsPreferred=${emailIsPreferred}, ` +
          `emailIsOnly=${emailIsOnly}, ` +
          `deviceMethods=[${deviceMethods.join(', ')}], ` +
          `email=${!!user.email}`,
      );
    }

    // Return challenge response
    // Always include maskedEmail if email is preferred, even if undefined (frontend can use user.email)
    const challengeParams: Record<string, unknown> = {
      availableMethods,
      preferredMethod: preferredMethod as MFADeviceMethod,
    };
    if (maskedPhone) {
      challengeParams.maskedPhone = maskedPhone;
    }
    if (maskedEmail || preferredMethod.toLowerCase() === 'email') {
      // Include maskedEmail if available, or if email is preferred (frontend will handle display)
      challengeParams.maskedEmail = maskedEmail || user.email || '';
    }

    return {
      challengeName: AuthChallenge.MFA_REQUIRED,
      session: challengeSession.sessionToken,
      challengeParameters: challengeParams,
    } as AuthResponseDTO;
  }

  // ============================================================================
  // Success Response
  // ============================================================================

  /**
   * Create successful authentication response with tokens
   *
   * Generates tokens and session for fully authenticated user.
   *
   * @param user - Authenticated user
   * @param deviceToken - Device token (optional)
   * @param isTrusted - Whether device is trusted (optional)
   * @param isSocialLogin - Whether this is a social login (optional)
   * @param metadata - Response metadata (optional)
   * @returns Auth response with tokens
   *
   * @example
   * ```typescript
   * const response = await challengeHelper.createSuccessResponse(
   *   user,
   *   'abc123',
   *   true,
   *   false
   * );
   * ```
   */
  async createSuccessResponse(
    user: IUser,
    deviceToken?: string,
    isTrusted?: boolean,
    _isSocialLogin = false, // Reserved for future use
    _metadata?: {
      // Reserved for future use
      gracePeriodEndsAt?: Date;
      riskScore?: number;
      riskLevel?: 'low' | 'medium' | 'high';
      blockedUntil?: Date;
      reason?: string;
    },
    sessionAuthMethod: string = 'password',
  ): Promise<AuthResponseDTO> {
    // Get client info from ClientInfoService (for deviceToken only - IP/userAgent come from context automatically)
    const clientInfo = this.clientInfoService.get();
    const finalDeviceToken = clientInfo.deviceToken || deviceToken;

    // ============================================================================
    // SECURITY: Defense-in-depth validation before token issuance
    // ============================================================================
    // Note: Challenge validation is now handled by state machine in determineAuthResponse
    // This method is only called when state is AUTHENTICATED, so no additional check needed

    // Generate token family for rotation tracking
    const tokenFamily = this.jwtService.generateTokenFamily();

    // Generate temporary tokens first (session creation requires token hashes)
    // Note: deviceId not included in token - session.deviceId is source of truth
    const tempTokens = await this.jwtService.generateTokenPair({
      userId: user.sub, // Use sub in JWT payload (external identifier)
      email: user.email,
      sessionId: 'temp', // Temporary - will be regenerated with real sessionId
      tokenFamily,
    });

    // Generate deviceId if not provided
    let finalDeviceId = finalDeviceToken;
    if (!finalDeviceId) {
      const crypto = await import('crypto');
      finalDeviceId = crypto.randomUUID();
    }

    // Create session
    // Client info (ipAddress, ipCountry, ipCity, userAgent) automatically extracted from ClientInfoService
    const session = await this.sessionService.createSession({
      userId: user.id, // Use internal id for foreign key
      accessTokenHash: this.jwtService.hashToken(tempTokens.accessToken),
      refreshTokenHash: this.jwtService.hashToken(tempTokens.refreshToken),
      tokenFamily,
      deviceId: finalDeviceId,
      expiresAt: this.sessionService.getSessionExpirationDate(),
      // WHY: Persist how the session was authenticated so the frontend can tell whether the user logged in
      // via password or via a specific social provider (google/apple/facebook).
      authMethod: sessionAuthMethod,
    });

    // Now regenerate tokens with the actual sessionId
    // Note: deviceId not included in token - session.deviceId is source of truth
    const tokens = await this.jwtService.generateTokenPair({
      userId: user.sub,
      email: user.email,
      sessionId: session.id.toString(),
      tokenFamily,
    });

    // Update session with new token hashes
    await this.sessionService.updateTokens(
      session.id,
      this.jwtService.hashToken(tokens.accessToken),
      this.jwtService.hashToken(tokens.refreshToken),
    );

    // Decode tokens to get expiry times
    const accessTokenValidation = await this.jwtService.validateAccessToken(tokens.accessToken);
    const refreshTokenValidation = await this.jwtService.validateRefreshToken(tokens.refreshToken);

    const response: AuthResponseDTO = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: accessTokenValidation.payload?.exp || 0,
      refreshTokenExpiresAt: refreshTokenValidation.payload?.exp || 0,
      authMethod: sessionAuthMethod,
      trusted: isTrusted,
      // Expose deviceToken so that:
      // - In cookies mode, CookieTokenInterceptor can set the httpOnly nauth_device_token cookie
      // - In JSON mode, mobile clients can store it securely and send via header
      // NOTE: finalDeviceToken is a logical device identifier derived from:
      // - clientInfo.deviceToken (existing trusted device), OR
      // - deviceToken parameter passed from AuthService / state machine
      deviceToken: finalDeviceToken,
      user: {
        sub: user.sub,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? undefined,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified ?? undefined,
        socialProviders: user.socialProviders ?? undefined,
        hasPasswordHash: !!user.passwordHash,
      },
      userSub: user.sub,
    };

    return response;
  }

  /**
   * Determine and create appropriate auth response
   *
   * Main entry point that decides whether to return challenges or tokens.
   * Uses state machine to evaluate authentication flow state.
   *
   * @param params - Authentication parameters
   * @param params.user - User attempting authentication
   * @param params.config - Auth configuration
   * @param params.deviceToken - Device token (optional)
   * @param params.isSocialLogin - Whether this is a social login (OAuth) authentication (optional)
   * @param params.skipMFAVerification - Skip MFA verification flag (optional)
   * @param params.authProvider - Social auth provider name (optional)
   * @returns Auth response (either challenge or success)
   *
   * @example
   * ```typescript
   * const response = await challengeHelper.determineAuthResponse({
   *   user,
   *   config,
   *   deviceToken: 'abc123',
   *   isSocialLogin: false
   * });
   * ```
   */
  async determineAuthResponse(params: {
    user: IUser;
    config: NAuthConfig;
    deviceToken?: string;
    isSocialLogin?: boolean;
    skipMFAVerification?: boolean;
    authProvider?: string;
  }): Promise<AuthResponseDTO> {
    const { user, config, deviceToken, isSocialLogin = false, skipMFAVerification = false, authProvider } = params;

    this.logger?.debug?.(
      `[ChallengeHelper] determineAuthResponse called for user ${user.sub} (isSocialLogin=${isSocialLogin}, skipMFA=${skipMFAVerification}, deviceToken=${deviceToken ? 'present' : 'none'})`,
    );

    // Build context with pre-computed values
    const context = await this.contextBuilder.build({
      user,
      config,
      authMethod: isSocialLogin ? 'social' : 'password',
      authProvider,
      deviceToken,
      skipMFAVerification,
    });

    // Evaluate state using state machine
    const state = await this.stateMachine.evaluateState(context);

    // Get state definition
    const stateDefinition = this.stateMachine.getStateDefinition(state);
    if (!stateDefinition) {
      this.logger?.error?.(`No state definition found for state: ${state}`, { state, userId: user.id });
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Invalid authentication state');
    }

    // Build metadata if available
    const metadata = this.stateMachine.buildMetadata(state, context);

    // Convert state to response
    const response = await this.stateToResponse(state, stateDefinition, context, metadata);

    this.logger?.debug?.(
      `[ChallengeHelper] State ${state} → Challenge: ${response.challengeName || 'SUCCESS'} for user ${user.sub}`,
    );

    return response;
  }

  /**
   * Convert state to authentication response
   *
   * Maps state to appropriate response (challenge or success).
   * Merges state metadata into response.
   *
   * @param state - Authentication flow state
   * @param stateDefinition - State definition
   * @param context - Authentication flow context
   * @param metadata - Response metadata (optional)
   * @returns Authentication response
   */
  private async stateToResponse(
    state: AuthFlowState,
    stateDefinition: { challenge?: AuthChallenge },
    context: AuthFlowContext,
    metadata?: {
      gracePeriodEndsAt?: Date;
      riskScore?: number;
      riskLevel?: 'low' | 'medium' | 'high';
      blockedUntil?: Date;
      reason?: string;
    },
  ): Promise<AuthResponseDTO> {
    // Get client info from ClientInfoService
    const clientInfo = this.clientInfoService.get();
    const deviceToken = clientInfo.deviceToken || context.deviceToken;

    const authMethod = context.authMethod || 'password';

    // Handle challenge states
    if (stateDefinition.challenge) {
      // Handle MFA_SETUP_REQUIRED challenge specially
      if (stateDefinition.challenge === AuthChallenge.MFA_SETUP_REQUIRED) {
        return this.createMFASetupChallengeResponse(context.user, context.config, authMethod, context.authProvider);
      }

      // Handle MFA_REQUIRED challenge specially - needs preferred method logic
      if (stateDefinition.challenge === AuthChallenge.MFA_REQUIRED) {
        return this.createMFAChallengeResponse(context.user);
      }

      // Handle other challenges
      return this.createChallengeResponse(
        context.user,
        stateDefinition.challenge,
        context.config,
        authMethod,
        context.authProvider,
      );
    }

    // Handle special states
    if (state === AuthFlowState.GRACE_PERIOD_ACTIVE) {
      // Grace period active - return success with metadata
      const isTrusted = context.computed.isDeviceTrusted;
      const sessionAuthMethod =
        context.authMethod === 'social' ? context.authProvider || 'social' : context.authMethod || 'password';
      const response = await this.createSuccessResponse(
        context.user,
        deviceToken,
        isTrusted,
        context.authMethod === 'social',
        metadata,
        sessionAuthMethod,
      );
      // Merge metadata
      if (metadata?.gracePeriodEndsAt) {
        (response as AuthResponseDTO & { gracePeriodEndsAt?: Date }).gracePeriodEndsAt = metadata.gracePeriodEndsAt;
      }
      if (metadata?.riskScore !== undefined) {
        (response as AuthResponseDTO & { riskScore?: number }).riskScore = metadata.riskScore;
      }
      if (metadata?.riskLevel) {
        (response as AuthResponseDTO & { riskLevel?: 'low' | 'medium' | 'high' }).riskLevel = metadata.riskLevel;
      }
      return response;
    }

    if (state === AuthFlowState.BLOCKED) {
      // User is blocked - throw exception with metadata
      const errorCode =
        (context.config.mfa?.adaptive?.blockedSignIn?.errorCode as AuthErrorCode) ||
        AuthErrorCode.SIGNIN_BLOCKED_HIGH_RISK;
      const message =
        metadata?.reason ||
        context.config.mfa?.adaptive?.blockedSignIn?.message ||
        'Sign-in blocked due to suspicious activity';
      throw new NAuthException(errorCode, message, {
        expiresAt: metadata?.blockedUntil,
      });
    }

    // AUTHENTICATED state - return success
    const isTrusted = context.computed.isDeviceTrusted;
    const sessionAuthMethod =
      context.authMethod === 'social' ? context.authProvider || 'social' : context.authMethod || 'password';
    return this.createSuccessResponse(
      context.user,
      deviceToken,
      isTrusted,
      context.authMethod === 'social',
      metadata,
      sessionAuthMethod,
    );
  }
}
