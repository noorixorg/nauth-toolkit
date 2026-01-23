import { Repository } from 'typeorm';
import { IUser } from '../interfaces/entities.interface';
import {
  BaseUser,
  BaseLoginAttempt,
  BaseMFADevice,
  BaseChallengeSession,
  BaseVerificationToken,
  BaseSocialAccount,
  BaseAuthAudit,
  BaseTrustedDevice,
  BaseSession,
} from '../entities';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { EmailVerificationService } from './email-verification.service';
import { PhoneVerificationService } from './phone-verification.service';
import { ClientInfoService } from './client-info.service';
import { ChallengeService } from './challenge.service';
import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { AccountLockoutStorageService } from '../storage/account-lockout-storage.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { TrustedDeviceService } from './trusted-device.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { AdminSignupDTO, AdminSignupResponseDTO } from '../dto/admin-signup.dto';
import { AdminSignupSocialDTO, AdminSignupSocialResponseDTO } from '../dto/admin-signup-social.dto';
import { DeleteUserDTO, DeleteUserResponseDTO } from '../dto/delete-user.dto';
import { GetUsersDTO, GetUsersResponseDTO } from '../dto/get-users.dto';
import { DisableUserDTO, DisableUserResponseDTO } from '../dto/disable-user.dto';
import { EnableUserDTO, EnableUserResponseDTO } from '../dto/enable-user.dto';
import { GetUserByEmailDTO } from '../dto/get-user-by-email.dto';
import { GetUserByIdDTO } from '../dto/get-user-by-id.dto';
import { UserResponseDTO } from '../dto/user-response.dto';
import { GetUserSessionsDTO } from '../dto/get-user-sessions.dto';
import { GetUserSessionsResponseDTO, UserSessionInfo } from '../dto/get-user-sessions-response.dto';
import { LogoutAllResponseDTO } from '../dto/logout-all-response.dto';
import { AdminLogoutAllDTO } from '../dto/admin-logout-all.dto';
import { AdminRevokeSessionDTO } from '../dto/admin-revoke-session.dto';
import { LogoutSessionResponseDTO } from '../dto/logout-session-response.dto';
import { SetMustChangePasswordDTO } from '../dto/set-must-change-password.dto';
import { SetMustChangePasswordResponseDTO } from '../dto/set-must-change-password-response.dto';
import { AdminSetPasswordDTO, AdminSetPasswordResponseDTO } from '../dto/admin-set-password.dto';
import {
  AdminResetPasswordDTO,
  AdminResetPasswordResponseDTO,
  ConfirmAdminResetPasswordDTO,
  ConfirmAdminResetPasswordResponseDTO,
} from '../dto/admin-reset-password.dto';
import { UpdateVerifiedStatusRequestDTO } from '../dto/update-verified-status-request.dto';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { generateSecurePassword } from '../utils/password-generator';
import { ensureValidatedDto } from '../utils/dto-validator';
import { HookRegistryService } from './hook-registry.service';
import { PasswordResetService } from './password-reset.service';
import { SocialAuthService } from './social-auth.service';
import { AuthServiceInternalHelpers } from './auth-service-internal-helpers';
import { UserService } from './user.service';
import { AdminUpdateUserAttributesDTO } from '../dto/admin-update-user-attributes.dto';

/**
 * Administrative authentication service
 *
 * Provides admin-only operations for managing users, sessions, and password workflows.
 * This service is intentionally separate from AuthService to keep user self-service
 * APIs isolated from admin actions.
 *
 * @example
 * ```typescript
 * const result = await adminAuthService.disableUser({ sub: 'user-uuid' });
 * ```
 */
export class AdminAuthService {
  private readonly helpers: AuthServiceInternalHelpers;
  private readonly userService: UserService;

  constructor(
    private readonly userRepository: Repository<BaseUser>,
    private readonly loginAttemptRepository: Repository<BaseLoginAttempt>,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly challengeService: ChallengeService,
    private readonly challengeHelper: AuthChallengeHelperService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly clientInfoService: ClientInfoService,
    private readonly accountLockoutStorage: AccountLockoutStorageService,
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
    private readonly hookRegistry: HookRegistryService,
    private readonly auditService?: AuthAuditService,
    private readonly phoneVerificationService?: PhoneVerificationService,
    private readonly mfaDeviceRepository?: Repository<BaseMFADevice>,
    private readonly trustedDeviceService?: TrustedDeviceService,
    private readonly passwordResetService?: PasswordResetService,
    private readonly socialAuthService?: SocialAuthService,
    private readonly sessionRepository?: Repository<BaseSession>,
    private readonly verificationTokenRepository?: Repository<BaseVerificationToken>,
    private readonly socialAccountRepository?: Repository<BaseSocialAccount>,
    private readonly challengeSessionRepository?: Repository<BaseChallengeSession>,
    private readonly authAuditRepository?: Repository<BaseAuthAudit>,
    private readonly trustedDeviceRepository?: Repository<BaseTrustedDevice>,
  ) {
    this.helpers = new AuthServiceInternalHelpers(
      userRepository,
      loginAttemptRepository,
      emailVerificationService,
      phoneVerificationService,
      challengeService,
      challengeHelper,
      clientInfoService,
      sessionService,
      accountLockoutStorage,
      config,
      logger,
      hookRegistry,
    );

    this.userService = new UserService(
      userRepository,
      loginAttemptRepository,
      sessionService,
      config,
      logger,
      mfaDeviceRepository,
      auditService,
      hookRegistry,
      clientInfoService,
      sessionRepository,
      verificationTokenRepository,
      socialAccountRepository,
      challengeSessionRepository,
      authAuditRepository,
      trustedDeviceRepository,
      this.helpers,
    );

    this.logger?.log?.('AdminAuthService initialized');
  }

