// Public API imports
import {
  AuthService,
  SocialAuthService,
  ClientInfoService,
  NAuthConfig,
  NAuthLogger,
  OAuthUserProfile,
  NAuthException,
  AuthErrorCode,
  ISocialAuthProviderService,
  ITokenVerifierService,
  MicrosoftSocialProviderConfig,
  PhoneVerificationService,
  BaseUser,
  ISocialAuthStateStore,
} from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import {
  BaseSocialAuthProviderService,
  JwtService,
  SessionService,
  AuthChallengeHelperService,
  AuthAuditService, // Internal version with recordEvent()
  TrustedDeviceService,
  HookRegistryService,
} from '@nauth-toolkit/core/internal';
import { Repository } from 'typeorm';
import { MicrosoftOAuthClient } from './microsoft-oauth.client';
import { TokenVerifierService as MicrosoftTokenVerifierService } from './token-verifier.service';
import { VerifiedMicrosoftTokenProfile } from './verified-token-profile.interface';

/**
 * Microsoft Social Authentication Service (Platform-Agnostic)
 *
 * Handles Microsoft Entra ID authentication, covering both populations the Microsoft
 * identity platform serves:
 *
 * - **Public sign-in** (`tenant: 'common'` or `'consumers'`) — behaves like any other
 *   social provider.
 * - **Organisational SSO** (`tenant: '<directory-guid>'`) — pins sign-in to one
 *   Microsoft 365 tenant, with an optional access gate on app roles or security groups.
 *
 * Unlike the Google provider, the redirect flow here reads the **verified ID token**
 * rather than a userinfo endpoint: `tid`, `xms_edov`, `roles` and `groups` all live in
 * the token, and every identity and access decision depends on them.
 *
 * This is a plain TypeScript class with no framework dependencies.
 * Use `@nauth-toolkit/social-microsoft/nestjs` for NestJS integration.
 *
 * @example
 * ```typescript
 * const microsoftAuth = new MicrosoftSocialAuthService(
 *   config,
 *   logger,
 *   authService,
 *   socialAuthService,
 *   jwtService,
 *   sessionService,
 *   challengeHelper,
 *   clientInfoService,
 *   stateStore,
 *   userRepository,
 * );
 * ```
 */
export class MicrosoftSocialAuthService extends BaseSocialAuthProviderService implements ISocialAuthProviderService {
  readonly providerName = 'microsoft';
  private readonly oauthClient: MicrosoftOAuthClient | null;
  private readonly tokenVerifier: ITokenVerifierService | null;

  constructor(
    config: NAuthConfig,
    logger: NAuthLogger,
    authService: AuthService,
    socialAuthService: SocialAuthService,
    jwtService: JwtService,
    sessionService: SessionService,
    challengeHelper: AuthChallengeHelperService,
    clientInfoService: ClientInfoService,
    // State store shared across all providers
    stateStore: ISocialAuthStateStore,
    userRepository: Repository<BaseUser>,
    // Phone verification service (optional - only available when SMS provider is configured)
    phoneVerificationService?: PhoneVerificationService,
    // Audit service (optional - only available when auditLogs.enabled is true)
    auditService?: AuthAuditService,
    // Trusted device service (optional - only available when rememberDevices is enabled)
    trustedDeviceService?: TrustedDeviceService,
    // Hook registry for lifecycle hooks (required)
    hookRegistry?: HookRegistryService,
    // Microsoft-specific token verifier (optional, falls back to a default instance)
    tokenVerifier?: ITokenVerifierService,
  ) {
    super(
      config,
      logger,
      authService,
      socialAuthService,
      jwtService,
      sessionService,
      challengeHelper,
      clientInfoService,
      stateStore,
      userRepository,
      phoneVerificationService,
      auditService,
      trustedDeviceService,
      hookRegistry,
    );

    // Initialize Microsoft OAuth client only if enabled
    const providerConfig = this.getMicrosoftConfig();
    if (!providerConfig || !providerConfig.enabled) {
      // Service can exist but be disabled - don't initialize OAuth client
      // Schema validation ensures credentials are present when enabled=true
      this.oauthClient = null;
      this.tokenVerifier = null;
      return;
    }

    const webClientId = Array.isArray(providerConfig.clientId) ? providerConfig.clientId[0] : providerConfig.clientId;

    if (!webClientId || !providerConfig.clientSecret) {
      // Schema validation should catch this, but double-check for safety
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        'Microsoft OAuth clientId and clientSecret are required when enabled',
      );
    }

    this.oauthClient = new MicrosoftOAuthClient({
      clientId: webClientId,
      clientSecret: providerConfig.clientSecret,
      redirectUri: providerConfig.callbackUrl || '',
      scopes: providerConfig.scopes || ['openid', 'email', 'profile'],
      tenant: providerConfig.tenant || 'common',
    });

