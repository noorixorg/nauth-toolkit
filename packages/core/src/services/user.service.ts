import { Repository } from 'typeorm';
import { IUser } from '../interfaces/entities.interface';
import {
  BaseUser,
  BaseMFADevice,
  BaseChallengeSession,
  BaseVerificationToken,
  BaseSocialAccount,
  BaseAuthAudit,
  BaseTrustedDevice,
  BaseSession,
  BaseLoginAttempt,
} from '../entities';
import { SessionService } from './session.service';
import { ClientInfoService } from './client-info.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { HookRegistryService } from './hook-registry.service';
import { EmailVerificationService } from './email-verification.service';
import { ChallengeService } from './challenge.service';
import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { AccountLockoutStorageService } from '../storage/account-lockout-storage.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { MFAMethod } from '../enums/mfa-method.enum';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { GetUsersDTO, GetUsersResponseDTO } from '../dto/get-users.dto';
import { GetUserByIdDTO } from '../dto/get-user-by-id.dto';
import { GetUserByEmailDTO } from '../dto/get-user-by-email.dto';
import { AdminUpdateUserAttributesDTO } from '../dto/admin-update-user-attributes.dto';
import { UpdateVerifiedStatusRequestDTO } from '../dto/update-verified-status-request.dto';
import { DeleteUserDTO, DeleteUserResponseDTO } from '../dto/delete-user.dto';
import { DisableUserDTO, DisableUserResponseDTO } from '../dto/disable-user.dto';
import { EnableUserDTO, EnableUserResponseDTO } from '../dto/enable-user.dto';
import { SetMustChangePasswordDTO } from '../dto/set-must-change-password.dto';
import { SetMustChangePasswordResponseDTO } from '../dto/set-must-change-password-response.dto';
import { UserResponseDTO } from '../dto/user-response.dto';
import { ensureValidatedDto } from '../utils/dto-validator';
import { AuthServiceInternalHelpers } from './auth-service-internal-helpers';

/**
 * Internal user data management service
 *
 * Handles all user storage, query, and lifecycle operations.
 * This class is NOT exported from the package and should only be used
 * internally by AuthService.
 *
 * INTERNAL USE ONLY - DO NOT IMPORT DIRECTLY
 *
 * @internal
 */
export class UserService {
  private readonly helpers: AuthServiceInternalHelpers;

  constructor(
    private readonly userRepository: Repository<BaseUser>,
    private readonly loginAttemptRepository: Repository<BaseLoginAttempt>,
    private readonly sessionService: SessionService,
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
    private readonly mfaDeviceRepository?: Repository<BaseMFADevice>,
    private readonly auditService?: AuthAuditService,
    private readonly hookRegistry?: HookRegistryService,
    private readonly clientInfoService: ClientInfoService = new ClientInfoService(),
    // Optional repositories for cascade deletion
    private readonly sessionRepository?: Repository<BaseSession>,
    private readonly verificationTokenRepository?: Repository<BaseVerificationToken>,
    private readonly socialAccountRepository?: Repository<BaseSocialAccount>,
    private readonly challengeSessionRepository?: Repository<BaseChallengeSession>,
    private readonly authAuditRepository?: Repository<BaseAuthAudit>,
    private readonly trustedDeviceRepository?: Repository<BaseTrustedDevice>,
    // Dependencies for helpers (needed for validateUniquenessConstraints)
    helpers?: AuthServiceInternalHelpers,
  ) {
    // Initialize helpers if provided, otherwise create a minimal one for validateUniquenessConstraints
    if (helpers) {
      this.helpers = helpers;
    } else {
      // Create minimal helpers just for validateUniquenessConstraints
      // This is a workaround - ideally we'd pass helpers from AuthService
      // We use type assertions here because we're creating a minimal instance
      // that only needs userRepository for validateUniquenessConstraints
      this.helpers = new AuthServiceInternalHelpers(
        userRepository,
        loginAttemptRepository,
        undefined as unknown as EmailVerificationService, // emailVerificationService - unused in validateUniquenessConstraints
        undefined, // phoneVerificationService
        undefined as unknown as ChallengeService, // challengeService - unused in validateUniquenessConstraints
        undefined as unknown as AuthChallengeHelperService, // challengeHelper - unused in validateUniquenessConstraints
        clientInfoService,
        sessionService,
        undefined as unknown as AccountLockoutStorageService, // accountLockoutStorage - unused in validateUniquenessConstraints
        config,
        logger,
        undefined as unknown as HookRegistryService, // hookRegistry - unused in validateUniquenessConstraints
      );
    }

    this.logger?.log?.('UserService initialized');
  }

  // ============================================================================
  // User Query Operations
  // ============================================================================

