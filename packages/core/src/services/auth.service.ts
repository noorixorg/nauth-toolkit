import { Repository } from 'typeorm';
import { IUser, ISession } from '../interfaces/entities.interface';
import { BaseUser, BaseLoginAttempt, BaseMFADevice, BaseChallengeSession } from '../entities';
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
import { LoginDTO } from '../dto/login.dto';
import { ChangePasswordRequestDTO } from '../dto/change-password-request.dto';
import { ChangePasswordResponseDTO } from '../dto/change-password-response.dto';
import { UpdateUserAttributesRequestDTO } from '../dto/update-user-attributes-request.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { AuthResponseDTO, TokenResponse } from '../dto/auth-response.dto';
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
import { RefreshTokenDTO } from '../dto/refresh-token.dto';
import { ResendCodeDTO } from '../dto/resend-code.dto';
import { ResendCodeResponseDTO } from '../dto/resend-code-response.dto';
import { SetMustChangePasswordDTO } from '../dto/set-must-change-password.dto';
import { SetMustChangePasswordResponseDTO } from '../dto/set-must-change-password-response.dto';
import { TrustDeviceResponseDTO } from '../dto/trust-device-response.dto';
import { IsTrustedDeviceResponseDTO } from '../dto/is-trusted-device-response.dto';
import { VerifyEmailWithCodeDTO, ResendVerificationEmailDTO } from '../dto/verify-email.dto';
import { SendVerificationSMSDTO, ResendVerificationSMSDTO } from '../dto/verify-phone.dto';
import { VerifyPhoneWithCodeBySubDTO } from '../dto/verify-phone-by-sub.dto';

import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { MFAMethod } from '../enums/mfa-method.enum';
import * as crypto from 'crypto';

/**
 * Dummy Argon2 hash for constant-time response
 *
 * ⚠️ SECURITY CRITICAL: Used when user doesn't exist to prevent timing attacks
 * This dummy hash has same format/cost as real Argon2id hashes but verifies against nothing.
 *
 * Format: $argon2id$v=19$m=65536,t=3,p=4$salt$hash
 */
const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$RFVNTVlfU0FMVF9GT1JfVElNSU5H$dummyhashfordummyhashfordummyhash1234567890';

