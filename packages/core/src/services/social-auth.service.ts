import { Repository } from 'typeorm';
import { IUser, ISocialAccount } from '../interfaces/entities.interface';
import { BaseUser, BaseSocialAccount } from '../entities';
import { AuthService } from './auth.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { NAuthLogger } from '../utils/nauth-logger';
import { ChangePasswordRequestDTO } from '../dto/change-password-request.dto';
import { SocialProviderRegistry } from './social-provider-registry.service';
import {
  LinkSocialAccountDTO,
  LinkSocialAccountResponseDTO,
  GetLinkedAccountsDTO,
  GetLinkedAccountsResponseDTO,
  UnlinkSocialAccountDTO,
  UnlinkSocialAccountResponseDTO,
  CanSetPasswordDTO,
  CanSetPasswordResponseDTO,
  SetPasswordForSocialUserDTO,
  SetPasswordForSocialUserResponseDTO,
} from '../dto/social-auth.dto';
import { ensureValidatedDto } from '../utils/dto-validator';

/**
 * Social Auth Service
 *
 * Service for managing social authentication accounts and their relationships.
 * This service provides:
 * - Social account linking/unlinking
 * - Account management for social users
 * - Password management for social-only users
 * - Querying linked accounts
 *
 * **Note:** For OAuth authentication flows (login/signup), use `SocialRedirectHandler`
 * or the frontend SDK's `loginWithSocial()` method.
 *
 * **Optional Feature:** Only available when social auth provider modules are imported.
 *
 * **Usage:**
 * ```typescript
 * // NestJS
 * imports: [
 *   AuthModule.forRoot(config),
 *   GoogleSocialAuthModule,  // Enables Google OAuth
 *   AppleSocialAuthModule,   // Enables Apple Sign In
 * ]
 *
 * // Then inject and use
 * constructor(private socialAuthService: SocialAuthService) {}
 *
 * const result = await this.socialAuthService.linkSocialAccount({ userId, provider, code, state });
 * const accounts = await this.socialAuthService.getLinkedAccounts({ userId });
 * ```
 */
export class SocialAuthService {
  constructor(
    private readonly providerRegistry: SocialProviderRegistry,
    private readonly userRepository: Repository<BaseUser>,
    private readonly socialAccountRepository: Repository<BaseSocialAccount>,
    private readonly authService: AuthService | null, // Can be null to break circular dependency
    private readonly logger: NAuthLogger,
    private readonly auditService?: AuthAuditService, // Optional - audit trail service (enabled via config.auditLogs.enabled)
  ) {}

  // ============================================================================
  // Social Authentication Methods
  // ============================================================================

  /**
   * Link social account to existing authenticated user
   *
   * Connects a social provider to an already logged-in user's account.
   * User must be authenticated before calling this method.
   *
   * @param dto - Request DTO containing userId, provider, code, and state
   * @returns Response DTO with success message and provider name
   * @throws {NAuthException} SOCIAL_ALREADY_LINKED, NOT_FOUND, etc.
   *
   * @example
   * ```typescript
   * const dto = {
   *   userId: user.sub,
   *   provider: 'apple',
   *   code: req.query.code,
   *   state: req.query.state
   * };
   * const result = await socialAuthService.linkSocialAccount(dto);
   * ```
   */
  async linkSocialAccount(dto: LinkSocialAccountDTO): Promise<LinkSocialAccountResponseDTO> {
    dto = await ensureValidatedDto(LinkSocialAccountDTO, dto);
    const { userId, provider, code, state } = dto;
    const providerInstance = this.providerRegistry.getProvider(provider);
    const result = await providerInstance.linkAccount(userId, code, state);
    return { ...result, provider };
  }

  /**
   * List available social auth providers
   *
   * Returns names of all registered and enabled social auth providers.
   * Useful for displaying available login options in the UI.
   *
   * @returns Array of provider names (e.g., ['google', 'apple', 'facebook'])
   *
   * @example
   * ```typescript
   * const providers = socialAuthService.listAvailableProviders();
   * // Display social login buttons based on available providers
   * ```
   */
  listAvailableProviders(): string[] {
    return this.providerRegistry.listProviders();
  }