  /**
   * Administrative user deletion with complete cascade cleanup
   *
   * @param dto - User sub to delete
   * @returns Deletion confirmation with cascade counts
   * @throws {NAuthException} USER_NOT_FOUND
   *
   * @example
   * ```typescript
   * const result = await adminAuthService.deleteUser({ sub: 'user-uuid-123' });
   * ```
   */
  async deleteUser(dto: DeleteUserDTO): Promise<DeleteUserResponseDTO> {
    return await this.userService.deleteUser(dto);
  }

  /**
   * Get paginated list of users with advanced filtering
   *
   * @param dto - Filters, pagination, sorting
   * @returns Paginated user list with metadata
   * @throws {NAuthException} When validation fails
   *
   * @example
   * ```typescript
   * const result = await adminAuthService.getUsers({ page: 1, limit: 20 });
   * ```
   */
  async getUsers(dto: GetUsersDTO): Promise<GetUsersResponseDTO> {
    return await this.userService.getUsers(dto);
  }

  /**
   * Administrative permanent account locking
   *
   * @param dto - User sub and optional reason
   * @returns User object with updated lock status and revoked session count
   * @throws {NAuthException} USER_NOT_FOUND
   *
   * @example
   * ```typescript
   * const result = await adminAuthService.disableUser({ sub: 'user-uuid-123' });
   * ```
   */
  async disableUser(dto: DisableUserDTO): Promise<DisableUserResponseDTO> {
    return await this.userService.disableUser(dto);
  }

  /**
   * Enable (unlock) user account
   *
   * @param dto - User sub to enable
   * @returns User object with updated lock status
   * @throws {NAuthException} USER_NOT_FOUND
   *
   * @example
   * ```typescript
   * const result = await adminAuthService.enableUser({ sub: 'user-uuid-123' });
   * ```
   */
  async enableUser(dto: EnableUserDTO): Promise<EnableUserResponseDTO> {
    return await this.userService.enableUser(dto);
  }

  /**
   * Get user by ID (sub)
   *
   * @param dto - GetUserByIdDTO containing sub
   * @returns User response DTO or null if not found
   * @throws {NAuthException} When validation fails
   *
   * @example
   * ```typescript
   * const user = await adminAuthService.getUserById({ sub: 'user-uuid' });
   * ```
   */
  async getUserById(dto: GetUserByIdDTO): Promise<UserResponseDTO | null> {
    return await this.userService.getUserById(dto);
  }

  /**
   * Get user by email address.
   *
   * @param dto - GetUserByEmailDTO containing email and optional requireEmailVerified
   * @returns User response DTO or null if not found
   * @throws {NAuthException} When validation fails
   *
   * @example
   * ```typescript
   * const user = await adminAuthService.getUserByEmail({ email: 'user@example.com' });
   * ```
   */
  async getUserByEmail(dto: GetUserByEmailDTO): Promise<UserResponseDTO | null> {
    return await this.userService.getUserByEmail(dto);
  }

  /**
   * Require user to change password at next login.
   *
   * @param dto - SetMustChangePasswordDTO containing sub
   * @returns Success response
   * @throws {NAuthException} If user is not found or cannot change password
   *
   * @example
   * ```typescript
   * await adminAuthService.setMustChangePassword({ sub: 'user-uuid-123' });
   * ```
   */
  async setMustChangePassword(dto: SetMustChangePasswordDTO): Promise<SetMustChangePasswordResponseDTO> {
    return await this.userService.setMustChangePassword(dto);
  }