export class AuthService {
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
    private readonly auditService?: AuthAuditService, // Optional - audit trail service (enabled via config.auditLogs.enabled)
    private readonly phoneVerificationService?: PhoneVerificationService, // Optional - only available when SMS provider is configured
    private readonly mfaService?: MFAService, // Optional - available when MFA modules are imported
    private readonly mfaDeviceRepository?: Repository<BaseMFADevice>, // Optional - available when MFA modules are imported
    private readonly trustedDeviceService?: TrustedDeviceService, // Optional - only available when rememberDevices is not 'never'
  ) {
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
      savedUser = (await this.userRepository.save(user)) as unknown as IUser;
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

    // Execute afterSignup hook if configured
    if (this.config.hooks?.afterSignup) {
      await this.config.hooks.afterSignup(savedUser, { requiresVerification: verificationMethod !== 'none' });
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
    // Get client info from request context (transparent!)
    const clientInfo = this.clientInfoService.get();
    const fireAndForget = this.config.auditLogs?.fireAndForget === true;

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
          await this.recordLoginAttempt(dto.identifier, false, 'ip_locked');

          // ============================================================================
          // Audit: Record blocked login (IP locked)
          // ============================================================================
          if (fireAndForget) {
            this.auditService
              ?.recordEvent({
                userSub: dto.identifier,
                eventType: AuthAuditEventType.LOGIN_BLOCKED,
                eventStatus: 'FAILURE',
                authMethod: 'password',
                reason: 'ip_locked',
                description: 'Login blocked - IP address locked due to too many failed attempts',
              })
              .catch((err) => {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                this.logger?.error?.(`Failed to record LOGIN_BLOCKED audit event (fire-and-forget): ${errorMessage}`, {
                  error: err,
                  identifier: dto.identifier,
                });
              });
          } else {
            try {
              await this.auditService?.recordEvent({
                userSub: dto.identifier,
                eventType: AuthAuditEventType.LOGIN_BLOCKED,
                eventStatus: 'FAILURE',
                authMethod: 'password',
                reason: 'ip_locked',
                description: 'Login blocked - IP address locked due to too many failed attempts',
              });
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
    const identifierType = this.config.login?.identifierType;
    if (identifierType) {
      this.logger?.debug?.(`Validating identifier type for: ${dto.identifier}, allowed type: ${identifierType}`);
      const isValidIdentifier = this.validateIdentifierType(dto.identifier, identifierType);
      if (!isValidIdentifier) {
        this.logger?.warn?.(
          `Login rejected - identifier type mismatch. Identifier: ${dto.identifier}, Required: ${identifierType}`,
        );
        await this.handleFailedLogin(dto.identifier, 'identifier_type_mismatch');
        throw new NAuthException(
          AuthErrorCode.INVALID_CREDENTIALS,
          `Login with this identifier type is not allowed. Expected: ${identifierType}`,
        );
      }
    }

    // Find user by email, username, or phone (filtered by identifierType config)
    this.logger?.debug?.(`Finding user by identifier: ${dto.identifier}`);
    const user = await this.findUserByIdentifier(dto.identifier, identifierType);

    // ⚠️ SECURITY CRITICAL: Always hash password even when user doesn't exist
    // This ensures constant-time response to prevent user enumeration via timing attacks
    const hashToVerify = user?.passwordHash || DUMMY_ARGON2_HASH;

    // Verify password (takes ~200-300ms regardless of user existence)
    this.logger?.debug?.('Verifying password');
    const isPasswordValid = await this.passwordService.verifyPassword(dto.password, hashToVerify);

    // Now check all conditions AFTER password verification (constant time achieved)
    if (!user || !user.passwordHash || !isPasswordValid) {
      this.logger?.warn?.(`Login failed - invalid credentials for: ${dto.identifier}`);
      await this.handleFailedLogin(dto.identifier, 'invalid_credentials');

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
      await this.recordLoginAttempt(
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
      await this.recordLoginAttempt(dto.identifier, true, undefined, user.id);
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
      } catch (_error) {
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
      await this.recordLoginAttempt(dto.identifier, false, 'account_inactive', user.id);

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
    await this.recordLoginAttempt(dto.identifier, true, undefined, user.id);
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

    // // Execute afterLogin hook
    // if (this.config.hooks?.afterLogin) {
    //   await this.config.hooks.afterLogin(user, session);
    // }

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
    const userDto = UserResponseDto.fromEntity(user);
    const authResponse: AuthResponseDTO = {
      user: {
        sub: userDto.sub,
        email: userDto.email,
        firstName: userDto.firstName,
        lastName: userDto.lastName,
        phone: userDto.phone ?? undefined,
        isEmailVerified: userDto.isEmailVerified,
        isPhoneVerified: userDto.isPhoneVerified ?? undefined,
        socialProviders:
          userDto.socialProviders && userDto.socialProviders.length > 0 ? userDto.socialProviders : undefined,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: accessTokenValidation.payload?.exp || 0,
      refreshTokenExpiresAt: refreshTokenValidation.payload?.exp || 0,
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
    const responseData = dto as ChallengeResponseData;
    const { session, type } = responseData;
    const requestTrace = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    this.logger?.log?.(
      `[${requestTrace}] Challenge response received: type=${type}, session=${session?.substring(0, 8)}...`,
    );

    // Validate session and get challenge type
    const challengeSession = await this.challengeService.validateSession(session);

    // Validate response matches expected challenge
    this.validateChallengeTypeMatch(challengeSession.challengeName, type);

    // Validate parameters for this challenge type
    // TODO: Later check if we can use classvalidator to replicate the logic of DTO validation centrally
    this.validateChallengeParams(type, responseData);

    // Handle challenge based on type
    switch (type) {
      case 'VERIFY_EMAIL':
        return await this.handleVerifyEmail(challengeSession, (responseData as VerifyEmailResponse).code);

      case 'VERIFY_PHONE':
        return await this.handleVerifyPhone(
          challengeSession,
          responseData as VerifyPhoneResponse | CollectPhoneResponse,
        );

      case 'MFA_REQUIRED':
        return await this.handleMFAVerification(
          challengeSession,
          responseData as VerifyMFACodeResponse | VerifyMFAPasskeyResponse,
        );

      case 'FORCE_CHANGE_PASSWORD':
        return await this.handleForceChangePassword(
          challengeSession,
          (responseData as ForceChangePasswordResponse).newPassword,
        );

      case 'MFA_SETUP_REQUIRED':
        return await this.handleMFASetup(challengeSession, responseData as MFASetupResponse);

      default:
        throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, `Unknown challenge type: ${type}`);
    }
  }

  /**
   * Validate that response type matches expected challenge type
   */
  private validateChallengeTypeMatch(expected: string, provided: string): void {
    if (expected !== provided) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Challenge type mismatch: expected ${expected}, got ${provided}`,
      );
    }
  }

  /**
   * Validate parameters for challenge type
   *
   * Service-level validation ensures Express/other frameworks get same validation as NestJS.
   * This is critical for non-DTO-based applications.
   */
  private validateChallengeParams(type: string, data: ChallengeResponseData): void {
    switch (type) {
      case 'VERIFY_EMAIL': {
        const response = data as VerifyEmailResponse;
        if (!response.code || typeof response.code !== 'string') {
          throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Verification code is required', { field: 'code' });
        }
        break;
      }

      case 'VERIFY_PHONE': {
        const response = data as VerifyPhoneResponse | CollectPhoneResponse;
        const hasCode = 'code' in response && response.code;
        const hasPhone = 'phone' in response && response.phone;

        if (!hasCode && !hasPhone) {
          throw new NAuthException(
            AuthErrorCode.VALIDATION_FAILED,
            'Either phone number or verification code is required',
            { fields: ['phone', 'code'] },
          );
        }
        break;
      }

      case 'MFA_REQUIRED': {
        const response = data as VerifyMFACodeResponse | VerifyMFAPasskeyResponse;
        if (!response.method) {
          throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'MFA method is required', { field: 'method' });
        }

        if (response.method === 'passkey') {
          const passkeyResponse = response as VerifyMFAPasskeyResponse;
          if (!passkeyResponse.credential) {
            throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Passkey credential is required', {
              field: 'credential',
            });
          }
        } else {
          const codeResponse = response as VerifyMFACodeResponse;
          if (!codeResponse.code || typeof codeResponse.code !== 'string') {
            throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'MFA code is required', { field: 'code' });
          }
        }
        break;
      }

      case 'FORCE_CHANGE_PASSWORD': {
        const response = data as ForceChangePasswordResponse;
        if (!response.newPassword || typeof response.newPassword !== 'string') {
          throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'New password is required', {
            field: 'newPassword',
          });
        }
        break;
      }

      case 'MFA_SETUP_REQUIRED': {
        const response = data as MFASetupResponse;
        if (!response.method) {
          throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'MFA setup method is required', {
            field: 'method',
          });
        }
        if (!response.setupData || typeof response.setupData !== 'object') {
          throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'MFA setup data is required', {
            field: 'setupData',
          });
        }
        break;
      }
    }
  }

  /**
   * Handle VERIFY_EMAIL challenge
   */
  private async handleVerifyEmail(
    challengeSession: BaseChallengeSession & { user?: BaseUser },
    code: string,
  ): Promise<AuthResponseDTO> {
    const user = challengeSession.user;
    if (!user) {
      throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
    }

    this.logger?.log?.(`Verifying email for user: ${user.sub}`);

    // Verify email with code, ensuring it belongs to this specific challenge session
    const verifyDto = Object.assign(new VerifyEmailWithCodeDTO(), {
      email: user.email,
      code,
      challengeSessionId: challengeSession.id, // Link verification to this specific session
    });
    const result = await this.emailVerificationService.verifyEmailWithCode(verifyDto);
    const isVerified = result.message === 'Email verified successfully. Please log in to continue.';

    if (!isVerified) {
      // Increment attempts but don't consume session
      await this.challengeService.incrementAttempts(challengeSession);
      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid verification code');
    }

    // Consume challenge session
    await this.challengeService.validateAndConsumeSession(challengeSession.sessionToken, AuthChallenge.VERIFY_EMAIL);

    // Reload user to get updated emailVerified flag
    const updatedUser = await this.userRepository.findOne({ where: { sub: user.sub } });
    if (!updatedUser) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found after email verification');
    }

    // Get client info
    const clientInfo = this.clientInfoService.get();

    // Read auth context from challenge session metadata
    const authMethod = (challengeSession.metadata?.authMethod as string) || 'password';
    const authProvider = challengeSession.metadata?.authProvider as string | undefined;
    const isSocialLogin = authMethod === 'social';

    // Check for next challenges
    const response = await this.challengeHelper.determineAuthResponse({
      user: updatedUser as unknown as IUser,
      config: this.config,
      deviceToken: clientInfo.deviceToken,
      isSocialLogin,
      skipMFAVerification: false,
      authProvider,
    });

    if (response.challengeName) {
      this.logger?.log?.(`Additional challenge required: ${response.challengeName}`);
    } else {
      this.logger?.log?.(`Email verified, auth completed for: ${user.email}`);
    }

    return response;
  }

  /**
   * Handle VERIFY_PHONE challenge
   */
  private async handleVerifyPhone(
    challengeSession: BaseChallengeSession & { user?: BaseUser },
    data: VerifyPhoneResponse | CollectPhoneResponse,
  ): Promise<AuthResponseDTO> {
    const user = challengeSession.user;
    if (!user) {
      throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
    }

    // Check if this is phone collection (first step) or verification (second step)
    if ('phone' in data && data.phone) {
      // Phone collection step
      const phone = data.phone;

      this.logger?.log?.(`Collecting phone number for user: ${user.sub}`);

      // Validate phone format (E.164 format: +[country][number])
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phone)) {
        throw new NAuthException(
          AuthErrorCode.INVALID_PHONE_FORMAT,
          'Invalid phone number format. Use E.164 format (e.g., +1234567890)',
        );
      }

      // Update user phone number
      await this.userRepository.update({ sub: user.sub }, { phone });

      this.logger?.log?.(`Phone number added for user ${user.sub}: ${phone}`);

      // Send verification SMS to the newly added phone
      let smsError: string | undefined;
      if (this.phoneVerificationService) {
        this.logger?.log?.(`Sending verification SMS to newly added phone: ${phone}`);
        try {
          const smsDto = Object.assign(new SendVerificationSMSDTO(), {
            sub: user.sub,
            challengeSessionId: challengeSession.id, // Link SMS code to this challenge session
          });
          await this.phoneVerificationService.sendVerificationSMS(smsDto);
          this.logger?.log?.(`Verification SMS sent successfully to: ${phone}`);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger?.error?.(`Failed to send verification SMS to ${phone}: ${errorMessage}`);
          smsError = errorMessage;
        }
      } else {
        this.logger?.warn?.(
          `Phone verification SMS not sent - PhoneVerificationService not available. ` +
            'Phone verification requires an SMS provider to be configured.',
        );
      }

      // DO NOT consume the challenge session yet - user still needs to verify the code
      // Preserve auth context from original challenge session
      const authMethod = (challengeSession.metadata?.authMethod as string) || 'password';
      const authProvider = challengeSession.metadata?.authProvider as string | undefined;

      // Return same challenge with updated phone in parameters
      // Skip auto-send since SMS was already sent above during phone collection
      const challengeResponse = await this.challengeHelper.createChallengeResponse(
        { ...user, phone },
        AuthChallenge.VERIFY_PHONE,
        this.config,
        authMethod as 'password' | 'social',
        authProvider,
        true, // skipAutoSend = true (SMS already sent during phone collection)
      );

      // Include SMS error in challenge parameters if SMS failed
      if (smsError) {
        challengeResponse.challengeParameters = challengeResponse.challengeParameters || {};
        challengeResponse.challengeParameters.smsError = smsError;
      }

      return challengeResponse;
    } else {
      // Phone verification step (code provided)
      const code = (data as VerifyPhoneResponse).code;

      this.logger?.log?.(`Verifying phone for user: ${user.sub}`);

      // Check if phone is set
      if (!user.phone) {
        throw new NAuthException(
          AuthErrorCode.VALIDATION_FAILED,
          'Phone number not yet provided. Submit phone number first.',
        );
      }

      // Verify phone with code, ensuring it belongs to this specific challenge session
      const verifyDto = Object.assign(new VerifyPhoneWithCodeBySubDTO(), {
        sub: user.sub,
        code,
        challengeSessionId: challengeSession.id, // Link verification to this specific session
      });
      const result = await this.phoneVerificationService!.verifyPhoneWithCodeBySub(verifyDto);
      const isVerified = result.message === 'Phone verified successfully. Please log in to continue.';

      if (!isVerified) {
        // Increment attempts but don't consume session
        await this.challengeService.incrementAttempts(challengeSession);
        throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid verification code');
      }

      // Consume challenge session
      await this.challengeService.validateAndConsumeSession(challengeSession.sessionToken, AuthChallenge.VERIFY_PHONE);

      // Reload user to get updated phoneVerified flag
      const updatedUser = await this.userRepository.findOne({ where: { sub: user.sub } });
      if (!updatedUser) {
        throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found after phone verification');
      }

      // Get client info
      const clientInfo = this.clientInfoService.get();

      // Read auth context from challenge session metadata
      const authMethod = (challengeSession.metadata?.authMethod as string) || 'password';
      const authProvider = challengeSession.metadata?.authProvider as string | undefined;
      const isSocialLogin = authMethod === 'social';

      // Check for next challenges
      const response = await this.challengeHelper.determineAuthResponse({
        user: updatedUser as unknown as IUser,
        config: this.config,
        deviceToken: clientInfo.deviceToken,
        isSocialLogin,
        skipMFAVerification: false,
        authProvider,
      });

      if (response.challengeName) {
        this.logger?.log?.(`Additional challenge required: ${response.challengeName}`);
      } else {
        this.logger?.log?.(`Phone verified, auth completed for: ${user.email}`);

        // ============================================================================
        // Audit: Record successful login after phone verification
        // ============================================================================
        const fireAndForget = this.config.auditLogs?.fireAndForget !== false;
        if (fireAndForget) {
          this.auditService
            ?.recordEvent({
              userId: user.id,
              eventType: AuthAuditEventType.LOGIN_SUCCESS,
              eventStatus: 'SUCCESS',
              authMethod: isSocialLogin ? authProvider || 'social' : 'password',
              metadata: {
                completedAfterPhoneVerification: true,
              },
            })
            .catch((err) => {
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              this.logger?.error?.(
                `Failed to record LOGIN_SUCCESS audit event after phone verification (fire-and-forget): ${errorMessage}`,
                {
                  error: err,
                  userId: user.id,
                  userSub: user.sub,
                },
              );
            });
        } else {
          try {
            await this.auditService?.recordEvent({
              userId: user.id,
              eventType: AuthAuditEventType.LOGIN_SUCCESS,
              eventStatus: 'SUCCESS',
              authMethod: isSocialLogin ? authProvider || 'social' : 'password',
              metadata: {
                completedAfterPhoneVerification: true,
              },
            });
          } catch (auditError) {
            const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
            this.logger?.error?.(
              `Failed to record LOGIN_SUCCESS audit event after phone verification: ${errorMessage}`,
              {
                error: auditError,
                userId: user.id,
              },
            );
          }
        }
      }

      return response;
    }
  }

  /**
   * Handle MFA_REQUIRED challenge
   */
  private async handleMFAVerification(
    challengeSession: BaseChallengeSession & { user?: BaseUser },
    data: VerifyMFACodeResponse | VerifyMFAPasskeyResponse,
  ): Promise<AuthResponseDTO> {
    const user = challengeSession.user;
    if (!user) {
      throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
    }

    const method = data.method;

    this.logger?.log?.(`MFA verification attempt: method=${method}, user=${user.sub}`);

    // Check if MFAService is available
    if (!this.mfaService) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'MFA service is not available');
    }

    // Get client info
    const clientInfo = this.clientInfoService.get();

    // Verify MFA based on method
    let isValid = false;

    if (method === 'passkey') {
      const passkeyData = data as VerifyMFAPasskeyResponse;
      const credential = passkeyData.credential;

      // Get expected challenge from session metadata
      const expectedChallenge = challengeSession.metadata?.passkeyChallenge;
      if (!expectedChallenge) {
        throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'No passkey challenge found in session');
      }

      // Verify passkey via MFAService
      const wrappedCredential = { credential, expectedChallenge };
      const verifyResult = await this.mfaService.verifyCode({
        sub: user.sub,
        methodName: MFAMethod.PASSKEY,
        code: wrappedCredential,
      });
      isValid = verifyResult.valid;
    } else {
      const codeData = data as VerifyMFACodeResponse;
      const code = codeData.code;

      // Verify code via MFAService (handles totp, sms, and backup)
      const verifyResult = await this.mfaService.verifyCode({
        sub: user.sub,
        methodName: method,
        code,
      });
      isValid = verifyResult.valid;
    }

    if (!isValid) {
      this.logger?.warn?.(`MFA verification failed for user: ${user.sub}`);

      // Audit: Record MFA verification failure
      if (this.config.auditLogs?.fireAndForget) {
        this.auditService
          ?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.MFA_VERIFICATION_FAILED,
            eventStatus: 'FAILURE',
            challengeSessionId: challengeSession.id,
            authMethod: method,
            metadata: { mfaMethod: method },
          })
          .catch((err) => {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.logger?.error?.(
              `Failed to record MFA_VERIFICATION_FAILED audit event (fire-and-forget): ${errorMessage}`,
              {
                error: err,
                userId: user.id,
                userSub: user.sub,
              },
            );
          });
      } else {
        try {
          await this.auditService?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.MFA_VERIFICATION_FAILED,
            eventStatus: 'FAILURE',
            challengeSessionId: challengeSession.id,
            authMethod: method,
            metadata: { mfaMethod: method },
          });
        } catch (auditError) {
          const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
          this.logger?.error?.(`Failed to record MFA_VERIFICATION_FAILED audit event: ${errorMessage}`, {
            error: auditError,
            userId: user.id,
          });
        }
      }

      // Increment challenge attempts (session not consumed, so user can retry)
      await this.challengeService.incrementAttempts(challengeSession);

      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid MFA code');
    }

    this.logger?.log?.(`MFA verified successfully for user: ${user.sub}`);

    // Audit: Record MFA verification success
    if (this.config.auditLogs?.fireAndForget) {
      this.auditService
        ?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.MFA_VERIFICATION_SUCCESS,
          eventStatus: 'SUCCESS',
          challengeSessionId: challengeSession.id,
          authMethod: method,
          metadata: { mfaMethod: method },
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          this.logger?.error?.(
            `Failed to record MFA_VERIFICATION_SUCCESS audit event (fire-and-forget): ${errorMessage}`,
            {
              error: err,
              userId: user.id,
              userSub: user.sub,
            },
          );
        });
    } else {
      try {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.MFA_VERIFICATION_SUCCESS,
          eventStatus: 'SUCCESS',
          challengeSessionId: challengeSession.id,
          authMethod: method,
          metadata: { mfaMethod: method },
        });
      } catch (auditError) {
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record MFA_VERIFICATION_SUCCESS audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
        });
      }
    }

    // Store MFA method in challenge session metadata for CHALLENGE_COMPLETED audit event
    await this.challengeService.updateMetadata(challengeSession.sessionToken, {
      mfaMethod: method,
    });

    // Only consume the session AFTER successful verification
    await this.challengeService.validateAndConsumeSession(challengeSession.sessionToken, AuthChallenge.MFA_REQUIRED);

    // Read auth context from challenge session metadata
    const authMethod = (challengeSession.metadata?.authMethod as string) || 'password';
    const authProvider = challengeSession.metadata?.authProvider as string | undefined;
    const isSocialLogin = authMethod === 'social';

    // ============================================================================
    // Trusted Device Token Management (Remember Device Feature)
    // ============================================================================
    // NOTE:
    // - We only create / update trusted device tokens AFTER MFA has been successfully
    //   verified to avoid trusting devices that haven't completed full auth.
    // - For 'always' mode, this mirrors the behavior in the primary login flow.
    let deviceToken = clientInfo.deviceToken as string | undefined;
    let isTrustedDevice = false;

    if (this.trustedDeviceService && this.config.mfa?.rememberDevices && this.config.mfa.rememberDevices !== 'never') {
      const rememberMode = this.config.mfa.rememberDevices;

      // If a device token is already present, check if it's trusted
      if (deviceToken) {
        try {
          isTrustedDevice = await this.trustedDeviceService.isDeviceTrusted(deviceToken, user.id);
          if (isTrustedDevice) {
            this.logger?.debug?.(
              `MFA flow: existing trusted device token detected for user ${user.sub} (token reused)`,
            );
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger?.warn?.(
            `MFA flow: failed to validate existing trusted device token for user ${user.sub}: ${errorMessage}`,
            { error },
          );
        }
      }

      // Auto-trust mode: create device token automatically if not already trusted
      if (rememberMode === 'always' && !isTrustedDevice) {
        try {
          deviceToken = await this.trustedDeviceService.createTrustedDevice(
            user.id,
            clientInfo.deviceName,
            clientInfo.deviceType,
            clientInfo.ipAddress,
            clientInfo.userAgent,
            clientInfo.platform,
            clientInfo.browser,
          );
          isTrustedDevice = true;
          this.logger?.debug?.(
            `MFA flow: auto-created trusted device token for user ${user.sub} (rememberDevices='always')`,
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger?.warn?.(`MFA flow: failed to create trusted device token for user ${user.sub}: ${errorMessage}`, {
            error,
          });
        }
      }
    }

    // Check for next challenges (MFA is usually the last challenge)
    const response = await this.challengeHelper.determineAuthResponse({
      user,
      config: this.config,
      deviceToken,
      isSocialLogin,
      skipMFAVerification: true, // Already verified
      authProvider,
    });

    // Propagate trusted device metadata into response so that:
    // - CookieTokenInterceptor can set the nauth_device_token cookie (cookies mode)
    // - Mobile clients in JSON mode can store the device token securely
    if (isTrustedDevice) {
      response.trusted = response.trusted ?? true;
    }
    if (deviceToken && !response.deviceToken) {
      response.deviceToken = deviceToken;
    }

    if (response.challengeName) {
      this.logger?.log?.(`Additional challenge required: ${response.challengeName}`);
    } else {
      this.logger?.log?.(`MFA verified, auth completed for: ${user.email}`);

      // ============================================================================
      // Audit: Record successful login after MFA completion
      // ============================================================================
      const fireAndForget = this.config.auditLogs?.fireAndForget !== false;
      if (fireAndForget) {
        this.auditService
          ?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.LOGIN_SUCCESS,
            eventStatus: 'SUCCESS',
            authMethod: isSocialLogin ? authProvider || 'social' : 'password',
            metadata: {
              completedAfterMFA: true,
            },
          })
          .catch((err) => {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.logger?.error?.(
              `Failed to record LOGIN_SUCCESS audit event after MFA (fire-and-forget): ${errorMessage}`,
              {
                error: err,
                userId: user.id,
                userSub: user.sub,
              },
            );
          });
      } else {
        try {
          await this.auditService?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.LOGIN_SUCCESS,
            eventStatus: 'SUCCESS',
            authMethod: isSocialLogin ? authProvider || 'social' : 'password',
            metadata: {
              completedAfterMFA: true,
            },
          });
        } catch (auditError) {
          const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
          this.logger?.error?.(`Failed to record LOGIN_SUCCESS audit event after MFA: ${errorMessage}`, {
            error: auditError,
            userId: user.id,
          });
        }
      }
    }

    return response;
  }

  /**
   * Handle FORCE_CHANGE_PASSWORD challenge
   */
  private async handleForceChangePassword(
    challengeSession: BaseChallengeSession & { user?: BaseUser },
    newPassword: string,
  ): Promise<AuthResponseDTO> {
    const user = challengeSession.user;
    if (!user) {
      throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
    }

    this.logger?.log?.(`Changing password for user: ${user.sub}`);

    // Validate new password
    const validation = await this.passwordService.validatePassword(newPassword, {
      email: user.email,
      username: user.username || undefined,
    });

    if (!validation.valid) {
      throw new NAuthException(AuthErrorCode.WEAK_PASSWORD, validation.errors.join(', '), {
        errors: validation.errors,
      });
    }

    // Check password history
    if (this.config.password?.historyCount) {
      const historyToCheck = user.passwordHistory || [];
      const allPreviousPasswords = user.passwordHash ? [user.passwordHash, ...historyToCheck] : historyToCheck;

      const isReused = await this.passwordService.isPasswordInHistory(newPassword, allPreviousPasswords);

      if (isReused) {
        throw new NAuthException(
          AuthErrorCode.PASSWORD_REUSED,
          'You have used this password recently. Please choose a different password.',
        );
      }
    }

    // Hash new password
    const newHash = await this.passwordService.hashPassword(newPassword);

    // Update password history
    const newHistory = user.passwordHash
      ? this.passwordService.addToHistory(user.passwordHistory || [], user.passwordHash)
      : (user.passwordHistory || []);

    // Update user password and clear mustChangePassword flag - use save() for array fields
    user.passwordHash = newHash;
    user.passwordChangedAt = new Date();
    user.passwordHistory = newHistory;
    user.mustChangePassword = false;
    await this.userRepository.save(user);

    this.logger?.log?.(`Password changed successfully for user: ${user.sub}`);

    // Consume challenge session
    await this.challengeService.validateAndConsumeSession(
      challengeSession.sessionToken,
      AuthChallenge.FORCE_CHANGE_PASSWORD,
    );

    // Reload user from database to get updated mustChangePassword flag
    const updatedUser = await this.userRepository.findOne({ where: { sub: user.sub } });
    if (!updatedUser) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found after password update');
    }

    // Get client info
    const clientInfo = this.clientInfoService.get();

    // Read auth context from challenge session metadata
    const authMethod = (challengeSession.metadata?.authMethod as string) || 'password';
    const authProvider = challengeSession.metadata?.authProvider as string | undefined;
    const isSocialLogin = authMethod === 'social';

    // Check for next challenges
    const response = await this.challengeHelper.determineAuthResponse({
      user: updatedUser as unknown as IUser,
      config: this.config,
      deviceToken: clientInfo.deviceToken,
      isSocialLogin,
      skipMFAVerification: false,
      authProvider,
    });

    if (response.challengeName) {
      this.logger?.log?.(`Additional challenge required: ${response.challengeName}`);
    } else {
      this.logger?.log?.(`Password changed, auth completed for: ${user.email}`);

      // ============================================================================
      // Audit: Record successful login after password change
      // ============================================================================
      const fireAndForget = this.config.auditLogs?.fireAndForget !== false;
      if (fireAndForget) {
        this.auditService
          ?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.LOGIN_SUCCESS,
            eventStatus: 'SUCCESS',
            authMethod: isSocialLogin ? authProvider || 'social' : 'password',
            metadata: {
              completedAfterPasswordChange: true,
            },
          })
          .catch((err) => {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.logger?.error?.(
              `Failed to record LOGIN_SUCCESS audit event after password change (fire-and-forget): ${errorMessage}`,
              {
                error: err,
                userId: user.id,
                userSub: user.sub,
              },
            );
          });
      } else {
        try {
          await this.auditService?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.LOGIN_SUCCESS,
            eventStatus: 'SUCCESS',
            authMethod: isSocialLogin ? authProvider || 'social' : 'password',
            metadata: {
              completedAfterPasswordChange: true,
            },
          });
        } catch (auditError) {
          const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
          this.logger?.error?.(`Failed to record LOGIN_SUCCESS audit event after password change: ${errorMessage}`, {
            error: auditError,
            userId: user.id,
          });
        }
      }
    }

    return response;
  }

  /**
   * Handle MFA_SETUP_REQUIRED challenge
   */
  private async handleMFASetup(
    challengeSession: BaseChallengeSession & { user?: BaseUser },
    data: MFASetupResponse,
  ): Promise<AuthResponseDTO> {
    const user = challengeSession.user;
    if (!user) {
      throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
    }

    const method = data.method;
    const setupData = data.setupData;

    const requestTrace = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.logger?.log?.(`[${requestTrace}] MFA setup attempt: method=${method}, user=${user.sub}`);

    // Check if MFAService is available
    if (!this.mfaService) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'MFA service is not available');
    }

    // Get provider
    const provider = this.mfaService.getProvider(method);

    // Verify setup based on method
    let deviceId: number;

    try {
      deviceId = await provider.verifySetup(user, setupData);
      this.logger?.log?.(`MFA device setup completed: method=${method}, deviceId=${deviceId}`);
    } catch (error) {
      this.logger?.warn?.(`MFA setup verification failed: method=${method}, user=${user.sub}`);

      // Increment attempts but don't consume session
      await this.challengeService.incrementAttempts(challengeSession);

      // Re-throw the error
      throw error;
    }

    // Store MFA method in challenge session metadata for CHALLENGE_COMPLETED audit event
    await this.challengeService.updateMetadata(challengeSession.sessionToken, {
      mfaMethod: method,
    });

    // Consume challenge session
    await this.challengeService.validateAndConsumeSession(
      challengeSession.sessionToken,
      AuthChallenge.MFA_SETUP_REQUIRED,
    );

    // Reload user from database to get updated mfaEnabled flag
    const updatedUser = await this.userRepository.findOne({ where: { sub: user.sub } });
    if (!updatedUser) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found after MFA setup');
    }

    // Get client info
    const clientInfo = this.clientInfoService.get();

    // Check for next challenges with updated user data
    // Skip MFA verification because device was already verified during setup
    const response = await this.challengeHelper.determineAuthResponse({
      user: updatedUser as unknown as IUser,
      config: this.config,
      deviceToken: clientInfo.deviceToken,
      isSocialLogin: false,
      skipMFAVerification: true, // Device already verified during setup
    });

    if (response.challengeName) {
      this.logger?.log?.(`Additional challenge required: ${response.challengeName}`);
    } else {
      this.logger?.log?.(`MFA setup completed, auth completed for: ${user.email}`);

      // ============================================================================
      // Audit: Record successful login after MFA setup
      // ============================================================================
      const fireAndForget = this.config.auditLogs?.fireAndForget !== false;
      if (fireAndForget) {
        this.auditService
          ?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.LOGIN_SUCCESS,
            eventStatus: 'SUCCESS',
            authMethod: 'password',
            metadata: {
              completedAfterMFASetup: true,
            },
          })
          .catch((err) => {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.logger?.error?.(
              `Failed to record LOGIN_SUCCESS audit event after MFA setup (fire-and-forget): ${errorMessage}`,
              {
                error: err,
                userId: user.id,
                userSub: user.sub,
              },
            );
          });
      } else {
        try {
          await this.auditService?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.LOGIN_SUCCESS,
            eventStatus: 'SUCCESS',
            authMethod: 'password',
            metadata: {
              completedAfterMFASetup: true,
            },
          });
        } catch (auditError) {
          const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
          this.logger?.error?.(`Failed to record LOGIN_SUCCESS audit event after MFA setup: ${errorMessage}`, {
            error: auditError,
            userId: user.id,
          });
        }
      }
    }

    return response;
  }

  // ============================================================================
  // Challenge Helper Methods
  // ============================================================================

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
   * @param session - Challenge session token
   * @returns Destination info (masked email/phone)
   * @throws {NAuthException} INVALID_CHALLENGE_SESSION | RATE_LIMIT_* | VALIDATION_FAILED
   *
   * @example
   * ```typescript
   * const result = await authService.resendCode(session);
   * // Returns: { destination: 'u***r@example.com' }
   * ```
   */
  async resendCode(dto: ResendCodeDTO): Promise<ResendCodeResponseDTO> {
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
        const resendDto = Object.assign(new ResendVerificationEmailDTO(), { sub: user.sub });
        await this.emailVerificationService.resendVerificationEmail(resendDto);
        const maskedEmail = this.maskEmail(user.email);
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
        const maskedPhone = this.maskPhone(user.phone);
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
            const maskedPhone = user.phone ? this.maskPhone(user.phone) : '***-***-****';
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
            const maskedEmail = user.email ? this.maskEmail(user.email) : 'u***r@example.com';
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
   * Mask email for display (helper method)
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
  }

  /**
   * Mask phone number for display (helper method)
   */
  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const lastFour = digits.slice(-4);
    return `***-***-${lastFour}`;
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
    const tokenHash = this.jwtService.hashToken(dto.refreshToken);

    // ============================================================================
    // CRITICAL SECURITY FIX #1 & #2: Distributed Lock + Reuse Detection
    // ============================================================================

    // CRITICAL: We need to get session ID for locking, but we must lock BEFORE validation
    // to prevent race conditions. So we do a quick, lightweight lookup first.
    // Find session by refresh token hash - this is fast and allows us to get session ID
    const session = await this.sessionService.findByRefreshToken(tokenHash);

    if (!session || session.isRevoked) {
      // Validate token to get user info for error message
      const validation = await this.jwtService.validateRefreshToken(dto.refreshToken);
      const userId = validation.payload?.sub || 'unknown';
      this.logger?.debug?.(
        `Session not found or revoked for user ${userId}. Possible issue where token are not cleared on logout`,
      );
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
          const tokenPayload = this.jwtService.decodeToken(dto.refreshToken);
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
      const validation = await this.jwtService.validateRefreshToken(dto.refreshToken);

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
  // Logout
  // ============================================================================

  /**
   * Logout user (revoke session)
   *
   * Session ID is automatically extracted from the JWT token context (via ClientInfoService), similar to how IP address and user agent are handled.
   *
   * @param dto - Logout options (forgetMe flag)
   * @returns Success status
   * @throws {NAuthException} If session ID is not available in request context
   */
  async logout(dto: LogoutDTO): Promise<LogoutResponseDTO> {
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
      throw new NAuthException(
        AuthErrorCode.SESSION_NOT_FOUND,
        'Session ID not found in request context. Ensure the request is authenticated.',
      );
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
      this.clearAuthCookies(response, dto.forgetMe ?? false);
      this.logger?.debug?.('Auth cookies cleared automatically on logout');
    }

    return { success: true };
  }

  /**
   * Clear authentication cookies from response
   *
   * @param response - HTTP response object with clearCookie method
   * @param forgetDevice - Whether to also clear device token cookie
   * @private
   */
  private clearAuthCookies(
    response: { clearCookie?: (name: string, options?: unknown) => void },
    forgetDevice: boolean,
  ): void {
    if (!response.clearCookie) {
      return; // Response doesn't support cookie clearing (shouldn't happen)
    }

    const cookieOptions = this.config.tokenDelivery?.cookieOptions || {};
    const prefix = this.config.tokenDelivery?.cookieNamePrefix || 'nauth';

    // Clear access and refresh tokens
    response.clearCookie(`${prefix}_access_token`, cookieOptions);
    response.clearCookie(`${prefix}_refresh_token`, cookieOptions);

    // Clear CSRF token cookie (httpOnly: false, so it can be cleared)
    // Use the same cookie options but with httpOnly: false to match how it was set
    const csrfCookieOptions = {
      ...cookieOptions,
      httpOnly: false, // CSRF token cookie is not httpOnly
    };
    const csrfCookieName = this.config.security?.csrf?.cookieName || `${prefix}_csrf_token`;
    response.clearCookie(csrfCookieName, csrfCookieOptions);

    // Clear device token if forgetting device
    if (forgetDevice) {
      response.clearCookie(`${prefix}_device_token`, cookieOptions);
    }
  }

  /**
   * Global signout (revoke all user sessions)
   * @param sub - External user identifier (sub/UUID)
   * @returns Number of sessions revoked
   */
  async logoutAll(dto: LogoutAllDTO): Promise<LogoutAllResponseDTO> {
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
    // Automatically Clear Auth Cookies (if using cookie-based token delivery)
    // ============================================================================
    const response = this.clientInfoService.getResponse();
    if (response && this.config.tokenDelivery?.method !== 'json') {
      // Clear auth cookies
      // If forgetDevices is true, also clear device token cookie
      this.clearAuthCookies(response, dto.forgetDevices ?? false);
      this.logger?.debug?.('Auth cookies cleared automatically on global logout');
    }

    return { revokedCount };
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
    // Get user by sub
    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;

    if (!user || !user.passwordHash) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Execute beforePasswordChange hook (use sub for external API)
    if (this.config.hooks?.beforePasswordChange) {
      const result = await this.config.hooks.beforePasswordChange(dto.sub, dto.oldPassword);
      if (result === false) {
        throw new NAuthException(AuthErrorCode.PASSWORD_CHANGE_NOT_ALLOWED, 'Password change not allowed');
      }
    }

    // Verify old password
    const isValid = await this.passwordService.verifyPassword(dto.oldPassword, user.passwordHash);

    if (!isValid) {
      throw new NAuthException(AuthErrorCode.PASSWORD_INCORRECT, 'Current password is incorrect');
    }

    // Validate new password
    const validation = await this.passwordService.validatePassword(dto.newPassword, {
      email: user.email,
      username: user.username || undefined,
    });

    if (!validation.valid) {
      throw new NAuthException(AuthErrorCode.WEAK_PASSWORD, validation.errors.join(', '), {
        errors: validation.errors,
      });
    }

    // Check password history
    if (this.config.password?.historyCount) {
      // Include current password hash in the check to prevent immediate reuse
      const historyToCheck = user.passwordHistory || [];
      const allPreviousPasswords = user.passwordHash ? [user.passwordHash, ...historyToCheck] : historyToCheck;

      const isReused = await this.passwordService.isPasswordInHistory(dto.newPassword, allPreviousPasswords);

      if (isReused) {
        throw new NAuthException(
          AuthErrorCode.PASSWORD_REUSED,
          'You have used this password recently. Please choose a different password.',
        );
      }
    }

    // Hash new password
    const newHash = await this.passwordService.hashPassword(dto.newPassword);

    // Update password history
    const newHistory = this.passwordService.addToHistory(user.passwordHistory || [], user.passwordHash);

    // Update user - use save() instead of update() to ensure TypeORM properly serializes simple-array fields
    user.passwordHash = newHash;
    user.passwordChangedAt = new Date();
    user.passwordHistory = newHistory;
    await this.userRepository.save(user);

    // Execute afterPasswordChange hook (use sub for external API)
    if (this.config.hooks?.afterPasswordChange) {
      await this.config.hooks.afterPasswordChange(dto.sub);
    }

    // Optionally revoke all sessions (force re-login) - use internal id
    await this.sessionService.revokeAllUserSessions(user.id, 'Password changed');

    // ============================================================================
    // Audit: Record password change
    // ============================================================================
    try {
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.PASSWORD_CHANGED,
        eventStatus: 'SUCCESS',
        // Client info automatically included from context
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record PASSWORD_CHANGED audit event: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
      });
    }

    return { success: true };
  }

  /**
   * Update user profile attributes.
   *
   * Updates user fields (name, email, phone, username, metadata) and enforces unique constraints and verification rules.
   *
   * @param sub - User sub/UUID
   * @param updateData - User fields to update
   * @returns Updated user object
   * @throws {NAuthException} If user not found or unique constraint violated
   *
   * @example
   * await authService.updateUserAttributes(sub, { email: 'test@example.com' });
   */
  async updateUserAttributes(dto: UpdateUserAttributesRequestDTO): Promise<UserResponseDto> {
    // Find user by sub (external identifier)
    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Check for uniqueness constraints - use internal id
    await this.validateUniquenessConstraints(user.id, dto);

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
    if (dto.metadata !== undefined) {
      const existingMetadata = user.metadata || {};
      updateFields.metadata = { ...existingMetadata, ...dto.metadata };
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
      const updatedFieldNames = Object.keys(updateFields);

      // Build field changes map with before/after values
      const fieldChanges: Record<string, unknown> = {};

      // Capture before/after values for each updated field
      if (dto.firstName !== undefined && dto.firstName !== user.firstName) {
        fieldChanges.firstName = {
          before: user.firstName ?? null,
          after: dto.firstName ?? null,
        };
      }

      if (dto.lastName !== undefined && dto.lastName !== user.lastName) {
        fieldChanges.lastName = {
          before: user.lastName ?? null,
          after: dto.lastName ?? null,
        };
      }

      if (dto.username !== undefined && dto.username !== user.username) {
        fieldChanges.username = {
          before: user.username ?? null,
          after: dto.username ?? null,
        };
      }

      // Note: email and phone are tracked separately with specific audit events,
      // but we include them in fieldChanges for completeness
      if (dto.email !== undefined && dto.email !== user.email) {
        fieldChanges.email = {
          before: user.email ?? null,
          after: dto.email ?? null,
        };
      }

      if (dto.phone !== undefined && dto.phone !== user.phone) {
        fieldChanges.phone = {
          before: user.phone ?? null,
          after: dto.phone ?? null,
        };
      }

      if (dto.preferredMfaMethod !== undefined && dto.preferredMfaMethod !== user.preferredMfaMethod) {
        fieldChanges.preferredMfaMethod = {
          before: user.preferredMfaMethod ?? null,
          after: dto.preferredMfaMethod ?? null,
        };
      }

      // Handle metadata changes (merged, so track what was added/changed)
      if (dto.metadata !== undefined) {
        const oldMetadata = user.metadata || {};
        const newMetadata = { ...oldMetadata, ...dto.metadata };
        const metadataChanges: Record<string, { before: unknown; after: unknown }> = {};

        // Track all keys in new metadata
        const allKeys = new Set([...Object.keys(oldMetadata), ...Object.keys(dto.metadata)]);

        for (const key of allKeys) {
          const oldValue = oldMetadata[key];
          const newValue = newMetadata[key];

          // Only track if value actually changed
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            metadataChanges[key] = {
              before: oldValue ?? null,
              after: newValue ?? null,
            };
          }
        }

        if (Object.keys(metadataChanges).length > 0) {
          fieldChanges.metadata = metadataChanges;
        }
      }

      // Track verification status changes if email/phone changed
      if (dto.email !== undefined && dto.email !== user.email) {
        const emailVerificationChanged = !dto.retainVerification && updateFields.isEmailVerified === false;
        if (emailVerificationChanged) {
          fieldChanges.isEmailVerified = {
            before: user.isEmailVerified,
            after: false,
          };
        }
      }

      if (dto.phone !== undefined && dto.phone !== user.phone) {
        const phoneVerificationChanged = !dto.retainVerification && updateFields.isPhoneVerified === false;
        if (phoneVerificationChanged) {
          fieldChanges.isPhoneVerified = {
            before: user.isPhoneVerified,
            after: false,
          };
        }
      }

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

      // Record specific field changes
      if (dto.email !== undefined && dto.email !== user.email) {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.EMAIL_CHANGED,
          eventStatus: 'INFO',
          metadata: {
            // Client info automatically included from context
            oldEmail: user.email,
            newEmail: dto.email,
            retainVerification: dto.retainVerification || false,
          },
        });
      }

      if (dto.phone !== undefined && dto.phone !== user.phone) {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.PHONE_CHANGED,
          eventStatus: 'INFO',
          metadata: {
            // Client info automatically included from context
            oldPhone: user.phone,
            newPhone: dto.phone,
            retainVerification: dto.retainVerification || false,
          },
        });
      }

      if (dto.username !== undefined && dto.username !== user.username) {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.USERNAME_CHANGED,
          eventStatus: 'INFO',
          metadata: {
            // Client info automatically included from context
            oldUsername: user.username,
            newUsername: dto.username,
          },
        });
      }
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record profile update audit events: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
      });
    }

    // Return user response DTO
    return UserResponseDto.fromEntity(updatedUser);
  }

  /**
   * Ensures email, phone, and username are unique for other users before update.
   *
   * Throws if another user already has the specified email, phone, or username.
   *
   * @param userId - Internal numeric user ID (excluded from check)
   * @param updateData - User fields to check for uniqueness
   * @throws {NAuthException} If a unique constraint is violated for email, phone, or username
   *
   * @example
   * ```typescript
   * await authService.validateUniquenessConstraints(1, { email: "test@example.com" });
   * ```
   */
  private async validateUniquenessConstraints(
    userId: number,
    updateData: UpdateUserAttributesRequestDTO,
  ): Promise<void> {
    const conflicts: string[] = [];

    // Check email uniqueness
    if (updateData.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateData.email },
      });
      if (existingUser && existingUser.id !== userId) {
        conflicts.push('Email already exists');
      }
    }

    // Check phone uniqueness
    if (updateData.phone) {
      const existingUser = await this.userRepository.findOne({
        where: { phone: updateData.phone },
      });
      if (existingUser && existingUser.id !== userId) {
        conflicts.push('Phone number already exists');
      }
    }

    // Check username uniqueness
    if (updateData.username) {
      const existingUser = await this.userRepository.findOne({
        where: { username: updateData.username },
      });
      if (existingUser && existingUser.id !== userId) {
        conflicts.push('Username already exists');
      }
    }

    if (conflicts.length > 0) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, conflicts.join(', '), {
        conflicts,
      });
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Checks if the login identifier matches the specified allowed type.
   *
   * Determines if the given identifier is a valid email, username, phone, or allowed hybrid,
   * according to the configured identifier type restriction.
   *
   * @param identifier - The login identifier to check (email, username, or phone)
   * @param allowedType - The permitted identifier type ('email', 'username', 'phone', or 'email_or_username')
   * @returns True if the identifier conforms to the allowed type, otherwise false
   *
   * @example
   * ```typescript
   * // Email check
   * const valid = this.validateIdentifierType('user@example.com', 'email'); // true
   *
   * // Username check
   * const valid = this.validateIdentifierType('johndoe', 'username'); // true
   * ```
   */
  private validateIdentifierType(
    identifier: string,
    allowedType: 'email' | 'username' | 'phone' | 'email_or_username',
  ): boolean {
    // Check if identifier is an email (contains @)
    const isEmail = identifier.includes('@');
    // Check if identifier looks like a phone (starts with + and contains digits)
    const isPhone = /^\+[1-9]\d{1,14}$/.test(identifier.trim());
    // If not email or phone, assume it's a username
    const isUsername = !isEmail && !isPhone;

    switch (allowedType) {
      case 'email':
        return isEmail;
      case 'username':
        return isUsername;
      case 'phone':
        return isPhone;
      case 'email_or_username':
        return isEmail || isUsername;
      default:
        return true; // No restriction
    }
  }

  /**
   * Retrieves a user entity by login identifier.
   *
   * Performs a lookup for a user by email, username, or phone number.
   * The search respects the identifierType restriction when provided, limiting which fields are queried.
   *
   * @param identifier - Login credential (email, username, or phone)
   * @param identifierType - Restricts search to a specific identifier type ('email', 'username', 'phone', or 'email_or_username')
   * @returns The user entity if found, otherwise null
   *
   * @example
   * ```typescript
   * const user = await this.findUserByIdentifier('user@example.com');
   * const user2 = await this.findUserByIdentifier('johndoe', 'username');
   * ```
   */
  private async findUserByIdentifier(
    identifier: string,
    identifierType?: 'email' | 'username' | 'phone' | 'email_or_username',
  ): Promise<IUser | null> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Build query based on identifier type restriction
    if (!identifierType) {
      // No restriction - search all fields
      queryBuilder
        .where('user.email = :identifier', { identifier })
        .orWhere('user.username = :identifier', { identifier })
        .orWhere('user.phone = :identifier', { identifier });
    } else {
      // Apply restriction based on identifier type
      switch (identifierType) {
        case 'email':
          queryBuilder.where('user.email = :identifier', { identifier });
          break;
        case 'username':
          queryBuilder.where('user.username = :identifier', { identifier });
          break;
        case 'phone':
          queryBuilder.where('user.phone = :identifier', { identifier });
          break;
        case 'email_or_username':
          queryBuilder
            .where('user.email = :identifier', { identifier })
            .orWhere('user.username = :identifier', { identifier });
          break;
      }
    }

    // Select only columns required for login checks and response shaping to reduce row size
    queryBuilder.select([
      'user.id',
      'user.sub',
      'user.email',
      'user.firstName',
      'user.lastName',
      'user.username',
      'user.phone',
      'user.passwordHash',
      'user.passwordChangedAt',
      'user.mustChangePassword',
      'user.isActive',
      'user.mfaEnabled',
      'user.preferredMfaMethod',
      'user.isEmailVerified',
      'user.isPhoneVerified',
      'user.mfaExempt', // Required for MFA exemption check in challenge flow
      // The following are used for messaging/challenge determination when needed
      'user.socialProviders',
      'user.backupCodes',
    ]);

    return (await queryBuilder.getOne()) as IUser | null;
  }

  /**
   * Handles a failed login by recording the attempt, applying IP-based lockout policy,
   * and invoking relevant hooks.
   *
   * @param identifier - User identifier (email/username/phone)
   * @param reason - Optional reason for failure
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * await authService.handleFailedLogin('user@example.com', 'invalid_credentials');
   * ```
   */
  private async handleFailedLogin(identifier: string, reason?: string): Promise<void> {
    // Get client IP address for lockout tracking
    const clientInfo = this.clientInfoService.get();
    const ipAddress = clientInfo.ipAddress;

    // Record failed attempt
    await this.recordLoginAttempt(identifier, false, reason);

    // Increment IP-based lockout counter if enabled
    if (this.config.lockout?.enabled && ipAddress) {
      const attempts = await this.accountLockoutStorage.recordFailedAttempt(ipAddress);

      // Lock IP if max attempts reached
      if (attempts >= (this.config.lockout.maxAttempts || 5)) {
        await this.accountLockoutStorage.blockIpAdresss(
          ipAddress,
          this.config.lockout.duration || 900, // 15 minutes default
          'Too many failed login attempts from this IP',
        );

        // // Execute hook with IP address
        // if (this.config.hooks?.afterAccountLock) {
        //   await this.config.hooks.afterAccountLock(identifier, 'Too many failed attempts from IP', clientInfo);
        // }
      }
    }

    // // Execute hook
    // if (this.config.hooks?.afterLoginFailed) {
    //   await this.config.hooks.afterLoginFailed(identifier, reason || 'unknown');
    // }
  }

  /**
   * Records a login attempt with client context.
   *
   * @param email - User's email address
   * @param success - True if login succeeded, false if failed
   * @param failureReason - Optional reason for failure
   * @param userId - Optional internal user ID (only for successful logins)
   * @returns Promise<void>
   */
  private async recordLoginAttempt(
    email: string,
    success: boolean,
    failureReason?: string,
    userId?: number,
  ): Promise<void> {
    // Get client info from context
    const clientInfo = this.clientInfoService.get();

    const attempt = this.loginAttemptRepository.create({
      email,
      userId, // Internal user ID (integer)
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      success,
      failureReason,
    });

    await this.loginAttemptRepository.save(attempt);
  }

  /**
   * Get user by ID (sub)
   * @param sub - User sub (external identifier)
   * @returns User entity or null
   */
  async getUserById(dto: GetUserByIdDTO): Promise<UserResponseDto | null> {
    const user = (await this.userRepository.findOne({ where: { sub: dto.sub } })) as IUser | null;
    return user ? UserResponseDto.fromEntity(user) : null;
  }

  /**
   * Get user by email address.
   *
   * @param email - User email
   * @param requireEmailVerified - Only return user if email is verified (default: false)
   * @returns User entity or null
   * @internal - For use by social auth providers
   *
   * @example
   * ```typescript
   * const user = await authService.getUserByEmail('user@example.com', true);
   * ```
   */
  async getUserByEmail(dto: GetUserByEmailDTO): Promise<UserResponseDto | null> {
    const where: Record<string, unknown> = dto.requireEmailVerified
      ? { email: dto.email, isEmailVerified: true }
      : { email: dto.email };
    const user = (await this.userRepository.findOne({ where })) as IUser | null;
    return user ? UserResponseDto.fromEntity(user) : null;
  }

  /**
   * Require user to change password at next login.
   *
   * Throws if user not found or has no password set (e.g. social login only).
   *
   * @param userId - User's sub identifier
   * @returns Resolves when flag is set
   * @throws {NAuthException} If user is not found or cannot change password
   *
   * @example
   * await authService.setMustChangePassword('user-uuid-123');
   */
  async setMustChangePassword(dto: SetMustChangePasswordDTO): Promise<SetMustChangePasswordResponseDTO> {
    const user = await this.userRepository.findOne({ where: { sub: dto.userId } });

    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    //  CRITICAL PROTECTION: Only allow for users with password authentication
    // Pure social users cannot be forced to change password
    if (!user.passwordHash) {
      this.logger?.warn?.(
        `Cannot force password change for user ${dto.userId} - user doesn't have a password (pure social signup)`,
      );
      throw new NAuthException(
        AuthErrorCode.PASSWORD_CHANGE_NOT_ALLOWED,
        'Password change not available. This account uses social authentication only and has no password.',
      );
    }

    await this.userRepository.update({ sub: dto.userId }, { mustChangePassword: true });

    this.logger?.log?.(`Must-change-password flag set for user: ${dto.userId}`);

    return { success: true };
  }
}
