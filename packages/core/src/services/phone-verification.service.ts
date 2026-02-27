import { Repository, IsNull } from 'typeorm';
import { IUser, IVerificationToken } from '../interfaces/entities.interface';
import { BaseVerificationToken, BaseUser } from '../entities';
import { SMSProvider } from '../interfaces/provider.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { ClientInfoService } from './client-info.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { NAuthLogger } from '../utils/nauth-logger';
import { HookRegistryService } from './hook-registry.service';
import {
  SendVerificationSMSDTO,
  SendVerificationSMSResponseDTO,
  VerifyPhoneWithCodeDTO,
  VerifyPhoneResponseDTO,
  ResendVerificationSMSDTO,
  ResendVerificationSMSResponseDTO,
} from '../dto/verify-phone.dto';
import { VerifyPhoneWithCodeBySubDTO } from '../dto/verify-phone-by-sub.dto';
import * as crypto from 'crypto';
import { ensureValidatedDto } from '../utils/dto-validator';

/**
 * Phone Verification Service (Core)
 *
 * Database-agnostic phone verification workflow with provider-driven SMS delivery.
 *
 * WHY: Keeps core business logic independent of database and SMS vendors. Databases are
 * injected via repository tokens and SMS via an `SMSProvider` adapter so consumers
 * can plug in Postgres, MySQL, or any SMS provider without code changes.
 *
 * @example
 * ```typescript
 * // Send OTP
 * const tokenId = await phoneVerificationService.sendVerificationSMS('user-sub');
 *
 * // Verify by sub
 * await phoneVerificationService.verifyPhoneWithCodeBySub('user-sub', '123456');
 *
 * // Resend
 * await phoneVerificationService.resendVerificationSMS('user-sub');
 * ```
 */
export class PhoneVerificationService {
  constructor(
    private readonly verificationTokenRepo: Repository<BaseVerificationToken>,
    private readonly userRepo: Repository<BaseUser>,
    private readonly smsProvider: SMSProvider,
    private readonly storageAdapter: StorageAdapter,
    private readonly config: NAuthConfig,
    private readonly clientInfoService: ClientInfoService,
    private readonly logger: NAuthLogger,
    private readonly hookRegistry: HookRegistryService,
    private readonly auditService?: AuthAuditService, // Optional - audit trail service (enabled via config.auditLogs.enabled)
  ) {}

