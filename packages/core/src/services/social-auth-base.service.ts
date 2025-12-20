import * as crypto from 'crypto';
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
import { NAuthLogger } from '../utils/nauth-logger';
import { AuthResponseDTO } from '../dto';
import { OAuthUserProfile } from '../interfaces/oauth.interface';
import { ISocialAuthProviderService } from '../interfaces/social-auth-provider.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

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
    // State store for CSRF protection - shared across all providers
    protected readonly stateStore: Map<string, { timestamp: number; provider: string }>,
    // User repository for creating social users
    protected readonly userRepository: Repository<BaseUser>,
    // Phone verification service (optional - only available when SMS provider is configured)
    protected readonly phoneVerificationService?: PhoneVerificationService,
    protected readonly auditService?: AuthAuditService, // Optional - audit trail service (enabled via config.auditLogs.enabled)
    protected readonly trustedDeviceService?: TrustedDeviceService, // Optional - only available when rememberDevices is not 'never'
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
   */
  async handleCallback(code: string, state: string): Promise<AuthResponseDTO> {
    const providerConfig = this.getProviderConfig();
    if (!providerConfig) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        `Provider configuration not found: ${this.providerName}`,
      );
    }

    // Validate state (basic CSRF protection)
    this.validateState(state);

    try {
      // Get user profile from provider
      const profile = await this.getOAuthProfile(code, state);
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
   */
  async verifyToken(
    idToken: string,
    accessToken?: string,
    profileData?: Record<string, unknown>,
  ): Promise<AuthResponseDTO> {
    const providerConfig = this.getProviderConfig();
    if (!providerConfig || providerConfig.enabled !== true) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        `Provider '${this.providerName}' is not configured or not enabled`,
      );
    }

    try {
      // Verify token and get profile
      const profile = await this.verifyNativeToken(idToken, accessToken, profileData);

      // Find or create user
      const user = await this.findOrCreateUser(profile, providerConfig);

      // Create or update social account
      await this.createOrUpdateSocialAccount(user, profile);

      // Generate JWT tokens and session
      return await this.createAuthResponse(user, 'mobile');
    } catch (error) {
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
    this.validateState(state);

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

      // Create social account using service
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
   */
  async getUserProfileFromCallback(code: string, state: string): Promise<OAuthUserProfile> {
    return this.getOAuthProfile(code, state);
  }

  // ============================================================================
  // Protected Helper Methods
  // ============================================================================

  /**
   * Validate state parameter for CSRF protection
   */
  protected validateState(state: string): void {
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid state parameter', { field: 'state' });
    }

    if (stateData.provider !== this.providerName) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'State provider mismatch', { field: 'state' });
    }

    // Check if state is not too old (5 minutes)
    if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
      this.stateStore.delete(state);
      throw new NAuthException(AuthErrorCode.CHALLENGE_EXPIRED, 'State parameter expired');
    }

    // Clean up used state
    this.stateStore.delete(state);
  }

  /**
   * Generate random state for CSRF protection
   */
  protected generateState(): string {
    const state = crypto.randomBytes(32).toString('hex');
    this.stateStore.set(state, {
      timestamp: Date.now(),
      provider: this.providerName,
    });
    return state;
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
      const existingUser = (await this.userRepository.findOne({
        where: { email: profile.email, isEmailVerified: true },
      })) as IUser | null;

      if (existingUser) {
        return existingUser;
      }
    }

    // Create new user if allowSignup is enabled
    if (providerConfig.allowSignup !== false) {
      this.logger?.log?.(
        `[SocialAuth] Creating user: email=${profile.email}, isEmailVerified=${profile.verified || false}`,
      );

      const savedUser = await this.createSocialUser(
        profile.email || '',
        profile.firstName,
        profile.lastName,
        profile.verified || false,
        this.providerName,
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
   * @returns Created user
   * @protected
   */
  protected async createSocialUser(
    email: string,
    firstName?: string | null,
    lastName?: string | null,
    isEmailVerified: boolean = true,
    socialProvider?: string,
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
    return savedUser;
  }

  /**
   * Create or update social account
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

    // Check trusted device status (for audit metadata)
    let isTrustedDevice = false;
    if (
      this.config.mfa?.rememberDevices &&
      this.config.mfa?.rememberDevices !== 'never' &&
      this.trustedDeviceService &&
      clientInfo.deviceToken
    ) {
      try {
        isTrustedDevice = await this.trustedDeviceService.isDeviceTrusted(clientInfo.deviceToken, user.id);
      } catch (error) {
        // Non-blocking: Log but continue
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger?.warn?.(`Failed to check trusted device for social login: ${errorMessage}`, {
          error,
          userId: user.id,
          provider: this.providerName,
        });
      }
    }

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
