import { Repository } from 'typeorm';
import { IUser } from '../interfaces/entities.interface';
import { BaseUser, BaseLoginAttempt, BaseChallengeSession } from '../entities';
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
import { MFAService } from './mfa.service';
import { HookRegistryService } from './hook-registry.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
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
import { AuthResponseDTO } from '../dto/auth-response.dto';
import { UserUpdateDTO } from '../dto/user-update.dto';
import { VerifyEmailWithCodeDTO } from '../dto/verify-email.dto';
import { SendVerificationSMSDTO } from '../dto/verify-phone.dto';
import { VerifyPhoneWithCodeBySubDTO } from '../dto/verify-phone-by-sub.dto';
import { MFAMethod } from '../enums/mfa-method.enum';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { ContextStorage } from '../utils/context-storage';
import { NAuthRequest } from '../platform/interfaces';

/**
 * Internal helper service for AuthService
 *
 * Contains private utility methods for challenge handling, validation,
 * password management, and login tracking. This class is NOT exported from
 * the package and should only be used internally by AuthService.
 *
 * INTERNAL USE ONLY - DO NOT IMPORT DIRECTLY
 *
 * @internal
 */
export class AuthServiceInternalHelpers {
  constructor(
    private readonly userRepository: Repository<BaseUser>,
    private readonly loginAttemptRepository: Repository<BaseLoginAttempt>,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly phoneVerificationService: PhoneVerificationService | undefined,
    private readonly challengeService: ChallengeService,
    private readonly challengeHelper: AuthChallengeHelperService,
    private readonly clientInfoService: ClientInfoService,
    private readonly sessionService: SessionService,
    private readonly accountLockoutStorage: AccountLockoutStorageService,
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
    private readonly hookRegistry: HookRegistryService,
  ) {}

  // ============================================================================
  // Context helpers
  // ============================================================================

