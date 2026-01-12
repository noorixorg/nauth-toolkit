import { Repository } from 'typeorm';
import { IUser, ISession } from '../interfaces/entities.interface';
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
import { JwtService } from './jwt.service';
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
import { RiskFactor } from '../enums/risk-factor.enum';
import { MFAService } from './mfa.service';
import { ContextStorage } from '../utils/context-storage';
import { SignupDTO } from '../dto/signup.dto';
import { AdminSignupDTO, AdminSignupResponseDTO } from '../dto/admin-signup.dto';
import { AdminSignupSocialDTO, AdminSignupSocialResponseDTO } from '../dto/admin-signup-social.dto';
import { DeleteUserDTO, DeleteUserResponseDTO } from '../dto/delete-user.dto';
import { GetUsersDTO, GetUsersResponseDTO } from '../dto/get-users.dto';
import { DisableUserDTO, DisableUserResponseDTO } from '../dto/disable-user.dto';
import { EnableUserDTO, EnableUserResponseDTO } from '../dto/enable-user.dto';
import { LoginDTO } from '../dto/login.dto';
import { ChangePasswordRequestDTO } from '../dto/change-password-request.dto';
import { ChangePasswordResponseDTO } from '../dto/change-password-response.dto';
import { UpdateUserAttributesRequestDTO } from '../dto/update-user-attributes-request.dto';
import { UpdateVerifiedStatusRequestDTO } from '../dto/update-verified-status-request.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { AuthResponseDTO, TokenResponse, toAuthResponseUser } from '../dto/auth-response.dto';
import { AuthChallenge } from '../dto/auth-challenge.dto';
import {
  ChallengeResponseData,
  VerifyEmailResponse,
  CollectPhoneResponse,
  VerifyPhoneResponse,
  VerifyMFACodeResponse,
  VerifyMFAPasskeyResponse,
  ForceChangePasswordResponse,
  MFASetupResponse,
} from '../dto/challenge-response.dto';
import { RespondChallengeDTO } from '../dto/respond-challenge.dto';
import { GetUserByEmailDTO } from '../dto/get-user-by-email.dto';
import { GetUserByIdDTO } from '../dto/get-user-by-id.dto';
import { LogoutDTO } from '../dto/logout.dto';
import { LogoutResponseDTO } from '../dto/logout-response.dto';
import { LogoutAllDTO } from '../dto/logout-all.dto';
import { LogoutAllResponseDTO } from '../dto/logout-all-response.dto';
import { GetUserSessionsDTO } from '../dto/get-user-sessions.dto';
import { GetUserSessionsResponseDTO, UserSessionInfo } from '../dto/get-user-sessions-response.dto';
import { LogoutSessionDTO } from '../dto/logout-session.dto';
import { LogoutSessionResponseDTO } from '../dto/logout-session-response.dto';
import { RefreshTokenDTO } from '../dto/refresh-token.dto';
import { ResendCodeDTO } from '../dto/resend-code.dto';
import { ResendCodeResponseDTO } from '../dto/resend-code-response.dto';
import { SetMustChangePasswordDTO } from '../dto/set-must-change-password.dto';
import { SetMustChangePasswordResponseDTO } from '../dto/set-must-change-password-response.dto';
import { AdminSetPasswordDTO, AdminSetPasswordResponseDTO } from '../dto/admin-set-password.dto';
import {
  AdminResetPasswordDTO,
  AdminResetPasswordResponseDTO,
  ConfirmAdminResetPasswordDTO,
  ConfirmAdminResetPasswordResponseDTO,
} from '../dto/admin-reset-password.dto';
import { ForgotPasswordDTO, ForgotPasswordResponseDTO } from '../dto/forgot-password.dto';
import { ConfirmForgotPasswordDTO, ConfirmForgotPasswordResponseDTO } from '../dto/confirm-forgot-password.dto';
import { TrustDeviceResponseDTO } from '../dto/trust-device-response.dto';
import { IsTrustedDeviceResponseDTO } from '../dto/is-trusted-device-response.dto';
import { ResendVerificationEmailDTO } from '../dto/verify-email.dto';
import { SendVerificationSMSDTO, ResendVerificationSMSDTO } from '../dto/verify-phone.dto';
import { ValidateAccessTokenDTO } from '../dto/validate-access-token.dto';
import { ValidateAccessTokenResponseDTO } from '../dto/validate-access-token-response.dto';
import { PasswordResetService } from './password-reset.service';
import { SocialAuthService } from './social-auth.service';
import { HookRegistryService } from './hook-registry.service';
import { AuthServiceInternalHelpers } from './auth-service-internal-helpers';
import { UserService } from './user.service';

import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { isUUID } from 'class-validator';
import * as crypto from 'crypto';
import { generateSecurePassword } from '../utils/password-generator';
import { ensureValidatedDto } from '../utils/dto-validator';
import { clearAuthCookies as clearAuthCookiesCompat } from '../utils/cookies.util';

/**
 * Dummy Argon2 hash for constant-time response
 *
 * SECURITY CRITICAL: Used when user doesn't exist to prevent timing attacks
 * This dummy hash has same format/cost as real Argon2id hashes but verifies against nothing.
 *
 * Format: $argon2id$v=19$m=65536,t=3,p=4$salt$hash
 */
const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$RFVNTVlfU0FMVF9GT1JfVElNSU5H$dummyhashfordummyhashfordummyhash1234567890';

export class AuthService {
  private readonly helpers: AuthServiceInternalHelpers;
  private readonly userService: UserService;

  constructor(
    private readonly userRepository: Repository<BaseUser>,
    private readonly loginAttemptRepository: Repository<BaseLoginAttempt>,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly challengeService: ChallengeService,
    private readonly challengeHelper: AuthChallengeHelperService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly clientInfoService: ClientInfoService,
    private readonly accountLockoutStorage: AccountLockoutStorageService,
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
    private readonly hookRegistry: HookRegistryService,
    private readonly auditService?: AuthAuditService, // Optional - audit trail service (enabled via config.auditLogs.enabled)
    private readonly phoneVerificationService?: PhoneVerificationService, // Optional - only available when SMS provider is configured
    private readonly mfaService?: MFAService, // Optional - available when MFA modules are imported
    private readonly mfaDeviceRepository?: Repository<BaseMFADevice>, // Optional - available when MFA modules are imported
    private readonly trustedDeviceService?: TrustedDeviceService, // Optional - only available when rememberDevices is not 'never'
    private readonly passwordResetService?: PasswordResetService, // Optional - only available when configured by framework adapter
    private readonly socialAuthService?: SocialAuthService, // Optional - only available when social auth is configured
    private readonly sessionRepository?: Repository<BaseSession>, // Optional - for cascade deletion
    private readonly verificationTokenRepository?: Repository<BaseVerificationToken>, // Optional - for cascade deletion
    private readonly socialAccountRepository?: Repository<BaseSocialAccount>, // Optional - for cascade deletion
    private readonly challengeSessionRepository?: Repository<BaseChallengeSession>, // Optional - for cascade deletion
    private readonly authAuditRepository?: Repository<BaseAuthAudit>, // Optional - for cascade deletion
    private readonly trustedDeviceRepository?: Repository<BaseTrustedDevice>, // Optional - for cascade deletion
  ) {
    // Initialize internal helpers with only needed dependencies
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

    // Initialize UserService for user data management
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
      this.helpers, // Pass helpers for validateUniquenessConstraints
    );