  /**
   * Update email and/or phone verification status.
   *
   * @param dto - Request DTO containing sub and verification status flags
   * @returns Updated user object
   * @throws {NAuthException} If user not found or trying to verify non-existent email/phone
   *
   * @example
   * ```typescript
   * await adminAuthService.updateVerifiedStatus({ sub: 'user-uuid', isEmailVerified: true });
   * ```
   */
  async updateVerifiedStatus(dto: UpdateVerifiedStatusRequestDTO): Promise<UserResponseDTO> {
    return await this.userService.updateVerifiedStatus(dto);
  }

  /**
   * Administrative user creation with override capabilities
   *
   * @param dto - Admin signup DTO with override flags
   * @returns User object and optionally generated password
   * @throws {NAuthException} EMAIL_EXISTS | USERNAME_EXISTS | PHONE_EXISTS | WEAK_PASSWORD
   *
   * @example
   * ```typescript
   * const result = await adminAuthService.signup({ email: 'user@example.com', generatePassword: true });
   * ```
   */
  async signup(dto: AdminSignupDTO): Promise<AdminSignupResponseDTO> {
    dto = await ensureValidatedDto(AdminSignupDTO, dto);

    const clientInfo = this.clientInfoService.get();

    this.logger?.log?.(`Admin signup attempt for email: ${dto.email}`);
    this.logger?.debug?.(
      `Admin signup details: { email: ${dto.email}, username: ${dto.username || 'none'}, ip: ${clientInfo.ipAddress} }`,
    );

    const existingUserByEmail = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUserByEmail) {
      this.logger?.warn?.(`Admin signup failed - user already exists: ${dto.email}`);
      throw new NAuthException(AuthErrorCode.EMAIL_EXISTS, 'User with this email already exists');
    }

    if (dto.username) {
      this.logger?.debug?.(`Checking if username exists: ${dto.username}`);
      const existingUserByUsername = await this.userRepository.findOne({
        where: { username: dto.username },
      });

      if (existingUserByUsername) {
        this.logger?.warn?.(`Admin signup failed - username already exists: ${dto.username}`);
        throw new NAuthException(AuthErrorCode.USERNAME_EXISTS, 'Username is already taken');
      }
    }

    if (dto.phone && !this.config.signup?.allowDuplicatePhones) {
      this.logger?.debug?.(`Checking if phone exists: ${dto.phone}`);
      const existingUserByPhone = await this.userRepository.findOne({
        where: { phone: dto.phone },
      });

      if (existingUserByPhone) {
        this.logger?.warn?.(`Admin signup failed - phone already exists: ${dto.phone}`);
        throw new NAuthException(AuthErrorCode.PHONE_EXISTS, 'Phone number is already registered');
      }
    }

    let passwordHash: string;
    let generatedPassword: string | undefined;

    if (dto.generatePassword) {
      const generatedPasswordValue = generateSecurePassword(16);
      generatedPassword = generatedPasswordValue;
      this.logger?.debug?.(`Generated password for admin-created user: ${dto.email}`);
      passwordHash = await this.passwordService.hashPassword(generatedPasswordValue);
    } else {
      if (!dto.password) {
        throw new NAuthException(AuthErrorCode.WEAK_PASSWORD, 'Password is required when generatePassword is false');
      }

      this.logger?.debug?.('Validating password against policy');
      const passwordValidation = await this.passwordService.validatePassword(dto.password, {
        email: dto.email,
        username: dto.username,
      });

      if (!passwordValidation.valid) {
        this.logger?.warn?.(`Password validation failed for ${dto.email}: ${passwordValidation.errors.join(', ')}`);
        throw new NAuthException(AuthErrorCode.WEAK_PASSWORD, passwordValidation.errors.join(', '), {
          errors: passwordValidation.errors,
        });
      }

      passwordHash = await this.passwordService.hashPassword(dto.password);
    }

    await this.hookRegistry.executePreSignup(dto, 'password', undefined, true);

    this.logger?.debug?.(
      `Creating admin user record for: ${dto.email} || ${dto.username} || ${dto.phone} (isEmailVerified: ${dto.isEmailVerified || false}, isPhoneVerified: ${dto.isPhoneVerified || false})`,
    );
    const user = this.userRepository.create({
      email: dto.email,
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      passwordHash,
      passwordChangedAt: new Date(),
      isEmailVerified: dto.isEmailVerified ?? false,
      isPhoneVerified: dto.isPhoneVerified ?? false,
      mustChangePassword: dto.mustChangePassword ?? false,
      isActive: true,
      metadata: dto.metadata,
    });