  /**
   * Send verification SMS to user identified by `sub`.
   * Applies rate limits and resend delay, stores hashed token + OTP, and sends via SMS provider.
   *
   * @param dto - Request DTO containing sub and skipAlreadyVerifiedCheck
   * @returns Response DTO with verification token ID
   * @throws {NAuthException} RATE_LIMIT_SMS | NOT_FOUND | PHONE_REQUIRED | ALREADY_VERIFIED | RATE_LIMIT_RESEND
   */
  async sendVerificationSMS(dto: SendVerificationSMSDTO): Promise<SendVerificationSMSResponseDTO> {
    dto = await ensureValidatedDto(SendVerificationSMSDTO, dto);
    const { sub, skipAlreadyVerifiedCheck = true, challengeSessionId } = dto;
    const rateLimitKey = `phone-verification:${sub}`;

    // Get rate limit configuration from config (moved to signup.phoneVerification)
    const rateLimitMax = this.config.signup?.phoneVerification?.rateLimitMax || 3;
    const rateLimitWindow = this.config.signup?.phoneVerification?.rateLimitWindow || 3600; // 1 hour in seconds

    // Check if key exists and has valid TTL (not expired)
    const ttlBefore = await this.storageAdapter.ttl(rateLimitKey);
    // Window is expired if: key doesn't exist (-1), expired (<0), or TTL is longer than configured window (config changed)
    const isWindowExpired = ttlBefore === -1 || ttlBefore < 0 || ttlBefore > rateLimitWindow;

    // If TTL is longer than configured window (config changed), delete the old key to reset it
    // This ensures the new window uses the current rateLimitWindow instead of preserving old expiry
    if (ttlBefore > rateLimitWindow) {
      await this.storageAdapter.del(rateLimitKey);
    }

    // Increment counter (will reset to 1 if key expired or doesn't exist)
    // Pass TTL so new records are created with correct expiry immediately
    const currentCount = await this.storageAdapter.incr(rateLimitKey, isWindowExpired ? rateLimitWindow : undefined);

    // If we created a new window, log it
    if (isWindowExpired && currentCount === 1) {
      this.logger?.debug?.(
        `Rate limit window reset for phone verification: sub=${sub}, window=${rateLimitWindow}s, max=${rateLimitMax}`,
      );
    }

    // Get actual TTL after setting expiry (for error message)
    const actualTtl = await this.storageAdapter.ttl(rateLimitKey);

    this.logger?.debug?.(
      `Phone verification rate limit check: sub=${sub}, count=${currentCount}/${rateLimitMax}, ttl=${actualTtl}s, window=${rateLimitWindow}s`,
    );

    if (currentCount > rateLimitMax) {
      this.logger?.error?.(
        `SMS rate limit exceeded: sub=${sub}, count=${currentCount}, max=${rateLimitMax}, retryAfter=${actualTtl}s, window=${rateLimitWindow}s. ` +
          `Config: rateLimitMax=${this.config.signup?.phoneVerification?.rateLimitMax}, rateLimitWindow=${this.config.signup?.phoneVerification?.rateLimitWindow}`,
      );
      throw new NAuthException(
        AuthErrorCode.RATE_LIMIT_SMS,
        `Too many verification SMS sent. Please try again in ${actualTtl > 0 ? actualTtl : rateLimitWindow} seconds`,
        {
          retryAfter: actualTtl > 0 ? actualTtl : rateLimitWindow,
          currentCount,
          maxAttempts: rateLimitMax,
        },
      );
    }

    // Load user by external identifier
    const user = (await this.userRepo.findOne({ where: { sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }
    if (!user.phone) {
      throw new NAuthException(AuthErrorCode.PHONE_REQUIRED, 'No phone number associated with this account');
    }
    // Only check "already verified" if not skipping (skip for MFA contexts where codes are needed even if phone is verified)
    if (!skipAlreadyVerifiedCheck && user.isPhoneVerified) {
      throw new NAuthException(AuthErrorCode.ALREADY_VERIFIED, 'Phone already verified');
    }

    // Enforce resend delay to prevent abuse
    const resendDelay = this.config.signup?.phoneVerification?.resendDelay ?? 60;
    this.logger?.debug?.(
      `Phone resend delay check: sub=${sub}, resendDelay=${resendDelay}s, config=${this.config.signup?.phoneVerification?.resendDelay}`,
    );
    const lastToken = (await this.verificationTokenRepo.findOne({
      where: { userId: user.id, type: 'phone' },
      order: { createdAt: 'DESC' },
    })) as IVerificationToken | null;
    if (lastToken) {
      const secondsSinceLastSend = (Date.now() - lastToken.createdAt.getTime()) / 1000;
      this.logger?.debug?.(
        `Phone last token: tokenId=${lastToken.id}, createdAt=${lastToken.createdAt.toISOString()}, secondsSince=${secondsSinceLastSend.toFixed(1)}s`,
      );
      if (secondsSinceLastSend < resendDelay) {
        const waitSeconds = Math.ceil(resendDelay - secondsSinceLastSend);

        // If challengeSessionId is provided and token is still valid, link it to the new challenge session
        // This allows the token to be found by the new session (e.g., during rapid re-logins)
        if (challengeSessionId && lastToken.usedAt === null && lastToken.expiresAt > new Date()) {
          this.logger?.log?.(
            `Resend delay active but linking existing token ${lastToken.id} to new challenge session ${challengeSessionId}. No new SMS sent.`,
          );
          await this.verificationTokenRepo.update({ id: lastToken.id }, { challengeSessionId });
          // Return success response with existing token ID (no new SMS sent)
          return { tokenId: lastToken.id as number };
        }

        this.logger?.warn?.(
          `SMS resend rate limit: sub=${sub}, wait=${waitSeconds}s, delay=${resendDelay}s, secondsSince=${secondsSinceLastSend.toFixed(1)}s`,
        );
        throw new NAuthException(
          AuthErrorCode.RATE_LIMIT_RESEND,
          `Please wait ${waitSeconds} seconds before requesting another code`,
          {
            retryAfter: waitSeconds,
            resendDelay,
          },
        );
      }
    }

    // Invalidate existing unused tokens for this user
    await this.verificationTokenRepo.update(
      { userId: user.id, type: 'phone', usedAt: IsNull() },
      { usedAt: new Date() },
    );

    // Generate OTP and hashed token
    const code = this.generateCode();
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    // Capture client info for auditability
    const clientInfo = this.clientInfoService.get();
    const { ipAddress, userAgent } = clientInfo;

    const verificationToken = this.verificationTokenRepo.create({
      userId: user.id,
      challengeSessionId: challengeSessionId ?? null, // Link to challenge session if provided
      type: 'phone',
      token: tokenHash,
      code,
      expiresAt: new Date(Date.now() + (this.config.signup?.phoneVerification?.expiresIn || 300) * 1000),
      attempts: 0,
      ipAddress,
      userAgent,
    });

    const saved = (await this.verificationTokenRepo.save(verificationToken)) as unknown as IVerificationToken;

    this.logger?.log?.(
      `SMS token created: sub=${sub}, tokenId=${saved.id}, code=${code}, codeType=${typeof code}, userId=${user.id}, usedAt=${saved.usedAt || 'null'}`,
    );

    // Calculate expiry minutes for template variables
    const expiresInSeconds = this.config.signup?.phoneVerification?.expiresIn || 300;
    const expiryMinutes = Math.ceil(expiresInSeconds / 60);

    // Determine template type: 'mfa' if called from MFA context, otherwise 'verification'
    // MFA context is detected by skipAlreadyVerifiedCheck being explicitly true AND phone already verified
    // (MFA always sends codes even if phone is verified, while verification only sends if not verified)
    // Default to 'verification' for phone verification flows
    const templateType = dto.skipAlreadyVerifiedCheck && user.isPhoneVerified ? 'mfa' : 'verification';

    // Get appName from email globals or SMS templates global variables
    const smsConfig = this.config.sms as { templates?: { globalVariables?: Record<string, unknown> } } | undefined;
    const appName =
      (this.config.email?.globalVariables?.appName as string | undefined) ||
      (smsConfig?.templates?.globalVariables?.appName as string | undefined);

    // Send SMS with template support
    await this.smsProvider.sendOTP(user.phone, code, templateType, {
      expiryMinutes,
      appName,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.username,
      userEmail: user.email,
      phone: user.phone,
    });
    this.logger?.log?.(
      `SMS verification code sent: sub=${sub}, tokenId=${saved.id}, phone=${this.maskPhone(user.phone)}`,
    );

    // ============================================================================
    // Audit: Record phone verification request
    // ============================================================================
    try {
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.PHONE_VERIFICATION_REQUESTED,
        eventStatus: 'INFO',
        metadata: {
          phone: this.maskPhone(user.phone),
        },
        // Client info automatically included from context
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record PHONE_VERIFICATION_REQUESTED audit event: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
      });
    }

    return { tokenId: saved.id };
  }

  /**
   * Verify phone by phone number and code.
   * Handles duplicate phone numbers by selecting the token whose user matches the phone provided.
   *
   * @param dto - Request DTO containing phone and code
   * @returns Response DTO with success message
   * @throws {NAuthException} VERIFICATION_CODE_INVALID | VERIFICATION_CODE_EXPIRED | VERIFICATION_TOO_MANY_ATTEMPTS
   */
  async verifyPhoneWithCode(dto: VerifyPhoneWithCodeDTO): Promise<VerifyPhoneResponseDTO> {
    dto = await ensureValidatedDto(VerifyPhoneWithCodeDTO, dto);
    const { phone, code, challengeSessionId } = dto;
    // Find all unused tokens matching the code and type
    // If challengeSessionId is provided, ensure token belongs to specific session
    const whereClause = {
      type: 'phone' as const,
      code,
      usedAt: IsNull(),
      ...(challengeSessionId !== undefined && { challengeSessionId }), // Include if provided
    };

    const candidateTokens = (await this.verificationTokenRepo.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
    })) as unknown as IVerificationToken[];