  // ============================================================================
  // Social Account Management Methods
  // ============================================================================

  /**
   * Get linked social accounts for a user
   *
   * @param dto - Request DTO containing userId
   * @returns Response DTO with array of linked social accounts
   * @throws {NAuthException} NOT_FOUND when user is not found
   *
   * @example
   * ```typescript
   * const dto = { userId: 'user-uuid' };
   * const accounts = await socialAuthService.getLinkedAccounts(dto);
   * console.log(accounts.accounts); // [{ provider: 'google', ... }]
   * ```
   */
  async getLinkedAccounts(dto: GetLinkedAccountsDTO): Promise<GetLinkedAccountsResponseDTO> {
    dto = await ensureValidatedDto(GetLinkedAccountsDTO, dto);
    const { userId } = dto;
    const user = (await this.userRepository.findOne({ where: { sub: userId } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const socialAccounts = (await this.socialAccountRepository.find({
      where: { userId: user.id },
      order: { linkedAt: 'DESC' },
    })) as ISocialAccount[];

    return {
      accounts: socialAccounts.map((account) => ({
        provider: account.provider,
        providerEmail: account.providerEmail || undefined,
        linkedAt: account.linkedAt,
        lastUsedAt: account.lastUsedAt || undefined,
      })),
    };
  }

  /**
   * Unlink social account from user
   *
   * @param dto - Request DTO containing userId and provider
   * @returns Response DTO with success message
   * @throws {NAuthException} NOT_FOUND when user or account is not found
   *
   * @example
   * ```typescript
   * const dto = { userId: 'user-uuid', provider: 'google' };
   * await socialAuthService.unlinkSocialAccount(dto);
   * ```
   */
  async unlinkSocialAccount(dto: UnlinkSocialAccountDTO): Promise<UnlinkSocialAccountResponseDTO> {
    dto = await ensureValidatedDto(UnlinkSocialAccountDTO, dto);
    const { userId, provider } = dto;
    const user = (await this.userRepository.findOne({ where: { sub: userId } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const socialAccount = (await this.socialAccountRepository.findOne({
      where: { userId: user.id, provider },
    })) as ISocialAccount | null;

    if (!socialAccount) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_ACCOUNT_NOT_FOUND,
        `${provider} account is not linked to this user`,
      );
    }

    // Delete social account
    await this.socialAccountRepository.remove(socialAccount);

    // Update user's social auth flags
    await this.updateUserSocialFlags(user.id as number);

    // ============================================================================
    // Audit: Record social account unlink
    // ============================================================================
    try {
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.SOCIAL_ACCOUNT_UNLINKED,
        eventStatus: 'INFO',
        authMethod: provider,
        // Client info automatically included from context
        metadata: {
          provider,
          providerEmail: socialAccount.providerEmail || null,
        },
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record SOCIAL_ACCOUNT_UNLINKED audit event: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
        provider,
      });
    }

    return { message: `${provider} account unlinked successfully` };
  }

  /**
   * Check if user can set a password
   * Users with social-only accounts can set passwords
   *
   * @param dto - Request DTO containing userId
   * @returns Response DTO indicating whether user can set password
   *
   * @example
   * ```typescript
   * const dto = { userId: 'user-uuid' };
   * const result = await socialAuthService.canSetPassword(dto);
   * if (result.canSetPassword) {
   *   // Allow user to set password
   * }
   * ```
   */
  async canSetPassword(dto: CanSetPasswordDTO): Promise<CanSetPasswordResponseDTO> {
    dto = await ensureValidatedDto(CanSetPasswordDTO, dto);
    const { userId } = dto;
    const user = (await this.userRepository.findOne({ where: { sub: userId } })) as IUser | null;
    if (!user) {
      return { canSetPassword: false };
    }

    // User can set password if they don't have one (social-only account)
    return { canSetPassword: !user.passwordHash };
  }

  /**
   * Set password for social-only user
   *
   * @param dto - Request DTO containing userId and password
   * @returns Response DTO with success message
   * @throws {NAuthException} NOT_FOUND when user is not found
   * @throws {NAuthException} VALIDATION_FAILED when user already has a password
   *
   * @example
   * ```typescript
   * const dto = { userId: 'user-uuid', password: 'newpassword' };
   * await socialAuthService.setPasswordForSocialUser(dto);
   * ```
   */
  async setPasswordForSocialUser(dto: SetPasswordForSocialUserDTO): Promise<SetPasswordForSocialUserResponseDTO> {
    dto = await ensureValidatedDto(SetPasswordForSocialUserDTO, dto);
    const { userId, password } = dto;
    const user = await this.userRepository.findOne({ where: { sub: userId } });
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    if (user.passwordHash) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'User already has a password', {
        field: 'password',
      });
    }

    // Use AuthService to set password (includes validation and hashing)
    // For social-only users, we bypass old password validation since they don't have one
    // Note: This requires type casting as ChangePasswordRequestDTO requires oldPassword, but
    // the auth service will handle the case where user has no passwordHash
    if (!this.authService) {
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        'AuthService is not available. This is a configuration error.',
      );
    }
    const changePasswordDto = new ChangePasswordRequestDTO();
    changePasswordDto.sub = userId; // userId is the sub (external UUID) in this context
    changePasswordDto.oldPassword = ''; // Social-only users don't have a password
    changePasswordDto.newPassword = password;
    await this.authService.changePassword(changePasswordDto);

