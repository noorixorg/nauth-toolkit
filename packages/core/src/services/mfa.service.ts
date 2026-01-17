import { Repository } from 'typeorm';
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
  GetAvailableMethodsDTO,
  GetAvailableMethodsResponseDTO,
  GetChallengeDataDTO,
  GetChallengeDataResponseDTO,
  AdminGetMFAStatusDTO,
  GetMFAStatusResponseDTO,
  GetSetupDataDTO,
  GetSetupDataResponseDTO,
  GetUserDevicesDTO,
  GetUserDevicesResponseDTO,
  HasProviderDTO,
  HasProviderResponseDTO,
  ListProvidersResponseDTO,
  AdminRemoveDevicesDTO,
  AdminSetPreferredMethodDTO,
  RemoveDevicesDTO,
  RemoveDevicesResponseDTO,
  SetMFAExemptionDTO,
  SetMFAExemptionResponseDTO,
  SetPreferredMethodDTO,
  SetPreferredMethodResponseDTO,
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
    const availableMethodsResult = await this.getAvailableMethods({ sub });

    // Add 'backup' to available methods if backup codes are enabled in config
    const finalAvailableMethods = [...availableMethodsResult.availableMethods];
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
  private async removeDevicesInternal(
    targetUser: IUser,
    methodType: MFAMethod,
    removedBy: 'user' | 'admin',
  ): Promise<RemoveDevicesResponseDTO> {
    const userId = targetUser.id;
    const preferredMethod = targetUser.preferredMfaMethod;
    const isPreferredMethod = preferredMethod === methodType;

    // Get all active devices for this user
    const activeDevices = await this.getActiveDevicesForUserId(userId);

    // Get devices of the method type to remove
    const devicesToRemove = activeDevices.filter((d) => d.type.toLowerCase() === methodType);

    if (devicesToRemove.length === 0) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `No active ${methodType} MFA devices found for this user`,
      );
    }

    // Delete all devices of this method type
    let deletedCount = 0;
    for (const device of devicesToRemove) {
      const result = await this.mfaDeviceRepository.delete(device.id);
      deletedCount += result.affected || 0;
    }

    // Check if any devices remain after removal
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
      // Audit: Record MFA disabled (all devices removed)
      // ============================================================================
      if (this.auditService && this.clientInfoService) {
        try {
          await this.auditService?.recordEvent({
            userId,
            eventType: AuthAuditEventType.MFA_DISABLED,
            eventStatus: 'INFO',
            reason: removedBy === 'admin' ? 'admin_action' : 'all_devices_removed',
            description:
              removedBy === 'admin'
                ? 'MFA disabled by admin - all devices removed'
                : 'MFA disabled - all devices removed',
            // Client info automatically included from context
            metadata: {
              removedMethod: methodType,
              deletedCount,
              removedBy,
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
            this.logger?.log?.(`Created MFA_SETUP_REQUIRED challenge for user ${targetUser.sub} after MFA removal`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger?.warn?.(`Failed to create MFA_SETUP_REQUIRED challenge after MFA removal: ${errorMessage}`);
          }
        }
      }
    } else {
      // Update mfaMethods array with remaining methods
      const remainingMethods = [...new Set(remainingActiveDevices.map((d) => d.type))];

      // If the removed method was preferred, update preferred method and device primary flags
      if (isPreferredMethod) {
        const newPreferredMethod = remainingActiveDevices[0].type;
        await this.userRepository.update(
          { id: userId },
          {
            mfaMethods: remainingMethods,
            preferredMfaMethod: newPreferredMethod,
          },
        );

        // Update device primary flags - set first remaining device as primary
        if (remainingActiveDevices[0].id) {
          await this.mfaDeviceRepository.update({ id: remainingActiveDevices[0].id }, { isPrimary: true });
        }

        // Unset primary flag on other devices
        for (let i = 1; i < remainingActiveDevices.length; i++) {
          if (remainingActiveDevices[i].id) {
            await this.mfaDeviceRepository.update({ id: remainingActiveDevices[i].id }, { isPrimary: false });
          }
        }

        this.logger?.log?.(`Updated preferred MFA method to ${newPreferredMethod} after removing ${methodType}`);
      } else {
        // No preferred method change needed, just update mfaMethods
        await this.userRepository.update(
          { id: userId },
          {
            mfaMethods: remainingMethods,
          },
        );
      }
    }

    // ============================================================================
    // Audit: Record MFA device removal
    // ============================================================================
    if (deletedCount > 0 && this.auditService && this.clientInfoService) {
      try {
        await this.auditService?.recordEvent({
          userId,
          eventType: AuthAuditEventType.MFA_DEVICE_REMOVED,
          eventStatus: 'INFO',
          metadata: {
            method: methodType,
            deletedCount,
            remainingDevices: remainingActiveDevices.length,
            mfaDisabled,
            removedBy,
          },
          // Client info automatically included from context
        });
      } catch (auditError) {
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record MFA_DEVICE_REMOVED audit event: ${errorMessage}`, {
          error: auditError,
          userId,
          method: methodType,
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
          deviceType: methodType as import('../enums/mfa-method.enum').MFADeviceMethod,
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
          method: methodType,
        });
      }
    }

    return { deletedCount, mfaDisabled };
  }

  /**
   * Shared implementation for setting preferred MFA method.
   *
   * @param targetUser - Target user (self-service or admin target)
   * @param methodType - Preferred method (normalized)
   * @param updatedBy - Actor performing the update
   */
  private async setPreferredMethodInternal(
    targetUser: IUser,
    methodType: MFAMethod,
    updatedBy: 'user' | 'admin',
  ): Promise<SetPreferredMethodResponseDTO> {
    // Verify user has this method configured
    const activeDevices = await this.getActiveDevicesForUserId(targetUser.id);
    const preferredDevice = activeDevices.find((d) => d.type.toLowerCase() === methodType && d.isActive);

    if (!preferredDevice) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `MFA method '${methodType}' is not configured for this user`,
      );
    }

    // Update user's preferred method
    await this.userRepository.update(
      { id: targetUser.id },
      {
        preferredMfaMethod: methodType as MFADeviceMethod,
      },
    );

    // Update device isPrimary flags: set preferred device as primary, unset others
    for (const device of activeDevices) {
      await this.mfaDeviceRepository.update({ id: device.id }, { isPrimary: device.id === preferredDevice.id });
    }

    this.logger?.log?.(`Device ${preferredDevice.id} set as primary for user ${targetUser.sub} (by ${updatedBy})`);

    // ============================================================================
    // Audit: Record preferred MFA method update
    // ============================================================================
    if (this.auditService && this.clientInfoService) {
      try {
        const previousMethod = targetUser.preferredMfaMethod;
        await this.auditService?.recordEvent({
          userId: targetUser.id,
          eventType: AuthAuditEventType.MFA_PREFERRED_METHOD_UPDATED,
          eventStatus: 'INFO',
          metadata: {
            previousMethod: previousMethod || null,
            newMethod: methodType,
            deviceId: preferredDevice.id,
            updatedBy,
          },
        });
      } catch (auditError) {
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record MFA_PREFERRED_METHOD_UPDATED audit event: ${errorMessage}`, {
          error: auditError,
          userId: targetUser.id,
          method: methodType,
        });
      }
    }

    return {
      message: 'Preferred method updated',
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
   * @param dto - Request DTO with user sub
   * @returns Response DTO with array of available method names
   *
   * @example
   * ```typescript
   * const result = await this.mfaService.getAvailableMethods({ sub: user.sub });
   * // Returns: { availableMethods: ['totp', 'sms', 'passkey'] }
   * ```
   */
  async getAvailableMethods(dto: GetAvailableMethodsDTO): Promise<GetAvailableMethodsResponseDTO> {
    dto = await ensureValidatedDto(GetAvailableMethodsDTO, dto);
    // Look up user by sub to validate user exists
    const userEntity = await this.userRepository.findOne({ where: { sub: dto.sub } });
    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const available: string[] = [];

    for (const [methodName, provider] of this.providers.entries()) {
      // Check if method is allowed by configuration
      if (!provider.isMethodAllowed()) {
        continue;
      }

      // Return all allowed methods (whether user has set them up or not)
      available.push(methodName);
    }

    return {
      availableMethods: available,
    };
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

    return {
      devices: await this.getActiveDevicesForUserId(currentUser.id),
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
    dto = await ensureValidatedDto(AdminGetMFAStatusDTO, dto);
    return await this.getMfaStatusBySub(dto.sub);
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
  async removeDevices(dto: RemoveDevicesDTO): Promise<RemoveDevicesResponseDTO> {
    dto = await ensureValidatedDto(RemoveDevicesDTO, dto);
    const validMethods = [MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY];
    const normalizedMethod = dto.methodType.toLowerCase();
    if (!validMethods.includes(normalizedMethod as MFAMethod)) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Invalid MFA method: ${dto.methodType}. Valid methods are: ${validMethods.join(', ')}`,
      );
    }

    const currentUser = this.getCurrentUserOrThrow();
    return await this.removeDevicesInternal(currentUser, normalizedMethod as MFAMethod, 'user');
  }

  /**
   * Admin: Remove MFA devices for a specific user by `sub`.
   *
   * @param dto - Admin DTO containing target `sub` and method type
   * @returns Removal result
   * @throws {NAuthException} NOT_FOUND when user is not found
   * @throws {NAuthException} VALIDATION_FAILED on invalid method type
   *
   * @example
   * ```typescript
   * await mfaService.adminRemoveDevices({ sub: 'user-uuid', methodType: 'totp' });
   * ```
   */
  async adminRemoveDevices(dto: AdminRemoveDevicesDTO): Promise<RemoveDevicesResponseDTO> {
    dto = await ensureValidatedDto(AdminRemoveDevicesDTO, dto);
    const validMethods = [MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY];
    const normalizedMethod = dto.methodType.toLowerCase();
    if (!validMethods.includes(normalizedMethod as MFAMethod)) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Invalid MFA method: ${dto.methodType}. Valid methods are: ${validMethods.join(', ')}`,
      );
    }

    const targetUser = await this.getUserBySubOrThrow(dto.sub);
    return await this.removeDevicesInternal(targetUser, normalizedMethod as MFAMethod, 'admin');
  }

  /**
   * Set preferred MFA method for a user
   *
   * Updates the user's preferred MFA method and device primary flags.
   * Validates that the method is configured for the user before setting it as preferred.
   *
   * This method encapsulates all database operations related to preferred method updates,
   * ensuring the consumer app doesn't need to directly manipulate nauth_* tables.
   *
   * @param dto - Request DTO with method type
   * @returns Response DTO with success message
   * @throws {NAuthException} If user not found, invalid method type, or method not configured
   *
   * @example
   * ```typescript
   * // Consumer app controller
   * @Put('mfa/preferred')
   * async setPreferredMFAMethod(@CurrentUser() user: IUser, @Body() body: { method: string }) {
   *   return await this.mfaService.setPreferredMethod({ methodType: body.method });
   * }
   * ```
   */
  async setPreferredMethod(dto: SetPreferredMethodDTO): Promise<SetPreferredMethodResponseDTO> {
    dto = await ensureValidatedDto(SetPreferredMethodDTO, dto);
    // Validate method type
    const validMethods = [MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY];
    const normalizedMethod = dto.methodType.toLowerCase();
    if (!validMethods.includes(normalizedMethod as MFAMethod)) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Invalid MFA method: ${dto.methodType}. Valid methods are: ${validMethods.join(', ')}`,
      );
    }

    const currentUser = this.getCurrentUserOrThrow();
    return await this.setPreferredMethodInternal(currentUser, normalizedMethod as MFAMethod, 'user');
  }

  /**
   * Admin: Set preferred MFA method for a specific user by `sub`.
   *
   * @param dto - Admin DTO containing target `sub` and method type
   * @returns Success response
   * @throws {NAuthException} NOT_FOUND when user is not found
   * @throws {NAuthException} VALIDATION_FAILED when method is invalid or not configured
   *
   * @example
   * ```typescript
   * await mfaService.adminSetPreferredMethod({ sub: 'user-uuid', methodType: 'sms' });
   * ```
   */
  async adminSetPreferredMethod(dto: AdminSetPreferredMethodDTO): Promise<SetPreferredMethodResponseDTO> {
    dto = await ensureValidatedDto(AdminSetPreferredMethodDTO, dto);
    const validMethods = [MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY];
    const normalizedMethod = dto.methodType.toLowerCase();
    if (!validMethods.includes(normalizedMethod as MFAMethod)) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Invalid MFA method: ${dto.methodType}. Valid methods are: ${validMethods.join(', ')}`,
      );
    }

    const targetUser = await this.getUserBySubOrThrow(dto.sub);
    return await this.setPreferredMethodInternal(targetUser, normalizedMethod as MFAMethod, 'admin');
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
    if (!dto.exempt && userEntity.mfaExempt === true && !userEntity.mfaEnabled) {
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
    if (this.auditService && this.clientInfoService) {
      try {
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
      return await provider.sendChallenge?.();
    });

    // For passkey, store the challenge in session metadata for verification
    if (dto.method === 'passkey') {
      const passkeyOptions = challengeData as { options: { challenge: string } };
      const passkeyChallenge = passkeyOptions.options?.challenge;
      if (passkeyChallenge) {
        await this.challengeService.updateMetadata(dto.session, {
          passkeyChallenge,
        });
        this.logger?.debug?.(`Passkey challenge stored in session metadata: user=${user.sub}`);
      }
    }

    this.logger?.debug?.(`MFA challenge data generated: method=${dto.method}, user=${user.sub}`);

    return {
      challengeData: challengeData as Record<string, unknown>,
    };
  }
}