    // Resolve the token whose user has the given phone
    let matched: { token: IVerificationToken; user: IUser } | null = null;
    for (const token of candidateTokens) {
      const user = (await this.userRepo.findOne({ where: { id: token.userId } })) as IUser | null;
      if (user && user.phone === phone) {
        matched = { token, user };
        break;
      }
    }

    if (!matched) {
      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid or expired verification code');
    }

    const { token, user } = matched;

    const verificationMethod = this.config.signup?.verificationMethod ?? 'email';
    const wasOnboardingCompleteBefore =
      verificationMethod === 'none'
        ? true
        : verificationMethod === 'email'
          ? !!user.isEmailVerified
          : verificationMethod === 'phone'
            ? !!user.isPhoneVerified
            : verificationMethod === 'both'
              ? !!user.isEmailVerified && !!user.isPhoneVerified
              : !!user.isEmailVerified;

    // Store initial verification status to detect changes
    const wasPhoneVerified = Boolean(user.isPhoneVerified);

    // Get verification attempt rate limit configuration from config
    const maxAttemptsPerUser = this.config.signup?.phoneVerification?.maxAttemptsPerUser ?? 10;
    const maxAttemptsPerIP = this.config.signup?.phoneVerification?.maxAttemptsPerIP ?? 20;
    const attemptWindow = this.config.signup?.phoneVerification?.attemptWindow ?? 3600; // 1 hour

