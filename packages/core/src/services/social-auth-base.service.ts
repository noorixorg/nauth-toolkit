import { Repository } from 'typeorm';
import { BaseUser } from '../entities';
import { IUser } from '../interfaces/entities.interface';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { TrustedDeviceService } from './trusted-device.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { ClientInfoService } from './client-info.service';
import { PhoneVerificationService } from './phone-verification.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { NAuthConfig, SocialProviderConfig } from '../interfaces/config.interface';
import { ISocialAuthStateStore } from '../interfaces/social-auth-state-store.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { AuthResponseDTO, HandleCallbackDTO, VerifyTokenDTO } from '../dto';
import { OAuthUserProfile } from '../interfaces/oauth.interface';
import { ISocialAuthProviderService } from '../interfaces/social-auth-provider.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { ensureValidatedDto } from '../utils/dto-validator';

/**
 * Base Social Auth Provider Service
 *
 * Abstract base class that provides common functionality for all social auth providers.
 * Provider-specific services (Google, Apple, Facebook, GitHub, etc.) should extend this class
 * and implement provider-specific OAuth client logic.
 *
 * This base class handles:
 * - User creation/lookup
 * - Social account linking
 * - JWT token generation
 * - Session management
 * - Challenge system integration
 *
 * **Key Design:**
 * - No hardcoded provider names - works with any provider
 * - Provider config accessed dynamically via `providerName`
 * - Future developers can add new providers without modifying this class
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class GitHubSocialAuthService extends BaseSocialAuthProviderService {
 *   readonly providerName = 'github';
 *
 *   constructor(
 *     // ... dependencies
 *     private readonly githubOAuthClient: GitHubOAuthClient,
 *   ) {
 *     super(/* ... base dependencies *\/);
 *   }
 *
 *   protected async getOAuthProfile(code: string, state: string): Promise<OAuthUserProfile> {
 *     // Provider-specific implementation
 *   }
 * }
 * ```
 */
export abstract class BaseSocialAuthProviderService implements ISocialAuthProviderService {
  abstract readonly providerName: string;

  constructor(
    protected readonly config: NAuthConfig,
    protected readonly logger: NAuthLogger,
    protected readonly authService: AuthService,
    protected readonly socialAuthService: SocialAuthService,
    protected readonly jwtService: JwtService,
    protected readonly sessionService: SessionService,
    protected readonly challengeHelper: AuthChallengeHelperService,
    protected readonly clientInfoService: ClientInfoService,
    // State store for OAuth CSRF protection - MUST be shared across instances (StorageAdapter-backed)
    protected readonly stateStore: ISocialAuthStateStore,
    // User repository for creating social users
    protected readonly userRepository: Repository<BaseUser>,
    // Phone verification service (optional - only available when SMS provider is configured)
    protected readonly phoneVerificationService?: PhoneVerificationService,
    protected readonly auditService?: AuthAuditService, // Optional - audit trail service (enabled via config.auditLogs.enabled)
    protected readonly trustedDeviceService?: TrustedDeviceService, // Optional - only available when rememberDevices is not 'never'
    protected readonly hookRegistry?: import('./hook-registry.service').HookRegistryService, // Optional - hook registry for lifecycle hooks
  ) {}

  /**
   * Get provider configuration dynamically
   *
   * Accesses config.social[providerName] without hardcoding provider names.
   * This allows any provider to work without modifying core code.
   *
   * @returns Provider configuration from NAuthConfig
   * @protected
   */
  protected getProviderConfig(): SocialProviderConfig | null {
    const socialConfig = this.config.social;
    if (!socialConfig) return null;

    // Access config dynamically using providerName (no hardcoding)
    const providerConfig = (socialConfig as Record<string, SocialProviderConfig | undefined>)[this.providerName];
    return providerConfig || null;
  }

  /**
   * Generate OAuth authorization URL for this provider
   *
   * Must be implemented by provider-specific services to generate the OAuth URL.
   *
   * @param state - Optional state parameter for CSRF protection
   * @returns Authorization URL to redirect user to
   * @throws {BadRequestException} When provider is not properly configured
   */
  abstract getAuthUrl(state?: string): Promise<string>;

  /**
   * Get user profile from OAuth callback
   *
   * Must be implemented by provider-specific services to exchange code for tokens
   * and fetch user profile.
   *
   * @param code - Authorization code from OAuth callback
   * @param state - State parameter from OAuth callback
   * @returns OAuth user profile
   * @protected
   */
  protected abstract getOAuthProfile(code: string, state: string): Promise<OAuthUserProfile>;