    return { message: 'Password set successfully' };
  }

  /**
   * Find social account by provider and provider ID
   *
   * @param provider - Provider name (e.g., 'google', 'apple')
   * @param providerId - Provider user ID
   * @returns Social account with user relation, or null
   * @internal - For use by BaseSocialAuthProviderService
   */
  async findSocialAccountByProvider(provider: string, providerId: string): Promise<ISocialAccount | null> {
    return (await this.socialAccountRepository.findOne({
      where: { provider, providerId },
      relations: ['user'],
    })) as ISocialAccount | null;
  }

  /**
   * Find social account by user ID and provider
   *
   * @param userId - User ID (internal)
   * @param provider - Provider name
   * @returns Social account or null
   * @internal - For use by BaseSocialAuthProviderService
   */
  async findSocialAccountByUser(userId: number, provider: string): Promise<ISocialAccount | null> {
    return (await this.socialAccountRepository.findOne({
      where: { userId, provider },
    })) as ISocialAccount | null;
  }

  /**
   * Create or update social account
   *
   * @param userId - User ID (internal)
   * @param provider - Provider name
   * @param providerId - Provider user ID
   * @param providerEmail - Provider email
   * @param metadata - Optional raw profile data
   * @internal - For use by BaseSocialAuthProviderService
   */
  async createOrUpdateSocialAccount(
    userId: number,
    provider: string,
    providerId: string,
    providerEmail?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const existingAccount = await this.findSocialAccountByUser(userId, provider);

    if (existingAccount) {
      // Update existing account
      existingAccount.providerEmail = providerEmail || null;
      existingAccount.lastUsedAt = new Date();
      existingAccount.metadata = metadata || null;
      await this.socialAccountRepository.save(existingAccount);
    } else {
      // Create new account
      const socialAccount = this.socialAccountRepository.create({
        userId,
        provider,
        providerId,
        providerEmail: providerEmail || null,
        linkedAt: new Date(),
        lastUsedAt: new Date(),
        metadata: metadata || null,
      });

      await this.socialAccountRepository.save(socialAccount);
    }

    // Update user's social auth flags
    await this.updateUserSocialFlags(userId);
  }

  /**
   * Update user's social authentication flags
   *
   * @param userId - User ID (internal)
   * @internal - For use by BaseSocialAuthProviderService
   */
  async updateUserSocialFlags(userId: number): Promise<void> {
    const socialAccounts = (await this.socialAccountRepository.find({
      where: { userId },
    })) as ISocialAccount[];

    const providers = socialAccounts?.map((account) => account.provider) || [];
    const hasSocialAuth = socialAccounts && socialAccounts.length > 0;

    // Use save() instead of update() to ensure TypeORM properly serializes simple-array fields
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.hasSocialAuth = hasSocialAuth;
      user.socialProviders = providers.length > 0 ? providers : null;
      await this.userRepository.save(user);
    }
  }
}