  /**
   * Get paginated list of users with advanced filtering
   *
   * Supports pagination, boolean filters, exact match filters,
   * date filters with operators (gt, gte, lt, lte, eq), and flexible sorting.
   *
   * Security:
   * - NO built-in authentication - endpoint MUST be protected by admin guards
   * - Returns sanitized user data (no passwordHash, secrets)
   *
   * @param dto - Filters, pagination, sorting
   * @returns Paginated user list with metadata
   *
   * @example
   * ```typescript
   * const result = await userService.getUsers({
   *   page: 1,
   *   limit: 20,
   *   isEmailVerified: true,
   *   hasSocialAuth: true,
   *   createdAt: { operator: 'gte', value: new Date('2024-01-01') },
   *   sortBy: 'createdAt',
   *   sortOrder: 'DESC'
   * });
   * ```
   */
  async getUsers(dto: GetUsersDTO): Promise<GetUsersResponseDTO> {
    // Ensure DTO is validated
    dto = await ensureValidatedDto(GetUsersDTO, dto);

    this.logger?.debug?.(`Admin getUsers initiated with filters: ${JSON.stringify(dto)}`);

    // ============================================================================
    // Build Query with Filters
    // ============================================================================
    const qb = this.userRepository.createQueryBuilder('user');

    // Apply partial match filters (email and phone) - case-insensitive
    // Using LOWER() for cross-database compatibility (works on both MySQL and PostgreSQL)
    if (dto.email) {
      qb.andWhere('LOWER(user.email) LIKE LOWER(:email)', { email: `%${dto.email}%` });
    }

    if (dto.phone) {
      qb.andWhere('LOWER(user.phone) LIKE LOWER(:phone)', { phone: `%${dto.phone}%` });
    }

    // Apply boolean filters
    if (dto.isEmailVerified !== undefined) {
      qb.andWhere('user.isEmailVerified = :isEmailVerified', { isEmailVerified: dto.isEmailVerified });
    }

    if (dto.isPhoneVerified !== undefined) {
      qb.andWhere('user.isPhoneVerified = :isPhoneVerified', { isPhoneVerified: dto.isPhoneVerified });
    }

    if (dto.hasSocialAuth !== undefined) {
      qb.andWhere('user.hasSocialAuth = :hasSocialAuth', { hasSocialAuth: dto.hasSocialAuth });
    }

    if (dto.isLocked !== undefined) {
      qb.andWhere('user.isLocked = :isLocked', { isLocked: dto.isLocked });
    }

    if (dto.mfaEnabled !== undefined) {
      qb.andWhere('user.mfaEnabled = :mfaEnabled', { mfaEnabled: dto.mfaEnabled });
    }

    // Apply date filters with operators
    if (dto.createdAt) {
      const { operator, value } = dto.createdAt;
      if (operator === 'gt') {
        qb.andWhere('user.createdAt > :createdAtValue', { createdAtValue: value });
      } else if (operator === 'gte') {
        qb.andWhere('user.createdAt >= :createdAtValue', { createdAtValue: value });
      } else if (operator === 'lt') {
        qb.andWhere('user.createdAt < :createdAtValue', { createdAtValue: value });
      } else if (operator === 'lte') {
        qb.andWhere('user.createdAt <= :createdAtValue', { createdAtValue: value });
      } else if (operator === 'eq') {
        qb.andWhere('user.createdAt = :createdAtValue', { createdAtValue: value });
      }
    }

    if (dto.updatedAt) {
      const { operator, value } = dto.updatedAt;
      if (operator === 'gt') {
        qb.andWhere('user.updatedAt > :updatedAtValue', { updatedAtValue: value });
      } else if (operator === 'gte') {
        qb.andWhere('user.updatedAt >= :updatedAtValue', { updatedAtValue: value });
      } else if (operator === 'lt') {
        qb.andWhere('user.updatedAt < :updatedAtValue', { updatedAtValue: value });
      } else if (operator === 'lte') {
        qb.andWhere('user.updatedAt <= :updatedAtValue', { updatedAtValue: value });
      } else if (operator === 'eq') {
        qb.andWhere('user.updatedAt = :updatedAtValue', { updatedAtValue: value });
      }
    }

    // ============================================================================
    // Apply Sorting
    // ============================================================================
    const sortBy = dto.sortBy || 'createdAt';
    const sortOrder = dto.sortOrder || 'DESC';
    qb.orderBy(`user.${sortBy}`, sortOrder);

    // ============================================================================
    // Apply Pagination
    // ============================================================================
    const page = dto.page || 1;
    const limit = dto.limit || 10;
    qb.skip((page - 1) * limit).take(limit);

    // Execute query
    const [users, total] = await qb.getManyAndCount();
    this.logger?.debug?.(`Found ${users.length} users (total: ${total}) with filters`);

    // Sanitize user data
    const sanitizedUsers = users.map((user) => UserResponseDTO.fromEntity(user as unknown as IUser));

    return {
      users: sanitizedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by external identifier (sub/UUID).
   *
   * @param dto - GetUserByIdDTO containing sub
   * @returns User response DTO or null if not found
   *
   * @example
   * ```typescript
   * const user = await userService.getUserById({ sub: 'user-uuid' });
   * ```
   */
  async getUserById(dto: GetUserByIdDTO): Promise<UserResponseDTO | null> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(GetUserByIdDTO, dto);

    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    return user ? UserResponseDTO.fromEntity(user) : null;
  }

  /**
   * Get user by email address.
   *
   * @param dto - GetUserByEmailDTO containing email and optional requireEmailVerified
   * @returns User response DTO or null if not found
   * @internal - For use by social auth providers
   *
   * @example
   * ```typescript
   * const user = await userService.getUserByEmail({ email: 'user@example.com', requireEmailVerified: true });
   * ```
   */
  async getUserByEmail(dto: GetUserByEmailDTO): Promise<UserResponseDTO | null> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(GetUserByEmailDTO, dto);

    const where: Record<string, unknown> = dto.requireEmailVerified
      ? { email: dto.email, isEmailVerified: true }
      : { email: dto.email };
    const user = (await this.userRepository.findOne({ where })) as IUser | null;
    return user ? UserResponseDTO.fromEntity(user) : null;
  }

  /**
   * Get user for authentication context
   *
   * Loads user by sub (external identifier) with all fields needed for auth context.
   * Computes hasPasswordHash from passwordHash, then removes passwordHash and other sensitive fields.
   *
   * This method is used by AuthHandler and AuthGuard to load authenticated users.
   * It ensures consistent user object shape across platforms (core + NestJS).
   *
   * @param sub - External user identifier (UUID)
   * @returns User object with hasPasswordHash flag, without sensitive fields
   * @throws {NAuthException} If user not found or account is inactive
   *
   * @example
   * ```typescript
   * const user = await userService.getUserForAuthContext('user-uuid-123');
   * // user.hasPasswordHash === true/false
   * // user.passwordHash === undefined (removed)
   * ```
   */
  async getUserForAuthContext(sub: string): Promise<IUser> {
    // ============================================================================
    // Hot-path user context load (PERFORMANCE + SECURITY)
    // ============================================================================
    // WHY:
    // - This method runs on many authenticated requests (AuthGuard/AuthHandler).
    // - Some user columns are large and/or highly sensitive (e.g., backup codes, TOTP secrets, password history).
    // - Selecting those fields on every request increases DB payload + deserialization cost and expands the
    //   in-memory exposure surface without providing value for request auth context.
    //
    // NOTE:
    // - We still select `passwordHash` only to compute `hasPasswordHash`, then we delete it before returning.
    const user = await this.userRepository.findOne({
      where: { sub },
      select: {
        id: true,
        sub: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        passwordHash: true, // Needed to compute hasPasswordHash; removed before returning
        passwordChangedAt: true,
        mustChangePassword: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        isLocked: true,
        lockReason: true,
        lockedAt: true,
        lockedUntil: true,
        failedLoginAttempts: true,
        lastFailedLoginAt: true,
        lastLoginAt: true,
        lastLoginIp: true,
        mfaEnabled: true,
        mfaMethods: true,
        mfaEnforcedAt: true,
        preferredMfaMethod: true,
        mfaExempt: true,
        mfaExemptReason: true,
        mfaExemptGrantedAt: true,
        mfaExemptGrantedBy: true,
        hasSocialAuth: true,
        socialProviders: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        // Intentionally NOT selecting: totpSecret, backupCodes, passwordHistory
      },
    });

    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    if (!user.isActive) {
      throw new NAuthException(AuthErrorCode.ACCOUNT_INACTIVE, 'Account is not active');
    }

    // CRITICAL: The @AfterLoad hook computes hasPasswordHash but doesn't delete passwordHash anymore
    // Use the computed value from the hook, or compute it from passwordHash if hook didn't run
    const userWithPassword = user as IUser & { passwordHash?: string | null };
    const hasPasswordHash =
      user.hasPasswordHash !== undefined ? user.hasPasswordHash : Boolean(userWithPassword.passwordHash);

    // Create safe user object without sensitive fields
    const safeUser = {
      ...user,
      hasPasswordHash,
    } as IUser;

    // Remove sensitive fields (passwordHash may already be deleted by @AfterLoad hook, but ensure it's gone)
    delete (safeUser as unknown as { passwordHash?: string | null }).passwordHash;
    delete (safeUser as unknown as { totpSecret?: string | null }).totpSecret;
    delete (safeUser as unknown as { backupCodes?: string[] | null }).backupCodes;
    delete (safeUser as unknown as { passwordHistory?: string[] | null }).passwordHistory;

    return safeUser;
  }

