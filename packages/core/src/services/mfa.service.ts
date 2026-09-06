import { Repository } from 'typeorm';
import { AuthorizationService } from './authorization.service';
import { BaseMFADevice, BaseUser } from '../entities';
import { IUser, IMFADevice } from '../interfaces/entities.interface';
import { IMFAProviderService } from '../interfaces/mfa-provider.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { MFAMethod, MFADeviceMethod } from '../enums/mfa-method.enum';
import { ChallengeService } from './challenge.service';
import { AuthChallenge } from '../dto/auth-challenge.dto';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { ClientInfoService } from './client-info.service';
import { HookRegistryService } from './hook-registry.service';
import { ensureValidatedDto, ensureValidatedDtoSync } from '../utils/dto-validator';
import { isUUID } from 'class-validator';
import { ContextStorage } from '../utils/context-storage';
import {
  GetAvailableMethodsResponseDTO,
  GenerateBackupCodesResponseDTO,
  GetChallengeDataDTO,
  GetChallengeDataResponseDTO,
  AdminGetMFAStatusDTO,
  GetMFAStatusResponseDTO,
  GetSetupDataDTO,
  GetSetupDataResponseDTO,
  AdminGetUserDevicesDTO,
  GetUserDevicesDTO,
  GetUserDevicesResponseDTO,
  MFADeviceResponseDTO,
  HasProviderDTO,
  HasProviderResponseDTO,
  ListProvidersResponseDTO,
  AdminRemoveDeviceDTO,
  AdminSetPreferredDeviceDTO,
  AdminSetPreferredDeviceResponseDTO,
  RemoveDeviceDTO,
  RemoveDeviceResponseDTO,
  SetMFAExemptionDTO,
  SetMFAExemptionResponseDTO,
  SetPreferredDeviceDTO,
  SetPreferredDeviceResponseDTO,
  SetupMFADTO,
  SetupMFAResponseDTO,
  VerifyMFACodeDTO,
  VerifyMFACodeResponseDTO,
} from '../dto';

/**
 * MFA Service Registry
 *
 * Central registry for managing MFA provider services.
 * Routes requests to the appropriate provider based on method name.
 *
 * Provider services (TOTP, SMS, Passkey) automatically register themselves
 * when their modules are imported via OnModuleInit.
 *
 * **Key Features:**
 * - Provider registration and lookup
 * - Unified interface for MFA operations
 * - Routing verification requests to correct provider
 * - Device management operations
 *
 * @example
 * ```typescript
 * @Controller('auth')
 * export class AuthController {
 *   constructor(private readonly mfaService: MFAService) {}
 *
 *   @Post('mfa/verify')
 *   async verifyMFA(@Body() dto: { method: string; code: string }) {
 *     const provider = this.mfaService.getProvider(dto.method);
 *     return await provider.verify(dto.code);
 *   }
 * }
 * ```
 */
export class MFAService {
  private readonly providers = new Map<string, IMFAProviderService>();

  // ============================================================================
  // MFA Status (User + Admin)
  // ============================================================================

  /**
   * Shared implementation for retrieving MFA status by target user sub.
   *
   * @param sub - Target user sub (UUID v4)
   * @returns Comprehensive MFA status
   */
  private async getMfaStatusBySub(sub: string): Promise<GetMFAStatusResponseDTO> {
    // Get user entity with MFA-related fields
    // Note: mfaExemptGrantedBy is intentionally excluded as it's sensitive admin information
    const userEntity = await this.userRepository.findOne({
      select: [
        'id',
        'mfaEnabled',
        'backupCodes',
        'preferredMfaMethod',
        'mfaExempt',
        'mfaExemptReason',
        'mfaExemptGrantedAt',
      ],
      where: { sub },
    });

    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const enabled = userEntity.mfaEnabled || false;

    // Get available methods (all registered & allowed methods)
    // Config-derived, so the already-resolved target user is not re-resolved here.
    const finalAvailableMethods = this.listAllowedMethods();
    if (this.config?.mfa?.backup?.enabled) {
      if (!finalAvailableMethods.includes(MFAMethod.BACKUP)) {
        finalAvailableMethods.push(MFAMethod.BACKUP);
      }
    }

    // Get user's configured devices for the target user
    const devicesResult = await this.mfaDeviceRepository.find({
      where: { userId: (userEntity as unknown as { id: number }).id, isActive: true },
      order: { createdAt: 'DESC' },
    } as Record<string, unknown>);
    const configuredMethods = [
      ...new Set((devicesResult as IMFADevice[]).filter((d) => d.isActive).map((d) => d.type)),
    ] as MFADeviceMethod[];

    // Determine if MFA is required based on config and user state
    const required = enabled && configuredMethods.length > 0;

    // Check backup codes
    const hasBackupCodes = !!(userEntity as unknown as { backupCodes?: unknown[] }).backupCodes?.length;

    return {
      enabled,
      required,
      configuredMethods,
      availableMethods: finalAvailableMethods,
      hasBackupCodes,
      preferredMethod: (userEntity as unknown as { preferredMfaMethod?: unknown }).preferredMfaMethod as
        | MFADeviceMethod
        | undefined,
      mfaExempt: (userEntity as unknown as { mfaExempt?: boolean }).mfaExempt || false,
      mfaExemptReason: ((userEntity as unknown as { mfaExemptReason?: string | null }).mfaExemptReason ?? null) as
        | string
        | null,
      mfaExemptGrantedAt: ((userEntity as unknown as { mfaExemptGrantedAt?: Date | null }).mfaExemptGrantedAt ??
        null) as Date | null,
    };
  }

  // ============================================================================
  // Internal helpers (shared by user + admin APIs)
  // ============================================================================