    // Rate limit verification attempts per user (not just per token)
    const userRateLimitKey = `verify-attempts:user:${user.id}`;
    const userAttempts = await this.storageAdapter.incr(userRateLimitKey);

    if (userAttempts === 1) {
      await this.storageAdapter.expire(userRateLimitKey, attemptWindow);
    }

    if (userAttempts > maxAttemptsPerUser) {
      throw new NAuthException(
        AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS,
        'Too many verification attempts. Please try again later.',
      );
    }

    // Also rate limit by IP
    const clientInfo = this.clientInfoService.get();
    if (clientInfo.ipAddress) {
      const ipRateLimitKey = `verify-attempts:ip:${clientInfo.ipAddress}`;
      const ipAttempts = await this.storageAdapter.incr(ipRateLimitKey);

      if (ipAttempts === 1) {
        await this.storageAdapter.expire(ipRateLimitKey, attemptWindow);
      }

      if (ipAttempts > maxAttemptsPerIP) {
        throw new NAuthException(
          AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS,
          'Too many verification attempts from this IP. Please try again later.',
        );
      }
    }

    // Expiry check (use entity method if provided)
    const isExpired =
      typeof token.isExpired === 'function' ? !!token.isExpired() : token.expiresAt.getTime() <= Date.now();
    if (isExpired) {
      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_EXPIRED, 'Verification code has expired');
    }

    // Attempts check (use entity method if provided)
    const maxAttempts = this.config.signup?.phoneVerification?.maxAttempts ?? 3;
    const tooManyAttempts =
      typeof token.maxAttemptsExceeded === 'function'
        ? !!token.maxAttemptsExceeded(maxAttempts)
        : token.attempts >= maxAttempts;
    if (tooManyAttempts) {
      throw new NAuthException(
        AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS,
        'Too many failed attempts. Request a new code.',
        {
          maxAttempts,
          currentAttempts: token.attempts,
        },
      );
    }

    // Increment attempts even on success to prevent reuse by race
    token.attempts += 1;
    if (token.code !== code) {
      await this.verificationTokenRepo.save(token);
      this.logger?.debug?.(
        `Phone verification failed: phone=${this.maskPhone(phone)}, attempts=${token.attempts}/${maxAttempts}`,
      );

      // ============================================================================
      // Audit: Record phone verification failure
      // ============================================================================
      try {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.PHONE_VERIFICATION_FAILED,
          eventStatus: 'FAILURE',
          reason: 'invalid_code',
          // Client info automatically included from context
          description: 'Invalid verification code provided',
          metadata: {
            attempts: token.attempts,
            phone: this.maskPhone(phone),
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record PHONE_VERIFICATION_FAILED audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
        });
      }

      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid verification code', {
        attemptsRemaining: Math.max(0, maxAttempts - token.attempts),
      });
    }

    // Mark token used
    token.usedAt = new Date();
    await this.verificationTokenRepo.save(token);

    // Update user flags - only update if not already verified to avoid unnecessary DB write
    if (!wasPhoneVerified) {
      await this.userRepo.update(user.id, {
        isPhoneVerified: true,
        isActive: true,
      });
    }

    this.logger?.log?.(`Phone verification successful: userId=${user.id}, phone=${this.maskPhone(phone)}`);

    // ============================================================================
    // Audit: Record phone verification success
    // ============================================================================
    try {
      // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
      // Note: ClientInfoService is used transparently by AuditService
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.PHONE_VERIFIED,
        eventStatus: 'SUCCESS',
        metadata: {
          verificationMethod: 'code',
          phone: this.maskPhone(phone),
        },
        // Client info automatically included from context
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record PHONE_VERIFIED audit event: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
      });
    }

    // ============================================================================
    // Hook: Execute user profile updated hooks
    // ============================================================================
    // Fire hook if verification status changed (false→true OR true→false)
    // This ensures hook fires consistently on any status change
    if (wasPhoneVerified !== true) {
      try {
        // Refetch user to get complete updated state
        const updatedUser = (await this.userRepo.findOne({ where: { id: user.id } })) as IUser | null;
        if (updatedUser) {
          // Get client info from ClientInfoService
          const clientInfo = this.clientInfoService.get();

          // Execute hooks (non-blocking) with actual old/new values
          await this.hookRegistry.executeUserProfileUpdated({
            user: updatedUser,
            changedFields: [
              {
                fieldName: 'isPhoneVerified',
                oldValue: wasPhoneVerified,
                newValue: true,
              },
            ],
            updateSource: 'phone_verification',
            clientInfo: {
              ipAddress: clientInfo.ipAddress,
              userAgent: clientInfo.userAgent,
              ipCountry: clientInfo.ipCountry,
              ipCity: clientInfo.ipCity,
            },
          });

          const isOnboardingCompleteNow =
            verificationMethod === 'none'
              ? true
              : verificationMethod === 'email'
                ? !!updatedUser.isEmailVerified
                : verificationMethod === 'phone'
                  ? !!updatedUser.isPhoneVerified
                  : verificationMethod === 'both'
                    ? !!updatedUser.isEmailVerified && !!updatedUser.isPhoneVerified
                    : !!updatedUser.isEmailVerified;

          // Fire onboarding completed only on the transition to "complete" to avoid duplicate welcome emails.
          if (!wasOnboardingCompleteBefore && isOnboardingCompleteNow) {
            await this.hookRegistry.executeOnboardingCompleted(updatedUser, {
              verificationMethod,
              source: 'phone_verification',
              completedAt: new Date(),
            });
          }
        }
      } catch (hookError) {
        // Non-blocking: Log but continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(`Failed to execute userProfileUpdated hooks: ${errorMessage}`, {
          error: hookError,
          userId: user.id,
        });
      }
    }

    return { message: 'Phone verified successfully. Please log in to continue.' };
  }

  /**
   * Verify phone by user sub and code.
   *
   * @param dto - Request DTO containing sub and code
   * @returns Response DTO with success message
   */
  async verifyPhoneWithCodeBySub(dto: VerifyPhoneWithCodeBySubDTO): Promise<VerifyPhoneResponseDTO> {
    dto = await ensureValidatedDto(VerifyPhoneWithCodeBySubDTO, dto);
    const { sub, code, challengeSessionId } = dto;
    // Load user to get current phone verification status
    // This ensures we have the latest state from the database
    const user = (await this.userRepo.findOne({ where: { sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const verificationMethod = this.config.signup?.verificationMethod ?? 'email';
    const wasOnboardingCompleteBefore =
      verificationMethod === 'none'
        ? true
        : verificationMethod === 'email'
          ? !!user.isEmailVerified
          : verificationMethod === 'phone'
            ? !!user.isPhoneVerified
            : verificationMethod === 'both'
              ? !!user.isEmailVerified && !!user.isPhoneVerified
              : !!user.isEmailVerified;
    if (!user.phone) {
      throw new NAuthException(AuthErrorCode.PHONE_REQUIRED, 'No phone number associated with this account');
    }

    // Store initial verification status to avoid unnecessary updates
    const wasPhoneVerified = Boolean(user.isPhoneVerified);

    // ============================================================================
    // Security: Rate limit configuration
    // IP-based rate limiting applies only to INVALID attempts to prevent brute force
    // Valid codes should not be blocked by IP rate limits
    // ============================================================================
    const maxAttemptsPerIP = this.config.signup?.phoneVerification?.maxAttemptsPerIP ?? 20;
    const attemptWindow = this.config.signup?.phoneVerification?.attemptWindow ?? 3600; // 1 hour
    const clientInfo = this.clientInfoService.get();

    // Find verification token
    // Query for unused tokens matching the code (order by newest first)
    // Ensure code is a string (database stores as varchar/string)
    // TypeORM may receive code as number from JSON, so convert to string for query
    const codeString = String(code);
    this.logger?.log?.(
      `Looking for verification token: sub=${sub}, code=${codeString}, codeType=${typeof code}, userId=${user.id}`,
    );
    // If challengeSessionId is provided, ensure token belongs to specific session
    const whereClause = {
      userId: user.id,
      type: 'phone' as const,
      code: codeString,
      usedAt: IsNull(),
      ...(challengeSessionId !== undefined && { challengeSessionId }), // Include if provided
    };

    const verificationToken = (await this.verificationTokenRepo.findOne({
      where: whereClause,
      order: { createdAt: 'DESC' },
    })) as IVerificationToken | null;

    // ============================================================================
    // Security: Increment IP rate limit for invalid attempts only
    // This prevents brute force attacks while allowing valid codes through
    // ============================================================================
    const incrementIPRateLimit = async (): Promise<void> => {
      if (clientInfo.ipAddress) {
        const ipRateLimitKey = `verify-attempts:ip:${clientInfo.ipAddress}`;
        const ipAttempts = await this.storageAdapter.incr(ipRateLimitKey);

        if (ipAttempts === 1) {
          await this.storageAdapter.expire(ipRateLimitKey, attemptWindow);
        }

        if (ipAttempts > maxAttemptsPerIP) {
          throw new NAuthException(
            AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS,
            'Too many verification attempts from this IP. Please try again later.',
          );
        }
      }
    };

    if (!verificationToken) {
      this.logger?.warn?.(
        `Phone verification token not found: sub=${sub}, code=${codeString}, originalCodeType=${typeof code}, userId=${user.id}`,
      );
      // Invalid attempt - increment IP rate limit
      await incrementIPRateLimit();
      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid or expired verification code');
    }

    const isExpired =
      typeof verificationToken.isExpired === 'function'
        ? !!verificationToken.isExpired()
        : verificationToken.expiresAt.getTime() <= Date.now();
    if (isExpired) {
      // Expired token - increment IP rate limit
      await incrementIPRateLimit();
      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_EXPIRED, 'Verification code has expired');
    }

    const maxAttempts = this.config.signup?.phoneVerification?.maxAttempts ?? 3;
    const tooManyAttempts =
      typeof verificationToken.maxAttemptsExceeded === 'function'
        ? !!verificationToken.maxAttemptsExceeded(maxAttempts)
        : verificationToken.attempts >= maxAttempts;
    if (tooManyAttempts) {
      // Token exceeded max attempts - increment IP rate limit
      await incrementIPRateLimit();
      throw new NAuthException(
        AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS,
        'Too many failed attempts. Request a new code.',
        {
          maxAttempts,
          currentAttempts: verificationToken.attempts,
        },
      );
    }

    // ============================================================================
    // Security: Rate limit verification attempts per user (for invalid attempts only)
    // This prevents users from exhausting their own tokens through repeated attempts
    // Valid codes should not be blocked by user rate limits
    // ============================================================================
    const maxAttemptsPerUser = this.config.signup?.phoneVerification?.maxAttemptsPerUser ?? 10;

    // Helper to increment user rate limit (only for invalid attempts)
    const incrementUserRateLimit = async (): Promise<void> => {
      const userRateLimitKey = `verify-attempts:user:${user.id}`;
      const userAttempts = await this.storageAdapter.incr(userRateLimitKey);

      if (userAttempts === 1) {
        await this.storageAdapter.expire(userRateLimitKey, attemptWindow);
      }

      if (userAttempts > maxAttemptsPerUser) {
        throw new NAuthException(
          AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS,
          'Too many verification attempts. Please try again later.',
        );
      }
    };

    verificationToken.attempts += 1;
    // Compare normalized codes (trim whitespace for comparison)
    const storedCode = String(verificationToken.code).trim();
    const providedCode = String(code).trim();
    if (storedCode !== providedCode) {
      // Invalid code - increment both IP and user rate limits
      await incrementIPRateLimit();
      await incrementUserRateLimit();

      await this.verificationTokenRepo.save(verificationToken);
      this.logger?.debug?.(
        `Phone verification failed: sub=${sub}, attempts=${verificationToken.attempts}/${maxAttempts}`,
      );

      // ============================================================================
      // Audit: Record phone verification failure (by sub)
      // ============================================================================
      try {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.PHONE_VERIFICATION_FAILED,
          eventStatus: 'FAILURE',
          reason: 'invalid_code',
          // Client info automatically included from context
          description: 'Invalid verification code provided',
          metadata: {
            attempts: verificationToken.attempts,
            phone: this.maskPhone(user.phone || ''),
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record PHONE_VERIFICATION_FAILED audit event (by sub): ${errorMessage}`, {
          error: auditError,
          userId: user.id,
        });
      }

      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid verification code', {
        attemptsRemaining: Math.max(0, maxAttempts - verificationToken.attempts),
      });
    }

    // ============================================================================
    // Code is valid - proceed without rate limit checks
    // Valid codes should always be allowed through
    // ============================================================================

    verificationToken.usedAt = new Date();
    await this.verificationTokenRepo.save(verificationToken);

    // ============================================================================
    // Only update user if phone is not already verified to avoid unnecessary DB write
    // This prevents updating updatedAt timestamp when phone is already verified
    // We use the verification status from when user was loaded at the start
    // ============================================================================
    const phoneWasJustVerified = !wasPhoneVerified;
    if (phoneWasJustVerified) {
      // Use update() with explicit WHERE clause to ensure the change is persisted
      // This bypasses entity tracking issues and ensures the update is committed
      await this.userRepo.update(
        { sub },
        {
          isPhoneVerified: true,
          isActive: true,
        },
      );
      this.logger?.log?.(`Phone verification successful: sub=${sub}, userId=${user.id} - phone marked as verified`);
    } else {
      // Phone already verified - just mark token as used, no user update needed
      this.logger?.log?.(`Phone verification code validated: sub=${sub}, userId=${user.id} - phone already verified`);
    }

    // ============================================================================
    // Audit: Record phone verification success (by sub)
    // ============================================================================
    try {
      // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
      // Note: ClientInfoService is used transparently by AuditService
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.PHONE_VERIFIED,
        eventStatus: 'SUCCESS',
        metadata: {
          verificationMethod: 'code',
          phone: this.maskPhone(user.phone || ''),
        },
        // Client info automatically included from context
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record PHONE_VERIFIED audit event (by sub): ${errorMessage}`, {
        error: auditError,
        userId: user.id,
      });
    }

    // ============================================================================
    // Hook: Execute user profile updated hooks
    // ============================================================================
    // Always fire hook when verification occurs (phone was just verified)
    // This ensures hook fires consistently whenever phone verification succeeds
    if (phoneWasJustVerified) {
      try {
        // Refetch user to get complete updated state
        const updatedUser = (await this.userRepo.findOne({ where: { id: user.id } })) as IUser | null;
        if (updatedUser) {
          // Get client info from ClientInfoService
          const clientInfo = this.clientInfoService.get();

          // Execute hooks (non-blocking) with actual old/new values
          await this.hookRegistry.executeUserProfileUpdated({
            user: updatedUser,
            changedFields: [
              {
                fieldName: 'isPhoneVerified',
                oldValue: wasPhoneVerified,
                newValue: true,
              },
            ],
            updateSource: 'phone_verification',
            clientInfo: {
              ipAddress: clientInfo.ipAddress,
              userAgent: clientInfo.userAgent,
              ipCountry: clientInfo.ipCountry,
              ipCity: clientInfo.ipCity,
            },
          });

          const isOnboardingCompleteNow =
            verificationMethod === 'none'
              ? true
              : verificationMethod === 'email'
                ? !!updatedUser.isEmailVerified
                : verificationMethod === 'phone'
                  ? !!updatedUser.isPhoneVerified
                  : verificationMethod === 'both'
                    ? !!updatedUser.isEmailVerified && !!updatedUser.isPhoneVerified
                    : !!updatedUser.isEmailVerified;

          if (!wasOnboardingCompleteBefore && isOnboardingCompleteNow) {
            await this.hookRegistry.executeOnboardingCompleted(updatedUser, {
              verificationMethod,
              source: 'phone_verification',
              completedAt: new Date(),
            });
          }
        }
      } catch (hookError) {
        // Non-blocking: Log but continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(`Failed to execute userProfileUpdated hooks: ${errorMessage}`, {
          error: hookError,
          userId: user.id,
        });
      }
    }

    return { message: 'Phone verified successfully. Please log in to continue.' };
  }

  /**
   * Resend verification SMS
   * Supports both sub and phone-based resend
   *
   * @param dto - Request DTO containing sub or phone
   * @returns Response DTO with verification token ID
   */
  async resendVerificationSMS(dto: ResendVerificationSMSDTO): Promise<ResendVerificationSMSResponseDTO> {
    dto = await ensureValidatedDto(ResendVerificationSMSDTO, dto);
    // Validate that either sub or phone is provided
    if (!dto.sub && !dto.phone) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Either sub or phone must be provided');
    }

    if (dto.sub) {
      return this.resendVerificationSMSBySub(dto.sub);
    }

    return this.resendVerificationSMSForPhone(dto.phone!);
  }

  /**
   * Resend verification SMS by user sub (private helper)
   *
   * @param sub - External user identifier
   * @returns New verification token id
   */
  private async resendVerificationSMSBySub(sub: string): Promise<ResendVerificationSMSResponseDTO> {
    const user = (await this.userRepo.findOne({ where: { sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const resendDelay = this.config.signup?.phoneVerification?.resendDelay ?? 60;
    const lastToken = (await this.verificationTokenRepo.findOne({
      where: { userId: user.id, type: 'phone' },
      order: { createdAt: 'DESC' },
    })) as IVerificationToken | null;
    if (lastToken) {
      const secondsSinceLastSend = (Date.now() - lastToken.createdAt.getTime()) / 1000;
      if (secondsSinceLastSend < resendDelay) {
        const waitSeconds = Math.ceil(resendDelay - secondsSinceLastSend);
        this.logger?.debug?.(`Resend rate limit: sub=${sub}, wait=${waitSeconds}s, delay=${resendDelay}s`);
        throw new NAuthException(
          AuthErrorCode.RATE_LIMIT_RESEND,
          `Please wait ${waitSeconds} seconds before requesting another code`,
          {
            retryAfter: waitSeconds,
            resendDelay,
          },
        );
      }
    }

    this.logger?.debug?.(`Resending SMS verification code: sub=${sub}`);
    // Preserve challengeSessionId from the last token to ensure verification succeeds
    const sendDto = Object.assign(new SendVerificationSMSDTO(), {
      sub,
      challengeSessionId: lastToken?.challengeSessionId ?? undefined,
    });
    const result = await this.sendVerificationSMS(sendDto);
    return { tokenId: result.tokenId };
  }

  /**
   * Resend verification SMS by phone number (private helper)
   *
   * @param phone - Phone number
   * @returns New verification token id
   */
  private async resendVerificationSMSForPhone(phone: string): Promise<ResendVerificationSMSResponseDTO> {
    const user = (await this.userRepo.findOne({ where: { phone } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }
    if (user.isPhoneVerified) {
      throw new NAuthException(AuthErrorCode.ALREADY_VERIFIED, 'Phone number is already verified');
    }
    return this.resendVerificationSMSBySub(user.sub);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Generate N-digit OTP code (default 6)
   */
  private generateCode(): string {
    const codeLength = this.config.signup?.phoneVerification?.codeLength || 6;
    const min = Math.pow(10, codeLength - 1);
    const max = Math.pow(10, codeLength) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * Generate secure random token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash token with SHA-256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Mask phone number for logging (preserves last 4 digits)
   * Respects config.security.maskSensitiveData setting.
   * @private
   */
  private maskPhone(phone: string): string {
    // Check config - default to true (mask by default)
    const shouldMask = this.config?.security?.maskSensitiveData !== false;
    if (!shouldMask) {
      return phone;
    }

    if (!phone || phone.length < 4) return '***';
    return `***${phone.slice(-4)}`;
  }
}