    let savedUser: IUser;
    try {
      savedUser = (await this.userRepository.save(user)) as unknown as IUser;
      this.logger?.log?.(`Admin user created successfully: ${dto.email} (sub: ${savedUser.sub})`);

      try {
        await this.auditService?.recordEvent({
          userId: savedUser.id,
          eventType: AuthAuditEventType.ACCOUNT_CREATED,
          eventStatus: 'INFO',
          authMethod: 'admin',
          metadata: {
            email: savedUser.email,
            username: savedUser.username || null,
            createdByAdmin: true,
            adminIdentifier: clientInfo.ipAddress || 'unknown',
            isEmailVerified: savedUser.isEmailVerified,
            isPhoneVerified: savedUser.isPhoneVerified,
            mustChangePassword: savedUser.mustChangePassword,
            passwordGenerated: !!generatedPassword,
          },
        });
      } catch (auditError) {
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record ACCOUNT_CREATED audit event: ${errorMessage}`, {
          error: auditError,
          userId: savedUser.id,
        });
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        const dbError = error as { code: string; detail?: string; message?: string };
        if (dbError.detail?.includes('email')) {
          this.logger?.warn?.(`Admin signup failed - email constraint violation: ${dto.email}`);
          throw new NAuthException(AuthErrorCode.EMAIL_EXISTS, 'User with this email already exists');
        } else if (dbError.detail?.includes('username')) {
          this.logger?.warn?.(`Admin signup failed - username constraint violation: ${dto.username}`);
          throw new NAuthException(AuthErrorCode.USERNAME_EXISTS, 'Username is already taken');
        } else if (dbError.detail?.includes('phone')) {
          this.logger?.warn?.(`Admin signup failed - phone constraint violation: ${dto.phone}`);
          throw new NAuthException(AuthErrorCode.PHONE_EXISTS, 'Phone number is already registered');
        } else {
          this.logger?.error?.(`Admin signup failed - database constraint violation: ${dbError.message}`);
          throw new NAuthException(AuthErrorCode.EMAIL_EXISTS, 'User with this information already exists', {
            conflictType: 'unknown',
          });
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      this.logger?.error?.(`Admin signup failed - database error: ${errorMessage}`);
      throw error;
    }

    await this.hookRegistry.executePostSignup(savedUser, {
      signupType: 'password',
      adminSignup: true,
    });

    const userDto = UserResponseDTO.fromEntity(savedUser);
    return {
      user: userDto,
      generatedPassword,
    };
  }

  /**
   * Administrative social user import with override capabilities
   *
   * @param dto - Admin social signup DTO with social account details
   * @returns User object and social account confirmation
   * @throws {NAuthException} EMAIL_EXISTS | USERNAME_EXISTS | PHONE_EXISTS | SOCIAL_ACCOUNT_EXISTS | WEAK_PASSWORD
   *
   * @example
   * ```typescript
   * const result = await adminAuthService.signupSocial({
   *   email: 'user@example.com',
   *   provider: 'google',
   *   providerId: 'google_12345',
   * });
   * ```
   */
  async signupSocial(dto: AdminSignupSocialDTO): Promise<AdminSignupSocialResponseDTO> {
    dto = await ensureValidatedDto(AdminSignupSocialDTO, dto);

    const clientInfo = this.clientInfoService.get();

    this.logger?.log?.(`Admin social signup attempt for email: ${dto.email}, provider: ${dto.provider}`);
    this.logger?.debug?.(
      `Admin social signup details: { email: ${dto.email}, username: ${dto.username || 'none'}, provider: ${dto.provider}, providerId: ${dto.providerId}, ip: ${clientInfo.ipAddress} }`,
    );

    const existingUserByEmail = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUserByEmail) {
      this.logger?.warn?.(`Admin social signup failed - user already exists: ${dto.email}`);
      throw new NAuthException(AuthErrorCode.EMAIL_EXISTS, 'User with this email already exists');
    }

    if (dto.username) {
      this.logger?.debug?.(`Checking if username exists: ${dto.username}`);
      const existingUserByUsername = await this.userRepository.findOne({
        where: { username: dto.username },
      });

      if (existingUserByUsername) {
        this.logger?.warn?.(`Admin social signup failed - username already exists: ${dto.username}`);
        throw new NAuthException(AuthErrorCode.USERNAME_EXISTS, 'Username is already taken');
      }
    }

    if (dto.phone && !this.config.signup?.allowDuplicatePhones) {
      this.logger?.debug?.(`Checking if phone exists: ${dto.phone}`);
      const existingUserByPhone = await this.userRepository.findOne({
        where: { phone: dto.phone },
      });

      if (existingUserByPhone) {
        this.logger?.warn?.(`Admin social signup failed - phone already exists: ${dto.phone}`);
        throw new NAuthException(AuthErrorCode.PHONE_EXISTS, 'Phone number is already registered');
      }
    }

    if (!this.socialAuthService) {
      this.logger?.error?.('SocialAuthService not available - cannot import social user');
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Social authentication is not configured');
    }

    this.logger?.debug?.(`Checking if social account exists: ${dto.provider}:${dto.providerId}`);
    const existingSocialAccount = await this.socialAuthService.findSocialAccountByProvider(
      dto.provider,
      dto.providerId,
    );

    if (existingSocialAccount) {
      this.logger?.warn?.(
        `Admin social signup failed - social account already exists: ${dto.provider}:${dto.providerId}`,
      );
      throw new NAuthException(AuthErrorCode.SOCIAL_ACCOUNT_EXISTS, 'This social account is already registered');
    }

    let passwordHash: string | null = null;
    if (dto.password) {
      const passwordValidation = await this.passwordService.validatePassword(dto.password, {
        email: dto.email,
        username: dto.username,
      });
      if (!passwordValidation.valid) {
        throw new NAuthException(AuthErrorCode.WEAK_PASSWORD, passwordValidation.errors.join(', '), {
          errors: passwordValidation.errors,
        });
      }
      passwordHash = await this.passwordService.hashPassword(dto.password);
    }

    await this.hookRegistry.executePreSignup(dto, 'social', dto.provider, true);

    const user = this.userRepository.create({
      email: dto.email,
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      passwordHash,
      passwordChangedAt: passwordHash ? new Date() : null,
      isEmailVerified: true,
      isPhoneVerified: dto.isPhoneVerified ?? false,
      mustChangePassword: dto.mustChangePassword ?? false,
      isActive: true,
      metadata: dto.metadata,
      hasSocialAuth: true,
    });

    let savedUser: IUser;
    try {
      savedUser = (await this.userRepository.save(user)) as unknown as IUser;

      await this.socialAuthService.createOrUpdateSocialAccount(
        savedUser.id,
        dto.provider,
        dto.providerId,
        dto.providerEmail,
        dto.socialMetadata,
      );

      this.logger?.log?.(`Admin social user created successfully: ${dto.email} (sub: ${savedUser.sub})`);

      try {
        await this.auditService?.recordEvent({
          userId: savedUser.id,
          eventType: AuthAuditEventType.ACCOUNT_CREATED,
          eventStatus: 'INFO',
          authMethod: `admin-social-${dto.provider}`,
          metadata: {
            email: savedUser.email,
            username: savedUser.username || null,
            createdByAdmin: true,
            adminIdentifier: clientInfo.ipAddress || 'unknown',
            isEmailVerified: savedUser.isEmailVerified,
            isPhoneVerified: savedUser.isPhoneVerified,
            mustChangePassword: savedUser.mustChangePassword,
            provider: dto.provider,
            providerId: dto.providerId,
            hasPassword: !!dto.password,
            socialImport: true,
          },
        });
      } catch (auditError) {
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record ACCOUNT_CREATED audit event: ${errorMessage}`, {
          error: auditError,
          userId: savedUser.id,
        });
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        const dbError = error as { code: string; detail?: string; message?: string };
        if (dbError.detail?.includes('email')) {
          this.logger?.warn?.(`Admin social signup failed - email constraint violation: ${dto.email}`);
          throw new NAuthException(AuthErrorCode.EMAIL_EXISTS, 'User with this email already exists');
        } else if (dbError.detail?.includes('username')) {
          this.logger?.warn?.(`Admin social signup failed - username constraint violation: ${dto.username}`);
          throw new NAuthException(AuthErrorCode.USERNAME_EXISTS, 'Username is already taken');
        } else if (dbError.detail?.includes('phone')) {
          this.logger?.warn?.(`Admin social signup failed - phone constraint violation: ${dto.phone}`);
          throw new NAuthException(AuthErrorCode.PHONE_EXISTS, 'Phone number is already registered');
        } else if (dbError.detail?.includes('provider') && dbError.detail?.includes('providerId')) {
          this.logger?.warn?.(
            `Admin social signup failed - social account constraint violation: ${dto.provider}:${dto.providerId}`,
          );
          throw new NAuthException(AuthErrorCode.SOCIAL_ACCOUNT_EXISTS, 'This social account is already registered');
        } else {
          this.logger?.error?.(`Admin social signup failed - database constraint violation: ${dbError.message}`);
          throw new NAuthException(AuthErrorCode.EMAIL_EXISTS, 'User with this information already exists', {
            conflictType: 'unknown',
          });
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      this.logger?.error?.(`Admin social signup failed - database error: ${errorMessage}`);
      throw error;
    }

    await this.hookRegistry.executePostSignup(savedUser, {
      signupType: 'social',
      adminSignup: true,
    });

    const userDto = UserResponseDTO.fromEntity(savedUser);
    return {
      user: userDto,
      socialAccount: {
        provider: dto.provider,
        providerId: dto.providerId,
        providerEmail: dto.providerEmail || null,
      },
    };
  }