  /**
   * Fetch active MFA devices for a given internal user ID.
   *
   * @param userId - Internal DB user ID
   * @returns Active MFA devices
   */
  private async getActiveDevicesForUserId(userId: number): Promise<IMFADevice[]> {
    const devices = await this.mfaDeviceRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    } as Record<string, unknown>);

    return devices as unknown as IMFADevice[];
  }

  /**
   * Resolve a target user by `sub` (admin-style targeting).
   *
   * @param sub - Target user sub (UUID v4)
   * @returns User entity
   * @throws {NAuthException} NOT_FOUND when user is not found
   */
  private async getUserBySubOrThrow(sub: string): Promise<IUser> {
    const user = (await this.userRepository.findOne({
      where: { sub },
    })) as IUser | null;

    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    return user;
  }

  /**
   * Shared implementation for removing MFA devices.
   *
   * @param targetUser - Target user (self-service or admin target)
   * @param methodType - MFA method to remove (normalized)
   * @param removedBy - Actor performing the removal
   */

  /**
   * Shared implementation for removing a single MFA device by device ID.
   *
   * @param targetUser - Target user (self-service or admin target)
   * @param deviceId - MFA device ID to remove
   * @param removedBy - Actor performing the removal
   * @returns Removal result
   * @throws {NAuthException} NOT_FOUND when device is not found for the user
   */
  private async removeDeviceInternal(
    targetUser: IUser,
    deviceId: number,
    removedBy: 'user' | 'admin',
  ): Promise<RemoveDeviceResponseDTO> {
    const userId = targetUser.id;

    // Get all active devices for this user and find the target device
    const activeDevices = await this.getActiveDevicesForUserId(userId);
    const deviceToRemove = activeDevices.find((d) => d.id === deviceId);

    if (!deviceToRemove) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'MFA device not found', { deviceId });
    }

    const removedMethod = deviceToRemove.type;

    // Delete the specific device
    const result = await this.mfaDeviceRepository.delete(deviceId);
    const deletedCount = result.affected || 0;

    // Re-load remaining devices after deletion
    const remainingActiveDevices = await this.getActiveDevicesForUserId(userId);
    let mfaDisabled = false;

    // If no active devices remain, disable MFA for user
    if (remainingActiveDevices.length === 0) {
      await this.userRepository.update(
        { id: userId },
        {
          mfaEnabled: false,
          mfaMethods: [],
          preferredMfaMethod: null,
        },
      );
      mfaDisabled = true;

      // ============================================================================
      // Audit: Record MFA disabled (last device removed)
      // ============================================================================
      if (this.auditService && this.clientInfoService) {
        try {
          const actor = removedBy === 'admin' ? ContextStorage.get<IUser>('CURRENT_USER') : null;
          const actorNameCandidate = actor
            ? `${(actor.firstName as string | null) || ''} ${(actor.lastName as string | null) || ''}`.trim()
            : '';
          const performedByName =
            actorNameCandidate.length > 0 ? actorNameCandidate : (actor?.email as string | undefined) || undefined;

          await this.auditService?.recordEvent({
            userId,
            eventType: AuthAuditEventType.MFA_DISABLED,
            eventStatus: 'INFO',
            authMethod: removedBy === 'admin' ? 'admin' : undefined,
            performedBy: removedBy === 'admin' && actor ? actor.sub : undefined,
            reason: removedBy === 'admin' ? 'admin_action' : 'last_device_removed',
            description:
              removedBy === 'admin'
                ? 'MFA disabled by admin - last device removed'
                : 'MFA disabled - last device removed',
            metadata: {
              removedDeviceId: deviceId,
              removedMethod,
              removedBy,
              ...(performedByName ? { performedByName } : {}),
            },
          });
        } catch (auditError) {
          const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
          this.logger?.error?.(`Failed to record MFA_DISABLED audit event: ${errorMessage}`, {
            error: auditError,
            userId,
          });
        }
      }

      // Automatically create MFA_SETUP_REQUIRED challenge if MFA enforcement requires it
      if (this.challengeService && this.config?.mfa?.enabled) {
        const enforcement = this.config.mfa.enforcement || 'OPTIONAL';
        if (enforcement === 'REQUIRED' || enforcement === 'ADAPTIVE') {
          try {
            await this.challengeService.createChallengeSession(targetUser, AuthChallenge.MFA_SETUP_REQUIRED, {
              allowedMethods: this.config.mfa.allowedMethods || [],
              requiresSetup: true,
            });
            this.logger?.log?.(`Created MFA_SETUP_REQUIRED challenge for user ${targetUser.sub} after device removal`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger?.warn?.(`Failed to create MFA_SETUP_REQUIRED challenge after device removal: ${errorMessage}`);
          }
        }
      }
    } else {
      // Update mfaMethods array with remaining methods
      const remainingMethods = [...new Set(remainingActiveDevices.map((d) => d.type))];

      // Determine preferred method: keep if still configured, otherwise pick a new one.
      const preferredMethod = targetUser.preferredMfaMethod;
      const preferredStillConfigured =
        !!preferredMethod && remainingActiveDevices.some((d) => d.type === preferredMethod);
      const finalPreferredMethod = preferredStillConfigured ? preferredMethod : remainingActiveDevices[0].type;

      await this.userRepository.update(
        { id: userId },
        {
          mfaMethods: remainingMethods,
          preferredMfaMethod: finalPreferredMethod,
        },
      );

      // Normalize primary device flags: ensure exactly one active device is primary.
      // Prefer a device of the preferred method (best UX).
      const primaryDevice =
        remainingActiveDevices.find((d) => d.type === finalPreferredMethod) || remainingActiveDevices[0];

      for (const device of remainingActiveDevices) {
        await this.mfaDeviceRepository.update({ id: device.id }, { isPrimary: device.id === primaryDevice.id });
      }
    }

    // ============================================================================
    // Audit: Record MFA device removal
    // ============================================================================
    if (deletedCount > 0 && this.auditService && this.clientInfoService) {
      try {
        const actor = removedBy === 'admin' ? ContextStorage.get<IUser>('CURRENT_USER') : null;
        const actorNameCandidate = actor
          ? `${(actor.firstName as string | null) || ''} ${(actor.lastName as string | null) || ''}`.trim()
          : '';
        const performedByName =
          actorNameCandidate.length > 0 ? actorNameCandidate : (actor?.email as string | undefined) || undefined;

        await this.auditService?.recordEvent({
          userId,
          eventType: AuthAuditEventType.MFA_DEVICE_REMOVED,
          eventStatus: 'INFO',
          authMethod: removedBy === 'admin' ? 'admin' : undefined,
          performedBy: removedBy === 'admin' && actor ? actor.sub : undefined,
          metadata: {
            removedDeviceId: deviceId,
            removedMethod,
            deletedCount,
            remainingDevices: remainingActiveDevices.length,
            mfaDisabled,
            removedBy,
            ...(performedByName ? { performedByName } : {}),
          },
        });
      } catch (auditError) {
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record MFA_DEVICE_REMOVED audit event: ${errorMessage}`, {
          error: auditError,
          userId,
          removedDeviceId: deviceId,
        });
      }
    }

    // ============================================================================
    // Lifecycle Hook: MFA Device Removed
    // ============================================================================
    if (deletedCount > 0 && this.hookRegistry && this.clientInfoService) {
      try {
        const clientInfo = this.clientInfoService.get();
        await this.hookRegistry.executeMFADeviceRemoved({
          user: targetUser,
          deviceType: removedMethod as import('../enums/mfa-method.enum').MFADeviceMethod,
          removedBy,
          remainingDeviceCount: remainingActiveDevices.length,
          clientInfo: {
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
            ipCountry: clientInfo.ipCountry,
            ipCity: clientInfo.ipCity,
          },
        });
      } catch (hookError) {
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(`Failed to execute mfaDeviceRemoved hooks: ${errorMessage}`, {
          error: hookError,
          userId,
          removedDeviceId: deviceId,
        });
      }
    }

    return {
      removedDeviceId: deviceId,
      removedMethod,
      mfaDisabled,
    };
  }

  /**
   * Resolve a user entity by flexible identifier.
   *
   * WHY: Admin APIs typically accept a generic identifier (email/username/phone/sub) for consistency.
   * MFA exemption is admin-only, so we support the same ergonomics.
   *
   * @param identifier - User identifier (email/username/phone/sub)
   * @returns User entity, or null when not found
   */
  private async findUserByIdentifier(identifier: string): Promise<BaseUser | null> {
    const trimmed = identifier.trim();

    // Try UUID-as-sub first (fast path)
    if (isUUID(trimmed)) {
      return await this.userRepository.findOne({ where: { sub: trimmed } });
    }

    const identifierType = this.config?.login?.identifierType;

    // ============================================================================
    // Identifier routing (match AuthService behavior for consistency)
    // ============================================================================
    // If the deployment constrains login identifiers, respect it here to avoid ambiguity.
    if (identifierType === 'email') {
      return await this.userRepository.findOne({ where: { email: trimmed.toLowerCase() } });
    }

    if (identifierType === 'username') {
      return await this.userRepository.findOne({ where: { username: trimmed } });
    }

    if (identifierType === 'phone') {
      return await this.userRepository.findOne({ where: { phone: trimmed } });
    }

    // Default / email_or_username: try email then username, finally phone (best-effort).
    const byEmail = await this.userRepository.findOne({ where: { email: trimmed.toLowerCase() } });
    if (byEmail) {
      return byEmail;
    }

    const byUsername = await this.userRepository.findOne({ where: { username: trimmed } });
    if (byUsername) {
      return byUsername;
    }

    return await this.userRepository.findOne({ where: { phone: trimmed } });
  }

  constructor(
    private readonly mfaDeviceRepository: Repository<BaseMFADevice>,
    private readonly userRepository: Repository<BaseUser>,
    private readonly challengeService?: ChallengeService,
    private readonly config?: NAuthConfig,
    private readonly logger?: NAuthLogger,
    private readonly auditService?: AuthAuditService,
    private readonly clientInfoService?: ClientInfoService,
    private readonly hookRegistry?: HookRegistryService,
    private readonly authorizationService?: AuthorizationService,
  ) {}

  /**
   * Get current user from authenticated context
   *
   * @returns Current authenticated user
   * @throws {NAuthException} If user not found in context
   */
  private getCurrentUserOrThrow(): IUser {
    const currentUser = ContextStorage.get<IUser>('CURRENT_USER');
    if (!currentUser) {
      throw new NAuthException(AuthErrorCode.FORBIDDEN, 'Authentication required');
    }
    return currentUser;
  }

  /**
   * Execute a callback with a specific user bound into CURRENT_USER context.
   *
   * This is required for flows where the user is resolved outside of request auth context
   * (e.g., challenge sessions) but providers must still derive the user from context.
   *
   * @param user - User to bind into context
   * @param callback - Callback to execute
   * @returns Callback result
   */
  private async withUserContext<T>(user: IUser, callback: () => Promise<T>): Promise<T> {
    const store = ContextStorage.getStore();
    if (!store) {
      return await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', user);
        return await callback();
      });
    }

    const previousUser = ContextStorage.get<IUser>('CURRENT_USER');
    ContextStorage.set('CURRENT_USER', user);
    try {
      return await callback();
    } finally {
      if (previousUser) {
        ContextStorage.set('CURRENT_USER', previousUser);
      } else {
        ContextStorage.delete('CURRENT_USER');
      }
    }
  }

  /**
   * Register an MFA provider
   *
   * Called automatically by provider modules during initialization.
   * Provider method names must be unique.
   *
   * @param provider - Provider service instance (must have methodName property)
   * @throws {NAuthException} If provider is already registered
   *
   * @example
   * ```typescript
   * // In provider module's OnModuleInit
   * this.mfaService.registerProvider(this.totpProvider);
   * ```
   */
  registerProvider(provider: IMFAProviderService): void {
    const name = provider.methodName;
    if (this.providers.has(name)) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, `MFA provider '${name}' is already registered`);
    }
    this.providers.set(name, provider);
  }

  /**
   * Get a provider by method name
   *
   * @param methodName - Method name (e.g., 'totp', 'sms', 'passkey')
   * @returns Provider service instance
   * @throws {NAuthException} If provider is not registered
   *
   * @example
   * ```typescript
   * const totpProvider = this.mfaService.getProvider('totp');
   * const setupData = await totpProvider.setup(user);
   * ```
   */
  getProvider(methodName: string): IMFAProviderService {
    const provider = this.providers.get(methodName);
    if (!provider) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `MFA provider '${methodName}' is not registered. Import the provider module (e.g., TOTPMFAModule) and ensure it's properly configured.`,
      );
    }
    return provider;
  }

  /**
   * Check if a provider is registered
   *
   * @param dto - Request DTO with method name
   * @returns Response DTO with hasProvider flag
   *
   * @example
   * ```typescript
   * const result = await this.mfaService.hasProvider({ methodName: 'totp' });
   * if (result.hasProvider) {
   *   // TOTP is available
   * }
   * ```
   */
  hasProvider(dto: HasProviderDTO): HasProviderResponseDTO {
    dto = ensureValidatedDtoSync(HasProviderDTO, dto);
    return {
      hasProvider: this.providers.has(dto.methodName),
    };
  }

  /**
   * Get all registered provider method names
   *
   * @returns Response DTO with array of method names
   *
   * @example
   * ```typescript
   * const result = this.mfaService.listProviders(); // { providers: ['totp', 'sms', 'passkey'] }
   * ```
   */
  listProviders(): ListProvidersResponseDTO {
    return {
      providers: Array.from(this.providers.keys()),
    };
  }

  /**
   * Get available MFA methods for a user
   *
   * Returns list of methods that are:
   * - Registered as providers
   * - Allowed by configuration
   *
   * This returns ALL methods that can be set up, not just ones the user has configured.
   * Use getUserDevices() to check which methods the user has actually set up.
   *
   * @returns Response DTO with array of available method names
   *
   * @example
   * ```typescript
   * const result = await this.mfaService.getAvailableMethods();
   * // Returns: { availableMethods: ['totp', 'sms', 'passkey'] }
   * ```
   */
  async getAvailableMethods(): Promise<GetAvailableMethodsResponseDTO> {
    this.getCurrentUserOrThrow();

    return {
      availableMethods: this.listAllowedMethods(),
    };
  }

  /**
   * Issue a fresh set of backup codes for the current user.
   *
   * Replaces any codes the user already held. Backup codes are not owned by any one
   * provider - every provider extends `BaseMFAProviderService`, which holds the shared
   * implementation - so this borrows whichever provider is registered.
   *
   * @returns The new plaintext codes, returned once and stored only as hashes
   * @throws {NAuthException} VALIDATION_FAILED when backup codes are disabled or no
   *   provider is registered to supply the implementation
   */
  async generateBackupCodes(): Promise<GenerateBackupCodesResponseDTO> {
    this.getCurrentUserOrThrow();

    if (!this.config?.mfa?.backup?.enabled) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Backup codes are not enabled');
    }

    const provider = Array.from(this.providers.values()).find((candidate) => !!candidate.generateBackupCodes);
    if (!provider?.generateBackupCodes) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Backup code generation not available');
    }

    return { codes: await provider.generateBackupCodes() };
  }

  /**
   * Methods registered as providers and permitted by configuration.
   *
   * Derived from configuration alone, so it is the same for every user - callers that
   * have already resolved a target user use this directly rather than re-resolving one.
   *
   * @returns Allowed method names, whether or not any user has set them up
   */
  private listAllowedMethods(): string[] {
    const available: string[] = [];

    for (const [methodName, provider] of this.providers.entries()) {
      if (!provider.isMethodAllowed()) {
        continue;
      }
      available.push(methodName);
    }

    return available;
  }

  /**
   * Verify MFA code using appropriate provider
   *
   * Routes the verification request to the correct provider based on method name.
   *
   * @param dto - Request DTO with user sub, method name, code, and optional device ID
   * @returns Response DTO with verification result
   * @throws {NAuthException} If method is not available or verification fails
   *
   * @example
   * ```typescript
   * // Verify TOTP code
   * const result = await this.mfaService.verifyCode({
   *   sub: user.sub,
   *   methodName: 'totp',
   *   code: '123456'
   * });
   *
   * // Verify backup code
   * const result = await this.mfaService.verifyCode({
   *   sub: user.sub,
   *   methodName: 'backup',
   *   code: 'ABC12345'
   * });
   * ```
   */
  async verifyCode(dto: VerifyMFACodeDTO): Promise<VerifyMFACodeResponseDTO> {
    dto = await ensureValidatedDto(VerifyMFACodeDTO, dto);
    // Look up user by sub
    const userEntity = await this.userRepository.findOne({ where: { sub: dto.sub } });
    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }
    const user = userEntity as unknown as IUser;

    // Handle backup codes specially (not a provider, uses base class helper)
    if (dto.methodName === MFAMethod.BACKUP) {
      // Get any provider to access backup code verification
      // All providers extend BaseMFAProviderService which has verifyBackupCode
      const firstProvider = Array.from(this.providers.values())[0];
      if (firstProvider && 'verifyBackupCode' in firstProvider) {
        const providerWithBackup = firstProvider as IMFAProviderService & {
          verifyBackupCode: (user: IUser, code: string) => Promise<boolean>;
        };
        const isValid = await providerWithBackup.verifyBackupCode(user, dto.code as string);
        return { valid: isValid };
      }
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Backup code verification not available');
    }

    // Get provider and verify (provider derives user from context)
    const provider = this.getProvider(dto.methodName);
    const isValid = await this.withUserContext(user, async () => {
      return await provider.verify(dto.code, dto.deviceId);
    });
    return { valid: isValid };
  }

  /**
   * Setup MFA device using appropriate provider
   *
   * @param dto - Request DTO with user sub, method name, and optional setup data
   * @returns Response DTO with provider-specific setup data
   *
   * @example
   * ```typescript
   * const result = await this.mfaService.setup({
   *   sub: user.sub,
   *   methodName: 'totp'
   * });
   * // Returns: { setupData: { secret, qrCode, manualEntryKey } }
   * ```
   */
  async setup(dto: SetupMFADTO): Promise<SetupMFAResponseDTO> {
    dto = await ensureValidatedDto(SetupMFADTO, dto);
    // Get user from authenticated context (already has all fields)
    const provider = this.getProvider(dto.methodName);
    const setupData = await provider.setup(dto.setupData);
    return {
      setupData: setupData as Record<string, unknown>,
    };
  }

  /**
   * Get user's MFA devices
   *
   * User self-service method: current user is derived from authenticated context.
   *
   * @param _dto - Optional (empty) DTO for validation consistency
   * @returns Response DTO with array of MFA devices
   *
   * @example
   * ```typescript
   * const result = await this.mfaService.getUserDevices();
   * // Returns: { devices: [...] }
   * ```
   */
  async getUserDevices(_dto: GetUserDevicesDTO = {}): Promise<GetUserDevicesResponseDTO> {
    await ensureValidatedDto(GetUserDevicesDTO, _dto);
    // Get user from authenticated context (already has id and sub)
    const currentUser = this.getCurrentUserOrThrow();

    const devices = await this.getActiveDevicesForUserId(currentUser.id);
    return {
      devices: MFADeviceResponseDTO.fromEntities(devices),
    };
  }

  /**
   * Get comprehensive MFA status for the current authenticated user (self-service).
   *
   * @returns Response DTO with complete MFA status
   */
  async getMfaStatus(): Promise<GetMFAStatusResponseDTO> {
    const currentUser = this.getCurrentUserOrThrow();
    return await this.getMfaStatusBySub(currentUser.sub);
  }

  /**
   * Get comprehensive MFA status for a target user (admin-only).
   *
   * @param dto - Admin request DTO with target user sub
   * @returns Response DTO with complete MFA status
   */
  async adminGetMfaStatus(dto: AdminGetMFAStatusDTO): Promise<GetMFAStatusResponseDTO> {
    await this.authorizationService?.authorize('admin.mfa.readStatus', { targetSub: dto.sub });
    dto = await ensureValidatedDto(AdminGetMFAStatusDTO, dto);
    return await this.getMfaStatusBySub(dto.sub);
  }

  /**
   * Get MFA devices for a specific user (admin-only).
   *
   * Admin operation that retrieves all active MFA devices for a target user.
   * Returns device details including id, name, type, and isPreferred status.
   *
   * @param dto - Admin request DTO with target user sub
   * @returns Response DTO with array of MFA devices
   * @throws {NAuthException} If user not found
   *
   * @example
   * ```typescript
   * const result = await mfaService.adminGetUserDevices({ sub: 'user-uuid' });
   * // Returns: { devices: [{ id: 1, name: 'My Authenticator', type: 'totp', isPreferred: true, ... }] }
   * ```
   */
  async adminGetUserDevices(dto: AdminGetUserDevicesDTO): Promise<GetUserDevicesResponseDTO> {
    await this.authorizationService?.authorize('admin.mfa.listDevices', { targetSub: dto.sub });
    dto = await ensureValidatedDto(AdminGetUserDevicesDTO, dto);

    // Find user by sub
    const user = await this.userRepository.findOne({
      where: { sub: dto.sub },
    } as Record<string, unknown>);

    if (!user) {
      throw new NAuthException(AuthErrorCode.USER_NOT_FOUND, 'User not found', { sub: dto.sub });
    }

    const devices = await this.getActiveDevicesForUserId(user.id);
    return {
      devices: MFADeviceResponseDTO.fromEntities(devices),
    };
  }

  /**
   * Remove MFA devices by method type
   *
   * Comprehensive method that handles all aspects of MFA device removal:
   * - Uses the authenticated user context (self-service)
   * - Validates method type
   * - Removes all active devices of the specified method type
   * - Updates user's preferred method if the removed method was preferred
   * - Updates device primary flags
   * - Disables MFA if this was the last device
   * - Creates MFA_SETUP_REQUIRED challenge if MFA enforcement requires it
   *
   * This method encapsulates all database operations related to MFA device removal,
   * ensuring the consumer app doesn't need to directly manipulate nauth_* tables.
   *
   * @param dto - Request DTO with method type
   * @returns Response DTO with deletedCount and whether MFA was disabled
   * @throws {NAuthException} If user not found, invalid method type, or no devices found
   *
   * @example
   * ```typescript
   * // Consumer app controller
   * @Delete('mfa/devices/:method')
   * async removeMFAMethod(@CurrentUser() user: IUser, @Param('method') method: string) {
   *   const result = await this.mfaService.removeDevices({ methodType: method });
   *   return { message: 'MFA method removed successfully', ...result };
   * }
   * ```
   */

  /**
   * Remove a single MFA device by device ID (self-service).
   *
   * WHY: Users can register multiple devices per method (e.g., multiple passkeys, multiple TOTP apps),
   * so deleting by method alone is often too destructive.
   *
   * @param dto - Request DTO with deviceId
   * @returns Removal response (removed device id/method and whether MFA was disabled)
   * @throws {NAuthException} NOT_FOUND when device does not exist or does not belong to the user
   *
   * @example
   * ```typescript
   * const result = await mfaService.removeDevice({ deviceId: 123 });
   * ```
   */
  async removeDevice(dto: RemoveDeviceDTO): Promise<RemoveDeviceResponseDTO> {
    dto = await ensureValidatedDto(RemoveDeviceDTO, dto);
    const currentUser = this.getCurrentUserOrThrow();
    return await this.removeDeviceInternal(currentUser, dto.deviceId, 'user');
  }

  /**
   * Admin: Remove a single MFA device by device ID.
   *
   * Admin APIs are allowed to target any user's device. The owning user is resolved
   * from the device record and the same internal removal logic is reused.
   *
   * @param dto - Admin request DTO with deviceId
   * @returns Removal response
   * @throws {NAuthException} NOT_FOUND when device or owning user is not found
   *
   * @example
   * ```typescript
   * const result = await mfaService.adminRemoveDevice({ deviceId: 123 });
   * ```
   */
  async adminRemoveDevice(dto: AdminRemoveDeviceDTO): Promise<RemoveDeviceResponseDTO> {
    // The DTO identifies the device, not its owner; the target user is resolved below.
    await this.authorizationService?.authorize('admin.mfa.removeDevice');
    dto = await ensureValidatedDto(AdminRemoveDeviceDTO, dto);

    const deviceEntity = await this.mfaDeviceRepository.findOne({
      where: { id: dto.deviceId },
    } as Record<string, unknown>);

    if (!deviceEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'MFA device not found', { deviceId: dto.deviceId });
    }

    const device = deviceEntity as unknown as IMFADevice;

    const userEntity = await this.userRepository.findOne({
      where: { id: device.userId },
    } as Record<string, unknown>);

    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found', {
        userId: device.userId,
        deviceId: dto.deviceId,
      });
    }

    const targetUser = userEntity as unknown as IUser;
    return await this.removeDeviceInternal(targetUser, dto.deviceId, 'admin');
  }

  /**
   * Admin: Set a user's preferred MFA device.
   *
   * Updates the preferred device for a specified user by device ID.
   * This is an admin-only operation that allows administrators to manage
   * user MFA preferences.
   *
   * @param dto - DTO containing user sub and device ID
   * @returns Success message
   * @throws {NAuthException} NOT_FOUND | VALIDATION_FAILED
   *
   * @example
   * ```typescript
   * const result = await mfaService.adminSetPreferredDevice({
   *   sub: 'user-uuid',
   *   deviceId: 123
   * });
   * // Returns: { message: "Preferred MFA device updated" }
   * ```
   */
  async adminSetPreferredDevice(dto: AdminSetPreferredDeviceDTO): Promise<AdminSetPreferredDeviceResponseDTO> {
    await this.authorizationService?.authorize('admin.mfa.setPreferred', { targetSub: dto.sub });
    dto = await ensureValidatedDto(AdminSetPreferredDeviceDTO, dto);

    // Get target user
    const user = await this.userRepository.findOne({ where: { sub: dto.sub } });
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Delegate to the regular setPreferredDevice logic
    // but use SetPreferredDeviceDTO format
    const deviceDto = Object.assign(new SetPreferredDeviceDTO(), { deviceId: dto.deviceId });

    // Temporarily set context user for the operation
    // Keep admin user in context for audit trails
    const originalUser = ContextStorage.get('CURRENT_USER');
    const adminUser = originalUser; // Admin user is already in context

    // Set target user as current user for the operation
    ContextStorage.set('CURRENT_USER', user as unknown as IUser);

    try {
      // Pass 'admin' flag to setPreferredDevice for proper audit trails
      const result = await this.setPreferredDevice(deviceDto, 'admin');
      return { message: result.message };
    } finally {
      // Restore original context (admin user)
      if (originalUser) {
        ContextStorage.set('CURRENT_USER', originalUser);
      } else {
        ContextStorage.set('CURRENT_USER', undefined as unknown as IUser);
      }
    }
  }

  /**
   * Set a specific MFA device as the user's preferred device (self-service).
   *
   * This updates:
   * - The user's preferred MFA method (set to the device's method)
   * - Device `isPrimary` flags (exactly one active device becomes primary/preferred)
   *
   * @param dto - Request DTO with deviceId
   * @returns Success message
   * @throws {NAuthException} NOT_FOUND when device does not exist or does not belong to the user
   *
   * @example
   * ```typescript
   * await mfaService.setPreferredDevice({ deviceId: 123 });
   * ```
   */
  async setPreferredDevice(
    dto: SetPreferredDeviceDTO,
    updatedBy: 'user' | 'admin' = 'user',
  ): Promise<SetPreferredDeviceResponseDTO> {
    dto = await ensureValidatedDto(SetPreferredDeviceDTO, dto);
    const currentUser = this.getCurrentUserOrThrow();

    const activeDevices = await this.getActiveDevicesForUserId(currentUser.id);
    const targetDevice = activeDevices.find((d) => d.id === dto.deviceId);
    if (!targetDevice) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'MFA device not found', { deviceId: dto.deviceId });
    }

    // Update user's preferred method to match the preferred device's method.
    await this.userRepository.update(
      { id: currentUser.id },
      {
        preferredMfaMethod: targetDevice.type,
      },
    );

    // Ensure exactly one active device is primary (marks it as preferred).
    for (const device of activeDevices) {
      await this.mfaDeviceRepository.update({ id: device.id }, { isPrimary: device.id === targetDevice.id });
    }

    // ============================================================================
    // Audit: Record preferred MFA device update
    // ============================================================================
    if (this.auditService && this.clientInfoService) {
      try {
        const actor = updatedBy === 'admin' ? ContextStorage.get<IUser>('CURRENT_USER') : currentUser;
        const actorNameCandidate =
          actor && updatedBy === 'admin'
            ? `${(actor.firstName as string | null) || ''} ${(actor.lastName as string | null) || ''}`.trim()
            : '';
        const performedByName =
          actorNameCandidate.length > 0 ? actorNameCandidate : (actor?.email as string | undefined) || undefined;

        await this.auditService?.recordEvent({
          userId: currentUser.id,
          eventType: AuthAuditEventType.MFA_PREFERRED_METHOD_UPDATED,
          eventStatus: 'INFO',
          authMethod: updatedBy === 'admin' ? 'admin' : undefined,
          performedBy: updatedBy === 'admin' && actor && actor.sub !== currentUser.sub ? actor.sub : undefined,
          metadata: {
            newMethod: targetDevice.type,
            deviceId: targetDevice.id,
            updatedBy,
            ...(performedByName && updatedBy === 'admin' ? { performedByName } : {}),
          },
        });
      } catch (auditError) {
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record MFA_PREFERRED_METHOD_UPDATED audit event: ${errorMessage}`, {
          error: auditError,
          userId: currentUser.id,
          deviceId: targetDevice.id,
        });
      }
    }

    return { message: 'Preferred MFA device updated' };
  }

  /**
   * Grant or revoke a user's exemption from multi-factor authentication (MFA) requirements.
   *
   * SECURITY: This admin-only operation updates the user's MFA exemption status, logs the action,
   * and records an audit event. MFA exemption bypasses MFA at login, but all other security controls remain enforced.
   *
   * @param dto - Request DTO with sub, exempt flag, reason, and grantedBy
   * @returns Response DTO with updated exemption fields
   * @throws {NAuthException} If the user is not found
   *
   * @example
   * ```typescript
   * // Grant MFA exemption
   * await mfaService.setMFAExemption({
   *   sub: 'a21b654c-2746-4168-acee-c175083a65cd',
   *   exempt: true,
   *   reason: 'Business partner requires MFA bypass',
   *   grantedBy: 'admin@example.com'
   * });
   *
   * // Revoke MFA exemption
   * await mfaService.setMFAExemption({
   *   sub: 'a21b654c-2746-4168-acee-c175083a65cd',
   *   exempt: false,
   *   reason: 'MFA now mandatory for this user',
   *   grantedBy: 'admin@example.com'
   * });
   * ```
   */
  async setMFAExemption(dto: SetMFAExemptionDTO): Promise<SetMFAExemptionResponseDTO> {
    await this.authorizationService?.authorize('admin.mfa.setExemption', { targetSub: dto.sub });
    dto = await ensureValidatedDto(SetMFAExemptionDTO, dto);

    // ============================================================================
    // SECURITY: Resolve the TARGET user from the DTO (admin-only API)
    // ============================================================================
    // Use `sub` (UUID v4) per ADMIN_USER_API_SEPARATION_PLAN.md
    const userEntity = await this.userRepository.findOne({ where: { sub: dto.sub } });
    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const user = userEntity as unknown as IUser;
    const targetSub = userEntity.sub;

    // Prepare update
    const updateFields: Record<string, unknown> = {
      mfaExempt: dto.exempt,
      mfaExemptReason: dto.reason || null,
      mfaExemptGrantedAt: dto.exempt ? new Date() : null,
      mfaExemptGrantedBy: dto.exempt ? dto.grantedBy || null : null,
    };

    // If revoking exemption and MFA is required, check if user needs to set up MFA
    // Note: This is just for logging - actual MFA setup requirement is checked by state machine on next login
    if (!dto.exempt && userEntity.mfaExempt && !userEntity.mfaEnabled) {
      this.logger?.warn?.(`MFA exemption revoked for user ${targetSub} - MFA setup will be required on next login`);
    }

    // Update user in database
    await this.userRepository.update(userEntity.id, updateFields);

    // Log the exemption change for audit trail
    this.logger?.log?.(`MFA exemption ${dto.exempt ? 'granted' : 'revoked'} for user ${targetSub}`, {
      userSub: targetSub,
      exempt: dto.exempt,
      reason: dto.reason || 'No reason provided',
      grantedBy: dto.grantedBy || 'System',
      timestamp: new Date().toISOString(),
    });

    // ============================================================================
    // Audit: Record MFA exemption grant/revoke
    // ============================================================================
    // Note: We also attach performedByName when possible so downstream systems
    // have a stable snapshot even if admin profile changes later.
    if (this.auditService && this.clientInfoService) {
      try {
        const actor = ContextStorage.get<IUser>('CURRENT_USER');
        const actorNameCandidate =
          `${(actor?.firstName as string | null) || ''} ${(actor?.lastName as string | null) || ''}`.trim();
        const performedByName =
          actorNameCandidate.length > 0 ? actorNameCandidate : (actor?.email as string | undefined) || undefined;

        await this.auditService.recordEvent({
          userId: user.id,
          eventType: dto.exempt ? AuthAuditEventType.MFA_EXEMPTION_GRANTED : AuthAuditEventType.MFA_EXEMPTION_REVOKED,
          eventStatus: 'INFO',
          performedBy: dto.grantedBy || null,
          // Client info automatically included from context
          reason: dto.reason || null,
          metadata: {
            previousExemptStatus: userEntity.mfaExempt,
            newExemptStatus: dto.exempt,
            ...(performedByName ? { performedByName } : {}),
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record MFA exemption audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
        });
      }
    }

    // Fetch updated user to return exemption fields
    const exemptionData = await this.userRepository.findOne({
      where: { id: userEntity.id },
      select: ['mfaExempt', 'mfaExemptReason', 'mfaExemptGrantedAt'],
    });

    if (!exemptionData) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found after update');
    }

    return {
      mfaExempt: exemptionData.mfaExempt || false,
      mfaExemptReason: exemptionData.mfaExemptReason || null,
      mfaExemptGrantedAt: exemptionData.mfaExemptGrantedAt || null,
    };
  }

  /**
   * Get MFA setup data during MFA_SETUP_REQUIRED challenge
   *
   * Returns provider-specific setup data:
   * - TOTP: { secret, qrCode, manualEntryKey }
   * - SMS: { maskedPhone } or error if phone required
   * - Passkey: WebAuthn registration options
   *
   * @param dto - Request DTO with session token, method, and optional setup data
   * @returns Response DTO with provider-specific setup data
   * @throws {NAuthException} INVALID_CHALLENGE_SESSION | VALIDATION_FAILED | PHONE_REQUIRED
   *
   * @example
   * ```typescript
   * const result = await mfaService.getSetupData({
   *   session: 'session-token',
   *   method: 'totp'
   * });
   * // Returns: { setupData: { secret: '...', qrCode: '...', manualEntryKey: '...' } }
   *
   * const result = await mfaService.getSetupData({
   *   session: 'session-token',
   *   method: 'sms',
   *   setupData: { phoneNumber: '+1234567890' }
   * });
   * // Returns: { setupData: { maskedPhone: '***-***-7890' } }
   * ```
   */
  async getSetupData(dto: GetSetupDataDTO): Promise<GetSetupDataResponseDTO> {
    dto = await ensureValidatedDto(GetSetupDataDTO, dto);
    if (!this.challengeService) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Challenge service is not available');
    }

    this.logger?.debug?.(`Getting MFA setup data: session=${dto.session}, method=${dto.method}`);

    // Validate session and ensure it's MFA_SETUP_REQUIRED
    const challengeSession = await this.challengeService.validateSession(dto.session);

    if (challengeSession.challengeName !== AuthChallenge.MFA_SETUP_REQUIRED) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Cannot get setup data: expected MFA_SETUP_REQUIRED challenge, got ${challengeSession.challengeName}`,
      );
    }

    // Get user from session
    const user = challengeSession.user;
    if (!user) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Challenge session has no associated user');
    }

    // Get provider and call setup
    // Pass challenge session ID in setupData so provider can link verification tokens
    const setupDataWithSession = {
      ...(dto.setupData || {}),
      challengeSessionId: challengeSession.id,
    };
    this.logger?.debug?.(`Passing challengeSessionId=${challengeSession.id} to ${dto.method} provider for MFA setup`);
    const provider = this.getProvider(dto.method);
    const result = await this.withUserContext(user, async () => {
      return await provider.setup(setupDataWithSession);
    });

    this.logger?.debug?.(`MFA setup data generated: method=${dto.method}, user=${user.sub}`);

    return {
      setupData: result as Record<string, unknown>,
    };
  }

  /**
   * Get MFA challenge data during MFA_REQUIRED challenge
   *
   * Supports multiple MFA methods:
   * - Passkey: Returns WebAuthn authentication options
   * - SMS: Sends SMS code and returns masked phone number (string)
   * - Email: Sends email code and returns masked email address (string)
   *
   * Note: SMS codes are automatically sent when challenge is created if SMS is preferred method.
   * This endpoint allows switching to a different method or requesting a new code.
   *
   * Session metadata updates:
   * - Stores the current method in session metadata
   * - This allows resendCode to use the correct method when user switches MFA methods
   * - For passkey, also stores the challenge for verification
   *
   * @param dto - Request DTO with session token and method
   * @returns Response DTO with provider-specific challenge data
   * @throws {NAuthException} INVALID_CHALLENGE_SESSION | VALIDATION_FAILED
   *
   * @example
   * ```typescript
   * // Passkey: Get WebAuthn options
   * const result = await mfaService.getChallengeData({
   *   session: 'session-token',
   *   method: 'passkey'
   * });
   * // Returns: { challengeData: { challenge: '...', allowCredentials: [...], ... } }
   *
   * // SMS: Send code and get masked phone
   * const result = await mfaService.getChallengeData({
   *   session: 'session-token',
   *   method: 'sms'
   * });
   * // Returns: { challengeData: '***-***-1234' }
   *
   * // Email: Send code and get masked email
   * const result = await mfaService.getChallengeData({
   *   session: 'session-token',
   *   method: 'email'
   * });
   * // Returns: { challengeData: 'u***r@example.com' }
   * ```
   */
  async getChallengeData(dto: GetChallengeDataDTO): Promise<GetChallengeDataResponseDTO> {
    dto = await ensureValidatedDto(GetChallengeDataDTO, dto);
    if (!this.challengeService) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Challenge service is not available');
    }

    this.logger?.debug?.(`Getting MFA challenge data: session=${dto.session}, method=${dto.method}`);

    // Validate session and ensure it's MFA_REQUIRED
    const challengeSession = await this.challengeService.validateSession(dto.session);

    if (challengeSession.challengeName !== AuthChallenge.MFA_REQUIRED) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Cannot get challenge data: expected MFA_REQUIRED challenge, got ${challengeSession.challengeName}`,
      );
    }

    // Get user from session
    const user = challengeSession.user;
    if (!user) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Challenge session has no associated user');
    }

    // Get provider and send challenge
    const provider = this.getProvider(dto.method);

    if (!provider.sendChallenge) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `MFA method '${dto.method}' does not support challenge data generation`,
      );
    }

    const challengeData = await this.withUserContext(user, async () => {
      return await provider.sendChallenge?.(challengeSession.id);
    });

    // Update session metadata with current method (for resendCode to use correct method)
    // This ensures that when user switches MFA methods, resendCode uses the new method
    const metadataUpdate: Record<string, unknown> = {
      method: dto.method,
    };

    // For passkey, also store the challenge in session metadata for verification
    if (dto.method === 'passkey') {
      const passkeyOptions = challengeData as { options: { challenge: string } };
      const passkeyChallenge = passkeyOptions.options?.challenge;
      if (passkeyChallenge) {
        metadataUpdate.passkeyChallenge = passkeyChallenge;
      }
    }

    await this.challengeService.updateMetadata(dto.session, metadataUpdate);
    this.logger?.debug?.(`MFA method ${dto.method} stored in session metadata: user=${user.sub}`);

    this.logger?.debug?.(`MFA challenge data generated: method=${dto.method}, user=${user.sub}`);

    return {
      challengeData: challengeData as Record<string, unknown>,
    };
  }
}