  /**
   * Execute a callback with a specific user bound into CURRENT_USER context.
   *
   * MFA providers must derive the user from request-scoped context. During challenge flows
   * we bind the resolved user explicitly to avoid taking user identity from consumer inputs.
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

  // ============================================================================
  // Challenge Response Handlers
  // ============================================================================

  /**
   * Handle VERIFY_EMAIL challenge
   *
   * @param challengeSession - Challenge session with user
   * @param code - Email verification code
   * @returns Authentication response with tokens or next challenge
   */
  async handleVerifyEmail(
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
   *
   * @param challengeSession - Challenge session with user
   * @param data - Phone verification data (phone number or code)
   * @returns Authentication response with tokens or next challenge
   */
  async handleVerifyPhone(
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

      // ============================================================================
      // Hook: Execute user profile updated hooks (phone number changed)
      // ============================================================================
      try {
        const clientInfo = this.clientInfoService.get();
        const updatedUser = { ...user, phone } as unknown as IUser;
        await this.hookRegistry.executeUserProfileUpdated({
          user: updatedUser,
          changedFields: [
            {
              fieldName: 'phone',
              oldValue: user.phone || null,
              newValue: phone,
            },
          ],
          updateSource: 'user_request',
          clientInfo: {
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
            ipCountry: clientInfo.ipCountry,
            ipCity: clientInfo.ipCity,
          },
        });
      } catch (hookError) {
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(`Failed to execute userProfileUpdated hooks: ${errorMessage}`, {
          error: hookError,
          userSub: user.sub,
        });
      }

      // Send verification SMS to the newly added phone
      let smsError: string | undefined;
      if (this.phoneVerificationService) {
        this.logger?.log?.(`Sending verification SMS to newly added phone: ${phone}`);
        try {
          const smsDto = Object.assign(new SendVerificationSMSDTO(), {
            sub: user.sub,
            skipAlreadyVerifiedCheck: false, // Explicitly set to false for phone verification (not MFA)
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
      }

      return response;
    }
  }

  /**
   * Handle MFA_REQUIRED challenge
   *
   * @param challengeSession - Challenge session with user
   * @param data - MFA verification data
   * @param mfaService - MFA service (passed from AuthService)
   * @param trustedDeviceService - Trusted device service (optional, passed from AuthService)
   * @param auditService - Audit service (optional, passed from AuthService)
   * @returns Authentication response with tokens or next challenge
   */
  async handleMFAVerification(
    challengeSession: BaseChallengeSession & { user?: BaseUser },
    data: VerifyMFACodeResponse | VerifyMFAPasskeyResponse,
    mfaService: MFAService | undefined,
    trustedDeviceService: TrustedDeviceService | undefined,
    auditService: AuthAuditService | undefined,
  ): Promise<AuthResponseDTO> {
    const user = challengeSession.user;
    if (!user) {
      throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
    }

    const method = data.method;

    this.logger?.log?.(`MFA verification attempt: method=${method}, user=${user.sub}`);

    // Check if MFAService is available
    if (!mfaService) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'MFA service is not available');
    }

    // Get client info
    const clientInfo = this.clientInfoService.get();

    // Verify MFA based on method
    let isValid = false;

    if (method === 'passkey') {
      const passkeyData = data as VerifyMFAPasskeyResponse;
      const credential = passkeyData.credential;
      const deviceId = passkeyData.deviceId;

      // Get expected challenge from session metadata
      const expectedChallenge = challengeSession.metadata?.passkeyChallenge;
      if (!expectedChallenge) {
        throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'No passkey challenge found in session');
      }

      // Verify passkey via MFAService
      const wrappedCredential = { credential, expectedChallenge };
      const verifyResult = await mfaService.verifyCode({
        sub: user.sub,
        methodName: MFAMethod.PASSKEY,
        code: wrappedCredential,
        ...(deviceId && { deviceId }),
      });
      isValid = verifyResult.valid;
    } else {
      const codeData = data as VerifyMFACodeResponse;
      const code = codeData.code;
      const deviceId = codeData.deviceId;

      // Verify code via MFAService (handles totp, sms, and backup)
      const verifyResult = await mfaService.verifyCode({
        sub: user.sub,
        methodName: method,
        code,
        ...(deviceId && { deviceId }),
      });
      isValid = verifyResult.valid;
    }

    if (!isValid) {
      this.logger?.warn?.(`MFA verification failed for user: ${user.sub}`);

      // Audit: Record MFA verification failure
      if (this.config.auditLogs?.fireAndForget) {
        auditService
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
          await auditService?.recordEvent({
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
      auditService
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
        await auditService?.recordEvent({
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

    if (trustedDeviceService && this.config.mfa?.rememberDevices && this.config.mfa.rememberDevices !== 'never') {
      const rememberMode = this.config.mfa.rememberDevices;

      // If a device token is already present, check if it's trusted
      if (deviceToken) {
        try {
          isTrustedDevice = await trustedDeviceService.isDeviceTrusted(deviceToken, user.id);
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
          deviceToken = await trustedDeviceService.createTrustedDevice(
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
    }

    return response;
  }

  /**
   * Handle FORCE_CHANGE_PASSWORD challenge
   *
   * @param challengeSession - Challenge session with user
   * @param newPassword - New password
   * @param passwordService - Password service (passed from AuthService)
   * @param auditService - Audit service (optional, passed from AuthService)
   * @returns Authentication response with tokens or next challenge
   */
  async handleForceChangePassword(
    challengeSession: BaseChallengeSession & { user?: BaseUser },
    newPassword: string,
    passwordService: PasswordService,
    auditService: AuthAuditService | undefined,
  ): Promise<AuthResponseDTO> {
    const user = challengeSession.user;
    if (!user) {
      throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
    }

    this.logger?.log?.(`Changing password for user: ${user.sub}`);

    await this.updateUserPassword(
      {
        user,
        newPassword,
        mustChangePassword: false,
        revokeSessions: true,
        revokeReason: 'Password changed (force change password)',
        audit: {
          eventType: AuthAuditEventType.PASSWORD_CHANGED,
          eventStatus: 'SUCCESS',
          reason: 'force_change_password',
          description: 'Password changed due to FORCE_CHANGE_PASSWORD challenge',
        },
      },
      passwordService,
      auditService,
    );

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
    }

    return response;
  }

  /**
   * Handle MFA_SETUP_REQUIRED challenge
   *
   * @param challengeSession - Challenge session with user
   * @param data - MFA setup data
   * @param mfaService - MFA service (passed from AuthService)
   * @param auditService - Audit service (optional, passed from AuthService)
   * @returns Authentication response with tokens or next challenge
   */
  async handleMFASetup(
    challengeSession: BaseChallengeSession & { user?: BaseUser },
    data: MFASetupResponse,
    mfaService: MFAService | undefined,
    _auditService: AuthAuditService | undefined,
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
    if (!mfaService) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'MFA service is not available');
    }

    // Get provider
    const provider = mfaService.getProvider(method);

    // Verify setup based on method
    let deviceId: number;

    try {
      deviceId = await this.withUserContext(user as unknown as IUser, async () => {
        return await provider.verifySetup(setupData);
      });
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
    }

    return response;
  }

  // ============================================================================
  // Validation Helpers
  // ============================================================================

  /**
   * Validate that response type matches expected challenge type
   *
   * @param expected - Expected challenge type
   * @param provided - Provided challenge type
   * @throws {NAuthException} If types don't match
   */
  validateChallengeTypeMatch(expected: string, provided: string): void {
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
   *
   * @param type - Challenge type
   * @param data - Challenge response data
   * @throws {NAuthException} If validation fails
   */
  validateChallengeParams(type: string, data: ChallengeResponseData): void {
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
   * Checks if the login identifier matches the specified allowed type.
   *
   * Determines if the given identifier is a valid email, username, phone, or allowed hybrid,
   * according to the configured identifier type restriction.
   *
   * @param identifier - The login identifier to check (email, username, or phone)
   * @param allowedType - The permitted identifier type ('email', 'username', 'phone', or 'email_or_username')
   * @returns True if the identifier conforms to the allowed type, otherwise false
   */
  validateIdentifierType(
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
   * Ensures email, phone, and username are unique for other users before update.
   *
   * Throws if another user already has the specified email, phone, or username.
   * Phone uniqueness check respects `config.signup.allowDuplicatePhones` setting:
   * - If `allowDuplicatePhones` is true, phone uniqueness is not checked
   * - If `allowDuplicatePhones` is false or undefined, phone must be unique
   *
   * @param userId - Internal numeric user ID (excluded from check)
   * @param updateData - User fields to check for uniqueness
   * @throws {NAuthException} If a unique constraint is violated for email, phone, or username
   */
  async validateUniquenessConstraints(userId: number, updateData: UserUpdateDTO): Promise<void> {
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

    // Check phone uniqueness - only if duplicates are not allowed
    if (updateData.phone && !this.config.signup?.allowDuplicatePhones) {
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
  // User Lookup Helpers
  // ============================================================================

  /**
   * Retrieves a user entity by login identifier.
   *
   * Performs a lookup for a user by email, username, or phone number.
   * The search respects the identifierType restriction when provided, limiting which fields are queried.
   *
   * **Case Sensitivity:**
   * - Email: Case-insensitive (normalized to lowercase, matches signup behavior)
   * - Username: Case-insensitive (normalized to lowercase, matches signup behavior)
   * - Phone: Case-sensitive (no normalization)
   *
   * @param identifier - Login credential (email, username, or phone)
   * @param identifierType - Restricts search to a specific identifier type ('email', 'username', 'phone', or 'email_or_username')
   * @returns The user entity if found, otherwise null
   */
  async findUserByIdentifier(
    identifier: string,
    identifierType?: 'email' | 'username' | 'phone' | 'email_or_username',
  ): Promise<IUser | null> {
    // ============================================================================
    // Normalize Identifier for Case-Insensitive Lookup
    // ============================================================================
    // WHY: Emails and usernames are stored in lowercase (see SignupDTO @Transform).
    // Login must normalize before querying to ensure case-insensitive matching.
    //
    // Phone numbers are NOT normalized (remain case-sensitive/as-provided).
    const trimmedIdentifier = identifier.trim();
    const normalizedIdentifier = identifierType === 'phone' ? trimmedIdentifier : trimmedIdentifier.toLowerCase();

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Build query based on identifier type restriction
    if (!identifierType) {
      // No restriction - search all fields
      // Email and username use normalized (lowercase) identifier
      // Phone uses original trimmed identifier
      queryBuilder
        .where('user.email = :emailIdentifier', { emailIdentifier: normalizedIdentifier })
        .orWhere('user.username = :usernameIdentifier', { usernameIdentifier: normalizedIdentifier })
        .orWhere('user.phone = :phoneIdentifier', { phoneIdentifier: trimmedIdentifier });
    } else {
      // Apply restriction based on identifier type
      switch (identifierType) {
        case 'email':
          queryBuilder.where('user.email = :identifier', { identifier: normalizedIdentifier });
          break;
        case 'username':
          queryBuilder.where('user.username = :identifier', { identifier: normalizedIdentifier });
          break;
        case 'phone':
          queryBuilder.where('user.phone = :identifier', { identifier: trimmedIdentifier });
          break;
        case 'email_or_username':
          queryBuilder
            .where('user.email = :identifier', { identifier: normalizedIdentifier })
            .orWhere('user.username = :identifier', { identifier: normalizedIdentifier });
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
      // Lock fields - required for account lock check in login flow
      'user.isLocked',
      'user.lockReason',
      'user.lockedAt',
      'user.lockedUntil',
      // The following are used for messaging/challenge determination when needed
      'user.socialProviders',
      'user.backupCodes',
    ]);

    return (await queryBuilder.getOne()) as IUser | null;
  }

  // ============================================================================
  // Password Management Helpers
  // ============================================================================

  /**
   * Centralized password update flow used by:
   * - changePassword()
   * - confirmForgotPassword()
   * - adminSetPassword()
   * - FORCE_CHANGE_PASSWORD challenge handler
   *
   * WHY:
   * - Prevent logic drift between different password-changing entrypoints
   * - Ensure consistent validation, history enforcement, persistence, session revocation, and audit trails
   *
   * @param params - Password update parameters
   * @param passwordService - Password service (passed from AuthService)
   * @param auditService - Audit service (optional, passed from AuthService)
   * @returns Sessions revoked count (0 when not revoked)
   * @throws {NAuthException} WEAK_PASSWORD | PASSWORD_REUSED | NOT_FOUND
   */
  async updateUserPassword(
    params: {
      user: IUser;
      newPassword: string;
      mustChangePassword: boolean;
      revokeSessions: boolean;
      revokeReason: string;
      beforePersist?: () => Promise<void>;
      audit?: {
        eventType: AuthAuditEventType;
        eventStatus: 'SUCCESS' | 'FAILURE' | 'INFO' | 'SUSPICIOUS';
        reason?: string;
        description?: string;
        authMethod?: string;
        metadata?: Record<string, unknown>;
      };
    },
    passwordService: PasswordService,
    auditService: AuthAuditService | undefined,
  ): Promise<{ sessionsRevoked: number }> {
    const { user, newPassword, mustChangePassword, revokeSessions, revokeReason, beforePersist, audit } = params;

    // ============================================================================
    // Load full user entity (important for passwordHistory serialization + reuse checks)
    // ============================================================================
    // WHY: Some call sites use a slim projection (e.g., findUserByIdentifier) which may omit passwordHistory.
    const userEntity = (await this.userRepository.findOne({ where: { id: user.id } })) as IUser | null;
    if (!userEntity) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // ============================================================================
    // Validate new password + history
    // ============================================================================
    const validation = await passwordService.validatePassword(newPassword, {
      email: userEntity.email,
      username: userEntity.username || undefined,
    });
    if (!validation.valid) {
      throw new NAuthException(AuthErrorCode.WEAK_PASSWORD, validation.errors.join(', '), {
        errors: validation.errors,
      });
    }

    if (this.config.password?.historyCount) {
      const historyToCheck = userEntity.passwordHistory || [];
      const allPreviousPasswords = userEntity.passwordHash
        ? [userEntity.passwordHash, ...historyToCheck]
        : historyToCheck;
      const isReused = await passwordService.isPasswordInHistory(newPassword, allPreviousPasswords);
      if (isReused) {
        throw new NAuthException(AuthErrorCode.PASSWORD_REUSED, 'Cannot reuse a recent password');
      }
    }

    // Hook point for flows that must prove possession of a reset code before persisting (forgot-password confirm)
    if (beforePersist) {
      await beforePersist();
    }

    // ============================================================================
    // Persist password update
    // ============================================================================
    const newHash = await passwordService.hashPassword(newPassword);
    const newHistory = userEntity.passwordHash
      ? passwordService.addToHistory(userEntity.passwordHistory || [], userEntity.passwordHash)
      : userEntity.passwordHistory || [];

    userEntity.passwordHash = newHash;
    userEntity.passwordChangedAt = new Date();
    userEntity.passwordHistory = newHistory;
    userEntity.mustChangePassword = mustChangePassword;
    await this.userRepository.save(userEntity as unknown as BaseUser);

    // ============================================================================
    // Session revocation
    // ============================================================================
    let sessionsRevoked = 0;
    if (revokeSessions) {
      sessionsRevoked = await this.sessionService.revokeAllUserSessions(userEntity.id, revokeReason);
    }

    // ============================================================================
    // Audit
    // ============================================================================
    if (audit) {
      try {
        await auditService?.recordEvent({
          userId: userEntity.id,
          eventType: audit.eventType,
          eventStatus: audit.eventStatus,
          reason: audit.reason,
          description: audit.description,
          authMethod: audit.authMethod,
          metadata: {
            ...audit.metadata,
            mustChangePassword,
            sessionsRevoked,
          },
        });
      } catch (auditError) {
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record ${audit.eventType} audit event: ${errorMessage}`, {
          error: auditError,
          userId: userEntity.id,
        });
      }
    }

    // ============================================================================
    // Lifecycle Hook: Password Changed
    // ============================================================================
    try {
      const clientInfo = this.clientInfoService.get();
      await this.hookRegistry.executePasswordChanged({
        user: userEntity,
        changedBy: audit?.reason?.includes('admin') ? 'admin' : audit?.reason?.includes('reset') ? 'reset' : 'user',
        sessionsRevoked,
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
      this.logger?.error?.(`Failed to execute passwordChanged hooks: ${errorMessage}`, {
        error: hookError,
        userId: userEntity.id,
      });
    }

    return { sessionsRevoked };
  }

  // ============================================================================
  // Login Tracking Helpers
  // ============================================================================

  /**
   * Handles a failed login by recording the attempt, applying IP-based lockout policy,
   * and invoking relevant hooks.
   *
   * @param identifier - User identifier (email/username/phone)
   * @param reason - Optional reason for failure
   */
  async handleFailedLogin(identifier: string, reason?: string): Promise<void> {
    // Get client IP address for lockout tracking
    const clientInfo = this.clientInfoService.get();
    const ipAddress = clientInfo.ipAddress;

    // Record failed attempt
    await this.recordLoginAttempt(identifier, false, reason);

    // Increment IP-based lockout counter if enabled
    if (this.config.lockout?.enabled && ipAddress) {
      const attemptWindowSeconds = this.config.lockout.attemptWindow ?? 3600;
      const attempts = await this.accountLockoutStorage.recordFailedAttempt(ipAddress, attemptWindowSeconds);

      // Lock IP if max attempts reached
      if (attempts >= (this.config.lockout.maxAttempts || 5)) {
        await this.accountLockoutStorage.lockIpAddress(
          ipAddress,
          this.config.lockout.duration || 900, // 15 minutes default
          'Too many failed login attempts from this IP',
        );
      }
    }
  }

  /**
   * Records a login attempt with client context.
   *
   * @param email - User's email address
   * @param success - True if login succeeded, false if failed
   * @param failureReason - Optional reason for failure
   * @param userId - Optional internal user ID (only for successful logins)
   */
  async recordLoginAttempt(email: string, success: boolean, failureReason?: string, userId?: number): Promise<void> {
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

  // ============================================================================
  // Cookie Management Helpers
  // ============================================================================

  /**
   * Clear authentication cookies from response
   *
   * @param response - HTTP response object with clearCookie method
   * @param forgetDevice - Whether to also clear device token cookie
   */
  clearAuthCookies(response: { clearCookie?: (name: string, options?: unknown) => void }, forgetDevice: boolean): void {
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

  // ============================================================================
  // Formatting Helpers
  // ============================================================================

  /**
   * Mask email address for privacy (show first char and domain)
   *
   * Uses centralized ChallengeService which respects config.security.maskSensitiveData.
   *
   * @param email - Email address to mask
   * @returns Masked email (e.g., 'u***r@example.com')
   */
  maskEmail(email: string): string {
    return this.challengeService.maskEmail(email);
  }

  /**
   * Mask phone number for privacy (show last 4 digits)
   *
   * Uses centralized ChallengeService which respects config.security.maskSensitiveData.
   *
   * @param phone - Phone number to mask
   * @returns Masked phone (e.g., '***-***-1234')
   */
  maskPhone(phone: string): string {
    return this.challengeService.maskPhone(phone);
  }

  // ============================================================================
  // reCAPTCHA Validation
  // ============================================================================

  /**
   * Validate reCAPTCHA token only when explicitly required via @RequireRecaptcha().
   *
   * Validation runs solely when the route has @RequireRecaptcha().
   * If the decorator is not present, any recaptchaToken in the request is ignored.
   *
   * Logic:
   * 1. Skip if reCAPTCHA not enabled in config
   * 2. Skip if route does not have @RequireRecaptcha() (ignore token)
   * 3. If @RequireRecaptcha(): require token and validate (throws if missing/invalid)
   *
   * @param token - reCAPTCHA token from client (optional)
   * @param clientIp - Client IP address for validation (optional)
   *
   * @throws {NAuthException} RECAPTCHA_REQUIRED - Token required but not provided
   * @throws {NAuthException} RECAPTCHA_PROVIDER_MISSING - Provider not configured
   * @throws {NAuthException} RECAPTCHA_VALIDATION_FAILED - Token validation failed
   * @throws {NAuthException} RECAPTCHA_SCORE_TOO_LOW - Score below minimum (v3/Enterprise)
   *
   * @example
   * ```typescript
   * // In controller:
   * @RequireRecaptcha()
   * @Post('login')
   * async login(@Body() dto: LoginDTO) { ... }
   *
   * // In AuthService.login():
   * await this.helpers.validateRecaptchaIfNeeded(dto.recaptchaToken, clientInfo.ipAddress);
   * ```
   */
  async validateRecaptchaIfNeeded(token: string | undefined, clientIp?: string): Promise<void> {
    const recaptchaConfig = this.config.recaptcha;

    // Skip if reCAPTCHA not enabled
    if (!recaptchaConfig?.enabled) {
      return;
    }

    // Get current request context for attributes set by decorators
    const req = ContextStorage.get<NAuthRequest>('REQUEST');

    // Validate only when @RequireRecaptcha() is on the route; otherwise ignore any token
    if (req?.attributes.nauthRequireRecaptcha !== true) {
      return;
    }

    this.logger?.debug?.('reCAPTCHA validation required (explicit @RequireRecaptcha() decorator)');

    if (!token) {
      throw new NAuthException(AuthErrorCode.RECAPTCHA_REQUIRED, 'reCAPTCHA token is required');
    }

    await this.verifyRecaptchaToken(token, clientIp);
  }

  /**
   * Verify reCAPTCHA token with Google's API
   *
   * @param token - reCAPTCHA token from client
   * @param clientIp - Client IP address (optional but recommended)
   *
   * @throws {NAuthException} RECAPTCHA_PROVIDER_MISSING - Provider not configured
   * @throws {NAuthException} RECAPTCHA_VALIDATION_FAILED - Token validation failed
   * @throws {NAuthException} RECAPTCHA_SCORE_TOO_LOW - Score below minimum (v3/Enterprise)
   */
  private async verifyRecaptchaToken(token: string, clientIp?: string): Promise<void> {
    const recaptchaConfig = this.config.recaptcha;

    if (!recaptchaConfig?.provider) {
      throw new NAuthException(AuthErrorCode.RECAPTCHA_PROVIDER_MISSING, 'reCAPTCHA provider is not configured');
    }

    try {
      // Call provider to verify token with Google
      const result = await recaptchaConfig.provider.verify(token, clientIp);

      // Check if verification succeeded
      if (!result.success) {
        this.logger?.warn?.(`reCAPTCHA validation failed: ${result.errorCodes?.join(', ') || 'unknown error'}`);
        throw new NAuthException(AuthErrorCode.RECAPTCHA_VALIDATION_FAILED, 'reCAPTCHA validation failed', {
          errorCodes: result.errorCodes,
        });
      }

      // Check score for v3/Enterprise (score is only present for v3/Enterprise)
      if (result.score !== undefined) {
        const minimumScore = recaptchaConfig.minimumScore ?? 0.5;

        this.logger?.debug?.(`reCAPTCHA score: ${result.score} (minimum: ${minimumScore})`);

        if (result.score < minimumScore) {
          this.logger?.warn?.(
            `reCAPTCHA score too low: ${result.score} < ${minimumScore}. Likely bot activity detected.`,
          );
          throw new NAuthException(AuthErrorCode.RECAPTCHA_SCORE_TOO_LOW, 'Suspicious activity detected', {
            score: result.score,
            minimumScore,
          });
        }
      }

      this.logger?.debug?.(
        `reCAPTCHA validation successful${result.score ? ` (score: ${result.score})` : ''} for action: ${result.action || 'unknown'}`,
      );
    } catch (error: unknown) {
      // If it's already a NAuthException, re-throw it
      if (error instanceof NAuthException) {
        throw error;
      }

      // Network or provider errors
      this.logger?.warn?.(`reCAPTCHA verification error: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw new NAuthException(
        AuthErrorCode.RECAPTCHA_VALIDATION_FAILED,
        'reCAPTCHA verification failed due to technical error',
      );
    }
  }
}