  /**
   * Verify social authentication token from native mobile apps
   *
   * Must be implemented by provider-specific services to verify ID tokens.
   *
   * @param idToken - ID token from native SDK
   * @param accessToken - Optional access token from native SDK
   * @param profileData - Optional profile data from native SDK
   * @returns OAuth user profile
   * @protected
   */
  protected abstract verifyNativeToken(
    idToken: string,
    accessToken?: string,
    profileData?: Record<string, unknown>,
  ): Promise<OAuthUserProfile>;

  /**
   * Handle OAuth callback and authenticate user
   *
   * Uses the provider-specific getOAuthProfile method and then handles
   * user creation, session management, and token generation.
   *
   * @param dto - HandleCallbackDTO containing code and state
   * @returns AuthResponseDTO with tokens and user data
   * @throws {NAuthException} SOCIAL_CONFIG_MISSING if provider not configured
   * @throws {NAuthException} SOCIAL_TOKEN_INVALID if OAuth flow fails
   *
   * @example
   * ```typescript
   * const response = await googleService.handleCallback({
   *   code: 'auth_code_from_google',
   *   state: 'csrf_state_token'
   * });
   * ```
   */
  async handleCallback(dto: HandleCallbackDTO): Promise<AuthResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(HandleCallbackDTO, dto);