    // Use provided token verifier or create default one
    this.tokenVerifier = tokenVerifier || new MicrosoftTokenVerifierService(config);

    this.logger?.debug?.(`MicrosoftSocialAuthService initialized (tenant=${providerConfig.tenant || 'common'})`);
  }

  /**
   * Microsoft-specific provider configuration.
   *
   * The base class returns the shared `SocialProviderConfig` shape; the tenant and
   * access-gate fields are narrowed here.
   *
   * @returns Provider configuration, or null when Microsoft is not configured
   * @protected
   */
  protected getMicrosoftConfig(): MicrosoftSocialProviderConfig | null {
    return this.getProviderConfig() as MicrosoftSocialProviderConfig | null;
  }

  /**
   * Generate the OAuth authorization URL for Microsoft.
   *
   * @param state - Optional state parameter for CSRF protection
   * @param oauthParams - Optional OAuth parameters to append to URL (overrides config defaults)
   * @returns Authorization URL for redirecting the user to Microsoft
   */
  async getAuthUrl(state?: string, oauthParams?: Record<string, string>): Promise<string> {
    if (!this.oauthClient) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Microsoft OAuth is not enabled');
    }

    const finalState = state || (await this.generateState());

    // Merge config-level oauthParams with per-request params (per-request takes precedence)
    const providerConfig = this.getMicrosoftConfig();
    const mergedParams = {
      ...providerConfig?.oauthParams,
      ...oauthParams,
    };

    return this.oauthClient.getAuthorizationUrl(
      finalState,
      Object.keys(mergedParams).length > 0 ? mergedParams : undefined,
    );
  }

  /**
   * Get the OAuth user profile from the callback.
   *
   * Exchanges the authorization code, verifies the returned ID token, and enforces the
   * access gate before any user record is touched.
   *
   * @param code - Authorization code from the Microsoft OAuth callback
   * @param _state - State parameter (validated by base class)
   * @param _profileData - Optional profile data (not used by Microsoft)
   * @returns User profile from the verified ID token
   * @protected
   */
  protected async getOAuthProfile(
    code: string,
    _state: string,
    _profileData?: Record<string, unknown>,
  ): Promise<OAuthUserProfile> {
    if (!this.oauthClient) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Microsoft OAuth is not enabled');
    }

    const providerConfig = this.getMicrosoftConfig();
    if (!providerConfig || !providerConfig.callbackUrl) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Microsoft OAuth callback URL is not configured');
    }

    const tokens = await this.oauthClient.exchangeCodeForToken(code, providerConfig.callbackUrl);

    if (!tokens.idToken) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_TOKEN_INVALID,
        'Microsoft did not return an ID token. Ensure the "openid" scope is requested.',
      );
    }

    const verified = await this.verifyIdToken(tokens.idToken, providerConfig);
    return this.toUserProfile(verified);
  }

  /**
   * Verify a Microsoft ID token from a native mobile app.
   *
   * @param idToken - ID token issued to the native client
   * @param _accessToken - Access token (unused; identity comes from the ID token)
   * @param _profileData - Optional profile data supplied by the client
   * @returns User profile from the verified ID token
   * @protected
   */
  protected async verifyNativeToken(
    idToken: string,
    _accessToken?: string,
    _profileData?: unknown,
  ): Promise<OAuthUserProfile> {
    const providerConfig = this.getMicrosoftConfig();
    if (!providerConfig) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Microsoft OAuth is not configured');
    }

    const verified = await this.verifyIdToken(idToken, providerConfig);
    return this.toUserProfile(verified);
  }

  /**
   * Verify an ID token and apply the access gate.
   *
   * Both the redirect flow and the native flow funnel through here, so the gate is
   * enforced on **every** authentication rather than only at signup — a user removed
   * from a required role or group loses access on their next sign-in.
   */
  private async verifyIdToken(
    idToken: string,
    providerConfig: MicrosoftSocialProviderConfig,
  ): Promise<VerifiedMicrosoftTokenProfile> {
    if (!this.tokenVerifier?.verifyMicrosoftToken) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Microsoft token verifier is not available');
    }

    const verified = (await this.tokenVerifier.verifyMicrosoftToken(idToken, providerConfig.clientId || '', {
      tenant: providerConfig.tenant || 'common',
      allowedTenants: providerConfig.allowedTenants,
    })) as VerifiedMicrosoftTokenProfile;

    this.assertAccessAllowed(verified, providerConfig);

    return verified;
  }

  /**
   * Enforce the configured app-role and security-group requirements.
   *
   * Entra's own "Assignment required" toggle is the preferred gate — it refuses
   * unassigned users before they ever reach this callback. These checks cover the case
   * where finer, in-token granularity is wanted on top of it.
   *
   * @throws {NAuthException} With `SOCIAL_ACCESS_DENIED` when the user fails a requirement
   */
  private assertAccessAllowed(
    profile: VerifiedMicrosoftTokenProfile,
    providerConfig: MicrosoftSocialProviderConfig,
  ): void {
    const requiredRoles = providerConfig.requiredRoles ?? [];
    if (requiredRoles.length > 0) {
      const held = new Set(profile.roles.map((role) => role.toLowerCase()));
      const satisfied = requiredRoles.some((role) => held.has(role.toLowerCase()));
      if (!satisfied) {
        this.logger?.warn?.(
          `[MicrosoftAuth] Access denied for oid=${profile.oid}: none of the required app roles are assigned`,
        );
        throw new NAuthException(
          AuthErrorCode.SOCIAL_ACCESS_DENIED,
          'Your account is not assigned a role that grants access to this application',
        );
      }
    }

    const requiredGroups = providerConfig.requiredGroups ?? [];
    if (requiredGroups.length > 0) {
      // Fail closed on overage: Entra dropped the group list because the user is in too
      // many groups, so an empty `groups` array here means "unknown", not "none".
      if (profile.hasGroupsOverage) {
        this.logger?.warn?.(
          `[MicrosoftAuth] Access denied for oid=${profile.oid}: groups claim omitted (overage), cannot evaluate requiredGroups`,
        );
        throw new NAuthException(
          AuthErrorCode.SOCIAL_ACCESS_DENIED,
          'Group membership could not be determined from the token. Configure the app registration to emit only groups assigned to the application, or use app roles instead.',
        );
      }

      const held = new Set(profile.groups.map((group) => group.toLowerCase()));
      const satisfied = requiredGroups.some((group) => held.has(group.toLowerCase()));
      if (!satisfied) {
        this.logger?.warn?.(
          `[MicrosoftAuth] Access denied for oid=${profile.oid}: not a member of any required security group`,
        );
        throw new NAuthException(
          AuthErrorCode.SOCIAL_ACCESS_DENIED,
          'Your account is not a member of a group that grants access to this application',
        );
      }
    }
  }

  /**
   * Map a verified Microsoft token onto the toolkit's provider-neutral profile.
   *
   * Two decisions matter here:
   *
   * - **`id` is the `oid` claim**, never email and never `sub`. `oid` is immutable within
   *   the directory; `sub` is pairwise per application and so is not a durable identity.
   * - **`verified` gates email auto-linking** in the base class, where a true value both
   *   links to an existing account by email and promotes that account's verified flag.
   *   For work accounts that is only safe when `xms_edov` confirms the tenant owns the
   *   domain — a tenant administrator can otherwise set a user's email to a domain they
   *   do not control, which is the nOAuth account-takeover pattern. Personal accounts
   *   are treated as verified: Microsoft proves ownership before an address can become
   *   an account alias.
   */
  private toUserProfile(verified: VerifiedMicrosoftTokenProfile): OAuthUserProfile {
    const email = verified.email ?? this.emailFromPreferredUsername(verified.preferredUsername);

    if (!email) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_EMAIL_REQUIRED,
        'Microsoft did not return an email address. Ensure the "email" scope is requested and the account has a mail address.',
      );
    }

    const emailIsTrustworthy = verified.isPersonalAccount || verified.emailDomainOwnerVerified;

    if (!emailIsTrustworthy) {
      this.logger?.debug?.(
        `[MicrosoftAuth] Email for oid=${verified.oid} is unverified (no xms_edov claim); auto-linking will be skipped`,
      );
    }

    const { givenName, familyName } = this.resolveNames(verified);

    return {
      id: verified.oid,
      email,
      // ?? not ||: preserve "" from provider (|| would coerce to null)
      firstName: givenName ?? null,
      lastName: familyName ?? null,
      picture: null,
      verified: emailIsTrustworthy,
      raw: verified.raw,
    };
  }

  /**
   * Fall back to `preferred_username` when the token carries no `email` claim.
   *
   * Common for work accounts whose UPN is their mail address. Anything that is not
   * email-shaped is ignored rather than stored as an address.
   */
  private emailFromPreferredUsername(preferredUsername?: string): string | undefined {
    if (!preferredUsername) return undefined;
    return preferredUsername.includes('@') ? preferredUsername : undefined;
  }

  /**
   * Resolve first and last name, falling back to splitting the display name.
   *
   * Entra omits `given_name`/`family_name` for some account types, but almost always
   * sends `name`.
   */
  private resolveNames(verified: VerifiedMicrosoftTokenProfile): {
    givenName?: string;
    familyName?: string;
  } {
    if (verified.givenName || verified.familyName) {
      return { givenName: verified.givenName, familyName: verified.familyName };
    }

    const displayName = verified.name?.trim();
    if (!displayName) return {};

    const parts = displayName.split(/\s+/);
    if (parts.length === 1) return { givenName: parts[0] };

    return { givenName: parts[0], familyName: parts.slice(1).join(' ') };
  }
}