    this.logger?.log?.('AuthService initialized');
  }

  // ============================================================================
  // User Signup
  // ============================================================================

  /**
   * Register a new user.
   *
   * Checks for duplicates (email, username, phone), validates password, hashes it,
   * creates the user, and returns tokens or a challenge if verification is required.
   *
   * @param dto - Signup payload
   * @returns Auth response with tokens or a verification challenge
   * @throws {NAuthException} If user exists, password is invalid, or signup is disabled
   *
   * @example
   * ```typescript
   * const result = await authService.signup({
   *   email: 'user@example.com',
   *   password: 'Password123!',
   *   username: 'johndoe',
   * });
   * ```
   */
  async signup(dto: SignupDTO): Promise<AuthResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(SignupDTO, dto);

    // Get client info from request context (transparent!)
    const clientInfo = this.clientInfoService.get();

    this.logger?.log?.(`Signup attempt for email: ${dto.email}`);
    this.logger?.debug?.(
      `Signup details: { email: ${dto.email}, username: ${dto.username || 'none'}, ip: ${clientInfo.ipAddress} }`,
    );

    // Check if signup is enabled
    if (this.config.signup?.enabled === false) {
      this.logger?.warn?.(`Signup blocked - signup is disabled`);
      throw new NAuthException(AuthErrorCode.SIGNUP_DISABLED, 'Signups are currently disabled');
    }

    // Check if user already exists (email and username)
    this.logger?.debug?.(`Checking if user exists: ${dto.email}`);
    const existingUserByEmail = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUserByEmail) {
      this.logger?.warn?.(`Signup failed - user already exists: ${dto.email}`);
      throw new NAuthException(AuthErrorCode.EMAIL_EXISTS, 'User with this email already exists');
    }

    // Check for duplicate username if provided
    if (dto.username) {
      this.logger?.debug?.(`Checking if username exists: ${dto.username}`);
      const existingUserByUsername = await this.userRepository.findOne({
        where: { username: dto.username },
      });

      if (existingUserByUsername) {
        this.logger?.warn?.(`Signup failed - username already exists: ${dto.username}`);
        throw new NAuthException(AuthErrorCode.USERNAME_EXISTS, 'Username is already taken');
      }
    }

    // Check for duplicate phone if provided and duplicates not allowed
    if (dto.phone && !this.config.signup?.allowDuplicatePhones) {
      this.logger?.debug?.(`Checking if phone exists: ${dto.phone}`);
      const existingUserByPhone = await this.userRepository.findOne({
        where: { phone: dto.phone },
      });

      if (existingUserByPhone) {
        this.logger?.warn?.(`Signup failed - phone already exists: ${dto.phone}`);
        throw new NAuthException(AuthErrorCode.PHONE_EXISTS, 'Phone number is already registered');
      }
    }

    // Validate password policy
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

    // Hash password
    const passwordHash = await this.passwordService.hashPassword(dto.password);

    // ============================================================================
    // Lifecycle Hook: preSignup
    // ============================================================================
    // Execute preSignup hook before user creation
    // Hook can throw NAuthException with PRESIGNUP_FAILED to block signup with custom message
    await this.hookRegistry.executePreSignup(dto, 'password', undefined, false);

    // Determine verification requirements based on verification method
    const verificationMethod = this.config.signup?.verificationMethod;

    // Validate required fields based on verification method
    if ((verificationMethod === 'phone' || verificationMethod === 'both') && !dto.phone) {
      this.logger?.warn?.(`Signup failed - phone required for verification method: ${verificationMethod}`);
      throw new NAuthException(
        AuthErrorCode.PHONE_REQUIRED,
        'Phone number is required for the selected verification method',
        { verificationMethod },
      );
    }

    // Create user
    // Users are always created as ACTIVE (so they can complete pending challenges)
    // Verification status controls access via challenge system, not account activation
    // Email and phone verification status is always false initially - must be explicitly verified
    this.logger?.debug?.(`Creating user record for: ${dto.email} || ${dto.username} || ${dto.phone}`);
    const user = this.userRepository.create({
      email: dto.email,
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      passwordHash,
      passwordChangedAt: new Date(),
      isEmailVerified: false, // Always false initially - must be explicitly verified
      isPhoneVerified: false, // Always false initially - must be verified via SMS
      isActive: true, // Always active - challenges control access instead
      metadata: dto.metadata,
    });

    let savedUser: IUser;
    try {
      savedUser = (await this.userRepository.save(user)) as IUser;
      this.logger?.log?.(`User created successfully: ${dto.email} (sub: ${savedUser.sub})`);

      // ============================================================================
      // Audit: Record account creation
      // ============================================================================
      try {
        await this.auditService?.recordEvent({
          userId: savedUser.id,
          eventType: AuthAuditEventType.ACCOUNT_CREATED,
          eventStatus: 'INFO',
          authMethod: 'password',
          // Client info automatically included from context
          metadata: {
            email: savedUser.email,
            username: savedUser.username || null,
            verificationMethod,
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record ACCOUNT_CREATED audit event: ${errorMessage}`, {
          error: auditError,
          userId: savedUser.id,
        });
      }
    } catch (error: unknown) {
      // Handle database constraint violations gracefully
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        // PostgreSQL unique constraint violation
        const dbError = error as { code: string; detail?: string; message?: string };
        if (dbError.detail?.includes('email')) {
          this.logger?.warn?.(`Signup failed - email constraint violation: ${dto.email}`);
          throw new NAuthException(AuthErrorCode.EMAIL_EXISTS, 'User with this email already exists');
        } else if (dbError.detail?.includes('username')) {
          this.logger?.warn?.(`Signup failed - username constraint violation: ${dto.username}`);
          throw new NAuthException(AuthErrorCode.USERNAME_EXISTS, 'Username is already taken');
        } else if (dbError.detail?.includes('phone')) {
          this.logger?.warn?.(`Signup failed - phone constraint violation: ${dto.phone}`);
          throw new NAuthException(AuthErrorCode.PHONE_EXISTS, 'Phone number is already registered');
        } else {
          this.logger?.error?.(`Signup failed - database constraint violation: ${dbError.message}`);
          throw new NAuthException(AuthErrorCode.EMAIL_EXISTS, 'User with this information already exists', {
            conflictType: 'unknown',
          });
        }
      }

      // Re-throw other database errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      this.logger?.error?.(`Signup failed - database error: ${errorMessage}`);
      throw error;
    }

    // ============================================================================
    // Verification Code Sending: Handled by challenge system (sequential flow)
    // ============================================================================
    // All verification codes are sent when challenges are created (in AuthChallengeHelperService.createChallengeResponse)
    // This ensures proper sequential flow: email code first, then phone code after email is verified
    // This prevents user confusion from receiving multiple codes at once

    // ============================================================================
    // Lifecycle Hook: postSignup
    // ============================================================================
    // Execute postSignup hook immediately after account creation (non-blocking)
    await this.hookRegistry.executePostSignup(savedUser, {
      requiresVerification: verificationMethod !== 'none',
      signupType: 'password',
      adminSignup: false,
    });

    // ============================================================================
    // refresh user data in case post signup hook has modified the user
    // ============================================================================
    const refreshedUser = await this.userRepository.findOne({
      where: { id: savedUser.id },
    });
    if (refreshedUser) {
      savedUser = refreshedUser as IUser;
    }

    // ============================================================================
    // Lifecycle Hook: onboardingCompleted
    // ============================================================================
    // Welcome-style emails should be sent when onboarding is complete:
    // - Immediately for verificationMethod = 'none'
    // - Otherwise, fired by EmailVerificationService / PhoneVerificationService once verification completes
    if (verificationMethod === 'none') {
      await this.hookRegistry.executeOnboardingCompleted(savedUser, {
        verificationMethod: 'none',
        source: 'signup',
        completedAt: new Date(),
      });
    }

    // ============================================================================
    // Challenge System: Determine if user needs to complete challenges
    // ============================================================================

    const response = await this.challengeHelper.determineAuthResponse({
      user: savedUser,
      config: this.config,
      deviceToken: clientInfo.deviceToken,
    });

    if (response.challengeName) {
      this.logger?.log?.(`Challenge required for user ${savedUser.sub}: ${response.challengeName}`);
    } else {
      this.logger?.log?.(`Signup successful - tokens issued for: ${dto.email}`);
    }

    return response;
  }

  // ============================================================================
  // Admin Signup
  // ============================================================================

  /**
   * Administrative user creation with override capabilities
   *
   * Allows administrators to create user accounts with:
   * - Bypass email/phone verification requirements
   * - Force password change on first login
   * - Auto-generate secure passwords
   *
   * Security:
   * - No built-in authentication - endpoint must be protected by framework adapter
   * - All duplicate checks still enforced
   * - Password policy still enforced (unless auto-generated)
   * - Audit trail records admin-created accounts
   *
   * @param dto - Admin signup DTO with override flags
   * @returns User object and optionally generated password
   * @throws {NAuthException} EMAIL_EXISTS | USERNAME_EXISTS | PHONE_EXISTS | WEAK_PASSWORD
   *
   * @example
   * ```typescript
   * // Create user with pre-verified email
   * const result = await authService.adminSignup({
   *   email: 'user@example.com',
   *   password: 'SecurePass123!',
   *   isEmailVerified: true,
   * });
   *
   * // Create user with auto-generated password
   * const result = await authService.adminSignup({
   *   email: 'user@example.com',
   *   generatePassword: true,
   *   isEmailVerified: true,
   *   mustChangePassword: true,
   * });
   * // result.generatedPassword contains the temporary password
   * ```
   */
  async adminSignup(dto: AdminSignupDTO): Promise<AdminSignupResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(AdminSignupDTO, dto);

    // Get client info from request context (transparent!)
    const clientInfo = this.clientInfoService.get();

    this.logger?.log?.(`Admin signup attempt for email: ${dto.email}`);
    this.logger?.debug?.(
      `Admin signup details: { email: ${dto.email}, username: ${dto.username || 'none'}, ip: ${clientInfo.ipAddress} }`,
    );

    // Skip signup.enabled check (admin bypass)

    // Check if user already exists (email and username)
    this.logger?.debug?.(`Checking if user exists: ${dto.email}`);
    const existingUserByEmail = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUserByEmail) {
      this.logger?.warn?.(`Admin signup failed - user already exists: ${dto.email}`);
      throw new NAuthException(AuthErrorCode.EMAIL_EXISTS, 'User with this email already exists');
    }

    // Check for duplicate username if provided
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

    // Check for duplicate phone if provided and duplicates not allowed
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

    // Handle password
    let passwordHash: string;
    let generatedPassword: string | undefined;

    if (dto.generatePassword) {
      // Generate secure random password
      generatedPassword = generateSecurePassword(16);
      this.logger?.debug?.(`Generated password for admin-created user: ${dto.email}`);
      passwordHash = await this.passwordService.hashPassword(generatedPassword);
    } else {
      // Validate password policy
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

      // Hash password
      passwordHash = await this.passwordService.hashPassword(dto.password);
    }

    // ============================================================================
    // Lifecycle Hook: preSignup
    // ============================================================================
    // Execute preSignup hook before user creation (admin signup)
    // Hook can throw NAuthException with PRESIGNUP_FAILED to block signup with custom message
    await this.hookRegistry.executePreSignup(dto, 'password', undefined, true);

    // Create user with override flags
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
      isEmailVerified: dto.isEmailVerified ?? false, // Use DTO value or default to false
      isPhoneVerified: dto.isPhoneVerified ?? false, // Use DTO value or default to false
      mustChangePassword: dto.mustChangePassword ?? false, // Use DTO value or default to false
      isActive: true, // Always active
      metadata: dto.metadata,
    });

    let savedUser: IUser;
    try {
      savedUser = (await this.userRepository.save(user)) as unknown as IUser;
      this.logger?.log?.(`Admin user created successfully: ${dto.email} (sub: ${savedUser.sub})`);

      // ============================================================================
      // Audit: Record account creation by admin
      // ============================================================================
      try {
        await this.auditService?.recordEvent({
          userId: savedUser.id,
          eventType: AuthAuditEventType.ACCOUNT_CREATED,
          eventStatus: 'INFO',
          authMethod: 'admin',
          // Client info automatically included from context
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
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record ACCOUNT_CREATED audit event: ${errorMessage}`, {
          error: auditError,
          userId: savedUser.id,
        });
      }
    } catch (error: unknown) {
      // Handle database constraint violations gracefully
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        // PostgreSQL unique constraint violation
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

      // Re-throw other database errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      this.logger?.error?.(`Admin signup failed - database error: ${errorMessage}`);
      throw error;
    }

    // ============================================================================
    // Lifecycle Hook: afterSignup
    // ============================================================================
    // Execute afterSignup hook immediately after account creation (non-blocking)
    await this.hookRegistry.executePostSignup(savedUser, {
      signupType: 'password',
      adminSignup: true,
    });

    // No tokens, no challenge system, no verification emails - pure user creation
    // Return sanitized user object (excludes passwordHash and other sensitive fields)
    const userDto = UserResponseDto.fromEntity(savedUser);
    return {
      user: userDto,
      generatedPassword,
    };
  }

  // ============================================================================
  // Admin Social Signup
  // ============================================================================

  /**
   * Administrative social user import with override capabilities
   *
   * Allows administrators to import existing social users from external platforms
   * (e.g., Cognito, Auth0) into nauth with:
   * - Bypass email/phone verification requirements
   * - Optional password for hybrid social+password accounts
   * - Social account linkage (provider + providerId)
   * - Automatic user flag updates (hasSocialAuth)
   *
   * Use case: Migrating users from external authentication platforms while
   * preserving their social login connections for transparent future logins.
   *
   * Security:
   * - No built-in authentication - endpoint must be protected by framework adapter
   * - All duplicate checks enforced (email, username, phone, provider+providerId)
   * - Password policy enforced if password provided
   * - Audit trail records admin-imported social accounts
   *
   * @param dto - Admin social signup DTO with social account details
   * @returns User object and social account confirmation
   * @throws {NAuthException} EMAIL_EXISTS | USERNAME_EXISTS | PHONE_EXISTS | SOCIAL_ACCOUNT_EXISTS | WEAK_PASSWORD
   *
   * @example
   * ```typescript
   * // Import social-only user from Cognito
   * // Note: Email is automatically verified for social imports (like normal social signup)
   * const result = await authService.adminSignupSocial({
   *   email: 'user@example.com',
   *   provider: 'google',
   *   providerId: 'google_12345',
   *   providerEmail: 'user@gmail.com',
   *   socialMetadata: { sub: 'google_12345', given_name: 'John' },
   * });
   *
   * // Import hybrid user with password + social
   * const result = await authService.adminSignupSocial({
   *   email: 'user@example.com',
   *   password: 'SecurePass123!',
   *   provider: 'apple',
   *   providerId: 'apple_67890',
   * });
   * ```
   */
  async adminSignupSocial(dto: AdminSignupSocialDTO): Promise<AdminSignupSocialResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(AdminSignupSocialDTO, dto);

    // Get client info from request context (transparent!)
    const clientInfo = this.clientInfoService.get();

    this.logger?.log?.(`Admin social signup attempt for email: ${dto.email}, provider: ${dto.provider}`);
    this.logger?.debug?.(
      `Admin social signup details: { email: ${dto.email}, username: ${dto.username || 'none'}, provider: ${dto.provider}, providerId: ${dto.providerId}, ip: ${clientInfo.ipAddress} }`,
    );

    // Skip signup.enabled check (admin bypass)

    // Check if user already exists (email and username)
    this.logger?.debug?.(`Checking if user exists: ${dto.email}`);
    const existingUserByEmail = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUserByEmail) {
      this.logger?.warn?.(`Admin social signup failed - user already exists: ${dto.email}`);
      throw new NAuthException(AuthErrorCode.EMAIL_EXISTS, 'User with this email already exists');
    }

    // Check for duplicate username if provided
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

    // Check for duplicate phone if provided and duplicates not allowed
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

    // Check for duplicate provider+providerId
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

    // Handle password (optional for hybrid accounts)
    let passwordHash: string | null;

    if (dto.password) {
      // Validate password policy
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

      // Hash password
      passwordHash = await this.passwordService.hashPassword(dto.password);
    } else {
      // Social-only user: no password (NULL in database)
      passwordHash = null;
    }

    // ============================================================================
    // Lifecycle Hook: preSignup
    // ============================================================================
    // Execute preSignup hook before user creation (admin social signup)
    // Hook can throw NAuthException with PRESIGNUP_FAILED to block signup with custom message
    // Convert AdminSignupSocialDTO to profile-like structure for hook
    const profileData = {
      email: dto.email,
      id: dto.providerId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      verified: true, // Admin signup always has verified email
      raw: dto.socialMetadata,
    };
    await this.hookRegistry.executePreSignup(profileData, 'social', dto.provider, true);

    // Create user with override flags
    // Note: Email is always verified for social imports (like normal social signup)
    this.logger?.debug?.(
      `Creating admin social user record for: ${dto.email} || ${dto.username} || ${dto.phone} (isEmailVerified: true [auto-verified for social], isPhoneVerified: ${dto.isPhoneVerified || false})`,
    );
    const user = this.userRepository.create({
      email: dto.email,
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      passwordHash, // null for social-only, hashed string for hybrid accounts
      passwordChangedAt: dto.password ? new Date() : null, // Only set if password provided
      isEmailVerified: true, // Always verified for social imports (like normal social signup)
      isPhoneVerified: dto.isPhoneVerified ?? false, // Use DTO value or default to false
      mustChangePassword: dto.mustChangePassword ?? false, // Use DTO value or default to false
      isActive: true, // Always active
      metadata: dto.metadata,
      hasSocialAuth: true, // Set immediately since we know this is a social user
      socialProviders: [dto.provider], // Set immediately with the provider from DTO
    });

    let savedUser: IUser;
    try {
      savedUser = (await this.userRepository.save(user)) as unknown as IUser;
      this.logger?.log?.(
        `Admin social user created successfully: ${dto.email} (sub: ${savedUser.sub}, provider: ${dto.provider})`,
      );

      // Create social account linkage
      this.logger?.debug?.(`Creating social account linkage: ${dto.provider}:${dto.providerId}`);
      await this.socialAuthService.createOrUpdateSocialAccount(
        savedUser.id as number,
        dto.provider,
        dto.providerId,
        dto.providerEmail || null,
        dto.socialMetadata,
      );
      this.logger?.log?.(`Social account linked successfully: ${dto.provider}:${dto.providerId}`);

      // Update savedUser in memory to reflect the updated social flags (no additional query needed)
      // updateUserSocialFlags() has already updated the DB, we just sync the in-memory object
      savedUser.hasSocialAuth = true;
      savedUser.socialProviders = [dto.provider];

      // ============================================================================
      // Lifecycle Hook: afterSignup
      // ============================================================================
      // Execute afterSignup hook immediately after account creation (non-blocking)
      // Extract profile picture from social metadata if available
      const profilePicture =
        dto.socialMetadata && typeof dto.socialMetadata === 'object' && 'picture' in dto.socialMetadata
          ? (dto.socialMetadata.picture as string | null)
          : null;

      await this.hookRegistry.executePostSignup(savedUser, {
        signupType: 'social',
        provider: dto.provider,
        adminSignup: true,
        socialMetadata: dto.socialMetadata || null,
        profilePicture,
      });

      // ============================================================================
      // Audit: Record account creation by admin (social import)
      // ============================================================================
      try {
        await this.auditService?.recordEvent({
          userId: savedUser.id,
          eventType: AuthAuditEventType.ACCOUNT_CREATED,
          eventStatus: 'INFO',
          authMethod: 'admin-social',
          // Client info automatically included from context
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
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record ACCOUNT_CREATED audit event: ${errorMessage}`, {
          error: auditError,
          userId: savedUser.id,
        });
      }
    } catch (error: unknown) {
      // Handle database constraint violations gracefully
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        // PostgreSQL unique constraint violation
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

      // Re-throw other database errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      this.logger?.error?.(`Admin social signup failed - database error: ${errorMessage}`);
      throw error;
    }

    // No tokens, no challenge system, no verification emails - pure user creation with social linkage
    // Return sanitized user object and social account confirmation
    const userDto = UserResponseDto.fromEntity(savedUser);
    return {
      user: userDto,
      socialAccount: {
        provider: dto.provider,
        providerId: dto.providerId,
        providerEmail: dto.providerEmail || null,
      },
    };
  }

  // ============================================================================
  // Admin User Management
  // ============================================================================

  /**
   * Administrative user deletion with complete cascade cleanup
   *
   * HARD DELETE - Permanently removes user and ALL associated data including:
   * - Sessions, verification tokens, MFA devices, trusted devices
   * - Social accounts, login attempts, challenge sessions, audit logs
   *
   * Security:
   * - NO built-in authentication - endpoint MUST be protected by admin guards
   * - Records admin action in separate audit log (not deleted with user)
   * - Irreversible operation - all data permanently removed
   *
   * @param dto - User sub to delete
   * @returns Deletion confirmation with cascade counts
   * @throws {NAuthException} USER_NOT_FOUND
   *
   * @example
   * ```typescript
   * const result = await authService.deleteUser({ sub: 'user-uuid-123' });
   * console.log(`Deleted user: ${result.deletedUserId}`);
   * console.log(`Deleted ${result.deletedRecords.sessions} sessions`);
   * ```
   */
  async deleteUser(dto: DeleteUserDTO): Promise<DeleteUserResponseDTO> {
    return await this.userService.deleteUser(dto);
  }

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
   * const result = await authService.getUsers({
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
    return await this.userService.getUsers(dto);
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
   * const result = await authService.disableUser({
   *   sub: 'user-uuid-123',
   *   reason: 'Suspicious activity detected'
   * });
   * console.log(`Revoked ${result.revokedSessions} sessions`);
   * ```
   */
  async disableUser(dto: DisableUserDTO): Promise<DisableUserResponseDTO> {
    return await this.userService.disableUser(dto);
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
   * const result = await authService.enableUser({
   *   sub: 'user-uuid-123'
   * });
   * console.log(`User unlocked: ${result.user.email}`);
   * ```
   */
  async enableUser(dto: EnableUserDTO): Promise<EnableUserResponseDTO> {
    return await this.userService.enableUser(dto);
  }

  // ============================================================================
  // User Login
  // ============================================================================
  /**
   * Log in a user with identifier (email, username, or phone) and password.
   *
   * Handles client/device context, login hooks, lockout checks, audit logging, password verification,
   * and challenge flow (MFA/verification) if required.
   *
   * @param dto - Login credentials (identifier and password)
   * @returns Authentication response containing challenge details if required, or tokens on success
   * @throws {NAuthException} On login failure, forbidden access, or account lockout
   *
   * @example
   * ```typescript
   * const res = await authService.login({ identifier: 'user@email.com', password: 'Pass123!' });
   * if (res.challengeName) {
   *   // prompt user for verification code
   * }
   * ```
   */
  async login(dto: LoginDTO): Promise<AuthResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(LoginDTO, dto);

    // Get client info from request context (transparent!)
    const clientInfo = this.clientInfoService.get();
    const fireAndForget = this.config.auditLogs?.fireAndForget === true;
    const identifierType = this.config.login?.identifierType;

    this.logger?.log?.(`Login attempt for: ${dto.identifier}`);
    this.logger?.debug?.(
      `Login details: { identifier: ${dto.identifier}, ip: ${clientInfo.ipAddress}, deviceToken: ${clientInfo.deviceToken ? 'present' : 'none'} }`,
    );

    // Check IP-based account lockout
    if (this.config.lockout?.enabled) {
      const clientInfo = this.clientInfoService.get();
      const ipAddress = clientInfo.ipAddress;

      if (ipAddress) {
        this.logger?.debug?.(`Checking IP lockout status for: ${ipAddress}`);
        const isLocked = await this.accountLockoutStorage.isAccountLocked(ipAddress);
        if (isLocked) {
          this.logger?.warn?.(`Login blocked - IP locked: ${ipAddress}`);
          await this.helpers.recordLoginAttempt(dto.identifier, false, 'ip_locked');

          // ============================================================================
          // Audit: Record blocked login (IP locked)
          // ============================================================================
          // We do not have a resolved user yet because IP lockout happens before the normal
          // identifier validation + user lookup. Resolve it here to avoid passing a non-UUID
          // (email/username/phone) into `userSub`.
          const userForAudit = await this.helpers.findUserByIdentifier(dto.identifier, identifierType);
          if (fireAndForget) {
            if (userForAudit?.id) {
              this.auditService
                ?.recordEvent({
                  userId: userForAudit.id,
                  eventType: AuthAuditEventType.LOGIN_BLOCKED,
                  eventStatus: 'FAILURE',
                  authMethod: 'password',
                  reason: 'ip_locked',
                  description: 'Login blocked - IP address locked due to too many failed attempts',
                  metadata: {
                    identifier: dto.identifier,
                    identifierType: identifierType || null,
                  },
                })
                .catch((err) => {
                  const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                  this.logger?.error?.(
                    `Failed to record LOGIN_BLOCKED audit event (fire-and-forget): ${errorMessage}`,
                    {
                      error: err,
                      identifier: dto.identifier,
                    },
                  );
                });
            }
          } else {
            try {
              if (userForAudit?.id) {
                await this.auditService?.recordEvent({
                  userId: userForAudit.id,
                  eventType: AuthAuditEventType.LOGIN_BLOCKED,
                  eventStatus: 'FAILURE',
                  authMethod: 'password',
                  reason: 'ip_locked',
                  description: 'Login blocked - IP address locked due to too many failed attempts',
                  metadata: {
                    identifier: dto.identifier,
                    identifierType: identifierType || null,
                  },
                });
              }
            } catch (auditError) {
              const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
              this.logger?.error?.(`Failed to record LOGIN_BLOCKED audit event (IP locked): ${errorMessage}`, {
                error: auditError,
              });
            }
          }

          throw new NAuthException(
            AuthErrorCode.RATE_LIMIT_LOGIN,
            'Too many failed attempts from this IP. Please try again later.',
          );
        }
      }
    }

    // ============================================================================
    // Validate identifier type based on configuration
    // ============================================================================
    if (identifierType) {
      this.logger?.debug?.(`Validating identifier type for: ${dto.identifier}, allowed type: ${identifierType}`);
      const isValidIdentifier = this.helpers.validateIdentifierType(dto.identifier, identifierType);
      if (!isValidIdentifier) {
        this.logger?.warn?.(
          `Login rejected - identifier type mismatch. Identifier: ${dto.identifier}, Required: ${identifierType}`,
        );
        await this.helpers.handleFailedLogin(dto.identifier, 'identifier_type_mismatch');
        throw new NAuthException(
          AuthErrorCode.INVALID_CREDENTIALS,
          `Login with this identifier type is not allowed. Expected: ${identifierType}`,
        );
      }
    }

    // Find user by email, username, or phone (filtered by identifierType config)
    this.logger?.debug?.(`Finding user by identifier: ${dto.identifier}`);
    const user = await this.helpers.findUserByIdentifier(dto.identifier, identifierType);

    // SECURITY CRITICAL: Always hash password even when user doesn't exist
    // This ensures constant-time response to prevent user enumeration via timing attacks
    const hashToVerify = user?.passwordHash || DUMMY_ARGON2_HASH;

    // Verify password (takes ~200-300ms regardless of user existence)
    this.logger?.debug?.('Verifying password');
    const isPasswordValid = await this.passwordService.verifyPassword(dto.password, hashToVerify);

    // Now check all conditions AFTER password verification (constant time achieved)
    if (!user || !user.passwordHash || !isPasswordValid) {
      this.logger?.warn?.(`Login failed - invalid credentials for: ${dto.identifier}`);
      await this.helpers.handleFailedLogin(dto.identifier, 'invalid_credentials');

      // ============================================================================
      // Audit: Record failed login
      // ============================================================================
      if (user) {
        if (fireAndForget) {
          this.auditService
            ?.recordEvent({
              userId: user.id,
              eventType: AuthAuditEventType.LOGIN_FAILED,
              eventStatus: 'FAILURE',
              authMethod: 'password',
              reason: 'invalid_credentials',
              description: 'Invalid password or user not found',
            })
            .catch((err) => {
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              this.logger?.error?.(`Failed to record LOGIN_FAILED audit event (fire-and-forget): ${errorMessage}`, {
                error: err,
                userId: user.id,
                userSub: user.sub,
              });
            });
        } else {
          try {
            await this.auditService?.recordEvent({
              userId: user.id,
              eventType: AuthAuditEventType.LOGIN_FAILED,
              eventStatus: 'FAILURE',
              authMethod: 'password',
              reason: 'invalid_credentials',
              description: 'Invalid password or user not found',
            });
          } catch (auditError) {
            const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
            this.logger?.error?.(`Failed to record LOGIN_FAILED audit event: ${errorMessage}`, {
              error: auditError,
              userId: user?.id,
            });
          }
        }
      }

      // Provide helpful error if user exists but has no password (social-only account)
      if (user && !user.passwordHash && user.socialProviders && user.socialProviders.length > 0) {
        const provider = user.socialProviders[0];
        const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
        throw new NAuthException(
          AuthErrorCode.INVALID_CREDENTIALS,
          `Invalid credentials - use your ${providerName} account`,
          {
            suggestedProvider: providerName,
          },
        );
      }

      throw new NAuthException(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
    }

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
          `Login blocked - account locked for user: ${user.email} (sub: ${user.sub}). Reason: ${lockReason}`,
        );

        // Record blocked login attempt
        await this.helpers.recordLoginAttempt(dto.identifier, false, 'account_locked');

        // ============================================================================
        // Audit: Record blocked login (account locked)
        // ============================================================================
        if (fireAndForget) {
          this.auditService
            ?.recordEvent({
              userId: user.id,
              eventType: AuthAuditEventType.LOGIN_BLOCKED,
              eventStatus: 'FAILURE',
              authMethod: 'password',
              reason: 'account_locked',
              description: `Login blocked - account locked: ${lockReason}`,
              metadata: {
                lockReason: user.lockReason,
                lockedAt: user.lockedAt,
                lockedUntil: user.lockedUntil,
                isPermanent: isPermanentlyLocked,
              },
            })
            .catch((err) => {
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              this.logger?.error?.(`Failed to record LOGIN_BLOCKED audit event (fire-and-forget): ${errorMessage}`, {
                error: err,
                userId: user.id,
                userSub: user.sub,
              });
            });
        } else {
          try {
            await this.auditService?.recordEvent({
              userId: user.id,
              eventType: AuthAuditEventType.LOGIN_BLOCKED,
              eventStatus: 'FAILURE',
              authMethod: 'password',
              reason: 'account_locked',
              description: `Login blocked - account locked: ${lockReason}`,
              metadata: {
                lockReason: user.lockReason,
                lockedAt: user.lockedAt,
                lockedUntil: user.lockedUntil,
                isPermanent: isPermanentlyLocked,
              },
            });
          } catch (auditError) {
            const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
            this.logger?.error?.(`Failed to record LOGIN_BLOCKED audit event (account locked): ${errorMessage}`, {
              error: auditError,
              userId: user.id,
            });
          }
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
    // Password Expiry Check
    // ============================================================================
    const expiryDays = this.config.password?.expiryDays;
    if (expiryDays && expiryDays > 0 && user.passwordChangedAt) {
      const expiryDate = new Date(user.passwordChangedAt);
      expiryDate.setDate(expiryDate.getDate() + expiryDays);
      const now = new Date();

      if (now > expiryDate) {
        this.logger?.warn?.(
          `Password expired for user: ${user.sub}. Changed: ${user.passwordChangedAt}, Expiry: ${expiryDate}`,
        );

        // Force password change by setting mustChangePassword flag
        await this.userRepository.update(user.id, {
          mustChangePassword: true,
        });
        // Update in-memory user reference to include mustChangePassword
        user.mustChangePassword = true;

        // Check challenges - FORCE_CHANGE_PASSWORD will be included
        const response = await this.challengeHelper.determineAuthResponse({
          user,
          config: this.config,
          deviceToken: clientInfo.deviceToken,
          isSocialLogin: false,
        });

        if (response.challengeName) {
          this.logger?.warn?.(
            `Login blocked - password expired, challenge: ${response.challengeName} for ${dto.identifier}`,
          );
          return response;
        }
      }
    }

    // ============================================================================
    // Audit: Record login attempt for successful password verification
    // ============================================================================
    // Record LOGIN_ATTEMPT for all successful password verifications
    // IMPORTANT: Always await this to ensure correct chronological order before risk assessment
    try {
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.LOGIN_ATTEMPT,
        eventStatus: 'INFO',
        authMethod: 'password',
        description: 'Password verification successful',
      });
    } catch (auditError) {
      // Non-blocking: Log but continue even if audit fails
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record LOGIN_ATTEMPT audit event: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
      });
    }

    // ============================================================================
    // Challenge System: Determine authentication response using state machine
    // ============================================================================
    // All challenge determination is now handled by state machine in determineAuthResponse
    // This replaces the old determinePendingChallenges and checkMFARequirement methods

    const response = await this.challengeHelper.determineAuthResponse({
      user,
      config: this.config,
      deviceToken: clientInfo.deviceToken,
      isSocialLogin: false,
    });

    // If challenge is required, record login attempt and return challenge
    if (response.challengeName) {
      const reasonMap: Record<AuthChallenge, string> = {
        [AuthChallenge.VERIFY_EMAIL]: 'verification_required',
        [AuthChallenge.VERIFY_PHONE]: 'verification_required',
        [AuthChallenge.MFA_SETUP_REQUIRED]: 'mfa_setup_required',
        [AuthChallenge.FORCE_CHANGE_PASSWORD]: 'password_change_required',
        [AuthChallenge.MFA_REQUIRED]: 'mfa_required',
      };

      this.logger?.warn?.(
        `Login blocked - pending challenge: ${response.challengeName} for ${dto.identifier} (sub: ${user.sub})`,
      );
      await this.helpers.recordLoginAttempt(
        dto.identifier,
        false,
        reasonMap[response.challengeName] || 'challenge_required',
        user.id,
      );

      return response;
    }

    // If response already has tokens (session was created by challenge helper), return it
    // This prevents duplicate session creation
    if (response.accessToken && response.refreshToken) {
      this.logger?.debug?.(
        `Login successful - session already created by challenge helper for ${dto.identifier} (sub: ${user.sub})`,
      );

      // Record successful login attempt
      await this.helpers.recordLoginAttempt(dto.identifier, true, undefined, user.id);
      this.logger?.log?.(`Login successful for: ${dto.identifier} (sub: ${user.sub}) from ${clientInfo.ipAddress}`);

      // Update user last login info
      await this.userRepository.update(user.id, {
        lastLoginAt: new Date(),
        lastLoginIp: clientInfo.ipAddress,
        failedLoginAttempts: 0,
      });

      // Reset IP-based failed attempts on successful login
      if (this.config.lockout?.enabled && this.config.lockout.resetOnSuccess) {
        const ipAddress = clientInfo.ipAddress;
        if (ipAddress) {
          this.logger?.debug?.(`Resetting failed login attempts for IP: ${ipAddress}`);
          await this.accountLockoutStorage.resetFailedAttempts(ipAddress);
        }
      }

      // Extract session ID and device info from token to record audit event
      let sessionId: number | undefined;
      let deviceId: string | undefined;
      try {
        const tokenPayload = this.jwtService.decodeToken(response.accessToken);
        if (tokenPayload?.sessionId) {
          sessionId = parseInt(String(tokenPayload.sessionId), 10);
        }
        // Get deviceId from session if available
        if (sessionId) {
          const session = await this.sessionService.findById(sessionId);
          if (session && session.deviceId) {
            deviceId = session.deviceId;
          }
        }
      } catch {
        // Non-blocking: Continue without sessionId/deviceId
        this.logger?.debug?.('Failed to extract sessionId/deviceId from token for audit');
      }

      // Determine trusted device and MFA bypass status from response
      const isTrustedDevice = response.trusted || false;
      const mfaBypassed = false; // Challenge helper handles MFA, so if we get here, MFA was not bypassed
      const mfaBypassReason: 'trusted_device' | 'mfa_exempt' | null = null;

      // Record successful login audit event
      if (fireAndForget) {
        this.auditService
          ?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.LOGIN_SUCCESS,
            eventStatus: 'SUCCESS',
            sessionId: sessionId || undefined,
            deviceId: deviceId || undefined,
            authMethod: 'password',
            metadata: { trustedDevice: isTrustedDevice, mfaBypassed, mfaBypassReason },
          })
          .catch((err) => {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.logger?.error?.(`Failed to record LOGIN_SUCCESS audit event (fire-and-forget): ${errorMessage}`, {
              error: err,
              userId: user.id,
              userSub: user.sub,
            });
          });
      } else {
        try {
          await this.auditService?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.LOGIN_SUCCESS,
            eventStatus: 'SUCCESS',
            sessionId: sessionId || undefined,
            deviceId: deviceId || undefined,
            authMethod: 'password',
            metadata: { trustedDevice: isTrustedDevice, mfaBypassed, mfaBypassReason },
          });
        } catch (auditError) {
          const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
          this.logger?.error?.(`Failed to record LOGIN_SUCCESS audit event: ${errorMessage}`, {
            error: auditError,
            userId: user.id,
          });
        }
      }

      return response;
    }

    // ============================================================================
    // Trusted Device Status Check (for audit metadata)
    // ============================================================================
    let isTrustedDevice = false;
    let mfaBypassed = false;
    let mfaBypassReason: 'trusted_device' | 'mfa_exempt' | null = null;

    if (
      this.config.mfa?.rememberDevices &&
      this.config.mfa?.rememberDevices !== 'never' &&
      this.trustedDeviceService &&
      clientInfo.deviceToken
    ) {
      isTrustedDevice = await this.trustedDeviceService.isDeviceTrusted(clientInfo.deviceToken, user.id);
    }

    // Check if user is exempt from MFA
    const userEntityDebug = user as unknown as Record<string, unknown>;
    const userMfaExempt = userEntityDebug.mfaExempt === true || userEntityDebug.mfaExempt === 'true';

    // Determine if MFA was bypassed
    // MFA is bypassed if:
    // 1. No challenge was returned (meaning MFA was skipped)
    // 2. MFA would have been required otherwise
    // 3. Either:
    //    a. Device is trusted AND bypassMFAForTrustedDevices is enabled (trusted device bypass)
    //    b. User has mfaExempt = true (MFA exemption bypass)
    if (!response.challengeName && this.config.mfa) {
      const enforcement = this.config.mfa.enforcement || 'OPTIONAL';
      // MFA would be required if:
      // - OPTIONAL enforcement AND user has MFA enabled, OR
      // - REQUIRED/ADAPTIVE enforcement (regardless of user.mfaEnabled for REQUIRED)
      const wouldRequireMFA =
        (enforcement === 'OPTIONAL' && user.mfaEnabled) || enforcement === 'REQUIRED' || enforcement === 'ADAPTIVE';

      if (wouldRequireMFA) {
        // Check if bypassed due to trusted device
        if (
          isTrustedDevice &&
          this.config.mfa.bypassMFAForTrustedDevices === true &&
          enforcement !== 'ADAPTIVE' && // Adaptive MFA could bypass it anyway if device is trusted but requires different logging
          !userMfaExempt
        ) {
          mfaBypassed = true;
          mfaBypassReason = 'trusted_device';
          this.logger?.debug?.(`MFA bypassed for trusted device - user ${user.sub}`);
        }
        // Check if bypassed due to MFA exemption
        else if (userMfaExempt) {
          mfaBypassed = true;
          mfaBypassReason = 'mfa_exempt';
          this.logger?.debug?.(`MFA bypassed due to exemption - user ${user.sub}`);
        }
      }
    }

    // MFA challenge is already handled by determineAuthResponse above
    // If response.challengeName is set, it was already returned

    // Check if user is active (should never happen with new signups, but keep for legacy accounts)
    if (!user.isActive) {
      this.logger?.warn?.(`Login failed - account inactive: ${dto.identifier} (sub: ${user.sub})`);
      await this.helpers.recordLoginAttempt(dto.identifier, false, 'account_inactive', user.id);

      // ============================================================================
      // Audit: Record blocked login (account inactive)
      // ============================================================================
      try {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.LOGIN_BLOCKED,
          eventStatus: 'FAILURE',
          authMethod: 'password',
          reason: 'account_inactive',
          description: 'Login blocked - account is inactive',
          // Client info automatically included from context
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record LOGIN_BLOCKED audit event (account inactive): ${errorMessage}`, {
          error: auditError,
          userId: user.id,
        });
      }

      throw new NAuthException(AuthErrorCode.ACCOUNT_INACTIVE, 'Account is inactive. Please contact support.');
    }

    // Reset IP-based failed attempts on successful login
    if (this.config.lockout?.enabled && this.config.lockout.resetOnSuccess) {
      const ipAddress = clientInfo.ipAddress;

      if (ipAddress) {
        this.logger?.debug?.(`Resetting failed login attempts for IP: ${ipAddress}`);
        await this.accountLockoutStorage.resetFailedAttempts(ipAddress);
      }
    }

    // ============================================================================
    // Generate Device ID Server-Side (Security: Never accept from client)
    // ============================================================================

    // Always generate device ID server-side (no client input accepted)
    // This device ID is used for session tracking, not for trusted device feature
    // Trusted devices use separate deviceToken (generated after MFA verification)
    const validatedDeviceId = crypto.randomUUID();
    this.logger?.debug?.(`Generated server-side deviceId: ${validatedDeviceId}`);

    // Generate token family for rotation tracking
    const tokenFamily = this.jwtService.generateTokenFamily();

    // ============================================================================
    // Single Session Mode: Revoke other sessions if disallowMultipleSessions is enabled
    // ============================================================================
    if (this.config.session?.disallowMultipleSessions) {
      this.logger?.debug?.(`Single session mode enabled - revoking other sessions for user: ${user.sub}`);
      const revokedCount = await this.sessionService.revokeAllUserSessions(user.id, 'Login from new session');
      if (revokedCount > 0) {
        this.logger?.log?.(`Revoked ${revokedCount} other active session(s) for user: ${user.sub}`);
      }
    }

    // Atomically create session and persist token hashes
    this.logger?.debug?.(`Creating login session for user: ${user.sub}`);
    const atomic = await this.sessionService.createSessionAtomic(
      {
        userId: user.id,
        tokenFamily,
        deviceId: validatedDeviceId,
        deviceName: dto.deviceName,
        deviceType: dto.deviceType,
        // Client info (ipAddress, ipCountry, ipCity, userAgent) automatically extracted from ClientInfoService
        isRemembered: false,
        expiresAt: this.sessionService.getSessionExpirationDate(),
        authMethod: 'password',
      },
      async (sessionId) => {
        const pair = await this.jwtService.generateTokenPair({
          userId: user.sub,
          email: user.email,
          sessionId: sessionId.toString(),
          tokenFamily,
        });
        return {
          accessTokenHash: this.jwtService.hashToken(pair.accessToken),
          refreshTokenHash: this.jwtService.hashToken(pair.refreshToken),
          extra: pair,
        };
      },
    );
    const session = atomic.session;
    const tokens = atomic.extra!;
    this.logger?.debug?.(`Session created: ${session.id}`);

    // Update user last login info - use internal id for update
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      lastLoginIp: clientInfo.ipAddress,
      failedLoginAttempts: 0,
    });

    // Record successful login attempt - use internal id
    await this.helpers.recordLoginAttempt(dto.identifier, true, undefined, user.id);
    this.logger?.log?.(`Login successful for: ${dto.identifier} (sub: ${user.sub}) from ${clientInfo.ipAddress}`);

    // ============================================================================
    // Audit: Record successful login with trusted device and MFA bypass metadata
    // ============================================================================
    if (fireAndForget) {
      this.auditService
        ?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.LOGIN_SUCCESS,
          eventStatus: 'SUCCESS',
          sessionId: session.id,
          deviceId: validatedDeviceId || undefined,
          authMethod: 'password',
          metadata: { trustedDevice: isTrustedDevice, mfaBypassed, mfaBypassReason },
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          this.logger?.error?.(`Failed to record LOGIN_SUCCESS audit event (fire-and-forget): ${errorMessage}`, {
            error: err,
            userId: user.id,
            userSub: user.sub,
          });
        });
    } else {
      try {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.LOGIN_SUCCESS,
          eventStatus: 'SUCCESS',
          sessionId: session.id,
          deviceId: validatedDeviceId || undefined,
          authMethod: 'password',
          metadata: { trustedDevice: isTrustedDevice, mfaBypassed, mfaBypassReason },
        });
      } catch (auditError) {
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record LOGIN_SUCCESS audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
        });
      }
    }

    // ============================================================================
    // Lifecycle Hook: afterLogin (TODO: Implement provider-based hook)
    // ============================================================================
    // TODO: Implement provider-based hook for afterLogin
    // await this.hookRegistry.executeAfterLogin(user, session);

    // ============================================================================
    // Trusted Device Token Management (Remember Device Feature)
    // ============================================================================
    let deviceToken: string | undefined;
    let isTrusted = false;

    if (this.config.mfa?.rememberDevices && this.config.mfa?.rememberDevices !== 'never' && this.trustedDeviceService) {
      const rememberDevicesMode = this.config.mfa.rememberDevices;

      // Check if device is already trusted
      if (clientInfo.deviceToken) {
        isTrusted = await this.trustedDeviceService.isDeviceTrusted(clientInfo.deviceToken, user.id);
        if (isTrusted) {
          deviceToken = clientInfo.deviceToken; // Reuse existing token
          this.logger?.debug?.(`Device already trusted for user ${user.sub}`);
        }
      }

      // Auto-trust mode: Create device token automatically if not already trusted
      if (rememberDevicesMode === 'always' && !isTrusted) {
        try {
          deviceToken = await this.trustedDeviceService.createTrustedDevice(
            user.id,
            dto.deviceName || clientInfo.deviceName,
            dto.deviceType || clientInfo.deviceType,
            clientInfo.ipAddress,
            clientInfo.userAgent,
            clientInfo.platform,
            clientInfo.browser,
          );
          isTrusted = true;
          this.logger?.debug?.(`Auto-created trusted device token for user ${user.sub} (always mode)`);
        } catch (error) {
          // Non-blocking: Log but continue without device token
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger?.warn?.(`Failed to create trusted device token: ${errorMessage}`, { error });
        }
      }
      // user_opt_in mode: Don't create token here - user must call trust-device endpoint
      // isTrusted flag is already set above if device token exists and is valid
    }

    // Decode tokens to get expiry times
    const accessTokenValidation = await this.jwtService.validateAccessToken(tokens.accessToken);
    const refreshTokenValidation = await this.jwtService.validateRefreshToken(tokens.refreshToken);

    // Return sanitized user object with expiry timestamps
    // Note: deviceToken inclusion in response body is handled by CookieTokenInterceptor
    // which checks route-level @TokenDelivery decorator and global config
    // to decide whether to set as cookie and/or strip from body
    const authResponse: AuthResponseDTO = {
      user: toAuthResponseUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: accessTokenValidation.payload?.exp || 0,
      refreshTokenExpiresAt: refreshTokenValidation.payload?.exp || 0,
      authMethod: 'password',
      trusted: isTrusted, // Include trusted flag so frontend knows if device is already trusted
      // Include deviceToken - CookieTokenInterceptor will handle cookie/stripping based on @TokenDelivery decorator
      deviceToken,
    };
    return authResponse;
  }

  /**
   * Complete an authentication challenge using the provided response data.
   *
   * Handles all challenge types (email verification, phone verification, MFA, password change, MFA setup).
   * Validates the session, challenge type, and parameters, and returns the result (tokens or next challenge).
   *
   * @param responseData - Data for responding to the challenge
   * @returns The authentication response (tokens or next challenge requirement)
   * @throws {NAuthException} If validation fails or the challenge type is unknown
   *
   * @example
   * ```typescript
   * // Example for email verification:
   * const dto = Object.assign(new RespondChallengeDTO(), {
   *   session: 'session-token',
   *   type: 'VERIFY_EMAIL',
   *   code: '123456',
   * });
   * await authService.respondToChallenge(dto);
   * ```
   */
  async respondToChallenge(dto: RespondChallengeDTO): Promise<AuthResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(RespondChallengeDTO, dto);

    const responseData = dto as ChallengeResponseData;
    const { session, type } = responseData;
    const requestTrace = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    this.logger?.log?.(
      `[${requestTrace}] Challenge response received: type=${type}, session=${session?.substring(0, 8)}...`,
    );

    // Validate session and get challenge type
    const challengeSession = await this.challengeService.validateSession(session);

    // Validate response matches expected challenge
    this.helpers.validateChallengeTypeMatch(challengeSession.challengeName, type);

    // Validate parameters for this challenge type
    // TODO: Later check if we can use classvalidator to replicate the logic of DTO validation centrally
    this.helpers.validateChallengeParams(type, responseData);

    // Handle challenge based on type
    switch (type) {
      case 'VERIFY_EMAIL':
        return await this.helpers.handleVerifyEmail(challengeSession, (responseData as VerifyEmailResponse).code);

      case 'VERIFY_PHONE':
        return await this.helpers.handleVerifyPhone(
          challengeSession,
          responseData as VerifyPhoneResponse | CollectPhoneResponse,
        );

      case 'MFA_REQUIRED':
        return await this.helpers.handleMFAVerification(
          challengeSession,
          responseData as VerifyMFACodeResponse | VerifyMFAPasskeyResponse,
          this.mfaService,
          this.trustedDeviceService,
          this.auditService,
        );

      case 'FORCE_CHANGE_PASSWORD':
        return await this.helpers.handleForceChangePassword(
          challengeSession,
          (responseData as ForceChangePasswordResponse).newPassword,
          this.passwordService,
          this.auditService,
        );

      case 'MFA_SETUP_REQUIRED':
        return await this.helpers.handleMFASetup(
          challengeSession,
          responseData as MFASetupResponse,
          this.mfaService,
          this.auditService,
        );

      default:
        throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, `Unknown challenge type: ${type}`);
    }
  }

  /**
   * Resend verification code for current challenge
   *
   * Determines the challenge type from the session and resends the appropriate code:
   * - VERIFY_EMAIL: Resends email verification code
   * - VERIFY_PHONE: Resends SMS verification code
   * - MFA_REQUIRED: Resends MFA code (for SMS MFA)
   *
   * Rate limits are enforced internally by the verification services.
   *
   * @param dto - Resend code request with challenge session token
   * @returns Destination info (masked email/phone)
   * @throws {NAuthException} INVALID_CHALLENGE_SESSION | RATE_LIMIT_* | VALIDATION_FAILED
   *
   * @example
   * ```typescript
   * const result = await authService.resendCode({ session: 'challenge-token' });
   * // Returns: { destination: 'u***r@example.com' }
   * ```
   */
  async resendCode(dto: ResendCodeDTO): Promise<ResendCodeResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(ResendCodeDTO, dto);

    this.logger?.debug?.(`Resending verification code: session=${dto.session}`);

    // Validate session (session must be valid to resend)
    const challengeSession = await this.challengeService.validateSession(dto.session);

    // Get user from session
    const user = challengeSession.user;
    if (!user) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Challenge session has no associated user');
    }

    // Handle based on challenge type
    switch (challengeSession.challengeName) {
      case AuthChallenge.VERIFY_EMAIL: {
        // Resend email verification
        // Pass challengeSessionId to ensure new token is linked to this challenge session
        const resendDto = Object.assign(new ResendVerificationEmailDTO(), {
          sub: user.sub,
          challengeSessionId: challengeSession.id,
        });
        await this.emailVerificationService.resendVerificationEmail(resendDto);
        const maskedEmail = this.helpers.maskEmail(user.email);
        this.logger?.debug?.(`Email verification code resent: user=${user.sub}, email=${maskedEmail}`);
        return { destination: maskedEmail };
      }

      case AuthChallenge.VERIFY_PHONE: {
        // Check if phone already collected
        if (!user.phone) {
          throw new NAuthException(
            AuthErrorCode.VALIDATION_FAILED,
            'Phone number not yet provided. Submit phone number first.',
          );
        }

        if (!this.phoneVerificationService) {
          throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Phone verification service is not available');
        }

        // Resend SMS verification
        const resendDto = Object.assign(new ResendVerificationSMSDTO(), { sub: user.sub });
        await this.phoneVerificationService.resendVerificationSMS(resendDto);
        const maskedPhone = this.helpers.maskPhone(user.phone);
        this.logger?.debug?.(`Phone verification code resent: user=${user.sub}, phone=${maskedPhone}`);
        return { destination: maskedPhone };
      }

      case AuthChallenge.MFA_REQUIRED: {
        // For MFA, we need to know which method is being used
        // Method is stored in metadata when challenge is created (see auth-challenge-helper.service.ts line 403)
        // Note: challengeParameters is never populated - only metadata is used
        const metadata = challengeSession.metadata as { method?: string };
        const method = metadata?.method;

        if (!method) {
          throw new NAuthException(
            AuthErrorCode.VALIDATION_FAILED,
            'Cannot resend MFA code: method not specified in session',
          );
        }

        // SMS and Email MFA support resending codes
        if (method === 'sms' || method === 'email') {
          // For SMS, use phone verification service directly to pass challengeSessionId
          if (method === 'sms' && this.phoneVerificationService) {
            const smsDto = Object.assign(new SendVerificationSMSDTO(), {
              sub: user.sub,
              skipAlreadyVerifiedCheck: true,
              challengeSessionId: challengeSession.id, // Link resend code to this challenge session
            });
            await this.phoneVerificationService.sendVerificationSMS(smsDto);
            this.logger?.debug?.(`SMS MFA code resent: user=${user.sub}`);
            // Get masked phone from user or device
            const maskedPhone = user.phone ? this.helpers.maskPhone(user.phone) : '***-***-****';
            return { destination: maskedPhone };
          }

          // For Email, use email verification service directly to pass challengeSessionId
          if (method === 'email' && this.emailVerificationService) {
            const emailDto = Object.assign(new ResendVerificationEmailDTO(), {
              sub: user.sub,
              challengeSessionId: challengeSession.id, // Link resend code to this challenge session
            });
            await this.emailVerificationService.resendVerificationEmail(emailDto);
            this.logger?.debug?.(`Email MFA code resent: user=${user.sub}`);
            const maskedEmail = user.email ? this.helpers.maskEmail(user.email) : 'u***r@example.com';
            return { destination: maskedEmail };
          }

          // Fallback to provider if services not available (shouldn't happen)
          if (!this.mfaService) {
            throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'MFA service is not available');
          }

          const provider = this.mfaService.getProvider(method);

          if (!provider.sendChallenge) {
            throw new NAuthException(
              AuthErrorCode.VALIDATION_FAILED,
              `${method.toUpperCase()} MFA provider does not support sending challenges`,
            );
          }

          const result = await provider.sendChallenge(user);
          this.logger?.debug?.(`${method.toUpperCase()} MFA code resent: user=${user.sub}`);

          // Provider returns masked phone or email
          return { destination: result as string };
        }

        throw new NAuthException(
          AuthErrorCode.VALIDATION_FAILED,
          `Cannot resend code for MFA method '${method}'. Only SMS and Email support code resending.`,
        );
      }

      default:
        throw new NAuthException(
          AuthErrorCode.VALIDATION_FAILED,
          `Cannot resend code for challenge type '${challengeSession.challengeName}'`,
        );
    }
  }

  /**
   * Registers the current device as trusted for the user (opt-in).
   *
   * Only available when rememberDevices is set to 'user_opt_in'. Generates and returns a trusted device token for the device associated with the current authenticated session.
   *
   * Session ID is automatically extracted from the JWT token context (via ClientInfoService), similar to how IP address and user agent are handled.
   *
   * @returns Object containing the new device token
   * @throws {NAuthException} If the feature is unavailable, service is not enabled, or session ID is not available
   *
   * @example
   * ```typescript
   * const result = await authService.trustDevice();
   * // { deviceToken: 'abc123' }
   * ```
   */
  async trustDevice(): Promise<TrustDeviceResponseDTO> {
    if (this.config.mfa?.rememberDevices !== 'user_opt_in') {
      throw new NAuthException(AuthErrorCode.FORBIDDEN, 'Trust device feature is only available in user_opt_in mode');
    }

    if (!this.trustedDeviceService) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Trusted device service not available');
    }

    // Get sessionId from context (automatically extracted from JWT token)
    const clientInfo = this.clientInfoService.get();
    const sessionId = clientInfo.sessionId;

    if (!sessionId) {
      throw new NAuthException(
        AuthErrorCode.SESSION_NOT_FOUND,
        'Session ID not found in request context. Ensure the request is authenticated.',
      );
    }

    // Get session to extract device info
    const session = await this.sessionService.findById(sessionId);
    if (!session || session.isRevoked) {
      throw new NAuthException(AuthErrorCode.SESSION_NOT_FOUND, 'Session not found or revoked');
    }

    // Get user
    const user = await this.userRepository.findOne({ where: { id: session.userId } });
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Check if device is already trusted
    const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
    if (clientInfo.deviceToken) {
      const isAlreadyTrusted = await this.trustedDeviceService.isDeviceTrusted(clientInfo.deviceToken, userId);
      if (isAlreadyTrusted) {
        this.logger?.debug?.(`Device already trusted for user ${user.sub}`);
        return { deviceToken: clientInfo.deviceToken };
      }
      // If device token exists but not trusted, revoke it first (may be expired/invalid)
      try {
        await this.trustedDeviceService.revokeTrustedDevice(clientInfo.deviceToken, userId);
        this.logger?.debug?.(`Revoked existing untrusted device token for user ${user.sub}`);
      } catch {
        // Non-blocking - may not exist
      }
    }

    // Create trusted device token using session device info
    const deviceToken = await this.trustedDeviceService.createTrustedDevice(
      userId,
      session.deviceName || clientInfo.deviceName,
      session.deviceType || clientInfo.deviceType,
      session.ipAddress || clientInfo.ipAddress,
      session.userAgent || clientInfo.userAgent,
      clientInfo.platform,
      clientInfo.browser,
    );

    this.logger?.log?.(`Device trusted for user ${user.sub} (user opt-in)`);

    // ============================================================================
    // Audit: Record device trust event
    // ============================================================================
    try {
      // Ensure userId is a number for audit
      const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);

      await this.auditService?.recordEvent({
        userId,
        eventType: AuthAuditEventType.DEVICE_TRUSTED,
        eventStatus: 'SUCCESS',
        // Override deviceId with the newly created device token
        deviceId: deviceToken,
        sessionId: session.id,
        description: `Device trusted by user (opt-in) - ${session.deviceName || 'Unknown device'}`,
        // Client info (deviceName, deviceType, etc.) automatically included from context
        metadata: {
          rememberDeviceDays: this.config.mfa?.rememberDeviceDays || 30,
          trustedUntil: new Date(
            Date.now() + (this.config.mfa?.rememberDeviceDays || 30) * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record DEVICE_TRUSTED audit event: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
      });
    }

    return { deviceToken };
  }

  /**
   * Check if the current device is trusted
   *
   * Returns whether the device associated with the current authenticated session
   * is trusted. Works for both cookies mode (reads from httpOnly cookie) and
   * JSON mode (reads from X-Device-Token header).
   *
   * This endpoint validates the device token on the server side and checks:
   * - Device token exists and is valid
   * - Device token matches a trusted device record in the database
   * - Trust has not expired
   *
   * @returns Object containing the trusted status
   * @throws {NAuthException} If the session is not found or user is not authenticated
   *
   * @example
   * ```typescript
   * const result = await authService.isTrustedDevice();
   * // { trusted: true }
   * ```
   */
  async isTrustedDevice(): Promise<IsTrustedDeviceResponseDTO> {
    if (!this.trustedDeviceService) {
      // If trusted device service is not available, device is not trusted
      return { trusted: false };
    }

    // Get sessionId from context (automatically extracted from JWT token)
    const clientInfo = this.clientInfoService.get();
    const sessionId = clientInfo.sessionId;

    if (!sessionId) {
      throw new NAuthException(
        AuthErrorCode.SESSION_NOT_FOUND,
        'Session ID not found in request context. Ensure the request is authenticated.',
      );
    }

    // Get session to extract user
    const session = await this.sessionService.findById(sessionId);
    if (!session || session.isRevoked) {
      throw new NAuthException(AuthErrorCode.SESSION_NOT_FOUND, 'Session not found or revoked');
    }

    // Get user
    const user = await this.userRepository.findOne({ where: { id: session.userId } });
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Check if device is trusted
    const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
    const deviceToken = clientInfo.deviceToken;

    if (!deviceToken) {
      return { trusted: false };
    }

    const isTrusted = await this.trustedDeviceService.isDeviceTrusted(deviceToken, userId);
    return { trusted: isTrusted };
  }

  /**
   * Refresh the access token using a refresh token.
   *
   * Handles secure token rotation with distributed locking, reuse detection,
   * and family revocation to prevent race conditions and replay attacks.
   *
   * @param refreshToken - The refresh token issued to the client
   * @returns Newly generated access and refresh tokens
   * @throws {NAuthException} If the session is not found, revoked, or refresh is abused
   *
   * @example
   * ```typescript
   * const tokens = await authService.refreshToken(refreshToken);
   * ```
   */
  async refreshToken(dto: RefreshTokenDTO): Promise<TokenResponse> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(RefreshTokenDTO, dto);

    // After validation, refreshToken must be present (validation ensures it's a valid string)
    // Controller should have filled it from cookies if it was missing in cookies mode
    if (!dto.refreshToken) {
      // Best-effort: clear cookies in cookie/hybrid delivery so clients don't keep sending stale cookies.
      this.clearAuthCookiesOnRefreshFailure(AuthErrorCode.TOKEN_INVALID);
      throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'Refresh token is required');
    }

    // Extract to const for type narrowing (TypeScript doesn't narrow optional properties)
    const refreshToken: string = dto.refreshToken;
    const tokenHash = this.jwtService.hashToken(refreshToken);

    // ============================================================================
    // CRITICAL SECURITY FIX #1 & #2: Distributed Lock + Reuse Detection
    // ============================================================================

    // CRITICAL: We need to get session ID for locking, but we must lock BEFORE validation
    // to prevent race conditions. So we do a quick, lightweight lookup first.
    // Find session by refresh token hash - this is fast and allows us to get session ID
    const session = await this.sessionService.findByRefreshToken(tokenHash);

    if (!session || session.isRevoked) {
      // Validate token to get user info for error message
      const validation = await this.jwtService.validateRefreshToken(refreshToken);
      const userId = validation.payload?.sub || 'unknown';
      this.logger?.debug?.(
        `Session not found or revoked for user ${userId}. Possible issue where token are not cleared on logout`,
      );

      // Best-effort: clear cookies in cookie/hybrid delivery so clients don't keep sending stale cookies.
      this.clearAuthCookiesOnRefreshFailure(AuthErrorCode.SESSION_NOT_FOUND);
      throw new NAuthException(AuthErrorCode.SESSION_NOT_FOUND, 'Session not found or revoked');
    }

    // Acquire distributed lock using SESSION ID (not token hash)
    // THIS MUST HAPPEN BEFORE VALIDATION to prevent race conditions
    // where multiple requests validate the same token before any lock is acquired
    const lockKey = `session-refresh:${session.id}`;
    this.logger?.debug?.(
      `[REFRESH DEBUG] Attempting to acquire lock ${lockKey} for token hash ${tokenHash.substring(0, 16)}...`,
    );
    let lockAcquired = false;
    try {
      const lockStartTime = Date.now();
      lockAcquired = await this.sessionService.acquireRefreshLock(lockKey, 10000);
      const lockDuration = Date.now() - lockStartTime;

      if (!lockAcquired) {
        this.logger?.warn?.(
          `[REFRESH DEBUG] Lock ${lockKey} NOT acquired - refresh already in progress for session ${session.id}`,
        );
        throw new NAuthException(AuthErrorCode.RATE_LIMIT_LOGIN, 'Token refresh already in progress', {
          retryAfter: 5,
        });
      }

      this.logger?.debug?.(
        `[REFRESH DEBUG] Lock ${lockKey} acquired successfully in ${lockDuration}ms for token hash ${tokenHash.substring(0, 16)}...`,
      );

      // CRITICAL: Check for token reuse IMMEDIATELY after acquiring lock
      // If same session + cookie race → return current tokens (don't reissue)
      // If different session → invalidate that session and reject (attack)
      if (this.config.jwt.refreshToken.reuseDetection) {
        const isAlreadyUsed = await this.sessionService.isRefreshTokenUsed(tokenHash);
        if (isAlreadyUsed) {
          // Decode token to get sessionId from JWT payload (without full validation)
          // This allows us to check if the token belongs to the session we found
          const tokenPayload = this.jwtService.decodeToken(refreshToken);
          const tokenSessionId = tokenPayload?.sessionId;

          // Get current session state to ensure it's still valid
          const currentSession = (await this.sessionService.findByIdLight(session.id)) as unknown as ISession | null;
          if (!currentSession || currentSession.isRevoked) {
            throw new NAuthException(AuthErrorCode.SESSION_NOT_FOUND, 'Session not found or revoked');
          }

          // Check if token's sessionId matches the session we found
          // If they match → cookie race (same session)
          // If they don't match → attack (token stolen from different session)
          if (tokenSessionId && tokenSessionId === session.id.toString()) {
            // Same session - this is a cookie race condition
            // Return the current valid tokens (user already has them from first request)

            this.logger?.debug?.(
              `[REFRESH DEBUG] Token hash ${tokenHash.substring(0, 16)}... already used for same session ${session.id} - cookie race detected, returning current tokens`,
            );

            // Get user info
            const user = (await this.userRepository.findOne({
              where: { id: currentSession.userId },
            })) as IUser | null;

            if (!user) {
              throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
            }

            // Generate tokens from current session state (same as what the first request returned)
            // These will match what the user already has, so no change needed
            // Note: deviceId not included in token - session.deviceId is source of truth
            const newTokens = await this.jwtService.generateTokenPair({
              userId: user.sub,
              email: user.email,
              sessionId: currentSession.id.toString(),
              tokenFamily: currentSession.tokenFamily,
            });

            // Update session with these tokens (they're already there, but ensures consistency)
            await this.sessionService.updateTokens(
              currentSession.id,
              this.jwtService.hashToken(newTokens.accessToken),
              this.jwtService.hashToken(newTokens.refreshToken),
            );

            // Decode tokens to get expiry times
            const accessTokenValidation = await this.jwtService.validateAccessToken(newTokens.accessToken);
            const refreshTokenValidation = await this.jwtService.validateRefreshToken(newTokens.refreshToken);

            // Return success with current tokens
            return {
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
              accessTokenExpiresAt: accessTokenValidation.payload?.exp || 0,
              refreshTokenExpiresAt: refreshTokenValidation.payload?.exp || 0,
            };
          } else {
            // Different session - this is an attack!
            // A refresh token from one session cannot be used by another session
            this.logger?.error?.(
              `[REFRESH DEBUG] Token hash ${tokenHash.substring(0, 16)}... already used for different session - ATTACK DETECTED! Token sessionId: ${tokenSessionId}, Found session: ${session.id}. Revoking session ${session.id}`,
            );

            // Revoke the session that's trying to use a stolen token
            await this.sessionService.revokeSession(session.id, 'Token reuse detected - possible token theft');

            // Audit the attack
            let userForAudit: IUser | null = null;
            try {
              userForAudit = (await this.userRepository.findOne({
                where: { id: session.userId },
              })) as IUser | null;
              if (userForAudit) {
                await this.auditService?.recordEvent({
                  userId: userForAudit.id,
                  eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
                  eventStatus: 'SUSPICIOUS',
                  riskFactor: 90,
                  riskFactors: [RiskFactor.TOKEN_THEFT_ATTEMPT, RiskFactor.REFRESH_TOKEN_REUSE_DIFFERENT_SESSION],
                  reason: 'Refresh token reuse from different session',
                  // Client info automatically included from context
                  description:
                    'Refresh token from another session attempted to be used. Session revoked as security measure.',
                  metadata: {
                    sessionId: session.id,
                    tokenSessionId,
                    tokenHash: `${tokenHash.substring(0, 16)}...`,
                    detectedAt: new Date().toISOString(),
                    action: 'session_revoked',
                  },
                });
              }
            } catch (auditError) {
              const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
              this.logger?.error?.(`Failed to record SUSPICIOUS_ACTIVITY audit event (token reuse): ${errorMessage}`, {
                error: auditError,
                userId: userForAudit?.id || session.userId,
              });
            }

            throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'Refresh token has already been used');
          }
        }
      }

      // NOW validate the refresh token (after lock is acquired and reuse check)
      // This ensures only one request can validate at a time per session
      const validation = await this.jwtService.validateRefreshToken(refreshToken);

      if (!validation.valid || !validation.payload) {
        throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'Invalid refresh token');
      }

      const payload = validation.payload;

      // Re-check session after acquiring lock (it might have been revoked/updated)
      // Since we have the lock, no other request can modify this session, but it might have been revoked
      // We already have currentSession from the early reuse check, but re-fetch to ensure it's still valid
      const lockedSession = (await this.sessionService.findByIdLight(session.id)) as unknown as ISession | null;
      if (!lockedSession || lockedSession.isRevoked || lockedSession.id !== session.id) {
        this.logger?.debug?.(
          `Session changed after lock acquisition for user ${payload.sub}. Session may have been revoked.`,
        );
        throw new NAuthException(AuthErrorCode.SESSION_NOT_FOUND, 'Session not found or revoked');
      }

      // ============================================================================
      // NOTE: We still do the atomic mark operation below as a double-check
      // The early check above handles cookie race conditions where old tokens
      // are sent before new cookies are received
      // ============================================================================

      // Mark token as used BEFORE generating new tokens (prevents reuse)
      if (this.config.jwt.refreshToken.reuseDetection) {
        const refreshTokenTTL = this.jwtService.getRefreshTokenTTL();
        const marked = await this.sessionService.markRefreshTokenAsUsed(tokenHash, refreshTokenTTL);

        if (!marked) {
          // Token was already marked as used - reuse detected!
          this.logger?.error?.(
            `Token reuse detected for user ${payload.sub} - atomic mark failed, revoking entire token family ${payload.tokenFamily}`,
          );

          // Audit the reuse attempt
          try {
            const userForAudit = (await this.userRepository.findOne({
              where: { sub: payload.sub },
            })) as IUser | null;
            if (userForAudit) {
              await this.auditService?.recordEvent({
                userId: userForAudit.id,
                eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
                eventStatus: 'SUSPICIOUS',
                riskFactor: 75,
                riskFactors: [RiskFactor.TOKEN_REUSE_ATTEMPT],
                reason: 'Token reuse attempt blocked',
                // Client info automatically included from context
                description:
                  'Refresh token reuse attempt detected via atomic operation. Legitimate user session preserved.',
                metadata: {
                  tokenFamily: payload.tokenFamily,
                  detectedAt: new Date().toISOString(),
                  action: 'reuse_blocked_atomic',
                },
              });
            }
          } catch (auditError) {
            this.logger?.warn?.('Failed to record SUSPICIOUS_ACTIVITY audit event', { error: auditError });
          }

          throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'Refresh token has already been used');
        }

        this.logger?.debug?.(`Marked refresh token as used for session ${lockedSession.id}`);
      }

      // Generate new token pair with same family
      // Note: deviceId not included in token - session.deviceId is source of truth
      const newTokens = await this.jwtService.generateTokenPair({
        userId: payload.sub,
        email: payload.email,
        sessionId: lockedSession.id.toString(), // Convert integer to string for JWT
        tokenFamily: payload.tokenFamily,
      });

      // Update session with new token hashes (token rotation)
      // This automatically invalidates the old tokens as they won't match the session
      await this.sessionService.updateTokens(
        lockedSession.id,
        this.jwtService.hashToken(newTokens.accessToken),
        this.jwtService.hashToken(newTokens.refreshToken),
      );

      this.logger?.log?.(`Token refreshed successfully for user ${payload.sub}`);

      // Decode new tokens to get expiry times
      const accessTokenValidation = await this.jwtService.validateAccessToken(newTokens.accessToken);
      const refreshTokenValidation = await this.jwtService.validateRefreshToken(newTokens.refreshToken);

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        accessTokenExpiresAt: accessTokenValidation.payload?.exp || 0,
        refreshTokenExpiresAt: refreshTokenValidation.payload?.exp || 0,
      };
    } catch (error: unknown) {
      // Best-effort cookie cleanup for session-invalid refresh errors.
      if (error instanceof NAuthException) {
        this.clearAuthCookiesOnRefreshFailure(error.code);
      }
      throw error;
    } finally {
      // Always release lock, even if error occurs
      // Only release if we successfully acquired it
      if (lockAcquired) {
        await this.sessionService.releaseRefreshLock(lockKey);
        this.logger?.debug?.(`[REFRESH DEBUG] Released lock ${lockKey}`);
      }
    }
  }

  // ============================================================================
  // Refresh failure cookie cleanup helpers
  // ============================================================================

  /**
   * Clear auth cookies (access/refresh/csrf) on refresh failures that imply the session is invalid.
   *
   * WHY:
   * - In cookie delivery, httpOnly cookies can only be cleared server-side.
   * - Clearing them on refresh failure prevents client loops and aligns client state with server reality.
   *
   * SECURITY NOTE:
   * - Device token cookie is intentionally NOT cleared by default (remember-device feature).
   *
   * @param code - Error code to evaluate
   */
  private clearAuthCookiesOnRefreshFailure(code: AuthErrorCode): void {
    if (this.config.tokenDelivery?.method === 'json') return;
    if (
      code !== AuthErrorCode.TOKEN_INVALID &&
      code !== AuthErrorCode.SESSION_NOT_FOUND &&
      code !== AuthErrorCode.SESSION_EXPIRED
    ) {
      return;
    }

    const responseFromContext = this.clientInfoService.getResponse();
    if (!responseFromContext) return;

    const response = responseFromContext as unknown as {
      clearCookie?: (name: string, options?: unknown) => void;
      cookie?: Function;
      setCookie?: Function;
    };

    if (typeof response.clearCookie === 'function') {
      this.helpers.clearAuthCookies(response, false);
      return;
    }

    if (typeof response.cookie === 'function' || typeof response.setCookie === 'function') {
      clearAuthCookiesCompat(response, this.config, this.config.tokenDelivery?.cookieOptions, false);
    }
  }

  // ============================================================================
  // Logout
  // ============================================================================

  /**
   * Logout user from current session
   *
   * Revokes the current authenticated session. Session ID is automatically extracted
   * from the JWT token context (via ClientInfoService), similar to how IP address
   * and user agent are handled.
   *
   * Usage Pattern:
   * - **User-context only**: This method operates on the current authenticated session
   * - Session ID is transparently extracted from JWT token in request context
   * - User can only logout their own current session (not other sessions)
   * - For logging out other sessions, use logoutSession() or logoutAll()
   *
   * Security:
   * - Requires authentication - session ID must be present in request context
   * - Endpoint MUST be protected by authentication guards
   * - User cannot specify which session to logout (always current session)
   * - Optional sub validation for additional security
   *
   * @param dto - Logout options (optional sub for validation, optional forgetMe flag)
   * @returns Success status
   * @throws {NAuthException} SESSION_NOT_FOUND if session ID not found in request context
   *
   * @example
   * ```typescript
   * @UseGuards(AuthGuard)
   * @Get('logout')
   * async logout(@CurrentUser() user: IUser, @Query('forgetMe') forgetMe?: string) {
   *   const dto = new LogoutDTO();
   *   dto.sub = user.sub; // Optional validation
   *   dto.forgetMe = forgetMe === 'true';
   *   return this.authService.logout(dto);
   * }
   * ```
   */
  async logout(dto: LogoutDTO): Promise<LogoutResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(LogoutDTO, dto);

    // Get sessionId from context (automatically extracted from JWT token)
    const clientInfo = this.clientInfoService.get();
    let sessionId = clientInfo.sessionId;

    // Fallback: Try to get sessionId from JWT payload in context
    if (!sessionId) {
      const jwtPayload = ContextStorage.get<Record<string, unknown>>('JWT_PAYLOAD');
      if (jwtPayload?.sessionId) {
        // Parse sessionId to number (JWT payload has it as string)
        const sessionIdStr = String(jwtPayload.sessionId);
        const sessionIdNumber = parseInt(sessionIdStr, 10);
        if (!isNaN(sessionIdNumber) && sessionIdNumber > 0) {
          sessionId = sessionIdNumber;
          // Update CLIENT_INFO in context for future use
          const clientInfoInContext = ContextStorage.get<Record<string, unknown>>('CLIENT_INFO');
          if (clientInfoInContext) {
            clientInfoInContext.sessionId = sessionIdNumber;
            ContextStorage.set('CLIENT_INFO', clientInfoInContext);
          }
        }
      }
    }

    if (!sessionId) {
      // ============================================================================
      // Idempotent logout (no consumer baggage)
      // ============================================================================
      // WHY:
      // - Frontends often call logout even after the session/access token has expired.
      // - In cookie delivery modes, httpOnly auth cookies can only be cleared server-side.
      // - Throwing here would prevent cookie clearing and force consumers to add try/catch logic.
      //
      // SECURITY NOTE:
      // - If we cannot identify a session, we do NOT revoke anything server-side.
      // - We only clear cookies (best-effort) and return success.
      const response = this.clientInfoService.getResponse();
      if (response && this.config.tokenDelivery?.method !== 'json') {
        this.helpers.clearAuthCookies(response, dto.forgetMe ?? false);
        this.logger?.debug?.('Auth cookies cleared on logout without an active session (idempotent logout)');
      }

      return { success: true };
    }

    // Prepare metadata for audit trail
    const auditMetadata: Record<string, unknown> | undefined = dto.forgetMe
      ? {
          deviceForgotten: true,
          reason: 'User requested device to be forgotten on logout',
        }
      : undefined;

    await this.sessionService.revokeSession(sessionId, 'User logout', auditMetadata);

    // If forgetMe is true, revoke trusted device
    if (
      dto.forgetMe &&
      this.config.mfa?.rememberDevices &&
      this.config.mfa?.rememberDevices !== 'never' &&
      this.trustedDeviceService
    ) {
      if (clientInfo.deviceToken) {
        try {
          // Get session to get userId
          const session = await this.sessionService.findById(sessionId);
          if (session) {
            await this.trustedDeviceService.revokeTrustedDevice(clientInfo.deviceToken, session.userId);
            this.logger?.log?.(`Revoked trusted device token for user (forgetMe=true)`);

            // Get user for audit
            const user = await this.userRepository.findOne({ where: { id: session.userId } });
            if (user) {
              // ============================================================================
              // Audit: Record device untrust event
              // ============================================================================
              try {
                // Ensure userId is a number for audit
                const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);

                await this.auditService?.recordEvent({
                  userId,
                  eventType: AuthAuditEventType.DEVICE_UNTRUSTED,
                  eventStatus: 'SUCCESS',
                  sessionId: session.id,
                  description: `Device untrusted by user (forgetMe=true) - ${session.deviceName || 'Unknown device'}`,
                  // Client info (deviceId, deviceName, deviceType, etc.) automatically included from context
                  metadata: {
                    reason: 'user_logout_forget_me',
                  },
                });
              } catch (auditError) {
                // Non-blocking: Log but continue
                const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
                this.logger?.error?.(`Failed to record DEVICE_UNTRUSTED audit event: ${errorMessage}`, {
                  error: auditError,
                  userId: session.userId,
                });
              }
            }
          }
        } catch (error) {
          // Non-blocking: Log but continue
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger?.debug?.(`Failed to revoke trusted device token on logout: ${errorMessage}`, { error });
        }
      }
    }

    // ============================================================================
    // Automatically Clear Auth Cookies (if using cookie-based token delivery)
    // ============================================================================
    const response = this.clientInfoService.getResponse();
    if (response && this.config.tokenDelivery?.method !== 'json') {
      this.helpers.clearAuthCookies(response, dto.forgetMe ?? false);
      this.logger?.debug?.('Auth cookies cleared automatically on logout');
    }

    return { success: true };
  }

  /**
   * Global signout (revoke all user sessions)
   *
   * Revokes all active sessions for a user across all devices.
   * Optionally revokes all trusted devices if forgetDevices flag is set.
   *
   * Usage Patterns:
   * - **User-initiated**: User logs out from all their own sessions (protected endpoint, user provides their own sub)
   * - **Admin-initiated**: Admin force-logs out any user (admin-protected endpoint, admin provides target user's sub)
   *
   * Security:
   * - Requires explicit sub parameter
   * - NO built-in authentication - endpoint MUST be protected by guards
   * - For user endpoints: Extract sub from authenticated user context (@CurrentUser)
   * - For admin endpoints: Accept sub from route parameter and protect with admin guards
   *
   * @param dto - User sub and optional forgetDevices flag
   * @returns Number of sessions revoked
   * @throws {NAuthException} NOT_FOUND if user not found
   *
   * @example User-initiated (user context)
   * ```typescript
   * // Controller extracts sub from authenticated user
   * @UseGuards(AuthGuard)
   * @Post('logout/all')
   * async logoutAll(@CurrentUser() user: IUser, @Body() body: { forgetDevices?: boolean }) {
   *   return this.authService.logoutAll({ sub: user.sub, forgetDevices: body.forgetDevices });
   * }
   * ```
   *
   * @example Admin-initiated (admin manages any user)
   * ```typescript
   * // Admin provides target user's sub
   * @UseGuards(AuthGuard, AdminGuard)
   * @Post('admin/users/:sub/logout-all')
   * async adminLogoutAll(@Param('sub') sub: string, @Body() body: { forgetDevices?: boolean }) {
   *   return this.authService.logoutAll({ sub, forgetDevices: body.forgetDevices });
   * }
   * ```
   */
  async logoutAll(dto: LogoutAllDTO): Promise<LogoutAllResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(LogoutAllDTO, dto);

    // Get user by sub to get internal id
    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Use internal id for session queries
    const revokedCount = await this.sessionService.revokeAllUserSessions(user.id, 'Global signout');

    // Revoke all trusted devices if forgetDevices flag is set
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
          `Revoked ${revokedDevicesCount} trusted device(s) for user ${user.sub} (forgetDevices=true)`,
        );

        // Record audit event for device revocation
        if (revokedDevicesCount > 0 && this.auditService) {
          try {
            const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
            await this.auditService.recordEvent({
              userId,
              eventType: AuthAuditEventType.DEVICE_UNTRUSTED,
              eventStatus: 'SUCCESS',
              description: `Global signout: All trusted devices revoked (${revokedDevicesCount} device(s))`,
              metadata: {
                reason: 'global_logout_forget_devices',
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
            // Non-blocking: Log but continue
            const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
            this.logger?.error?.(`Failed to record DEVICE_UNTRUSTED audit event: ${errorMessage}`, {
              error: auditError,
              userId: user.id,
            });
          }
        }
      } catch (error) {
        // Non-blocking: Log but continue
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger?.debug?.(`Failed to revoke trusted devices on global logout: ${errorMessage}`, { error });
      }
    }

    // ============================================================================
    // Audit: Record GLOBAL_SIGNOUT event (individual SESSION_REVOKED events recorded in SessionService)
    // ============================================================================
    if (this.auditService && revokedCount > 0) {
      try {
        const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
        const description =
          dto.forgetDevices && revokedDevicesCount > 0
            ? `Global signout: ${revokedCount} session(s) revoked, ${revokedDevicesCount} trusted device(s) forgotten`
            : `Global signout: ${revokedCount} session(s) revoked`;

        await this.auditService.recordEvent({
          userId,
          eventType: AuthAuditEventType.GLOBAL_SIGNOUT,
          eventStatus: 'INFO',
          reason: 'Global signout',
          description,
          metadata: {
            revokedCount,
            forgetDevices: dto.forgetDevices ?? false,
            ...(dto.forgetDevices && revokedDevicesCount > 0
              ? {
                  revokedDevicesCount,
                  devices: revokedDevices.map((d) => ({
                    id: d.id,
                    deviceName: d.deviceName,
                    lastUsedAt: d.lastUsedAt?.toISOString() || null,
                    trustedUntil: d.trustedUntil?.toISOString() || null,
                  })),
                }
              : {}),
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue (individual SESSION_REVOKED events already recorded in SessionService)
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record GLOBAL_SIGNOUT audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
        });
      }
    }

    // ============================================================================
    // Lifecycle Hook: Sessions Revoked
    // ============================================================================
    if (revokedCount > 0) {
      try {
        await this.hookRegistry.executeSessionsRevoked({
          user,
          revokedCount,
          reason: 'global_signout',
          initiatedBy: 'user',
        });
      } catch (hookError) {
        // Non-blocking: Log but continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(`Failed to execute sessionsRevoked hooks: ${errorMessage}`, {
          error: hookError,
          userId: user.id,
        });
      }
    }

    // ============================================================================
    // Automatically Clear Auth Cookies (if using cookie-based token delivery)
    // ============================================================================
    const response = this.clientInfoService.getResponse();
    if (response && this.config.tokenDelivery?.method !== 'json') {
      // Clear auth cookies
      // If forgetDevices is true, also clear device token cookie
      this.helpers.clearAuthCookies(response, dto.forgetDevices ?? false);
      this.logger?.debug?.('Auth cookies cleared automatically on global logout');
    }

    return { revokedCount };
  }

  /**
   * Get all active sessions for a user
   *
   * Returns session details including authentication method (password, social, admin).
   * For social logins, check session metadata for the specific OAuth provider.
   * Current session (if called from authenticated context) is marked with isCurrent=true.
   *
   * Usage Patterns:
   * - **User viewing own sessions**: User views their active sessions (protected endpoint, user provides their own sub)
   * - **Admin viewing any user's sessions**: Admin views any user's sessions (admin-protected endpoint, admin provides target user's sub)
   *
   * Security:
   * - Requires explicit sub parameter
   * - NO built-in authentication - endpoint MUST be protected by guards
   * - For user endpoints: Extract sub from authenticated user context (@CurrentUser)
   * - For admin endpoints: Accept sub from route parameter and protect with admin guards
   *
   * @param dto - Contains user sub
   * @returns Array of sessions with device info, auth method, and isCurrent flag
   * @throws {NAuthException} NOT_FOUND if user not found
   *
   * @example User viewing own sessions
   * ```typescript
   * @UseGuards(AuthGuard)
   * @Get('sessions')
   * async getSessions(@CurrentUser() user: IUser) {
   *   return this.authService.getUserSessions({ sub: user.sub });
   * }
   * ```
   *
   * @example Admin viewing any user's sessions
   * ```typescript
   * @UseGuards(AuthGuard, AdminGuard)
   * @Get('admin/users/:sub/sessions')
   * async adminGetSessions(@Param('sub') sub: string) {
   *   return this.authService.getUserSessions({ sub });
   * }
   * ```
   */
  async getUserSessions(dto: GetUserSessionsDTO): Promise<GetUserSessionsResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(GetUserSessionsDTO, dto);

    // Get user by sub to get internal id
    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Get current session ID from context (if available)
    const clientInfo = this.clientInfoService.get();
    const currentSessionId = clientInfo.sessionId ? String(clientInfo.sessionId) : null;

    // Get all active sessions for user
    const sessions = await this.sessionService.findUserSessions(user.id);

    // Map sessions to response format
    const sessionInfos: UserSessionInfo[] = sessions.map((session) => {
      // Determine auth method and provider
      let authMethod: string | null = session.authMethod || null;
      let authProvider: string | null = null;

      // If authMethod is 'social' or starts with 'admin-', extract provider from metadata
      if (authMethod === 'social' || authMethod?.startsWith('admin-')) {
        // Check metadata for provider information
        const metadata = session.metadata || {};
        authProvider = (metadata.authProvider as string) || (metadata.provider as string) || null;

        // If no provider in metadata but authMethod contains it (e.g., 'google', 'facebook')
        if (!authProvider && authMethod && authMethod !== 'social' && !authMethod.startsWith('admin-')) {
          authProvider = authMethod;
          authMethod = 'social';
        }
      }

      // Determine if this is the current session
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
        isRemembered: session.isRemembered,
        isCurrent,
        authMethod,
        authProvider,
      };
    });

    return { sessions: sessionInfos };
  }

  /**
   * Logout a specific session by ID
   *
   * Revokes a specific session for a user. Validates session belongs to requesting user.
   * Automatically clears cookies if logging out the current session.
   * Useful for "sign out from device" functionality in user dashboards.
   *
   * Usage Patterns:
   * - **User logging out own session**: User revokes specific session (protected endpoint, user provides their own sub)
   * - **Admin revoking any user's session**: Admin revokes specific session for any user (admin-protected endpoint, admin provides target user's sub)
   *
   * Security:
   * - Requires explicit sub parameter
   * - Validates session belongs to user (prevents unauthorized session revocation)
   * - NO built-in authentication - endpoint MUST be protected by guards
   * - For user endpoints: Extract sub from authenticated user context (@CurrentUser)
   * - For admin endpoints: Accept sub from route parameter and protect with admin guards
   *
   * @param dto - Contains sessionId and user sub
   * @returns Success status and whether it was the current session
   * @throws {NAuthException} NOT_FOUND if user not found
   * @throws {NAuthException} SESSION_NOT_FOUND if session not found
   * @throws {NAuthException} FORBIDDEN if session doesn't belong to user
   *
   * @example User logging out own session
   * ```typescript
   * @UseGuards(AuthGuard)
   * @Delete('sessions/:sessionId')
   * async logoutSession(@CurrentUser() user: IUser, @Param('sessionId') sessionId: string) {
   *   return this.authService.logoutSession({ sub: user.sub, sessionId });
   * }
   * ```
   *
   * @example Admin revoking any user's session (if needed)
   * ```typescript
   * @UseGuards(AuthGuard, AdminGuard)
   * @Delete('admin/users/:sub/sessions/:sessionId')
   * async adminRevokeSession(@Param('sub') sub: string, @Param('sessionId') sessionId: string) {
   *   return this.authService.logoutSession({ sub, sessionId });
   * }
   * ```
   */
  async logoutSession(dto: LogoutSessionDTO): Promise<LogoutSessionResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(LogoutSessionDTO, dto);

    // Get user by sub to get internal id
    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Parse session ID (can be string or number)
    const sessionId = typeof dto.sessionId === 'string' ? parseInt(dto.sessionId, 10) : dto.sessionId;
    if (isNaN(sessionId)) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid session ID');
    }

    // Get session to verify ownership
    const session = await this.sessionService.findById(sessionId);
    if (!session) {
      throw new NAuthException(AuthErrorCode.SESSION_NOT_FOUND, 'Session not found');
    }

    // Verify session belongs to user
    if (session.userId !== user.id) {
      throw new NAuthException(AuthErrorCode.FORBIDDEN, 'Session does not belong to user');
    }

    // Check if this is the current session
    const clientInfo = this.clientInfoService.get();
    const currentSessionId = clientInfo.sessionId ? parseInt(String(clientInfo.sessionId), 10) : null;
    const wasCurrentSession = currentSessionId !== null && sessionId === currentSessionId;

    // Revoke the session
    await this.sessionService.revokeSession(sessionId, 'User requested logout', {
      requestedBy: dto.sub,
      wasCurrentSession,
    });

    // Clear cookies if this was the current session
    if (wasCurrentSession) {
      const response = this.clientInfoService.getResponse();
      if (response && this.config.tokenDelivery?.method !== 'json') {
        this.helpers.clearAuthCookies(response, false);
        this.logger?.debug?.('Auth cookies cleared automatically on session logout');
      }
    }

    // Record audit event
    if (this.auditService) {
      try {
        await this.auditService.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.SESSION_REVOKED,
          eventStatus: 'INFO',
          reason: 'user_requested',
          description: `Session revoked by user request${wasCurrentSession ? ' (current session)' : ''}`,
          metadata: {
            sessionId,
            wasCurrentSession,
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
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

  // ============================================================================
  // Password Management
  // ============================================================================

  /**
   * Change the password for an existing user.
   *
   * Verifies the current password, validates the new password,
   * checks password reuse policy, and updates the user's password hash and history.
   * Executes configured pre-change hooks if provided.
   *
   * @param sub - External user identifier (sub/UUID)
   * @param dto - ChangePasswordDTO containing old and new password
   * @returns void
   * @throws {NAuthException} If the user is not found, current password is incorrect, the new password is weak, password reuse is detected, or password change is disallowed by hooks.
   *
   * @example
   * ```typescript
   * await authService.changePassword('user-uuid', {
   *   oldPassword: 'currentPass123!',
   *   newPassword: 'newStr0ngPass!@#',
   * });
   * ```
   */
  async changePassword(dto: ChangePasswordRequestDTO): Promise<ChangePasswordResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(ChangePasswordRequestDTO, dto);

    // Get user by sub
    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;

    if (!user || !user.passwordHash) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // ============================================================================
    // Lifecycle Hook: beforePasswordChange (TODO: Implement provider-based hook)
    // ============================================================================
    // TODO: Implement provider-based hook for beforePasswordChange
    // const allowed = await this.hookRegistry.executeBeforePasswordChange(dto.sub, dto.oldPassword);
    // if (!allowed) {
    //   throw new NAuthException(AuthErrorCode.PASSWORD_CHANGE_NOT_ALLOWED, 'Password change not allowed');
    // }

    // Verify old password
    const isValid = await this.passwordService.verifyPassword(dto.oldPassword, user.passwordHash);

    if (!isValid) {
      throw new NAuthException(AuthErrorCode.PASSWORD_INCORRECT, 'Current password is incorrect');
    }

    // ============================================================================
    // Lifecycle Hook: afterPasswordChange (TODO: Implement provider-based hook)
    // ============================================================================
    // TODO: Implement provider-based hook for afterPasswordChange
    // await this.hookRegistry.executeAfterPasswordChange(dto.sub);

    await this.helpers.updateUserPassword(
      {
        user,
        newPassword: dto.newPassword,
        mustChangePassword: false,
        revokeSessions: true,
        revokeReason: 'Password changed',
        audit: {
          eventType: AuthAuditEventType.PASSWORD_CHANGED,
          eventStatus: 'SUCCESS',
        },
      },
      this.passwordService,
      this.auditService,
    );

    return { success: true };
  }

  /**
   * Update user profile attributes.
   *
   * Updates user fields (name, email, phone, username, metadata) and enforces unique constraints and verification rules.
   *
   * @param dto - UpdateUserAttributesRequestDTO containing sub and fields to update
   * @returns Updated user object
   * @throws {NAuthException} If user not found or unique constraint violated
   *
   * @example
   * await authService.updateUserAttributes({ sub: 'user-uuid', email: 'test@example.com' });
   */
  async updateUserAttributes(dto: UpdateUserAttributesRequestDTO): Promise<UserResponseDto> {
    return await this.userService.updateUserAttributes(dto);
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
   * await authService.updateVerifiedStatus({
   *   sub: 'user-uuid',
   *   isEmailVerified: true
   * });
   *
   * // Update both email and phone verification
   * await authService.updateVerifiedStatus({
   *   sub: 'user-uuid',
   *   isEmailVerified: true,
   *   isPhoneVerified: false
   * });
   * ```
   */
  async updateVerifiedStatus(dto: UpdateVerifiedStatusRequestDTO): Promise<UserResponseDto> {
    return await this.userService.updateVerifiedStatus(dto);
  }

  /**
   * Validate JWT access token
   *
   * Validates JWT access token signature, expiration, and format.
   * Returns decoded payload if valid, or error information if invalid.
   *
   * Use cases:
   * - Manual token validation in consumer applications
   * - Token introspection for debugging
   * - Custom authorization logic requiring token payload
   * - API gateway token validation
   *
   * Security:
   * - Verifies token signature using configured secret/public key
   * - Validates expiration timestamp
   * - Ensures token type is 'access'
   * - Checks issuer and audience claims
   *
   * @param dto - ValidateAccessTokenDTO containing access token
   * @returns ValidateAccessTokenResponseDTO with validation result and optional payload
   *
   * @example
   * ```typescript
   * const result = await authService.validateAccessToken({
   *   accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
   * });
   *
   * if (result.valid) {
   *   console.log('User ID:', result.payload.sub);
   *   console.log('Session ID:', result.payload.sessionId);
   * } else {
   *   console.error('Validation failed:', result.error, result.errorType);
   * }
   * ```
   */
  async validateAccessToken(dto: ValidateAccessTokenDTO): Promise<ValidateAccessTokenResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(ValidateAccessTokenDTO, dto);

    const result = await this.jwtService.validateAccessToken(dto.accessToken);

    return {
      valid: result.valid,
      payload: result.payload,
      error: result.error,
      errorType: result.errorType,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================
  // NOTE: Private helper methods have been moved to AuthServiceInternalHelpers
  // Use this.helpers.methodName() to access them

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
   * const user = await authService.getUserForAuthContext('user-uuid-123');
   * // user.hasPasswordHash === true/false
   * // user.passwordHash === undefined (removed)
   * ```
   */
  async getUserForAuthContext(sub: string): Promise<IUser> {
    return await this.userService.getUserForAuthContext(sub);
  }

  /**
   * Get user by external identifier (sub/UUID).
   *
   * @param dto - GetUserByIdDTO containing sub
   * @returns User response DTO or null if not found
   *
   * @example
   * ```typescript
   * const user = await authService.getUserById({ sub: 'user-uuid' });
   * ```
   */
  async getUserById(dto: GetUserByIdDTO): Promise<UserResponseDto | null> {
    return await this.userService.getUserById(dto);
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
   * const user = await authService.getUserByEmail({ email: 'user@example.com', requireEmailVerified: true });
   * ```
   */
  async getUserByEmail(dto: GetUserByEmailDTO): Promise<UserResponseDto | null> {
    return await this.userService.getUserByEmail(dto);
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
   * await authService.setMustChangePassword({ userId: 'user-uuid-123' });
   * ```
   */
  async setMustChangePassword(dto: SetMustChangePasswordDTO): Promise<SetMustChangePasswordResponseDTO> {
    return await this.userService.setMustChangePassword(dto);
  }

  /**
   * Admin-only: Initiate a code-based password reset workflow.
   *
   * Unlike adminSetPassword(), this sends a verification code (and optional link)
   * to the user via email/SMS and allows them to set their own password.
   *
   * Features:
   * - Code + optional link delivery (like email verification)
   * - Optional immediate session revocation
   * - Configurable expiry (default 1 hour)
   * - Admin-specific email template
   * - No rate limiting (admin bypass)
   * - Separate audit trail with reason
   *
   * Security:
   * - Admin-only operation (protect route with admin guard)
   * - Non-enumerating (throws NOT_FOUND if user doesn't exist)
   * - Separate token type ('admin_password_reset')
   * - Audit logging with reason
   *
   * @param dto - Admin reset password request
   * @returns Response with masked destination, expiry, and sessions revoked count
   * @throws {NAuthException} NOT_FOUND when user not found
   *
   * @example
   * ```typescript
   * // With link for custom UI
   * const result = await authService.adminResetPassword({
   *   identifier: 'user@example.com',
   *   baseUrl: 'https://myapp.com/reset-password',
   *   revokeSessions: true,
   *   reason: 'User reported compromise'
   * });
   * // result: { success: true, destination: 'u***r@example.com', expiresIn: 3600, sessionsRevoked: 3 }
   *
   * // Code only (no link)
   * const result = await authService.adminResetPassword({
   *   identifier: 'user@example.com'
   * });
   * ```
   */
  async adminResetPassword(dto: AdminResetPasswordDTO): Promise<AdminResetPasswordResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(AdminResetPasswordDTO, dto);

    this.logger?.log?.(`Admin password reset requested for identifier: ${dto.identifier}`);
    this.logger?.debug?.(
      `Reset details: { identifier: ${dto.identifier}, deliveryMethod: ${dto.deliveryMethod ?? 'email'}, revokeSessions: ${dto.revokeSessions ?? false}, baseUrl: ${dto.baseUrl ?? 'none'}, reason: ${dto.reason ?? 'none'} }`,
    );

    // ============================================================================
    // Find User by Identifier
    // ============================================================================
    // Support multiple identifier types: email, username, phone, or sub (UUID)
    let user: IUser | null = null;

    // Try to find by sub (UUID) first if it looks like a UUID.
    // WHY: Many deployments treat `sub` as the primary immutable identifier.
    if (isUUID(dto.identifier)) {
      this.logger?.debug?.(`Identifier appears to be UUID, searching by sub: ${dto.identifier}`);
      user = (await this.userRepository.findOne({ where: { sub: dto.identifier } })) as IUser | null;
    }

    // If not found by sub, try by identifier (email, username, phone)
    if (!user) {
      this.logger?.debug?.(`Searching by identifier (email/username/phone): ${dto.identifier}`);
      user = await this.helpers.findUserByIdentifier(dto.identifier);
    }

    if (!user) {
      this.logger?.warn?.(`Admin password reset failed - user not found: ${dto.identifier}`);
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    if (!this.passwordResetService) {
      this.logger?.error?.('Password reset service not available');
      throw new NAuthException(
        AuthErrorCode.SERVICE_UNAVAILABLE,
        'Password reset service is not configured. Please configure an email provider.',
      );
    }

    // ============================================================================
    // Optionally revoke sessions immediately (before sending reset email)
    // ============================================================================
    const revokeSessions = dto.revokeSessions ?? false;
    let sessionsRevoked = 0;

    if (revokeSessions) {
      sessionsRevoked = await this.sessionService.revokeAllUserSessions(user.id, 'Admin initiated password reset');
      this.logger?.log?.(`Revoked ${sessionsRevoked} sessions for user ${user.sub}`);
    }

    // ============================================================================
    // Request admin reset with code + link
    // ============================================================================
    const delivery = dto.deliveryMethod || 'email';
    const expiresIn = dto.codeExpiresIn || 3600; // Default 1 hour

    const result = await this.passwordResetService.requestAdminReset(user, delivery, {
      expiresIn,
      baseUrl: dto.baseUrl, // Consumer app can build custom UI
    });

    // ============================================================================
    // Audit Logging
    // ============================================================================
    await this.auditService?.recordEvent({
      userId: user.id,
      eventType: AuthAuditEventType.ADMIN_PASSWORD_RESET_INITIATED,
      eventStatus: 'INFO',
      authMethod: 'password',
      description: dto.reason || 'Admin initiated password reset',
      reason: dto.reason, // Store reason in audit event
      metadata: {
        medium: delivery,
        expiresIn,
        sessionsRevoked,
        hasBaseUrl: !!dto.baseUrl,
      },
    });

    // ============================================================================
    // Return Response
    // ============================================================================
    return {
      success: true,
      destination: result.destination,
      deliveryMedium: result.deliveryMedium,
      expiresIn: result.expiresIn,
      sessionsRevoked: revokeSessions ? sessionsRevoked : undefined,
    };
  }

  /**
   * Complete admin-initiated password reset with verification code or token.
   *
   * Accepts either:
   * - code: Short numeric code from email/SMS (6-10 digits, attempt tracking)
   * - token: Long hex token from link (64 chars, single use, no attempts)
   *
   * Security:
   * - Verifies code/token via PasswordResetService
   * - Enforces password policy and history
   * - Always revokes all sessions on completion
   * - Does not force password change (user already set new password)
   * - Records audit event
   *
   * @param dto - Confirm admin reset password request
   * @returns Success response
   * @throws {NAuthException} NOT_FOUND | PASSWORD_RESET_CODE_INVALID | PASSWORD_RESET_CODE_EXPIRED | PASSWORD_RESET_MAX_ATTEMPTS | WEAK_PASSWORD | PASSWORD_REUSED | INVALID_CREDENTIALS
   *
   * @example
   * ```typescript
   * // With code
   * await authService.confirmAdminResetPassword({
   *   identifier: 'user@example.com',
   *   code: '123456',
   *   newPassword: 'NewSecurePass123!'
   * });
   *
   * // With token from link
   * await authService.confirmAdminResetPassword({
   *   identifier: 'user@example.com',
   *   token: '64-char-hex-token',
   *   newPassword: 'NewSecurePass123!'
   * });
   * ```
   */
  async confirmAdminResetPassword(dto: ConfirmAdminResetPasswordDTO): Promise<ConfirmAdminResetPasswordResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(ConfirmAdminResetPasswordDTO, dto);

    this.logger?.log?.(`Confirm admin password reset for identifier: ${dto.identifier}`);

    // ============================================================================
    // Validate that either code or token is provided
    // ============================================================================
    if (!dto.code && !dto.token) {
      throw new NAuthException(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Either code or token is required to confirm password reset',
      );
    }

    // ============================================================================
    // Find User by Identifier
    // ============================================================================
    let user: IUser | null = null;

    if (isUUID(dto.identifier)) {
      this.logger?.debug?.(`Identifier appears to be UUID, searching by sub: ${dto.identifier}`);
      user = (await this.userRepository.findOne({ where: { sub: dto.identifier } })) as IUser | null;
    }

    if (!user) {
      this.logger?.debug?.(`Searching by identifier (email/username/phone): ${dto.identifier}`);
      user = await this.helpers.findUserByIdentifier(dto.identifier);
    }

    if (!user) {
      this.logger?.warn?.(`Confirm admin reset failed - user not found: ${dto.identifier}`);
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    if (!this.passwordResetService) {
      this.logger?.error?.('Password reset service not available');
      throw new NAuthException(
        AuthErrorCode.SERVICE_UNAVAILABLE,
        'Password reset service is not configured. Please configure an email provider.',
      );
    }

    // ============================================================================
    // Verify code or token
    // ============================================================================
    const codeOrToken = dto.code || dto.token;
    if (!codeOrToken) {
      throw new NAuthException(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Either code or token is required to confirm password reset',
      );
    }

    await this.passwordResetService.consumeValidCode(user, codeOrToken, 'admin_password_reset');

    // ============================================================================
    // Update password
    // ============================================================================
    // WHY: User already set a new password via this reset flow, so no need to force
    // another password change on next login (unlike adminSetPassword where admin sets
    // a password the user doesn't know)
    await this.helpers.updateUserPassword(
      {
        user,
        newPassword: dto.newPassword,
        mustChangePassword: false, // User already set new password, no need to force change again
        revokeSessions: true, // Always revoke on completion
        revokeReason: 'Admin-initiated password reset completed',
        audit: {
          eventType: AuthAuditEventType.ADMIN_PASSWORD_RESET_COMPLETED,
          eventStatus: 'SUCCESS',
          description: 'User completed admin-initiated password reset',
          metadata: {
            usedCode: !!dto.code,
            usedToken: !!dto.token,
          },
        },
      },
      this.passwordService,
      this.auditService,
    );

    // ============================================================================
    // Return Response
    // ============================================================================
    return {
      success: true,
    };
  }

  /**
   * Admin-only: Reset a user's password by identifier.
   *
   * Allows administrators to reset a user's password using any identifier
   * (email, username, phone, or sub). Automatically revokes sessions and optionally
   * requires password change on next login using the existing challenge system.
   *
   * SECURITY: This is an admin-only operation. Ensure proper authorization
   * checks are in place before calling this method.
   *
   * @param dto - Admin reset password request
   * @returns Response with success status and session revocation count
   * @throws {NAuthException} If user not found, user has no password (social-only), or password validation fails
   *
   * @example
   * ```typescript
   * // Reset with force password change
   * const result = await authService.adminSetPassword({
   *   identifier: 'user@example.com',
   *   newPassword: 'NewSecurePassword123!',
   *   mustChangePassword: true,
   *   revokeSessions: true
   * });
   *
   * // Reset without forcing password change
   * const result = await authService.adminSetPassword({
   *   identifier: 'a21b654c-2746-4168-acee-c175083a65cd',
   *   newPassword: 'NewSecurePassword123!',
   *   mustChangePassword: false
   * });
   * ```
   */
  async adminSetPassword(dto: AdminSetPasswordDTO): Promise<AdminSetPasswordResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(AdminSetPasswordDTO, dto);

    this.logger?.log?.(`Admin password reset requested for identifier: ${dto.identifier}`);
    this.logger?.debug?.(
      `Reset details: { identifier: ${dto.identifier}, mustChangePassword: ${dto.mustChangePassword ?? true}, revokeSessions: ${dto.revokeSessions ?? true} }`,
    );

    // ============================================================================
    // Find User by Identifier
    // ============================================================================
    // Support multiple identifier types: email, username, phone, or sub (UUID)
    let user: IUser | null = null;

    // Try to find by sub (UUID) first if it looks like a UUID.
    // WHY: Many deployments treat `sub` as the primary immutable identifier.
    if (isUUID(dto.identifier)) {
      this.logger?.debug?.(`Identifier appears to be UUID, searching by sub: ${dto.identifier}`);
      user = (await this.userRepository.findOne({ where: { sub: dto.identifier } })) as IUser | null;
    }

    // If not found by sub, try by identifier (email, username, phone)
    if (!user) {
      this.logger?.debug?.(`Searching by identifier (email/username/phone): ${dto.identifier}`);
      user = await this.helpers.findUserByIdentifier(dto.identifier);
    }

    if (!user) {
      this.logger?.warn?.(`Password reset failed - user not found: ${dto.identifier}`);
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const mustChangePassword = dto.mustChangePassword ?? true; // Default to true for security
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
            identifier: dto.identifier,
            mustChangePassword,
            // WHY: Admins can set the first password for social-only accounts so users can login via either route later.
            // This flag helps downstream observability without exposing anything to clients.
            wasSocialOnly,
          },
        },
      },
      this.passwordService,
      this.auditService,
    );

    // ============================================================================
    // Return Response
    // ============================================================================
    return {
      success: true,
      mustChangePassword,
      sessionsRevoked,
    };
  }

  // ============================================================================
  // Forgot Password (Account Recovery)
  // ============================================================================

  /**
   * Request a password reset code for an account.
   *
   * Security:
   * - Avoids account enumeration: returns success even when user is not found.
   * - Delivery is best-effort; errors are logged but should not reveal account existence.
   *
   * Channel selection (per config.signup.verificationMethod):
   * - 'none': send to email if available; else phone (if available)
   * - 'email': only send to verified email
   * - 'phone': only send to verified phone
   * - 'both': prefer verified email; fallback to verified phone
   *
   * @param dto - Forgot password request payload
   * @returns Delivery metadata (masked destination) when available
   */
  async forgotPassword(dto: ForgotPasswordDTO): Promise<ForgotPasswordResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(ForgotPasswordDTO, dto);

    const response: ForgotPasswordResponseDTO = { success: true };

    if (!this.passwordResetService) {
      // Do not leak configuration details to clients.
      this.logger?.warn?.('PasswordResetService not configured; forgotPassword will not send any delivery');
      return response;
    }

    // Respect identifier type restrictions (if configured)
    if (
      this.config.login?.identifierType &&
      !this.helpers.validateIdentifierType(dto.identifier, this.config.login.identifierType)
    ) {
      // Non-enumerating: return success without sending
      return response;
    }

    const user = await this.helpers.findUserByIdentifier(dto.identifier, this.config.login?.identifierType);
    if (!user) {
      return response; // Non-enumerating
    }

    // ============================================================================
    // Allow social-only accounts to set their first password via forgot-password
    // ============================================================================
    // WHY: Social-first users commonly want to add a password later. The reset code proves possession
    // of the delivery channel (email/sms) and avoids weakening account security.

    const verificationMethod = this.config.signup?.verificationMethod ?? 'email';

    // ============================================================================
    // Determine delivery channel
    // ============================================================================
    let delivery: 'email' | 'sms' | undefined;

    if (verificationMethod === 'none') {
      // Rare config: no verification required. Still prefer email if present, else phone.
      if (user.email) delivery = 'email';
      else if (user.phone) delivery = 'sms';
    } else if (verificationMethod === 'email') {
      if (user.isEmailVerified && user.email) delivery = 'email';
    } else if (verificationMethod === 'phone') {
      if (user.isPhoneVerified && user.phone) delivery = 'sms';
    } else if (verificationMethod === 'both') {
      if (user.isEmailVerified && user.email) delivery = 'email';
      else if (user.isPhoneVerified && user.phone) delivery = 'sms';
    }

    if (!delivery) {
      // Non-enumerating: return success without sending
      return response;
    }

    try {
      const result = await this.passwordResetService.requestReset(user, delivery, {
        baseUrl: dto.baseUrl,
      });
      response.destination = result.destination;
      response.deliveryMedium = result.deliveryMedium;
      response.expiresIn = result.expiresIn;
    } catch (error) {
      // Rate limit is safe to return (still does not reveal existence when user exists).
      if (error instanceof NAuthException && error.code === AuthErrorCode.RATE_LIMIT_PASSWORD_RESET) {
        throw error;
      }

      // Non-blocking: log and return success
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`Failed to send password reset code: ${errorMessage}`, { error });
    }

    return response;
  }

  /**
   * Confirm a password reset by validating the reset code and setting a new password.
   *
   * Security:
   * - Uses platform-agnostic errors via NAuthException
   * - Verifies reset code via PasswordResetService
   * - Enforces password policy and history
   * - Revokes all sessions upon successful reset
   *
   * @param dto - Confirm forgot password payload
   * @returns Success response
   * @throws {NAuthException} PASSWORD_RESET_CODE_INVALID | PASSWORD_RESET_CODE_EXPIRED | PASSWORD_RESET_MAX_ATTEMPTS
   */
  async confirmForgotPassword(dto: ConfirmForgotPasswordDTO): Promise<ConfirmForgotPasswordResponseDTO> {
    // Ensure DTO is validated (supports direct usage without framework validation)
    dto = await ensureValidatedDto(ConfirmForgotPasswordDTO, dto);

    if (!this.passwordResetService) {
      throw new NAuthException(AuthErrorCode.SERVICE_UNAVAILABLE, 'Password reset is not available');
    }

    const user = await this.helpers.findUserByIdentifier(dto.identifier, this.config.login?.identifierType);
    if (!user) {
      // Non-enumerating: treat as invalid code
      throw new NAuthException(AuthErrorCode.PASSWORD_RESET_CODE_INVALID, 'Invalid password reset code');
    }

    const { sessionsRevoked: _sessionsRevoked } = await this.helpers.updateUserPassword(
      {
        user,
        newPassword: dto.newPassword,
        mustChangePassword: false,
        revokeSessions: true,
        revokeReason: 'Password reset',
        beforePersist: async () => {
          // Consume code (throws if invalid/expired/too many attempts)
          await this.passwordResetService!.consumeValidCode(user, dto.code);
        },
        audit: {
          eventType: AuthAuditEventType.PASSWORD_RESET_COMPLETED,
          eventStatus: 'SUCCESS',
          authMethod: 'password',
          description: 'Password reset completed by user',
          reason: 'forgot_password',
        },
      },
      this.passwordService,
      this.auditService,
    );

    return { success: true, mustChangePassword: false };
  }
}
