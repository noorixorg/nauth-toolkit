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
import {
  GetAvailableMethodsDTO,
  GetAvailableMethodsResponseDTO,
  GetChallengeDataDTO,
  GetChallengeDataResponseDTO,
  GetMFAStatusDTO,
  GetMFAStatusResponseDTO,
  GetSetupDataDTO,
  GetSetupDataResponseDTO,
  GetUserDevicesDTO,
  GetUserDevicesResponseDTO,
  HasProviderDTO,
  HasProviderResponseDTO,
  ListProvidersResponseDTO,
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
 *     return await provider.verify(user, dto.code);
 *   }
 * }
 * ```
 */
export class MFAService {
  private readonly providers = new Map<string, IMFAProviderService>();

  constructor(
    private readonly mfaDeviceRepository: Repository<BaseMFADevice>,
    private readonly userRepository: Repository<BaseUser>,
    private readonly challengeService?: ChallengeService,
    private readonly config?: NAuthConfig,
    private readonly logger?: NAuthLogger,
    private readonly auditService?: AuthAuditService,
    private readonly clientInfoService?: ClientInfoService,
  ) {}

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

    // Get provider and verify
    const provider = this.getProvider(dto.methodName);
    const isValid = await provider.verify(user, dto.code, dto.deviceId);
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
    // Look up user by sub
    const userEntity = await this.userRepository.findOne({ where: { sub: dto.sub } });
    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }
    const user = userEntity as unknown as IUser;

    const provider = this.getProvider(dto.methodName);
    const setupData = await provider.setup(user, dto.setupData);
    return {
      setupData: setupData as Record<string, unknown>,
    };
  }

  /**
   * Get user's MFA devices
   *
   * @param dto - Request DTO with user sub
   * @returns Response DTO with array of MFA devices
   *
   * @example
   * ```typescript
   * const result = await this.mfaService.getUserDevices({ sub: user.sub });
   * // Returns: { devices: [...] }
   * ```
   */
  async getUserDevices(dto: GetUserDevicesDTO): Promise<GetUserDevicesResponseDTO> {
    // Look up user by sub to get internal ID
    const userEntity = await this.userRepository.findOne({ where: { sub: dto.sub } });
    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Only fetch active devices (inactive devices are soft-deleted)
    const devices = await this.mfaDeviceRepository.find({
      where: { userId: userEntity.id, isActive: true },
      order: { createdAt: 'DESC' },
    } as Record<string, unknown>);

    return {
      devices: devices as unknown as IMFADevice[],
    };
  }

  /**
   * Get comprehensive MFA status for a user
   *
   * Returns complete MFA configuration status including:
   * - Whether MFA is enabled/required
   * - Configured and available methods
   * - Preferred method
   * - Backup codes status
   * - MFA exemption information
   *
   * This method encapsulates all business logic for MFA status,
   * ensuring consumer apps don't need to query databases or build responses manually.
   *
   * @param dto - Request DTO with user sub
   * @returns Response DTO with complete MFA status
   *
   * @example
   * ```typescript
   * @Get('mfa/status')
   * async getMFAStatus(@CurrentUser() user: IUser) {
   *   return await this.mfaService.getMFAStatus({ sub: user.sub });
   * }
   * ```
   */
  async getMFAStatus(dto: GetMFAStatusDTO): Promise<GetMFAStatusResponseDTO> {
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
      where: { sub: dto.sub },
    });

    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const enabled = userEntity.mfaEnabled || false;

    // Get available methods (all registered & allowed methods)
    const availableMethodsResult = await this.getAvailableMethods({ sub: dto.sub });

    // Add 'backup' to available methods if backup codes are enabled in config
    const finalAvailableMethods = [...availableMethodsResult.availableMethods];
    if (this.config?.mfa?.backup?.enabled) {
      if (!finalAvailableMethods.includes(MFAMethod.BACKUP)) {
        finalAvailableMethods.push(MFAMethod.BACKUP);
      }
    }

    // Get user's configured devices
    const devicesResult = await this.getUserDevices({ sub: dto.sub });
    const configuredMethods = [
      ...new Set(devicesResult.devices.filter((d) => d.isActive).map((d) => d.type)),
    ] as MFADeviceMethod[];

    // Determine if MFA is required based on config and user state
    const required = enabled && configuredMethods.length > 0;

    // Check backup codes
    const hasBackupCodes = !!userEntity.backupCodes && userEntity.backupCodes.length > 0;

    return {
      enabled,
      required,
      configuredMethods,
      availableMethods: finalAvailableMethods,
      hasBackupCodes,
      preferredMethod: userEntity.preferredMfaMethod as MFADeviceMethod | undefined,
      mfaExempt: userEntity.mfaExempt || false,
      mfaExemptReason: userEntity.mfaExemptReason || null,
      mfaExemptGrantedAt: userEntity.mfaExemptGrantedAt || null,
    };
  }

  /**
   * Remove MFA devices by method type
   *
   * Comprehensive method that handles all aspects of MFA device removal:
   * - Looks up user by sub (consumer apps should pass user.sub from @CurrentUser())
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
   * @param dto - Request DTO with user sub and method type
   * @returns Response DTO with deletedCount and whether MFA was disabled
   * @throws {NAuthException} If user not found, invalid method type, or no devices found
   *
   * @example
   * ```typescript
   * // Consumer app controller
   * @Delete('mfa/devices/:method')
   * async removeMFAMethod(@CurrentUser() user: IUser, @Param('method') method: string) {
   *   const result = await this.mfaService.removeDevices({ userSub: user.sub, methodType: method });
   *   return { message: 'MFA method removed successfully', ...result };
   * }
   * ```
   */
  async removeDevices(dto: RemoveDevicesDTO): Promise<RemoveDevicesResponseDTO> {
    // Validate method type
    const validMethods = [MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY];
    const normalizedMethod = dto.methodType.toLowerCase();
    if (!validMethods.includes(normalizedMethod as MFAMethod)) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Invalid MFA method: ${dto.methodType}. Valid methods are: ${validMethods.join(', ')}`,
      );
    }

    // Look up user by sub using repository directly (no AuthService dependency needed)
    const userEntity = await this.userRepository.findOne({ where: { sub: dto.userSub } });
    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User entity not found');
    }

    const userId = userEntity.id;
    if (!userId) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'User entity missing internal ID');
    }

    // Cast to IUser for type safety
    const user = userEntity as unknown as IUser;

    const preferredMethod = userEntity.preferredMfaMethod;
    const isPreferredMethod = preferredMethod === normalizedMethod;

    // Get all active devices for this user
    const devicesResult = await this.getUserDevices({ sub: dto.userSub });
    const activeDevices = devicesResult.devices.filter((d) => d.isActive);

    // Get devices of the method type to remove
    const devicesToRemove = activeDevices.filter((d) => d.type.toLowerCase() === normalizedMethod);

    if (devicesToRemove.length === 0) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `No active ${normalizedMethod} MFA devices found for this user`,
      );
    }

    // Delete all devices of this method type
    let deletedCount = 0;
    for (const device of devicesToRemove) {
      const result = await this.mfaDeviceRepository.delete(device.id);
      deletedCount += result.affected || 0;
    }

    // Check if any devices remain after removal
    const remainingDevicesResult = await this.getUserDevices({ sub: dto.userSub });
    const remainingActiveDevices = remainingDevicesResult.devices.filter((d) => d.isActive);
    let mfaDisabled = false;

    // If no active devices remain, disable MFA for user
    if (remainingActiveDevices.length === 0) {
      userEntity.mfaEnabled = false;
      userEntity.mfaMethods = [];
      userEntity.preferredMfaMethod = null;
      await this.userRepository.save(userEntity);
      mfaDisabled = true;

      // ============================================================================
      // Audit: Record MFA disabled (all devices removed)
      // ============================================================================
      if (this.auditService && this.clientInfoService) {
        try {
          await this.auditService?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.MFA_DISABLED,
            eventStatus: 'INFO',
            reason: 'all_devices_removed',
            description: 'MFA disabled - all devices removed',
            // Client info automatically included from context
            metadata: {
              removedMethod: normalizedMethod,
              deletedCount,
            },
          });
        } catch (auditError) {
          // Non-blocking: Log but continue
          const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
          this.logger?.error?.(`Failed to record MFA_DISABLED audit event: ${errorMessage}`, {
            error: auditError,
            userId: user.id,
          });
        }
      }

      // Automatically create MFA_SETUP_REQUIRED challenge if MFA enforcement requires it
      if (this.challengeService && this.config?.mfa?.enabled) {
        const enforcement = this.config.mfa.enforcement || 'OPTIONAL';
        if (enforcement === 'REQUIRED' || enforcement === 'ADAPTIVE') {
          const user = userEntity as unknown as IUser;
          try {
            // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
            await this.challengeService.createChallengeSession(user, AuthChallenge.MFA_SETUP_REQUIRED, {
              allowedMethods: this.config.mfa.allowedMethods || [],
              requiresSetup: true,
            });
            this.logger?.log?.(`Created MFA_SETUP_REQUIRED challenge for user ${user.sub} after MFA removal`);
          } catch (error) {
            // Log but don't fail the removal if challenge creation fails
            this.logger?.warn?.(`Failed to create MFA_SETUP_REQUIRED challenge after MFA removal: ${error}`);
          }
        }
      }
    } else {
      // Update mfaMethods array with remaining methods
      const remainingMethods = [...new Set(remainingActiveDevices.map((d) => d.type))];
      userEntity.mfaMethods = remainingMethods;

      // If the removed method was preferred, update preferred method and device primary flags
      if (isPreferredMethod) {
        const newPreferredMethod = remainingActiveDevices[0].type;
        userEntity.preferredMfaMethod = newPreferredMethod;
        await this.userRepository.save(userEntity);

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

        this.logger?.log?.(`Updated preferred MFA method to ${newPreferredMethod} after removing ${normalizedMethod}`);
      } else {
        // No preferred method change needed, just update mfaMethods
        await this.userRepository.save(userEntity);
      }
    }

    // ============================================================================
    // Audit: Record MFA device removal
    // ============================================================================
    if (deletedCount > 0 && this.auditService && this.clientInfoService) {
      try {
        const user = userEntity as unknown as IUser;
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.MFA_DEVICE_REMOVED,
          eventStatus: 'INFO',
          metadata: {
            method: normalizedMethod,
            deletedCount,
            remainingDevices: remainingActiveDevices.length,
            mfaDisabled,
          },
          // Client info automatically included from context
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record MFA_DEVICE_REMOVED audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
          method: normalizedMethod,
        });
      }
    }

    return { deletedCount, mfaDisabled };
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
   * @param dto - Request DTO with user sub and method type
   * @returns Response DTO with success message
   * @throws {NAuthException} If user not found, invalid method type, or method not configured
   *
   * @example
   * ```typescript
   * // Consumer app controller
   * @Put('mfa/preferred')
   * async setPreferredMFAMethod(@CurrentUser() user: IUser, @Body() body: { method: string }) {
   *   return await this.mfaService.setPreferredMethod({ userSub: user.sub, methodType: body.method });
   * }
   * ```
   */
  async setPreferredMethod(dto: SetPreferredMethodDTO): Promise<SetPreferredMethodResponseDTO> {
    // Validate method type
    const validMethods = [MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY];
    const normalizedMethod = dto.methodType.toLowerCase();
    if (!validMethods.includes(normalizedMethod as MFAMethod)) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Invalid MFA method: ${dto.methodType}. Valid methods are: ${validMethods.join(', ')}`,
      );
    }

    // Look up user by sub using repository directly (no AuthService dependency needed)
    const userEntity = await this.userRepository.findOne({ where: { sub: dto.userSub } });
    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const userId = userEntity.id;
    if (!userId) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'User entity missing internal ID');
    }

    // Cast to IUser for type safety
    const user = userEntity as unknown as IUser;

    // Verify user has this method configured
    const devicesResult = await this.getUserDevices({ sub: dto.userSub });
    // Normalize device types for comparison (database might store in different case)
    const preferredDevice = devicesResult.devices.find((d) => d.type.toLowerCase() === normalizedMethod && d.isActive);

    if (!preferredDevice) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `MFA method '${normalizedMethod}' is not configured for this user`,
      );
    }

    // Update user's preferred method directly via repository
    await this.userRepository.update(
      { id: userId },
      {
        preferredMfaMethod: normalizedMethod as MFADeviceMethod,
      },
    );

    // Update device isPrimary flags: set preferred device as primary, unset others
    const activeDevices = devicesResult.devices.filter((d) => d.isActive);
    for (const device of activeDevices) {
      await this.mfaDeviceRepository.update({ id: device.id }, { isPrimary: device.id === preferredDevice.id });
    }

    this.logger?.log?.(`Device ${preferredDevice.id} set as primary for user ${dto.userSub}`);

    // ============================================================================
    // Audit: Record preferred MFA method update
    // ============================================================================
    if (this.auditService && this.clientInfoService) {
      try {
        const previousMethod = userEntity.preferredMfaMethod;
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.MFA_PREFERRED_METHOD_UPDATED,
          eventStatus: 'INFO',
          metadata: {
            // Client info automatically included from context
            previousMethod: previousMethod || null,
            newMethod: normalizedMethod,
            deviceId: preferredDevice.id,
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record MFA_PREFERRED_METHOD_UPDATED audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
          method: normalizedMethod,
        });
      }
    }

    return {
      message: 'Preferred method updated',
    };
  }

  /**
   * Grant or revoke a user's exemption from multi-factor authentication (MFA) requirements.
   *
   * SECURITY: This admin-only operation updates the user's MFA exemption status, logs the action,
   * and records an audit event. MFA exemption bypasses MFA at login, but all other security controls remain enforced.
   *
   * @param dto - Request DTO with user sub, exempt flag, reason, and grantedBy
   * @returns Response DTO with updated exemption fields
   * @throws {NAuthException} If the user is not found
   *
   * @example
   * ```typescript
   * // Grant MFA exemption
   * await mfaService.setMFAExemption({
   *   userSub: 'user-uuid',
   *   exempt: true,
   *   reason: 'Business partner requires MFA bypass',
   *   grantedBy: 'admin@example.com'
   * });
   *
   * // Revoke MFA exemption
   * await mfaService.setMFAExemption({
   *   userSub: 'user-uuid',
   *   exempt: false,
   *   reason: 'MFA now mandatory for this user',
   *   grantedBy: 'admin@example.com'
   * });
   * ```
   */
  async setMFAExemption(dto: SetMFAExemptionDTO): Promise<SetMFAExemptionResponseDTO> {
    // Find user by sub (external identifier)
    const userEntity = await this.userRepository.findOne({ where: { sub: dto.userSub } });
    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const user = userEntity as unknown as IUser;

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
      this.logger?.warn?.(`MFA exemption revoked for user ${dto.userSub} - MFA setup will be required on next login`);
    }

    // Update user in database
    await this.userRepository.update(userEntity.id, updateFields);

    // Log the exemption change for audit trail
    this.logger?.log?.(`MFA exemption ${dto.exempt ? 'granted' : 'revoked'} for user ${dto.userSub}`, {
      userSub: dto.userSub,
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
    const result = await provider.setup(user, setupDataWithSession);

    this.logger?.debug?.(`MFA setup data generated: method=${dto.method}, user=${user.sub}`);

    return {
      setupData: result as Record<string, unknown>,
    };
  }

  /**
   * Get MFA challenge data during MFA_REQUIRED challenge
   *
   * Currently only used for passkey authentication to get WebAuthn options.
   * SMS/TOTP codes are sent automatically when the challenge is created.
   *
   * @param dto - Request DTO with session token and method
   * @returns Response DTO with provider-specific challenge data
   * @throws {NAuthException} INVALID_CHALLENGE_SESSION | VALIDATION_FAILED
   *
   * @example
   * ```typescript
   * const result = await mfaService.getChallengeData({
   *   session: 'session-token',
   *   method: 'passkey'
   * });
   * // Returns: { challengeData: { challenge: '...', allowCredentials: [...], ... } }
   * ```
   */
  async getChallengeData(dto: GetChallengeDataDTO): Promise<GetChallengeDataResponseDTO> {
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

    const challengeData = await provider.sendChallenge(user);

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
