import { Repository } from 'typeorm';
import { BaseMFADevice, BaseUser } from '../entities';
import { randomBytes } from 'crypto';
import { IUser, IMFADevice } from '../interfaces/entities.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { ClientInfoService } from './client-info.service';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { IMFAProviderService } from '../interfaces/mfa-provider.interface';
import { MFADeviceMethod, MFADeviceMethods } from '../enums/mfa-method.enum';
import { ChallengeService } from './challenge.service';
import { HookRegistryService } from './hook-registry.service';
import { ContextStorage } from '../utils/context-storage';

/**
 * Base MFA Provider Service
 *
 * Abstract base class that provides common functionality for all MFA providers.
 * Provider-specific services (TOTP, SMS, Passkey, etc.) should extend this class
 * and implement the IMFAProviderService interface methods.
 *
 * This base class handles:
 * - Device repository access
 * - User repository access
 * - Common device management operations
 * - Backup codes generation and verification
 * - MFA enforcement checks
 * - Helper methods
 *
 * **Key Design:**
 * - No hardcoded method names - works with any provider
 * - Provider config accessed dynamically via `methodName`
 * - Future developers can add new providers without modifying this class
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class TOTPMFAProviderService extends BaseMFAProviderService implements IMFAProviderService {
 *   readonly methodName = 'totp';
 *
 *   constructor(
 *     // ... base dependencies injected via super()
 *     private readonly totpService: TOTPService,
 *   ) {
 *     super(/* ... base dependencies *\/);
 *   }
 *
 *   async setup(user: IUser): Promise<unknown> {
 *     // TOTP-specific setup logic
 *   }
 *
 *   async verify(user: IUser, code: unknown): Promise<boolean> {
 *     // TOTP verification logic
 *   }
 * }
 * ```
 */
export abstract class BaseMFAProviderService implements IMFAProviderService {
  abstract readonly methodName: string;

  constructor(
    protected readonly mfaDeviceRepository: Repository<BaseMFADevice>,
    protected readonly userRepository: Repository<BaseUser>,
    protected readonly config: NAuthConfig,
    protected readonly logger: NAuthLogger,
    protected readonly passwordService?: unknown, // Optional - from @nauth-toolkit/core
    protected readonly challengeService?: ChallengeService,
    protected readonly auditService?: AuthAuditService,
    protected readonly clientInfoService?: ClientInfoService,
    protected readonly hookRegistry?: HookRegistryService,
  ) {}

  /**
   * Check if this MFA method is allowed by configuration
   *
   * @returns True if method is allowed
   */
  isMethodAllowed(): boolean {
    const allowedMethods = this.config.mfa?.allowedMethods || [...MFADeviceMethods];
    return allowedMethods.includes(this.methodName as MFADeviceMethod);
  }

  // ============================================================================
  // Context helpers
  // ============================================================================

  /**
   * Resolve the current authenticated user from request context.
   *
   * Security: MFA providers must never accept user identity from consumer apps.
   * The user is derived from request-scoped context (AuthGuard / adapter sets CURRENT_USER).
   *
   * @returns Current authenticated user
   * @throws {NAuthException} FORBIDDEN when user context is missing
   */
  protected getCurrentUserOrThrow(): IUser {
    const currentUser = ContextStorage.get<IUser>('CURRENT_USER');
    if (!currentUser) {
      throw new NAuthException(AuthErrorCode.FORBIDDEN, 'Authentication required');
    }
    return currentUser;
  }

  // Abstract methods to be implemented by providers
  abstract setup(setupData?: unknown): Promise<unknown>;
  abstract verifySetup(verificationData: unknown, deviceName?: string): Promise<number>;
  abstract verify(code: unknown, deviceId?: number): Promise<boolean>;
  // sendChallenge is optional - only providers like SMS need it
  // TOTP doesn't need it (user generates code locally)

  // ============================================================================
  // Device Management (Common Logic)
  // ============================================================================