  // ============================================================================
  // User Update Operations
  // ============================================================================

  /**
   * Update user profile attributes.
   *
   * Updates user fields (name, email, phone, username, metadata) and enforces unique constraints and verification rules.
   *
   * @param dto - AdminUpdateUserAttributesDTO containing sub and fields to update
   * @returns Updated user object
   * @throws {NAuthException} If user not found or unique constraint violated
   *
   * @example
   * ```typescript
   * await userService.updateUserAttributes({ sub: 'user-uuid', email: 'test@example.com' });
   * ```
   */
  async updateUserAttributes(dto: AdminUpdateUserAttributesDTO): Promise<UserResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(AdminUpdateUserAttributesDTO, dto);

    // Find user by sub (external identifier)
    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Check for uniqueness constraints - use internal id
    await this.helpers.validateUniquenessConstraints(user.id, dto);

    // Prepare update object
    const updateFields: Partial<IUser> = {};

    // Update basic fields if provided
    if (dto.firstName !== undefined) {
      updateFields.firstName = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      updateFields.lastName = dto.lastName;
    }
    if (dto.username !== undefined) {
      updateFields.username = dto.username;
    }
    if (dto.email !== undefined) {
      const oldEmail = user.email;
      updateFields.email = dto.email;
      // Reset email verification if email changed (unless retainVerification is true)
      if (dto.email !== user.email) {
        if (!dto.retainVerification) {
          updateFields.isEmailVerified = false;
        } else {
          // Explicitly retain current verification status
          updateFields.isEmailVerified = user.isEmailVerified;
        }

        // ============================================================================
        // MFA Device Management: Handle Email MFA devices when email changes
        // ============================================================================
        // When email address changes, Email MFA devices become invalid.
        // We deactivate them and check if user has any other active MFA devices.
        // If Email was the only MFA method, user will need to set up MFA again.
        // This happens automatically via challenge system at next login.
        if (oldEmail && this.mfaDeviceRepository) {
          try {
            // Find all Email MFA devices (email field may be null in legacy devices)
            const emailDevices = (await this.mfaDeviceRepository.find({
              where: {
                userId: user.id,
                type: MFAMethod.EMAIL,
                isActive: true,
              },
            } as Record<string, unknown>)) as unknown as Array<Record<string, unknown>>;

            if (emailDevices.length > 0) {
              this.logger?.log?.(
                `Deleting ${emailDevices.length} Email MFA device(s) for user ${user.sub} due to email address change (old: ${oldEmail}, new: ${dto.email})`,
              );

              // Delete all Email devices (can't be reactivated with old email)
              for (const device of emailDevices) {
                const deviceId = (device as Record<string, unknown>).id as number;
                await this.mfaDeviceRepository.delete(deviceId);
              }

              // Record audit event for removed Email MFA devices
              if (this.auditService) {
                try {
                  await this.auditService.recordEvent({
                    userId: user.id,
                    eventType: AuthAuditEventType.MFA_DEVICE_REMOVED,
                    eventStatus: 'INFO',
                    reason: 'email_changed',
                    description: `Email MFA device(s) removed due to email address change (${oldEmail} → ${dto.email})`,
                    metadata: {
                      method: MFAMethod.EMAIL,
                      deletedCount: emailDevices.length,
                      oldEmail,
                      newEmail: dto.email,
                      reason: 'email_address_changed_requires_reverification',
                    },
                  });
                } catch (auditError) {
                  const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
                  this.logger?.error?.(
                    `Failed to record MFA_DEVICE_REMOVED audit event for email change: ${errorMessage}`,
                    { error: auditError, userId: user.id },
                  );
                }
              }

              // Check if user has any other active MFA devices
              const allActiveDevices = (await this.mfaDeviceRepository.find({
                where: {
                  userId: user.id,
                  isActive: true,
                },
              } as Record<string, unknown>)) as unknown as Array<Record<string, unknown>>;

              // If no active devices remain and user had MFA enabled, disable MFA
              if (allActiveDevices.length === 0 && user.mfaEnabled) {
                updateFields.mfaEnabled = false;
                updateFields.mfaMethods = [];
                updateFields.preferredMfaMethod = null;
                this.logger?.log?.(
                  `MFA disabled for user ${user.sub} - no active MFA devices remaining after email change`,
                );
              } else {
                this.logger?.log?.(
                  `User ${user.sub} still has ${allActiveDevices.length} active MFA device(s) - MFA remains enabled`,
                );
              }
            }
          } catch (error: unknown) {
            // Log error but don't fail the email update
            // This handles cases where MFA module is not imported (mfaDeviceRepository might not be available)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger?.warn?.(
              `Failed to handle MFA device deactivation during email change for user ${user.sub}: ${errorMessage}`,
            );
          }
        }
      }
    }
    if (dto.phone !== undefined) {
      const oldPhone = user.phone;
      updateFields.phone = dto.phone;
      // Reset phone verification if phone changed (unless retainVerification is true)
      if (dto.phone !== user.phone) {
        if (!dto.retainVerification) {
          updateFields.isPhoneVerified = false;
        } else {
          // Explicitly retain current verification status
          updateFields.isPhoneVerified = user.isPhoneVerified;
        }

        // ============================================================================
        // MFA Device Management: Handle SMS MFA devices when phone changes
        // ============================================================================
        // When phone number changes, SMS MFA devices become invalid.
        // We delete them and check if user has any other active MFA devices.
        // If SMS was the only MFA method, user will need to set up MFA again.
        // This happens automatically via challenge system at next login.
        if (oldPhone && this.mfaDeviceRepository) {
          try {
            // Find all SMS MFA devices (SMS MFA is tied to user.phone, not device phoneNumber)
            const smsDevices = (await this.mfaDeviceRepository.find({
              where: {
                userId: user.id,
                type: MFAMethod.SMS,
                isActive: true,
              },
            } as Record<string, unknown>)) as unknown as Array<Record<string, unknown>>;

            if (smsDevices.length > 0) {
              this.logger?.log?.(
                `Deleting ${smsDevices.length} SMS MFA device(s) for user ${user.sub} due to phone number change (old: ${oldPhone}, new: ${dto.phone})`,
              );

              // Delete all SMS devices (can't be reactivated with old phone number)
              for (const device of smsDevices) {
                const deviceId = (device as Record<string, unknown>).id as number;
                await this.mfaDeviceRepository.delete(deviceId);
              }

              // Record audit event for removed SMS MFA devices
              if (this.auditService) {
                try {
                  await this.auditService.recordEvent({
                    userId: user.id,
                    eventType: AuthAuditEventType.MFA_DEVICE_REMOVED,
                    eventStatus: 'INFO',
                    reason: 'phone_changed',
                    description: `SMS MFA device(s) removed due to phone number change (${oldPhone} → ${dto.phone})`,
                    metadata: {
                      method: MFAMethod.SMS,
                      deletedCount: smsDevices.length,
                      oldPhone,
                      newPhone: dto.phone,
                      reason: 'phone_number_changed_requires_reverification',
                    },
                  });
                } catch (auditError) {
                  const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
                  this.logger?.error?.(
                    `Failed to record MFA_DEVICE_REMOVED audit event for phone change: ${errorMessage}`,
                    { error: auditError, userId: user.id },
                  );
                }
              }

              // Check if user has any other active MFA devices
              const allActiveDevices = (await this.mfaDeviceRepository.find({
                where: {
                  userId: user.id,
                  isActive: true,
                },
              } as Record<string, unknown>)) as unknown as Array<Record<string, unknown>>;

              // If no active devices remain and user had MFA enabled, disable MFA
              if (allActiveDevices.length === 0 && user.mfaEnabled) {
                updateFields.mfaEnabled = false;
                updateFields.mfaMethods = [];
                updateFields.preferredMfaMethod = null;
                this.logger?.log?.(
                  `MFA disabled for user ${user.sub} - no active MFA devices remaining after phone change`,
                );
              } else {
                this.logger?.log?.(
                  `User ${user.sub} still has ${allActiveDevices.length} active MFA device(s) - MFA remains enabled`,
                );
              }
            }
          } catch (error: unknown) {
            // Log error but don't fail the phone update
            // This handles cases where MFA module is not imported (mfaDeviceRepository might not be available)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger?.warn?.(
              `Failed to handle MFA device deactivation during phone change for user ${user.sub}: ${errorMessage}`,
            );
          }
        }
      }
    }

    // Handle preferred MFA method
    if (dto.preferredMfaMethod !== undefined) {
      updateFields.preferredMfaMethod = dto.preferredMfaMethod as string | null;
    }

    // Handle metadata merge
    // Keys set to null will be deleted from metadata
    if (dto.metadata !== undefined) {
      const existingMetadata = user.metadata || {};
      const mergedMetadata = { ...existingMetadata, ...dto.metadata };

      // Remove keys that are explicitly set to null
      Object.keys(mergedMetadata).forEach((key) => {
        if (mergedMetadata[key] === null) {
          delete mergedMetadata[key];
        }
      });

      updateFields.metadata = mergedMetadata;
    }

    // Update user in database - use internal id for update query
    await this.userRepository.update(user.id, updateFields as Record<string, unknown>);

    // Fetch updated user - use internal id
    const updatedUser = (await this.userRepository.findOne({ where: { id: user.id } })) as IUser | null;
    if (!updatedUser) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found after update');
    }

    // ============================================================================
    // Audit: Record profile and attribute updates
    // ============================================================================
    try {
      // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
      // Note: ClientInfoService is used transparently by SessionService and AuditService
      // ============================================================================
      // Build fieldChanges from actual persisted updateFields (holistic)
      // ============================================================================
      // WHY: Some fields are derived/updated implicitly (e.g., MFA flags when devices are removed),
      // and some inputs may normalize to the existing value. We only want to log real changes and
      // ensure before/after is consistent for ALL changed attributes (including phone).
      const fieldChanges: Record<string, unknown> = {};

      const valuesDiffer = (before: unknown, after: unknown): boolean => {
        // Use JSON stringification for a stable deep-ish comparison for our update payloads
        // (primitives, arrays, plain objects). This is audit-only and non-security-critical.
        return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
      };

      // Capture before/after values for all updated fields except metadata (handled below with per-key diff)
      for (const [fieldName, afterValue] of Object.entries(updateFields)) {
        if (fieldName === 'metadata') continue;

        const beforeValue = (user as unknown as Record<string, unknown>)[fieldName];
        if (!valuesDiffer(beforeValue, afterValue)) continue;

        fieldChanges[fieldName] = {
          before: beforeValue ?? null,
          after: afterValue ?? null,
        };
      }

      // Handle metadata changes (merged, so track what was added/changed/deleted)
      // Note: Keys set to null in dto.metadata are deleted from final metadata
      if (dto.metadata !== undefined) {
        const oldMetadata = user.metadata || {};
        const newMetadata = (updateFields.metadata as Record<string, unknown> | undefined) || oldMetadata;
        const metadataChanges: Record<string, { before: unknown; after: unknown }> = {};

        // Track all keys that exist in either old or new metadata
        const allKeys = new Set([...Object.keys(oldMetadata), ...Object.keys(dto.metadata)]);

        for (const key of allKeys) {
          const oldValue = oldMetadata[key];
          const newValue = newMetadata[key];

          // Track changes, additions, and deletions
          if (valuesDiffer(oldValue, newValue)) {
            metadataChanges[key] = {
              before: oldValue ?? null,
              after: newValue ?? null, // Will be null for deleted keys
            };
          }
        }

        if (Object.keys(metadataChanges).length > 0) {
          fieldChanges.metadata = metadataChanges;
        }
      }

      const updatedFieldNames = Object.keys(fieldChanges);

      // Record general profile update with field changes
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.PROFILE_UPDATED,
        eventStatus: 'INFO',
        metadata: {
          // Client info automatically included from context
          updatedFields: updatedFieldNames,
          fieldChanges: Object.keys(fieldChanges).length > 0 ? fieldChanges : undefined,
        },
      });

      const clientInfoForSource = this.clientInfoService.get();
      const inferredUpdateSource =
        clientInfoForSource?.sub && clientInfoForSource.sub !== user.sub
          ? ('admin_action' as const)
          : ('user_request' as const);

      const newEmail = updateFields.email;
      if (fieldChanges.email && typeof newEmail === 'string') {
        // ============================================================================
        // Lifecycle Hook: Email Changed
        // ============================================================================
        if (this.hookRegistry) {
          try {
            await this.hookRegistry.executeEmailChanged({
              user: updatedUser,
              oldEmail: user.email,
              newEmail,
              updateSource: inferredUpdateSource,
              clientInfo: {
                ipAddress: clientInfoForSource.ipAddress,
                userAgent: clientInfoForSource.userAgent,
                ipCountry: clientInfoForSource.ipCountry,
                ipCity: clientInfoForSource.ipCity,
              },
            });
          } catch (hookError) {
            // Non-blocking: Log but continue
            const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
            this.logger?.error?.(`Failed to execute emailChanged hooks: ${errorMessage}`, {
              error: hookError,
              userId: user.id,
            });
          }
        }
      }

    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record profile update audit events: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
      });
    }

    // ============================================================================
    // Hook: Execute user profile updated hooks
    // ============================================================================
    try {
      // Build changed fields array with old/new values (only for fields that actually changed)
      const changedFields: Array<{ fieldName: string; oldValue: unknown; newValue: unknown }> = [];

      const valuesDiffer = (before: unknown, after: unknown): boolean => {
        return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
      };

      // Track all fields that were in updateFields (but filter to real changes)
      for (const [fieldName, newValue] of Object.entries(updateFields)) {
        const oldValue = (user as unknown as Record<string, unknown>)[fieldName];
        if (!valuesDiffer(oldValue, newValue)) continue;

        changedFields.push({
          fieldName,
          oldValue,
          newValue,
        });
      }

      // Get client info from ClientInfoService
      const clientInfo = this.clientInfoService.get();

      // Determine update source (admin vs user) based on authenticated context
      // WHY: userService.updateUserAttributes() is used by both AuthService (self updates)
      // and AdminAuthService (admin updates), so we infer source from request context.
      const updateSource =
        clientInfo?.sub && clientInfo.sub !== user.sub ? ('admin_action' as const) : ('user_request' as const);

      // Execute hooks (non-blocking)
      await this.hookRegistry?.executeUserProfileUpdated({
        user: updatedUser,
        changedFields,
        updateSource,
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
      this.logger?.error?.(`Failed to execute userProfileUpdated hooks: ${errorMessage}`, {
        error: hookError,
        userId: user.id,
      });
    }

    // Return user response DTO
    return UserResponseDTO.fromEntity(updatedUser);
  }

  /**
   * Update email and/or phone verification status.
   *
   * Intended for admin use cases such as migration or offline validation.
   * Updates verification status without requiring actual verification codes.
   *
   * Validation:
   * - Cannot set verified=true if email/phone doesn't exist
   * - Can set verified=false even if email/phone doesn't exist (default state)
   * - Only updates provided fields (partial update)
   *
   * Audit:
   * - Records EMAIL_VERIFIED or PHONE_VERIFIED audit events
   * - Includes performedBy from authenticated admin context
   *
   * @param dto - Request DTO containing sub and verification status flags
   * @returns Updated user object
   * @throws {NAuthException} If user not found or trying to verify non-existent email/phone
   *
   * @example
   * ```typescript
   * // Update email verification only
   * await userService.updateVerifiedStatus({
   *   sub: 'user-uuid',
   *   isEmailVerified: true
   * });
   *
   * // Update both email and phone verification
   * await userService.updateVerifiedStatus({
   *   sub: 'user-uuid',
   *   isEmailVerified: true,
   *   isPhoneVerified: false
   * });
   * ```
   */
  async updateVerifiedStatus(dto: UpdateVerifiedStatusRequestDTO): Promise<UserResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(UpdateVerifiedStatusRequestDTO, dto);

    // Find user by sub (external identifier)
    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Validate that email exists if trying to set isEmailVerified to true
    if (dto.isEmailVerified === true && !user.email) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Cannot set email verification to true: user does not have an email address',
      );
    }

    // Validate that phone exists if trying to set isPhoneVerified to true
    if (dto.isPhoneVerified === true && !user.phone) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Cannot set phone verification to true: user does not have a phone number',
      );
    }

    // Prepare update object - only include fields that were provided
    const updateFields: Partial<IUser> = {};

    if (dto.isEmailVerified !== undefined) {
      updateFields.isEmailVerified = dto.isEmailVerified;
    }

    if (dto.isPhoneVerified !== undefined) {
      updateFields.isPhoneVerified = dto.isPhoneVerified;
    }

    // If no fields to update, return current user
    if (Object.keys(updateFields).length === 0) {
      return UserResponseDTO.fromEntity(user);
    }

    // Update user - use internal id for database update
    await this.userRepository.update(user.id, updateFields as Record<string, unknown>);

    // Reload user to get updated values
    const updatedUser = (await this.userRepository.findOne({ where: { id: user.id } })) as IUser;

    if (!updatedUser) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Failed to reload user after update');
    }

    // ============================================================================
    // Audit: Record verification status changes
    // ============================================================================
    if (this.auditService) {
      // Record email verification change if provided
      if (dto.isEmailVerified !== undefined) {
        try {
          await this.auditService.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.EMAIL_VERIFICATION_STATUS_UPDATED,
            eventStatus: 'SUCCESS',
            description: 'Email verification status updated by admin',
            reason: 'admin_verification_update',
            metadata: {
              previousStatus: user.isEmailVerified,
              newStatus: dto.isEmailVerified,
              updateMethod: 'admin_direct',
              // Client info automatically included from context (performedBy auto-populated)
            },
          });
        } catch (auditError) {
          // Non-blocking: Log but continue
          const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
          this.logger?.error?.(`Failed to record EMAIL_VERIFICATION_STATUS_UPDATED audit event: ${errorMessage}`, {
            error: auditError,
            userId: user.id,
          });
        }
      }

      // Record phone verification change if provided
      if (dto.isPhoneVerified !== undefined) {
        try {
          await this.auditService.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.PHONE_VERIFICATION_STATUS_UPDATED,
            eventStatus: 'SUCCESS',
            description: 'Phone verification status updated by admin',
            reason: 'admin_verification_update',
            metadata: {
              previousStatus: user.isPhoneVerified,
              newStatus: dto.isPhoneVerified,
              updateMethod: 'admin_direct',
              // Client info automatically included from context (performedBy auto-populated)
            },
          });
        } catch (auditError) {
          // Non-blocking: Log but continue
          const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
          this.logger?.error?.(`Failed to record PHONE_VERIFICATION_STATUS_UPDATED audit event: ${errorMessage}`, {
            error: auditError,
            userId: user.id,
          });
        }
      }
    }

    // ============================================================================
    // Hook: Execute user profile updated hooks
    // ============================================================================
    try {
      // Build changed fields array with old/new values
      const changedFields: Array<{ fieldName: string; oldValue: unknown; newValue: unknown }> = [];

      if (dto.isEmailVerified !== undefined) {
        changedFields.push({
          fieldName: 'isEmailVerified',
          oldValue: user.isEmailVerified,
          newValue: dto.isEmailVerified,
        });
      }

      if (dto.isPhoneVerified !== undefined) {
        changedFields.push({
          fieldName: 'isPhoneVerified',
          oldValue: user.isPhoneVerified,
          newValue: dto.isPhoneVerified,
        });
      }

      // Get client info from ClientInfoService
      const clientInfo = this.clientInfoService.get();

      // Execute hooks (non-blocking)
      await this.hookRegistry?.executeUserProfileUpdated({
        user: updatedUser,
        changedFields,
        updateSource: 'admin_action',
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
      this.logger?.error?.(`Failed to execute userProfileUpdated hooks: ${errorMessage}`, {
        error: hookError,
        userId: user.id,
      });
    }

    // Return user response DTO
    return UserResponseDTO.fromEntity(updatedUser);
  }

  // ============================================================================
  // User Lifecycle Operations
  // ============================================================================

  /**
   * Delete a user and all associated data (cascade deletion).
   *
   * Permanently removes a user account and all related records:
   * - Sessions
   * - Verification tokens
   * - MFA devices
   * - Trusted devices
   * - Social accounts
   * - Login attempts
   * - Challenge sessions
   * - Audit logs (user-specific)
   *
   * Security:
   * - NO built-in authentication - endpoint MUST be protected by admin guards
   * - Records ACCOUNT_DELETED audit event before deletion
   * - Returns counts of deleted records for confirmation
   *
   * @param dto - DeleteUserDTO containing sub
   * @returns Response with success status and deleted record counts
   * @throws {NAuthException} USER_NOT_FOUND
   *
   * @example
   * ```typescript
   * const result = await userService.deleteUser({ sub: 'user-uuid-123' });
   * console.log(`Deleted ${result.deletedRecords.sessions} sessions`);
   * ```
   */
  async deleteUser(dto: DeleteUserDTO): Promise<DeleteUserResponseDTO> {
    // Ensure DTO is validated
    dto = await ensureValidatedDto(DeleteUserDTO, dto);

    // Get client info for audit
    const clientInfo = this.clientInfoService.get();

    this.logger?.log?.(`Admin deleteUser initiated for sub: ${dto.sub}`);

    // Find user by sub
    const user = await this.userRepository.findOne({ where: { sub: dto.sub } });

    if (!user) {
      this.logger?.warn?.(`User not found for deletion: ${dto.sub}`);
      throw new NAuthException(AuthErrorCode.USER_NOT_FOUND, 'User not found');
    }

    this.logger?.debug?.(`Deleting user ${user.email} (id: ${user.id}, sub: ${dto.sub})`);

    // ============================================================================
    // Explicit Cascade Deletion (to track counts)
    // ============================================================================
    // Even though database has CASCADE, we explicitly delete each table to track counts

    // 1. Delete Sessions
    let sessionsCount = 0;
    if (this.sessionRepository) {
      const result = await this.sessionRepository.delete({ userId: user.id as number });
      sessionsCount = result.affected || 0;
      this.logger?.debug?.(`Deleted ${sessionsCount} sessions for user ${dto.sub}`);
    }

    // 2. Delete Verification Tokens
    let verificationTokensCount = 0;
    if (this.verificationTokenRepository) {
      const result = await this.verificationTokenRepository.delete({ userId: user.id as number });
      verificationTokensCount = result.affected || 0;
      this.logger?.debug?.(`Deleted ${verificationTokensCount} verification tokens for user ${dto.sub}`);
    }

    // 3. Delete MFA Devices
    let mfaDevicesCount = 0;
    if (this.mfaDeviceRepository) {
      const result = await this.mfaDeviceRepository.delete({ userId: user.id as number });
      mfaDevicesCount = result.affected || 0;
      this.logger?.debug?.(`Deleted ${mfaDevicesCount} MFA devices for user ${dto.sub}`);
    }

    // 4. Delete Trusted Devices
    let trustedDevicesCount = 0;
    if (this.trustedDeviceRepository) {
      const result = await this.trustedDeviceRepository.delete({ userId: user.id as number });
      trustedDevicesCount = result.affected || 0;
      this.logger?.debug?.(`Deleted ${trustedDevicesCount} trusted devices for user ${dto.sub}`);
    }

    // 5. Delete Social Accounts
    let socialAccountsCount = 0;
    if (this.socialAccountRepository) {
      const result = await this.socialAccountRepository.delete({ userId: user.id as number });
      socialAccountsCount = result.affected || 0;
      this.logger?.debug?.(`Deleted ${socialAccountsCount} social accounts for user ${dto.sub}`);
    }

    // 6. Delete Login Attempts
    let loginAttemptsCount = 0;
    const loginAttemptResult = await this.loginAttemptRepository.delete({ userId: user.id as number });
    loginAttemptsCount = loginAttemptResult.affected || 0;
    this.logger?.debug?.(`Deleted ${loginAttemptsCount} login attempts for user ${dto.sub}`);

    // 7. Delete Challenge Sessions
    let challengeSessionsCount = 0;
    if (this.challengeSessionRepository) {
      const result = await this.challengeSessionRepository.delete({ userId: user.id as number });
      challengeSessionsCount = result.affected || 0;
      this.logger?.debug?.(`Deleted ${challengeSessionsCount} challenge sessions for user ${dto.sub}`);
    }

    // 8. Delete Audit Logs (user-specific)
    let auditLogsCount = 0;
    if (this.authAuditRepository) {
      const result = await this.authAuditRepository.delete({ userId: user.id as number });
      auditLogsCount = result.affected || 0;
      this.logger?.debug?.(`Deleted ${auditLogsCount} audit logs for user ${dto.sub}`);
    }

    // ============================================================================
    // Record Admin Action (BEFORE deleting user to satisfy foreign key constraint)
    // ============================================================================
    try {
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.ACCOUNT_DELETED,
        eventStatus: 'INFO',
        authMethod: 'admin',
        metadata: {
          deletedEmail: user.email,
          deletedSub: dto.sub,
          adminIdentifier: clientInfo.ipAddress || 'unknown',
          deletedRecords: {
            sessions: sessionsCount,
            verificationTokens: verificationTokensCount,
            mfaDevices: mfaDevicesCount,
            trustedDevices: trustedDevicesCount,
            socialAccounts: socialAccountsCount,
            loginAttempts: loginAttemptsCount,
            challengeSessions: challengeSessionsCount,
            auditLogs: auditLogsCount,
          },
        },
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record ACCOUNT_DELETED audit event: ${errorMessage}`);
    }

    // 9. Delete User Record (final)
    await this.userRepository.delete({ id: user.id });
    this.logger?.log?.(`User deleted successfully: ${user.email} (sub: ${dto.sub})`);

    return {
      success: true,
      deletedUserId: dto.sub,
      deletedRecords: {
        sessions: sessionsCount,
        verificationTokens: verificationTokensCount,
        mfaDevices: mfaDevicesCount,
        trustedDevices: trustedDevicesCount,
        socialAccounts: socialAccountsCount,
        loginAttempts: loginAttemptsCount,
        challengeSessions: challengeSessionsCount,
        auditLogs: auditLogsCount,
      },
    };
  }

  /**
   * Administrative permanent account locking
   *
   * Sets permanent lock (lockedUntil=NULL) and immediately revokes all active sessions.
   * Reuses existing rate-limit lock fields (isLocked, lockReason, lockedAt, lockedUntil).
   *
   * Permanent vs Temporary locks:
   * - Rate limiting: lockedUntil = future date (temporary auto-unlock)
   * - Admin disableUser: lockedUntil = NULL (permanent manual lock)
   *
   * Security:
   * - NO built-in authentication - endpoint MUST be protected by admin guards
   * - Revokes all sessions immediately (forced logout)
   * - Records ACCOUNT_DISABLED audit event with admin identifier
   *
   * @param dto - User sub and optional reason
   * @returns User object with updated lock status and revoked session count
   * @throws {NAuthException} USER_NOT_FOUND
   *
   * @example
   * ```typescript
   * const result = await userService.disableUser({
   *   sub: 'user-uuid-123',
   *   reason: 'Suspicious activity detected'
   * });
   * console.log(`Revoked ${result.revokedSessions} sessions`);
   * ```
   */
  async disableUser(dto: DisableUserDTO): Promise<DisableUserResponseDTO> {
    // Ensure DTO is validated
    dto = await ensureValidatedDto(DisableUserDTO, dto);

    // Get client info for audit
    const clientInfo = this.clientInfoService.get();

    this.logger?.log?.(`Admin disableUser initiated for sub: ${dto.sub}`);

    // Find user by sub
    const user = await this.userRepository.findOne({ where: { sub: dto.sub } });

    if (!user) {
      this.logger?.warn?.(`User not found for disabling: ${dto.sub}`);
      throw new NAuthException(AuthErrorCode.USER_NOT_FOUND, 'User not found');
    }

    this.logger?.debug?.(`Disabling user ${user.email} (id: ${user.id}, sub: ${dto.sub})`);

    // ============================================================================
    // Set Permanent Lock (lockedUntil = NULL)
    // ============================================================================
    // Use update() to ensure persistence and avoid entity state issues
    await this.userRepository.update(
      { id: user.id },
      {
        isLocked: true,
        lockReason: dto.reason || 'Account disabled',
        lockedAt: new Date(),
        lockedUntil: null, // NULL = permanent lock (vs rate-limit's future date)
      },
    );

    // Reload user to get updated entity with lock fields
    const updatedUser = (await this.userRepository.findOne({ where: { id: user.id } })) as IUser | null;
    if (!updatedUser) {
      throw new NAuthException(AuthErrorCode.USER_NOT_FOUND, 'User not found after update');
    }

    this.logger?.log?.(`User locked permanently: ${updatedUser.email} (sub: ${dto.sub})`);

    // ============================================================================
    // Revoke All Sessions (force logout)
    // ============================================================================
    let revokedCount = 0;
    try {
      revokedCount = await this.sessionService.revokeAllUserSessions(updatedUser.id as number, 'Account disabled');
      this.logger?.debug?.(`Revoked ${revokedCount} sessions for user ${dto.sub}`);
    } catch (sessionError) {
      // Non-blocking: Log but continue
      const errorMessage = sessionError instanceof Error ? sessionError.message : 'Unknown error';
      this.logger?.warn?.(`Failed to revoke sessions for user ${dto.sub}: ${errorMessage}`);
    }

    // ============================================================================
    // Record Admin Action (ACCOUNT_DISABLED)
    // ============================================================================
    if (!this.auditService) {
      this.logger?.warn?.(
        `Audit service not available - ACCOUNT_DISABLED event not recorded for user ${dto.sub}. Enable audit logs in config.auditLogs.enabled`,
      );
    } else {
      try {
        // Get admin sub (preferred) or userId from client info (the currently logged in user performing this action)
        const adminSub = (clientInfo as { sub?: string })?.sub;
        const adminUserId = (clientInfo as { userId?: number })?.userId;
        const performedBy =
          adminSub ??
          (typeof adminUserId === 'number' ? String(adminUserId) : null) ??
          clientInfo.ipAddress ??
          'system';

        if (adminSub || adminUserId) {
          this.logger?.debug?.(
            `Admin (sub=${adminSub ?? 'n/a'}, id=${adminUserId ?? 'n/a'}) is disabling account for user ${dto.sub}`,
          );
        } else {
          this.logger?.warn?.(
            `No admin sub/userId in clientInfo - performedBy will be set to IP or 'system' for user ${dto.sub}`,
          );
        }

        const auditResult = await this.auditService.recordEvent({
          userId: updatedUser.id, // The user whose account is being disabled
          eventType: AuthAuditEventType.ACCOUNT_DISABLED,
          eventStatus: 'INFO',
          authMethod: 'admin',
          performedBy, // The admin user ID (currently logged in user) who performed this action
          reason: updatedUser.lockReason || 'Account disabled',
          description: `Account disabled by administrator. User: ${updatedUser.email} (sub: ${dto.sub}). ${revokedCount} session(s) revoked.`,
          metadata: {
            email: updatedUser.email,
            userSub: dto.sub,
            reason: updatedUser.lockReason,
            adminIdentifier: clientInfo.ipAddress || 'unknown',
            adminSub: adminSub || null,
            adminUserId: adminUserId ?? null,
            revokedSessions: revokedCount,
            lockedAt: updatedUser.lockedAt,
            lockedUntil: updatedUser.lockedUntil,
          },
        });

        if (auditResult) {
          this.logger?.debug?.(`ACCOUNT_DISABLED audit event recorded successfully for user ${dto.sub}`);
        } else {
          this.logger?.warn?.(`ACCOUNT_DISABLED audit event returned null for user ${dto.sub}`);
        }
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        const errorStack = auditError instanceof Error ? auditError.stack : undefined;
        this.logger?.error?.(`Failed to record ACCOUNT_DISABLED audit event: ${errorMessage}`, {
          error: auditError,
          errorStack,
          userId: updatedUser.id,
          userSub: dto.sub,
        });
      }
    }

    // ============================================================================
    // Lifecycle Hook: Account Status Changed (Disabled)
    // ============================================================================
    if (this.hookRegistry) {
      try {
        await this.hookRegistry.executeAccountStatusChanged({
          user: updatedUser,
          status: 'disabled',
          reason: updatedUser.lockReason || 'Account disabled',
          revokedSessions: revokedCount,
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
        this.logger?.error?.(`Failed to execute accountStatusChanged hooks: ${errorMessage}`, {
          error: hookError,
          userId: updatedUser.id,
          status: 'disabled',
        });
      }
    }

    // Return sanitized user and revoked session count
    const userDto = UserResponseDTO.fromEntity(updatedUser as unknown as IUser);
    return {
      success: true,
      user: userDto,
      revokedSessions: revokedCount,
    };
  }

  /**
   * Enable (unlock) user account
   *
   * Unlocks a previously locked user account by clearing all lock fields.
   * This reverses the effect of disableUser() or rate-limit lockouts.
   *
   * Security:
   * - NO built-in authentication - endpoint MUST be protected by admin guards
   * - Clears lock fields (isLocked, lockReason, lockedAt, lockedUntil)
   * - Resets failed login attempts counter
   * - Records ACCOUNT_ENABLED audit event with admin identifier
   *
   * @param dto - User sub to enable
   * @returns User object with updated lock status
   * @throws {NAuthException} USER_NOT_FOUND
   *
   * @example
   * ```typescript
   * const result = await userService.enableUser({
   *   sub: 'user-uuid-123'
   * });
   * console.log(`User unlocked: ${result.user.email}`);
   * ```
   */
  async enableUser(dto: EnableUserDTO): Promise<EnableUserResponseDTO> {
    // Ensure DTO is validated
    dto = await ensureValidatedDto(EnableUserDTO, dto);

    // Get client info for audit
    const clientInfo = this.clientInfoService.get();

    this.logger?.log?.(`Admin enableUser initiated for sub: ${dto.sub}`);

    // Find user by sub
    const user = await this.userRepository.findOne({ where: { sub: dto.sub } });

    if (!user) {
      this.logger?.warn?.(`User not found for enabling: ${dto.sub}`);
      throw new NAuthException(AuthErrorCode.USER_NOT_FOUND, 'User not found');
    }

    this.logger?.debug?.(`Enabling user ${user.email} (id: ${user.id}, sub: ${dto.sub})`);

    // ============================================================================
    // Clear Lock Fields (unlock account)
    // ============================================================================
    await this.userRepository.update(
      { id: user.id },
      {
        isLocked: false,
        lockReason: null,
        lockedAt: null,
        lockedUntil: null,
        failedLoginAttempts: 0, // Reset failed attempts counter
      },
    );

    // Reload user to get updated entity
    const updatedUser = (await this.userRepository.findOne({ where: { id: user.id } })) as IUser | null;
    if (!updatedUser) {
      throw new NAuthException(AuthErrorCode.USER_NOT_FOUND, 'User not found after update');
    }

    this.logger?.log?.(`User unlocked: ${updatedUser.email} (sub: ${dto.sub})`);

    // ============================================================================
    // Record Admin Action (ACCOUNT_ENABLED)
    // ============================================================================
    if (!this.auditService) {
      this.logger?.warn?.(
        `Audit service not available - ACCOUNT_ENABLED event not recorded for user ${dto.sub}. Enable audit logs in config.auditLogs.enabled`,
      );
    } else {
      try {
        // Get admin sub (preferred) or userId from client info (the currently logged in user performing this action)
        const adminSub = (clientInfo as { sub?: string })?.sub;
        const adminUserId = (clientInfo as { userId?: number })?.userId;
        const performedBy =
          adminSub ??
          (typeof adminUserId === 'number' ? String(adminUserId) : null) ??
          clientInfo.ipAddress ??
          'system';

        if (adminSub || adminUserId) {
          this.logger?.debug?.(
            `Admin (sub=${adminSub ?? 'n/a'}, id=${adminUserId ?? 'n/a'}) is enabling account for user ${dto.sub}`,
          );
        } else {
          this.logger?.warn?.(
            `No admin sub/userId in clientInfo - performedBy will be set to IP or 'system' for user ${dto.sub}`,
          );
        }

        const auditResult = await this.auditService.recordEvent({
          userId: updatedUser.id,
          eventType: AuthAuditEventType.ACCOUNT_ENABLED,
          eventStatus: 'INFO',
          authMethod: 'admin',
          performedBy,
          reason: 'admin_unlock',
          description: 'Account unlocked by administrator',
          metadata: {
            userSub: dto.sub,
            adminIdentifier: clientInfo.ipAddress || 'unknown',
            adminSub: adminSub || null,
            adminUserId: adminUserId ?? null,
            previousLockReason: user.lockReason,
            previousLockedAt: user.lockedAt,
            previousLockedUntil: user.lockedUntil,
          },
        });

        if (auditResult) {
          this.logger?.debug?.(`ACCOUNT_ENABLED audit event recorded successfully for user ${dto.sub}`);
        } else {
          this.logger?.warn?.(`ACCOUNT_ENABLED audit event returned null for user ${dto.sub}`);
        }
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        const errorStack = auditError instanceof Error ? auditError.stack : undefined;
        this.logger?.error?.(`Failed to record ACCOUNT_ENABLED audit event: ${errorMessage}`, {
          error: auditError,
          errorStack,
          userId: updatedUser.id,
          userSub: dto.sub,
        });
      }
    }

    // ============================================================================
    // Lifecycle Hook: Account Status Changed (Enabled)
    // ============================================================================
    if (this.hookRegistry) {
      try {
        await this.hookRegistry.executeAccountStatusChanged({
          user: updatedUser,
          status: 'enabled',
          reason: 'admin_unlock',
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
        this.logger?.error?.(`Failed to execute accountStatusChanged hooks: ${errorMessage}`, {
          error: hookError,
          userId: updatedUser.id,
          status: 'enabled',
        });
      }
    }

    // Return sanitized user
    const userDto = UserResponseDTO.fromEntity(updatedUser as unknown as IUser);
    return {
      success: true,
      user: userDto,
    };
  }

  /**
   * Require user to change password at next login.
   *
   * Throws if user not found or has no password set (e.g. social login only).
   *
   * @param dto - SetMustChangePasswordDTO containing userId (sub)
   * @returns Success response
   * @throws {NAuthException} If user is not found or cannot change password
   *
   * @example
   * ```typescript
   * await userService.setMustChangePassword({ userId: 'user-uuid-123' });
   * ```
   */
  async setMustChangePassword(dto: SetMustChangePasswordDTO): Promise<SetMustChangePasswordResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(SetMustChangePasswordDTO, dto);

    const user = await this.userRepository.findOne({ where: { sub: dto.sub } });

    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    //  CRITICAL PROTECTION: Only allow for users with password authentication
    // Pure social users cannot be forced to change password
    if (!user.passwordHash) {
      this.logger?.warn?.(
        `Cannot force password change for user ${dto.sub} - user doesn't have a password (pure social signup)`,
      );
      throw new NAuthException(
        AuthErrorCode.PASSWORD_CHANGE_NOT_ALLOWED,
        'Password change not available. This account uses social authentication only and has no password.',
      );
    }

    await this.userRepository.update({ sub: dto.sub }, { mustChangePassword: true });

    this.logger?.log?.(`Must-change-password flag set for user: ${dto.sub}`);

    return { success: true };
  }
}