  /**
   * Global signout (admin-initiated)
   *
   * @param dto - Target user sub and optional forgetDevices flag
   * @returns Number of sessions revoked
   * @throws {NAuthException} NOT_FOUND if user not found
   *
   * @example
   * ```typescript
   * const result = await adminAuthService.logoutAll({ sub: 'user-uuid', forgetDevices: true });
   * ```
   */
  async logoutAll(dto: AdminLogoutAllDTO): Promise<LogoutAllResponseDTO> {
    dto = await ensureValidatedDto(AdminLogoutAllDTO, dto);

    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const revokedCount = await this.sessionService.revokeAllUserSessions(user.id, 'Admin global signout');

    let revokedDevicesCount = 0;
    let revokedDevices: Array<{
      id: number | string;
      deviceName: string | null;
      lastUsedAt: Date | null;
      trustedUntil: Date | null;
    }> = [];
    if (
      dto.forgetDevices &&
      this.config.mfa?.rememberDevices &&
      this.config.mfa?.rememberDevices !== 'never' &&
      this.trustedDeviceService
    ) {
      try {
        const deviceRevocationResult = await this.trustedDeviceService.revokeAllTrustedDevices(user.id);
        revokedDevicesCount = deviceRevocationResult.revokedCount;
        revokedDevices = deviceRevocationResult.devices;
        this.logger?.log?.(
          `Revoked ${revokedDevicesCount} trusted device(s) for user ${user.sub} (admin forgetDevices=true)`,
        );

        if (revokedDevicesCount > 0 && this.auditService) {
          try {
            const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
            const clientInfo = this.clientInfoService.get();
            await this.auditService.recordEvent({
              userId,
              eventType: AuthAuditEventType.DEVICE_UNTRUSTED,
              eventStatus: 'SUCCESS',
              description: `Admin global signout: All trusted devices revoked (${revokedDevicesCount} device(s))`,
              metadata: {
                reason: 'admin_global_logout_forget_devices',
                initiatedBy: 'admin',
                adminIdentifier: clientInfo.ipAddress || 'unknown',
                revokedDevicesCount,
                devices: revokedDevices.map((d) => ({
                  id: d.id,
                  deviceName: d.deviceName,
                  lastUsedAt: d.lastUsedAt?.toISOString() || null,
                  trustedUntil: d.trustedUntil?.toISOString() || null,
                })),
              },
            });
          } catch (auditError) {
            const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
            this.logger?.error?.(`Failed to record DEVICE_UNTRUSTED audit event: ${errorMessage}`, {
              error: auditError,
              userId: user.id,
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger?.debug?.(`Failed to revoke trusted devices on admin global logout: ${errorMessage}`, { error });
      }
    }

    return { revokedCount };
  }

  /**
   * Get all active sessions for a user (admin)
   *
   * @param dto - Contains target user sub
   * @returns Array of sessions with device info, auth method, and isCurrent flag
   * @throws {NAuthException} NOT_FOUND if user not found
   *
   * @example
   * ```typescript
   * const result = await adminAuthService.getUserSessions({ sub: 'user-uuid' });
   * ```
   */
  async getUserSessions(dto: GetUserSessionsDTO): Promise<GetUserSessionsResponseDTO> {
    dto = await ensureValidatedDto(GetUserSessionsDTO, dto);

    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const clientInfo = this.clientInfoService.get();
    const currentSessionId = clientInfo.sessionId ? String(clientInfo.sessionId) : null;

    const sessions = await this.sessionService.findUserSessions(user.id);

    const sessionInfos: UserSessionInfo[] = sessions.map((session) => {
      let authMethod: string | null = session.authMethod || null;
      let authProvider: string | null = null;

      if (authMethod === 'social' || authMethod?.startsWith('admin-')) {
        const metadata = session.metadata || {};
        authProvider = (metadata.authProvider as string) || (metadata.provider as string) || null;

        if (!authProvider && authMethod && authMethod !== 'social' && !authMethod.startsWith('admin-')) {
          authProvider = authMethod;
          authMethod = 'social';
        }
      }

      const isCurrent = currentSessionId !== null && String(session.id) === currentSessionId;

      return {
        sessionId: String(session.id),
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        platform: session.platform,
        browser: session.browser,
        ipAddress: session.ipAddress,
        ipCountry: session.ipCountry,
        ipCity: session.ipCity,
        lastActivityAt: session.lastActivityAt || session.createdAt,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        isTrustedDevice: session.isTrustedDevice,
        isCurrent,
        authMethod,
        authProvider,
      };
    });

    return { sessions: sessionInfos };
  }

  /**
   * Revoke a specific user session by ID (admin)
   *
   * @param dto - Contains sessionId and user sub
   * @returns Success status and whether it was the current session
   * @throws {NAuthException} NOT_FOUND if user not found
   * @throws {NAuthException} SESSION_NOT_FOUND if session not found
   * @throws {NAuthException} FORBIDDEN if session doesn't belong to user
   *
   * @example
   * ```typescript
   * await adminAuthService.revokeUserSession({ sub: 'user-uuid', sessionId: '123' });
   * ```
   */
  async revokeUserSession(dto: AdminRevokeSessionDTO): Promise<LogoutSessionResponseDTO> {
    dto = await ensureValidatedDto(AdminRevokeSessionDTO, dto);

    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const sessionId = typeof dto.sessionId === 'string' ? parseInt(dto.sessionId, 10) : dto.sessionId;
    if (isNaN(sessionId)) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid session ID');
    }

    const session = await this.sessionService.findById(sessionId);
    if (!session) {
      throw new NAuthException(AuthErrorCode.SESSION_NOT_FOUND, 'Session not found');
    }

    if (session.userId !== user.id) {
      throw new NAuthException(AuthErrorCode.FORBIDDEN, 'Session does not belong to user');
    }

    const clientInfo = this.clientInfoService.get();
    const currentSessionId = clientInfo.sessionId ? parseInt(String(clientInfo.sessionId), 10) : null;
    const wasCurrentSession = currentSessionId !== null && sessionId === currentSessionId;

    await this.sessionService.revokeSession(sessionId, 'Admin revoked session', {
      requestedBy: dto.sub,
      wasCurrentSession,
      initiatedBy: 'admin',
      adminIdentifier: clientInfo.ipAddress || 'unknown',
    });

    if (this.auditService) {
      try {
        await this.auditService.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.SESSION_REVOKED,
          eventStatus: 'INFO',
          reason: 'admin_requested',
          description: `Session revoked by admin${wasCurrentSession ? ' (current session)' : ''}`,
          metadata: {
            sessionId,
            wasCurrentSession,
            initiatedBy: 'admin',
            adminIdentifier: clientInfo.ipAddress || 'unknown',
          },
        });
      } catch (auditError) {
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record SESSION_REVOKED audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
        });
      }
    }