  /**
   * Get user's MFA devices
   *
   * @param userId - Internal user ID
   * @returns Array of MFA devices
   *
   * @protected
   */
  protected async getUserDevices(userId: number): Promise<IMFADevice[]> {
    const devices = await this.mfaDeviceRepository.find({
      where: { userId },
      order: { isPrimary: 'DESC', createdAt: 'DESC' },
    } as Record<string, unknown>);

    return devices as unknown as IMFADevice[];
  }

  /**
   * Create MFA device for user
   *
   * Creates a new MFA device with transaction safety.
   *
   * NAuth supports multiple devices per MFA method (e.g., multiple TOTP apps, multiple passkeys).
   * Some methods still behave like singletons (e.g., SMS/Email) and should enable de-duplication
   * explicitly via the `options.dedupeWhere` parameter.
   *
   * **Race Condition Prevention:**
   * - Optionally checks for an existing device before creation (provider-controlled)
   * - Wraps in transaction with pessimistic write lock on user row
   * - Database unique constraint provides final safety net
   *
   * **Transaction Flow:**
   * 1. Lock user row (prevents concurrent MFA setup)
   * 2. (Optional) Check for existing device matching de-duplication criteria
   * 3. Create device if none exists / de-dup disabled
   * 4. Update user MFA flags
   * 5. Commit transaction
   *
   * @param userId - Internal user ID
   * @param deviceData - Device data to create
   * @param options - Optional creation options (e.g., de-duplication criteria)
   * @returns Created device (or existing device if already present)
   * @protected
   *
   * @example
   * ```typescript
   * const device = await this.createDevice(user.id, {
   *   name: 'SMS Phone',
   *   phoneNumber: '+1234567890',
   *   isActive: true,
   *   isPrimary: !user.mfaEnabled,
   * });
   * ```
   */
  protected async createDevice(
    userId: number,
    deviceData: Partial<IMFADevice>,
    options?: {
      /**
       * Optional de-duplication criteria.
       *
       * - When provided (even as an empty object), `createDevice` will first attempt to find an
       *   existing device for this user/method and return it.
       * - Providers can add method-specific keys (e.g., `{ credentialId }` for passkeys).
       *
       * SECURITY: Only use stable identifiers here (never secrets).
       *
       * @example { credentialId: 'base64url-credential-id' }
       */
      dedupeWhere?: Record<string, unknown>;
    },
  ): Promise<IMFADevice> {
    // ============================================================================
    // Transaction-Safe Device Creation with Race Condition Prevention
    // ============================================================================
    // Use TypeORM transaction manager to ensure atomicity across all database adapters
    // Pessimistic write lock prevents concurrent MFA device creation for same user
    const device = await this.userRepository.manager.transaction(async (transactionalEntityManager) => {
      // Step 1: Lock user row to prevent concurrent MFA setup
      // This works across MySQL and PostgreSQL (TypeORM translates to FOR UPDATE)
      await transactionalEntityManager
        .createQueryBuilder()
        .select('user.id')
        .from(this.userRepository.target, 'user')
        .where('user.id = :userId', { userId })
        .setLock('pessimistic_write')
        .getOne();

      const shouldDedupe = options && options.dedupeWhere !== undefined;
      const dedupeWhere = options?.dedupeWhere ?? {};

      const findExistingDevice = async (): Promise<IMFADevice | null> => {
        if (!shouldDedupe) {
          return null;
        }

        const qb = transactionalEntityManager
          .getRepository(this.mfaDeviceRepository.target)
          .createQueryBuilder('device')
          .where('device.userId = :userId', { userId })
          .andWhere('device.type = :type', { type: this.methodName });

        // Provider-supplied de-duplication keys (e.g., credentialId for passkeys).
        for (const [key, value] of Object.entries(dedupeWhere)) {
          if (value === undefined) {
            continue;
          }
          qb.andWhere(`device.${key} = :${key}`, { [key]: value });
        }

        const existing = await qb.getOne();
        return existing ? (existing as unknown as IMFADevice) : null;
      };

      // Step 2 (Optional): De-duplication within transaction (provider-controlled)
      const existingDevice = await findExistingDevice();
      if (existingDevice) {
        this.logger?.log?.(`MFA device already exists for user ${userId} (method='${this.methodName}'), reusing it`);
        return existingDevice;
      }

      // Step 3: Create new device
      const newDevice = transactionalEntityManager.getRepository(this.mfaDeviceRepository.target).create({
        userId,
        type: this.methodName,
        ...deviceData,
      } as Record<string, unknown>);

      // Step 4: Save device (DB constraints provide final safety net)
      const isUniqueConstraintViolation = (error: unknown): boolean => {
        if (!error || typeof error !== 'object') {
          return false;
        }
        const err = error as { code?: unknown; errno?: unknown };
        const code = typeof err.code === 'string' ? err.code : undefined;
        const errno = typeof err.errno === 'number' ? err.errno : undefined;

        // PostgreSQL: unique_violation = 23505
        if (code === '23505') {
          return true;
        }

        // MySQL: ER_DUP_ENTRY / errno 1062
        if (code === 'ER_DUP_ENTRY' || errno === 1062) {
          return true;
        }

        return false;
      };

      let saved: IMFADevice;
      try {
        saved = (await transactionalEntityManager
          .getRepository(this.mfaDeviceRepository.target)
          .save(newDevice)) as unknown as IMFADevice;
      } catch (error: unknown) {
        // If a concurrent request created the same device, attempt to re-fetch and return it.
        if (shouldDedupe && isUniqueConstraintViolation(error)) {
          const concurrentDevice = await findExistingDevice();
          if (concurrentDevice) {
            this.logger?.warn?.(
              `MFA device create hit a uniqueness constraint but existing device was found (method='${this.methodName}', userId=${userId})`,
            );
            return concurrentDevice;
          }
        }
        throw error;
      }

      this.logger?.log?.(`Created new MFA device: type='${this.methodName}', userId=${userId}, deviceId=${saved.id}`);

      return saved;
    });

    // ============================================================================
    // Audit: Record MFA device added
    // ============================================================================
    if (this.auditService && this.clientInfoService) {
      try {
        await this.auditService.recordEvent({
          userId,
          eventType: AuthAuditEventType.MFA_DEVICE_ADDED,
          eventStatus: 'SUCCESS',
          metadata: {
            // Client info automatically included from context
            mfaMethod: this.methodName,
            deviceId: device.id,
            deviceName: device.name,
            isPrimary: device.isPrimary,
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record MFA_DEVICE_ADDED audit event: ${errorMessage}`, {
          error: auditError,
          userId,
          methodName: this.methodName,
        });
      }
    }

    return device;
  }

  /**
   * Find active device for user by method
   *
   * @param userId - Internal user ID
   * @param deviceId - Optional device ID
   * @returns Device if found, null otherwise
   * @protected
   */
  protected async findDevice(userId: number, deviceId?: number): Promise<IMFADevice | null> {
    const where: Record<string, unknown> = {
      userId,
      type: this.methodName,
      isActive: true,
    };

    if (deviceId) {
      where.id = deviceId;
    }

    const device = await this.mfaDeviceRepository.findOne({
      where,
      order: { isPrimary: 'DESC', lastUsedAt: 'DESC' },
    } as Record<string, unknown>);

    return device ? (device as unknown as IMFADevice) : null;
  }

  /**
   * Update device usage statistics
   *
   * @param deviceId - Device ID
   * @protected
   */
  protected async updateDeviceUsage(deviceId: number): Promise<void> {
    const device = await this.mfaDeviceRepository.findOne({ where: { id: deviceId } });
    if (device) {
      device.lastUsedAt = new Date();
      device.usageCount = (device.usageCount || 0) + 1;
      await this.mfaDeviceRepository.save(device);
    }
  }

  /**
   * Enable MFA for user
   *
   * Sets mfaEnabled flag and updates mfaMethods array.
   * Called automatically when first device is registered.
   * Automatically clears MFA_SETUP_REQUIRED challenges if they exist.
   *
   * @param user - User to enable MFA for
   * @protected
   */
  protected async enableMFAForUser(user: IUser): Promise<void> {
    // Reload user from database to ensure we have the latest state
    // This prevents overwriting fields like isPhoneVerified that may have been updated
    // between when the user object was loaded and when MFA is enabled
    const userId = (user as unknown as Record<string, unknown>).id as number;
    const userEntity = await this.userRepository.findOne({ where: { id: userId } });
    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found when enabling MFA');
    }

    const userEntityRecord = userEntity as unknown as Record<string, unknown>;
    const isFirstDevice = !userEntityRecord.mfaEnabled;
    const previousMethods = Array.isArray(userEntityRecord.mfaMethods)
      ? (userEntityRecord.mfaMethods as unknown as string[])
      : [];

    if (!userEntityRecord.mfaEnabled) {
      userEntityRecord.mfaEnabled = true;
      userEntityRecord.mfaEnforcedAt = new Date();
    }

    // Update mfaMethods array
    const devices = await this.getUserDevices(userId);
    const methods = [...new Set(devices.filter((d) => d.isActive).map((d) => d.type))];
    const newlyAddedMethods = methods.filter((m) => !previousMethods.includes(m));
    userEntityRecord.mfaMethods = methods;

    // Set preferred method if not set
    if (!userEntityRecord.preferredMfaMethod && methods.length > 0) {
      const primaryDevice = devices.find((d) => d.isPrimary && d.isActive);
      userEntityRecord.preferredMfaMethod = primaryDevice?.type || methods[0];
    }

    await this.userRepository.save(userEntity);

    // ============================================================================
    // Lifecycle Hook: MFA Method Added (additional methods only)
    // ============================================================================
    // This complements (and avoids duplicating) the "first enabled" hook:
    // - First ever method → `executeMFAFirstEnabled`
    // - Subsequent new method → `executeMFAMethodAdded`
    if (!isFirstDevice && newlyAddedMethods.length > 0 && this.hookRegistry && this.clientInfoService) {
      try {
        const clientInfo = this.clientInfoService.get();
        for (const method of newlyAddedMethods) {
          await this.hookRegistry.executeMFAMethodAdded({
            user: userEntity as unknown as IUser,
            method: method as import('../enums/mfa-method.enum').MFADeviceMethod,
            isFirstMethod: false,
            enabledMethods: methods as unknown as import('../enums/mfa-method.enum').MFADeviceMethod[],
            timestamp: new Date(),
            clientInfo: {
              ipAddress: clientInfo.ipAddress,
              userAgent: clientInfo.userAgent,
              ipCountry: clientInfo.ipCountry,
              ipCity: clientInfo.ipCity,
            },
          });
        }
      } catch (hookError) {
        // Non-blocking: Log but continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(`Failed to execute mfaMethodAdded hooks: ${errorMessage}`, {
          error: hookError,
          userId: user.id,
          methodName: this.methodName,
        });
      }
    }

    // If this is the first MFA device being set up, clear any MFA_SETUP_REQUIRED challenges
    // This prevents phantom challenges when user sets up MFA while logged in
    // if (isFirstDevice && this.challengeService) {
    //   try {
    //     await this.challengeService.deleteUserChallengeSessions(userId, AuthChallenge.MFA_SETUP_REQUIRED);
    //     this.logger?.log?.(`Cleared MFA_SETUP_REQUIRED challenge for user ${user.sub} after MFA setup`);
    //   } catch (error) {
    //     // Log but don't fail MFA setup if challenge clearing fails
    //     this.logger?.warn?.(`Failed to clear MFA_SETUP_REQUIRED challenge after MFA setup: ${error}`);
    //   }
    // }

    // ============================================================================
    // Audit: Record MFA enabled (only for first device)
    // ============================================================================
    if (isFirstDevice && this.auditService && this.clientInfoService) {
      try {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.MFA_ENABLED,
          eventStatus: 'SUCCESS',
          metadata: {
            // Client info automatically included from context
            mfaMethod: this.methodName,
            mfaMethods: methods,
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record MFA_ENABLED audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
          methodName: this.methodName,
        });
      }
    }

    // ============================================================================
    // Lifecycle Hook: MFA First Enabled (only for first device)
    // ============================================================================
    if (isFirstDevice && this.hookRegistry && this.clientInfoService) {
      try {
        const clientInfo = this.clientInfoService.get();
        await this.hookRegistry.executeMFAFirstEnabled({
          user: userEntity as unknown as IUser,
          firstMethod: this.methodName as import('../enums/mfa-method.enum').MFADeviceMethod,
          enforcedAt: new Date(),
          clientInfo: {
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
            ipCountry: clientInfo.ipCountry,
            ipCity: clientInfo.ipCity,
          },
        });
      } catch (hookError) {
        // Non-blocking: Log but continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(`Failed to execute mfaFirstEnabled hooks: ${errorMessage}`, {
          error: hookError,
          userId: user.id,
          methodName: this.methodName,
        });
      }
    }
  }

  // ============================================================================
  // Backup Codes (Common Logic)
  // ============================================================================

  /**
   * Generate backup codes for user
   *
   * Creates single-use recovery codes that can be used when MFA devices are unavailable.
   * Exposed as optional method in IMFAProviderService interface.
   *
   * @param user - User to generate codes for
   * @returns Generated backup codes (plain text - shown only once)
   */
  async generateBackupCodes(): Promise<string[]> {
    const user = this.getCurrentUserOrThrow();
    const userEntity = user as unknown as Record<string, unknown>;
    const config = this.config.mfa?.backup;
    const codeCount = config?.codeCount || 10;
    const codeLength = config?.codeLength || 8;

    // Generate random codes
    const codes: string[] = [];
    for (let i = 0; i < codeCount; i++) {
      const code = this.generateRandomCode(codeLength);
      codes.push(code);
    }

    // Check if password service is available
    if (!this.passwordService || typeof (this.passwordService as Record<string, unknown>).hashPassword !== 'function') {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Password service is not available');
    }

    // Hash codes for storage
    const passwordService = this.passwordService as { hashPassword: (password: string) => Promise<string> };
    const hashedCodes = await Promise.all(codes.map((code) => passwordService.hashPassword(code)));

    // Store hashed codes
    userEntity.backupCodes = hashedCodes;
    await this.userRepository.save(userEntity);

    this.logger?.log?.(`Generated ${codeCount} backup codes for user: ${user.sub}`);

    // ============================================================================
    // Audit: Record backup codes generation
    // ============================================================================
    if (this.auditService && this.clientInfoService) {
      try {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.MFA_BACKUP_CODES_GENERATED,
          eventStatus: 'INFO',
          metadata: {
            // Client info automatically included from context
            codeCount,
            codeLength,
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record MFA_BACKUP_CODES_GENERATED audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
        });
      }
    }

    return codes;
  }

  /**
   * Verify backup code
   *
   * Validates backup code and removes it after use (single-use).
   *
   * @param user - User being authenticated
   * @param code - Backup code to verify
   * @returns True if code is valid
   * @protected
   */
  protected async verifyBackupCode(user: IUser, code: string): Promise<boolean> {
    const userEntity = user as unknown as Record<string, unknown>;

    const backupCodes = userEntity.backupCodes as string[] | undefined;
    if (!backupCodes || backupCodes.length === 0) {
      this.logger?.warn?.('No backup codes available');
      return false;
    }

    // Check if password service is available
    if (
      !this.passwordService ||
      typeof (this.passwordService as Record<string, unknown>).verifyPassword !== 'function'
    ) {
      this.logger?.warn?.('Backup code verification attempted but password service is not available');
      return false;
    }

    // Check code against all stored hashed codes
    const passwordService = this.passwordService as {
      verifyPassword: (plain: string, hash: string) => Promise<boolean>;
    };
    for (let i = 0; i < backupCodes.length; i++) {
      const isValid = await passwordService.verifyPassword(code, backupCodes[i]);
      if (isValid) {
        // Remove used code
        backupCodes.splice(i, 1);
        userEntity.backupCodes = backupCodes;
        await this.userRepository.save(userEntity);

        this.logger?.log?.(`Backup code verified and removed for user: ${user.sub}`);

        // ============================================================================
        // Audit: Record backup code usage
        // ============================================================================
        if (this.auditService && this.clientInfoService) {
          try {
            await this.auditService?.recordEvent({
              userId: user.id,
              eventType: AuthAuditEventType.MFA_BACKUP_CODE_USED,
              eventStatus: 'SUCCESS',
              authMethod: 'backup',
              metadata: {
                // Client info automatically included from context
                remainingCodes: backupCodes.length,
              },
            });
          } catch (auditError) {
            // Non-blocking: Log but continue
            const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
            this.logger?.error?.(`Failed to record MFA_BACKUP_CODE_USED audit event: ${errorMessage}`, {
              error: auditError,
              userId: user.id,
            });
          }
        }

        return true;
      }
    }

    this.logger?.warn?.('Backup code verification failed');
    return false;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate random alphanumeric code
   *
   * @param length - Code length
   * @returns Random code
   * @protected
   */
  protected generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous characters
    let code = '';
    const bytes = randomBytes(length);
    for (let i = 0; i < length; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  /**
   * Mask phone number for display
   *
   * @param phone - Phone number
   * @returns Masked phone number
   * @protected
   */
  protected maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return phone;
    return `***-***-${digits.slice(-4)}`;
  }

  /**
   * Mask email address for display
   *
   * Masks the local part of the email while showing the domain.
   * Example: user@example.com → u***r@example.com
   *
   * @param email - Email address
   * @returns Masked email address
   * @protected
   *
   * @example
   * ```typescript
   * const masked = this.maskEmail('user@example.com');
   * // Returns: 'u***r@example.com'
   * ```
   */
  protected maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
  }

  /**
   * Check if MFA is required for a user
   *
   * Determines MFA requirement based on:
   * - User-level MFA exemption (admin override)
   * - Global enforcement policy (OPTIONAL, REQUIRED, ADAPTIVE)
   * - Grace period for REQUIRED enforcement
   * - User's MFA enrollment date
   *
   * ADAPTIVE enforcement currently behaves like REQUIRED (placeholder for future risk-based logic)
   *
   * @param user - User to check
   * @returns True if MFA is required
   * @protected
   */
  protected async isMFARequired(user: IUser): Promise<boolean> {
    // ============================================================================
    // SECURITY: Check user-level MFA exemption FIRST
    // ============================================================================
    // Exemption allows bypassing MFA requirements
    // This is checked early to ensure exempt users can always login
    // Handle different database representations (boolean true, MySQL tinyint 1, etc.)
    const mfaExempt = user.mfaExempt;
    // Check for boolean true (handle numeric 1 case at runtime if needed)
    if (mfaExempt === true || (mfaExempt as unknown) === 1) {
      return false;
    }

    const mfaConfig = this.config.mfa;

    if (!mfaConfig?.enabled) {
      return false;
    }

    const enforcement = mfaConfig.enforcement || 'OPTIONAL';

    if (enforcement === 'OPTIONAL') {
      return false;
    }

    if (enforcement === 'REQUIRED' || enforcement === 'ADAPTIVE') {
      // Check grace period
      const gracePeriod = mfaConfig.gracePeriod || 7;
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() - gracePeriod);

      // If user has enrolled in MFA, check if they're within grace period
      const userWithDates = user as IUser & { mfaEnforcedAt?: Date; createdAt: Date };
      if (userWithDates.mfaEnforcedAt) {
        return userWithDates.mfaEnforcedAt <= gracePeriodEnd;
      }

      // User hasn't enrolled - check account creation date
      if (userWithDates.createdAt) {
        return userWithDates.createdAt <= gracePeriodEnd;
      }

      // No dates available - require MFA immediately
      return true;
    }

    return false;
  }
}