    const providerConfig = this.getProviderConfig();
    if (!providerConfig) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        `Provider configuration not found: ${this.providerName}`,
      );
    }

    // Validate state (basic CSRF protection)
    await this.validateState(dto.state);

    try {
      // Get user profile from provider
      const profile = await this.getOAuthProfile(dto.code, dto.state);
      this.logger?.log?.(`[SocialAuth] ${this.providerName} callback verified (secure): ${profile.email}`);

      // Find or create user
      const user = await this.findOrCreateUser(profile, providerConfig);

      // Create or update social account
      await this.createOrUpdateSocialAccount(user, profile);

      // Generate JWT tokens and session
      return await this.createAuthResponse(user, 'web');
    } catch (error) {
      if (error instanceof NAuthException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, `Social authentication failed: ${error.message}`);
      }
      throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Social authentication failed: Unknown error');
    }
  }

  /**
   * Verify social authentication token from native mobile apps
   *
   * Used when mobile apps use native SDKs (Google Sign-In, Sign in with Apple, etc.)
   * to obtain ID tokens that need backend verification.
   *
   * @param dto - VerifyTokenDTO containing idToken, optional accessToken, and profileData
   * @returns AuthResponseDTO with tokens and user data
   * @throws {NAuthException} SOCIAL_CONFIG_MISSING if provider not configured
   * @throws {NAuthException} SOCIAL_TOKEN_INVALID if token verification fails
   * @throws {NAuthException} PRESIGNUP_FAILED if pre-signup hook rejects user
   *
   * @example
   * ```typescript
   * // Google Sign-In from iOS/Android
   * const response = await googleService.verifyToken({
   *   idToken: 'eyJhbGciOiJSUzI1NiIs...',
   *   accessToken: 'ya29.a0AfH6SM...'
   * });
   *
   * // Sign in with Apple from iOS
   * const response = await appleService.verifyToken({
   *   idToken: 'eyJraWQiOiJlWGF1bm...',
   *   profileData: {
   *     name: { firstName: 'John', lastName: 'Doe' },
   *     email: 'user@privaterelay.appleid.com'
   *   }
   * });
   * ```
   */
  async verifyToken(dto: VerifyTokenDTO): Promise<AuthResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(VerifyTokenDTO, dto);

    const providerConfig = this.getProviderConfig();
    if (!providerConfig || providerConfig.enabled !== true) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        `Provider '${this.providerName}' is not configured or not enabled`,
      );
    }

    try {
      // Verify token and get profile
      // Note: For Facebook classic login, idToken may be undefined and accessToken is used instead.
      // Provider-specific implementations handle this mapping internally.
      const profile = await this.verifyNativeToken(
        dto.idToken || dto.accessToken || '',
        dto.accessToken,
        dto.profileData,
      );

      // Find or create user
      const user = await this.findOrCreateUser(profile, providerConfig);

      // Create or update social account
      await this.createOrUpdateSocialAccount(user, profile);

      // Generate JWT tokens and session
      return await this.createAuthResponse(user, 'mobile');
    } catch (error) {
      // Re-throw PRESIGNUP_FAILED errors as-is (from preSignup hook)
      if (error instanceof NAuthException && error.code === AuthErrorCode.PRESIGNUP_FAILED) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`Native token verification failed for ${this.providerName}: ${errorMessage}`);
      throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, `Token verification failed: ${errorMessage}`);
    }
  }

  /**
   * Link social account to existing user
   */
  async linkAccount(userId: string, code: string, state: string): Promise<{ message: string }> {
    // Get full user entity (need internal id for foreign keys)
    const user = (await this.userRepository.findOne({ where: { sub: userId } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const providerConfig = this.getProviderConfig();
    if (!providerConfig) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        `Provider configuration not found: ${this.providerName}`,
      );
    }

    // Validate state
    await this.validateState(state);

    try {
      // Get user profile from provider
      const profile = await this.getOAuthProfile(code, state);

      // Check if account is already linked
      const existingAccount = await this.socialAuthService.findSocialAccountByProvider(this.providerName, profile.id);

      if (existingAccount) {
        throw new NAuthException(
          AuthErrorCode.SOCIAL_ACCOUNT_LINKED,
          'This social account is already linked to another user',
        );
      }

      // Create social account
      await this.socialAuthService.createOrUpdateSocialAccount(
        user.id as number,
        this.providerName,
        profile.id,
        profile.email,
        profile.raw,
      );

      // ============================================================================
      // Audit: Record social account link
      // ============================================================================
      try {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.SOCIAL_ACCOUNT_LINKED,
          eventStatus: 'INFO',
          authMethod: this.providerName,
          // Client info automatically included from context
          metadata: {
            provider: this.providerName,
            providerEmail: profile.email || null,
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record SOCIAL_ACCOUNT_LINKED audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
          provider: this.providerName,
        });
      }

      // ============================================================================
      // Audit: Record social account link
      // ============================================================================
      try {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.SOCIAL_ACCOUNT_LINKED,
          eventStatus: 'SUCCESS',
          authMethod: this.providerName.toLowerCase(),
          // Client info automatically included from context
          metadata: {
            provider: this.providerName.toLowerCase(),
            providerEmail: profile.email || null,
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record SOCIAL_ACCOUNT_LINKED audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
          provider: this.providerName,
        });
      }

      return { message: `${this.providerName} account linked successfully` };
    } catch (error) {
      if (error instanceof NAuthException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, `Social account linking failed: ${error.message}`);
      }
      throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Social account linking failed: Unknown error');
    }
  }

  /**
   * Get OAuth user profile from callback
   *
   * Alias for getOAuthProfile for interface compliance.
   * Delegates to the protected getOAuthProfile method.
   *
   * @param dto - HandleCallbackDTO containing code and state
   * @returns OAuth user profile
   * @protected
   */
  async getUserProfileFromCallback(dto: HandleCallbackDTO): Promise<OAuthUserProfile> {
    return this.getOAuthProfile(dto.code, dto.state);
  }

  // ============================================================================
  // Protected Helper Methods
  // ============================================================================

  /**
   * Validate state parameter for CSRF protection
   */
  protected async validateState(state: string): Promise<void> {
    // ========================================================================
    // SECURITY: CSRF state MUST be one-time use
    // ========================================================================
    // The store enforces single-use semantics in a multi-server safe way.
    await this.stateStore.validateAndConsumeCsrfState(this.providerName, state);
  }

  /**
   * Generate random state for CSRF protection
   */
  protected async generateState(): Promise<string> {
    return await this.stateStore.createCsrfState(this.providerName);
  }

  /**
   * Find existing user or create new one
   */
  protected async findOrCreateUser(profile: OAuthUserProfile, providerConfig: SocialProviderConfig): Promise<IUser> {
    // First, try to find user by social account
    const socialAccount = await this.socialAuthService.findSocialAccountByProvider(this.providerName, profile.id);

    if (socialAccount) {
      return (socialAccount as unknown as { user?: IUser }).user as IUser;
    }

    // If auto-link is enabled, try to find by email
    if (providerConfig.autoLink === true && profile.email) {
      // Get full user entity (need internal id for foreign keys)
      // ============================================================================
      // SECURITY: Safe auto-linking rules
      // ============================================================================
      // We allow auto-linking when:
      // - The existing local account email is already verified, OR
      // - The provider asserts the email is verified (`profile.verified === true`)
      //
      // WHY: This enables "password-first account -> later social login (same email)" without requiring
      // the local account to be verified first, while still requiring proof of email ownership.
      const existingUser = (await this.userRepository.findOne({
        where: { email: profile.email },
      })) as IUser | null;

      if (existingUser) {
        const providerVerified = profile.verified === true;

        if (!existingUser.isEmailVerified && providerVerified) {
          // Provider verified the email; promote local email verification.
          await this.userRepository.update({ id: existingUser.id }, { isEmailVerified: true });
          existingUser.isEmailVerified = true;
        }

        if (existingUser.isEmailVerified || providerVerified) {
          return existingUser;
        }
      }
    }

    // Create new user if allowSignup is enabled
    if (providerConfig.allowSignup !== false) {
      this.logger?.log?.(
        `[SocialAuth] Creating user: email=${profile.email}, isEmailVerified=${profile.verified || false}`,
      );

      // ============================================================================
      // Pre-Signup Hook: Execute validation hooks before user creation
      // ============================================================================
      if (this.hookRegistry) {
        await this.hookRegistry.executePreSignup(profile, 'social', this.providerName, false);
      }

      const savedUser = await this.createSocialUser(
        profile.email || '',
        profile.firstName,
        profile.lastName,
        profile.verified || false,
        this.providerName,
        profile, // Pass profile for post-signup hook metadata
      );

      this.logger?.log?.(
        `[SocialAuth] User created: email=${savedUser.email}, isEmailVerified=${savedUser.isEmailVerified}`,
      );

      return savedUser;
    }

    throw new NAuthException(AuthErrorCode.SIGNUP_DISABLED, 'User not found and signup is disabled');
  }

  /**
   * Create a social-only user (no password)
   *
   * @param email - User email
   * @param firstName - Optional first name
   * @param lastName - Optional last name
   * @param isEmailVerified - Whether email is verified (default: true)
   * @param socialProvider - Initial social provider name
   * @param profile - Optional OAuth profile for passing to post-signup hook
   * @returns Created user
   * @protected
   */
  protected async createSocialUser(
    email: string,
    firstName?: string | null,
    lastName?: string | null,
    isEmailVerified: boolean = true,
    socialProvider?: string,
    profile?: OAuthUserProfile,
  ): Promise<IUser> {
    const user = this.userRepository.create({
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      isEmailVerified,
      hasSocialAuth: true,
      socialProviders: socialProvider ? [socialProvider] : null,
      isActive: true,
    });

    const savedUser = (await this.userRepository.save(user)) as unknown as IUser;
    this.logger?.log?.(`Social user created: ${email} (sub: ${savedUser.sub})`);

    // ============================================================================
    // After-Signup Hook: Execute post-creation actions (non-blocking)
    // ============================================================================
    if (this.hookRegistry) {
      await this.hookRegistry.executePostSignup(savedUser, {
        requiresVerification: false, // Social signups are typically pre-verified
        signupType: 'social',
        provider: socialProvider,
        socialMetadata: profile?.raw || null,
        profilePicture: profile?.picture || null,
      });
    }

    return savedUser;
  }

  /**
   * Create or update social account linkage
   *
   * @param user - User entity
   * @param profile - OAuth profile from provider
   * @protected
   */
  protected async createOrUpdateSocialAccount(user: IUser, profile: OAuthUserProfile): Promise<void> {
    await this.socialAuthService.createOrUpdateSocialAccount(
      user.id as number,
      this.providerName,
      profile.id,
      profile.email,
      profile.raw,
    );
  }

  /**
   * Create authentication response with tokens and user info
   */
  protected async createAuthResponse(user: IUser, _deviceType: 'web' | 'mobile'): Promise<AuthResponseDTO> {
    // Get actual client info from context (IP, userAgent, etc.)
    const clientInfo = this.clientInfoService.get();

    // ============================================================================
    // Account Lock Check (Admin Disabled / Rate Limit Lockout)
    // ============================================================================
    // Check if account is permanently locked (lockedUntil = NULL) or temporarily locked (lockedUntil > now)
    if (user.isLocked) {
      const now = new Date();
      const isPermanentlyLocked = user.lockedUntil === null;
      const isTemporarilyLocked = user.lockedUntil && new Date(user.lockedUntil) > now;

      if (isPermanentlyLocked || isTemporarilyLocked) {
        const lockReason = user.lockReason || 'Account is locked';
        this.logger?.warn?.(
          `Social login blocked - account locked for user: ${user.email} (sub: ${user.sub}). Reason: ${lockReason}`,
        );

        // ============================================================================
        // Audit: Record blocked login (account locked)
        // ============================================================================
        try {
          await this.auditService?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.LOGIN_BLOCKED,
            eventStatus: 'FAILURE',
            authMethod: this.providerName.toLowerCase(),
            reason: 'account_locked',
            description: `Social login blocked - account locked: ${lockReason}`,
            metadata: {
              provider: this.providerName.toLowerCase(),
              lockReason: user.lockReason,
              lockedAt: user.lockedAt,
              lockedUntil: user.lockedUntil,
              isPermanent: isPermanentlyLocked,
            },
          });
        } catch (auditError) {
          const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
          this.logger?.error?.(`Failed to record LOGIN_BLOCKED audit event (social, account locked): ${errorMessage}`, {
            error: auditError,
            userId: user.id,
            provider: this.providerName,
          });
        }

        throw new NAuthException(AuthErrorCode.ACCOUNT_LOCKED, lockReason, {
          lockReason: user.lockReason,
          lockedAt: user.lockedAt,
          lockedUntil: user.lockedUntil,
          isPermanent: isPermanentlyLocked,
        });
      } else {
        // Account was temporarily locked but lock has expired - unlock it
        this.logger?.debug?.(`Account lock expired for user: ${user.email} (sub: ${user.sub}), unlocking account`);
        user.isLocked = false;
        user.lockReason = null;
        user.lockedAt = null;
        user.lockedUntil = null;
        await this.userRepository.save(user as unknown as BaseUser);
      }
    }

    // ============================================================================
    // Audit: Record login attempt for social authentication
    // ============================================================================
    try {
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.LOGIN_ATTEMPT,
        eventStatus: 'INFO',
        authMethod: this.providerName.toLowerCase(),
        description: `${this.providerName} OAuth token validated`,
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record LOGIN_ATTEMPT audit event for social login: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
        provider: this.providerName,
      });
    }

    // ============================================================================
    // Check for Required Challenges BEFORE creating session
    // ============================================================================
    const response = await this.challengeHelper.determineAuthResponse({
      user,
      config: this.config,
      deviceToken: clientInfo.deviceToken,
      isSocialLogin: true,
      skipMFAVerification: false,
      authProvider: this.providerName.toLowerCase(), // e.g., 'google', 'facebook', 'apple'
    });

    if (response.challengeName) {
      this.logger?.log?.(`Challenge required for social auth user ${user.sub}: ${response.challengeName}`);
      // Record SOCIAL_LOGIN event even when challenge is required
      try {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.SOCIAL_LOGIN,
          eventStatus: 'INFO',
          authMethod: this.providerName.toLowerCase(),
          metadata: {
            provider: this.providerName.toLowerCase(),
            challengeRequired: response.challengeName,
          },
        });
      } catch (auditError) {
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record SOCIAL_LOGIN audit event (challenge): ${errorMessage}`, {
          error: auditError,
          userId: user.id,
          provider: this.providerName,
        });
      }
      return response;
    }

    // ============================================================================
    // No challenges - determineAuthResponse already created session and tokens
    // Just record SOCIAL_LOGIN audit event and return the response
    // ============================================================================
    // ============================================================================
    // No challenges - determineAuthResponse already created session and tokens
    // Just record SOCIAL_LOGIN audit event and return the response
    // ============================================================================

    // Determine trusted device status from the auth response.
    // WHY: `determineAuthResponse()` already computed device trust using request context (ClientInfoService).
    // Re-checking here can drift (e.g., due to repository/adapter differences), so reuse the computed result.
    const isTrustedDevice = response.trusted === true;

    // Record SOCIAL_LOGIN audit event
    try {
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.SOCIAL_LOGIN,
        eventStatus: 'SUCCESS',
        authMethod: this.providerName.toLowerCase(),
        metadata: {
          provider: this.providerName.toLowerCase(),
          trustedDevice: isTrustedDevice,
        },
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record SOCIAL_LOGIN audit event: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
        provider: this.providerName,
      });
    }

    // Return the response with session and tokens already created by determineAuthResponse
    return response;
  }
}