    return {
      success: true,
      wasCurrentSession,
    };
  }

  /**
   * Update user profile attributes (admin)
   *
   * @param dto - AdminUpdateUserAttributesDTO containing sub and fields to update
   * @returns Updated user object
   * @throws {NAuthException} If user not found or unique constraint violated
   *
   * @example
   * ```typescript
   * const user = await adminAuthService.updateUserAttributes({ sub: 'user-uuid', email: 'new@example.com' });
   * ```
   */
  async updateUserAttributes(dto: AdminUpdateUserAttributesDTO): Promise<UserResponseDTO> {
    return await this.userService.updateUserAttributes(dto);
  }

  /**
   * Admin-only: Initiate a code-based password reset workflow.
   *
   * @param dto - Admin reset password request
   * @returns Response with masked destination, expiry, and sessions revoked count
   * @throws {NAuthException} NOT_FOUND when user not found
   *
   * @example
   * ```typescript
   * const result = await adminAuthService.resetPassword({ sub: 'user-uuid', deliveryMethod: 'email' });
   * ```
   */
  async resetPassword(dto: AdminResetPasswordDTO): Promise<AdminResetPasswordResponseDTO> {
    dto = await ensureValidatedDto(AdminResetPasswordDTO, dto);

    this.logger?.log?.(`Admin password reset requested for sub: ${dto.sub}`);
    this.logger?.debug?.(
      `Reset details: { sub: ${dto.sub}, deliveryMethod: ${dto.deliveryMethod ?? 'email'}, revokeSessions: ${dto.revokeSessions ?? false}, baseUrl: ${dto.baseUrl ?? 'none'}, reason: ${dto.reason ?? 'none'} }`,
    );

    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    if (!user) {
      this.logger?.warn?.(`Admin password reset failed - user not found: ${dto.sub}`);
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    if (!this.passwordResetService) {
      this.logger?.error?.('Password reset service not available');
      throw new NAuthException(
        AuthErrorCode.SERVICE_UNAVAILABLE,
        'Password reset service is not configured. Please configure an email provider.',
      );
    }

    const revokeSessions = dto.revokeSessions ?? false;
    let sessionsRevoked = 0;

    if (revokeSessions) {
      sessionsRevoked = await this.sessionService.revokeAllUserSessions(user.id, 'Admin initiated password reset');
      this.logger?.log?.(`Revoked ${sessionsRevoked} sessions for user ${user.sub}`);
    }

    const delivery = dto.deliveryMethod || 'email';
    const expiresIn = dto.codeExpiresIn || 3600;

    const result = await this.passwordResetService.requestAdminReset(user, delivery, {
      expiresIn,
      baseUrl: dto.baseUrl,
    });

    await this.auditService?.recordEvent({
      userId: user.id,
      eventType: AuthAuditEventType.ADMIN_PASSWORD_RESET_INITIATED,
      eventStatus: 'INFO',
      authMethod: 'password',
      description: dto.reason || 'Admin initiated password reset',
      reason: dto.reason,
      metadata: {
        sub: dto.sub,
        medium: delivery,
        expiresIn,
        sessionsRevoked,
        hasBaseUrl: !!dto.baseUrl,
      },
    });

    return {
      success: true,
      destination: result.destination,
      deliveryMedium: result.deliveryMedium,
      expiresIn: result.expiresIn,
      sessionsRevoked: revokeSessions ? sessionsRevoked : undefined,
    };
  }

  /**
   * Complete admin-initiated password reset with a verification code.
   *
   * @param dto - Confirm admin reset password request
   * @returns Success response
   * @throws {NAuthException} NOT_FOUND | PASSWORD_RESET_CODE_INVALID | PASSWORD_RESET_CODE_EXPIRED | PASSWORD_RESET_MAX_ATTEMPTS | WEAK_PASSWORD | PASSWORD_REUSED | INVALID_CREDENTIALS
   *
   * @example
   * ```typescript
   * await adminAuthService.confirmResetPassword({ identifier: 'user@example.com', code: '123456', newPassword: 'NewPass123!' });
   * ```
   */
  async confirmResetPassword(dto: ConfirmAdminResetPasswordDTO): Promise<ConfirmAdminResetPasswordResponseDTO> {
    dto = await ensureValidatedDto(ConfirmAdminResetPasswordDTO, dto);

    this.logger?.log?.(`Confirm admin password reset for identifier: ${dto.identifier}`);

    const user = await this.helpers.findUserByIdentifier(dto.identifier, this.config.login?.identifierType);
    if (!user) {
      // Non-enumerating: treat as invalid code
      this.logger?.warn?.(`Confirm admin reset failed - user not found for identifier: ${dto.identifier}`);
      throw new NAuthException(AuthErrorCode.PASSWORD_RESET_CODE_INVALID, 'Invalid password reset code');
    }

    if (!this.passwordResetService) {
      this.logger?.error?.('Password reset service not available');
      throw new NAuthException(
        AuthErrorCode.SERVICE_UNAVAILABLE,
        'Password reset service is not configured. Please configure an email provider.',
      );
    }

    await this.passwordResetService.consumeValidCode(user, dto.code, 'admin_password_reset');

    await this.helpers.updateUserPassword(
      {
        user,
        newPassword: dto.newPassword,
        mustChangePassword: false,
        revokeSessions: true,
        revokeReason: 'Admin-initiated password reset completed',
        audit: {
          eventType: AuthAuditEventType.ADMIN_PASSWORD_RESET_COMPLETED,
          eventStatus: 'SUCCESS',
          description: 'User completed admin-initiated password reset',
          metadata: {
            usedCode: true,
            identifier: dto.identifier,
          },
        },
      },
      this.passwordService,
      this.auditService,
    );

    return {
      success: true,
    };
  }

  /**
   * Admin-only: Reset a user's password by sub.
   *
   * @param dto - Admin reset password request
   * @returns Response with success status and session revocation count
   * @throws {NAuthException} If user not found, user has no password (social-only), or password validation fails
   *
   * @example
   * ```typescript
   * const result = await adminAuthService.setPassword({ sub: 'user-uuid', newPassword: 'NewPass123!' });
   * ```
   */
  async setPassword(dto: AdminSetPasswordDTO): Promise<AdminSetPasswordResponseDTO> {
    dto = await ensureValidatedDto(AdminSetPasswordDTO, dto);

    this.logger?.log?.(`Admin password reset requested for sub: ${dto.sub}`);
    this.logger?.debug?.(
      `Reset details: { sub: ${dto.sub}, mustChangePassword: ${dto.mustChangePassword ?? true}, revokeSessions: ${dto.revokeSessions ?? true} }`,
    );

    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    if (!user) {
      this.logger?.warn?.(`Password reset failed - user not found: ${dto.sub}`);
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const mustChangePassword = dto.mustChangePassword ?? true;
    const revokeSessions = dto.revokeSessions !== false;
    const wasSocialOnly = !user.passwordHash;

    const { sessionsRevoked } = await this.helpers.updateUserPassword(
      {
        user,
        newPassword: dto.newPassword,
        mustChangePassword,
        revokeSessions,
        revokeReason: 'Password reset by administrator',
        audit: {
          eventType: AuthAuditEventType.PASSWORD_RESET_COMPLETED,
          eventStatus: 'SUCCESS',
          reason: 'admin_reset',
          description: 'Password reset by administrator',
          metadata: {
            sub: dto.sub,
            mustChangePassword,
            wasSocialOnly,
          },
        },
      },
      this.passwordService,
      this.auditService,
    );

    return {
      success: true,
      mustChangePassword,
      sessionsRevoked,
    };
  }
}
