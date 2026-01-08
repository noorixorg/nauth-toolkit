import { Repository, IsNull } from 'typeorm';
import { IUser, IVerificationToken } from '../interfaces/entities.interface';
import { BaseVerificationToken, BaseUser } from '../entities';
import { EmailProvider } from '../interfaces/provider.interface';
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
  SendVerificationEmailDTO,
  SendVerificationEmailResponseDTO,
  VerifyEmailWithCodeDTO,
  VerifyEmailWithTokenDTO,
  ResendVerificationEmailDTO,
  ResendVerificationEmailResponseDTO,
  VerifyEmailResponseDTO,
} from '../dto/verify-email.dto';
import * as crypto from 'crypto';
import { ensureValidatedDto } from '../utils/dto-validator';

/**
 * Email Verification Service
 *
 * Handles email verification workflow:
 * - Generate verification codes
 * - Send verification emails
 * - Verify codes with token generation
 * - Resend with rate limiting
 *
 * Supports both code-based (6-digit OTP) and link-based verification.
 */
export class EmailVerificationService {
  constructor(
    private readonly verificationTokenRepo: Repository<BaseVerificationToken>,
    private readonly userRepo: Repository<BaseUser>,
    private readonly emailProvider: EmailProvider,
    private readonly storageAdapter: StorageAdapter,
    private readonly config: NAuthConfig,
    private readonly clientInfoService: ClientInfoService,
    private readonly logger: NAuthLogger,
    private readonly hookRegistry: HookRegistryService,
    private readonly auditService?: AuthAuditService, // Optional - audit trail service (enabled via config.auditLogs.enabled)
  ) {}

  /**
   * Send verification email to user
   * Generates a new verification code and sends it via email
   *
   * @param dto - Request DTO containing sub, baseUrl, and skipAlreadyVerifiedCheck
   * @returns Response DTO with verification token ID
   */
  async sendVerificationEmail(dto: SendVerificationEmailDTO): Promise<SendVerificationEmailResponseDTO> {
    dto = await ensureValidatedDto(SendVerificationEmailDTO, dto);
    const { sub, baseUrl, skipAlreadyVerifiedCheck = false, challengeSessionId } = dto;
    // Get rate limit configuration from config (moved to signup.emailVerification)
    const rateLimitMax = this.config.signup?.emailVerification?.rateLimitMax || 3;
    const rateLimitWindow = this.config.signup?.emailVerification?.rateLimitWindow || 3600; // 1 hour in seconds

    // Check rate limit - use sub for rate limiting
    const rateLimitKey = `email-verification:${sub}`;

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
        `Rate limit window reset for email verification: sub=${sub}, window=${rateLimitWindow}s, max=${rateLimitMax}`,
      );
    }

    // Get actual TTL after setting expiry (for error message)
    const actualTtl = await this.storageAdapter.ttl(rateLimitKey);

    if (currentCount > rateLimitMax) {
      throw new NAuthException(
        AuthErrorCode.RATE_LIMIT_EMAIL,
        'Too many verification emails sent. Please try again later.',
        {
          retryAfter: actualTtl > 0 ? actualTtl : rateLimitWindow,
          currentCount,
          maxAttempts: rateLimitMax,
        },
      );
    }

    // Check if user already has a pending verification token
    const user = (await this.userRepo.findOne({ where: { sub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Check resend delay to prevent abuse
    const resendDelay = this.config.signup?.emailVerification?.resendDelay ?? 60; // 1 minute default
    const lastToken = (await this.verificationTokenRepo.findOne({
      where: { userId: user.id, type: 'email' },
      order: { createdAt: 'DESC' },
    })) as IVerificationToken | null;

    if (lastToken) {
      const secondsSinceLastSend = (Date.now() - lastToken.createdAt.getTime()) / 1000;
      if (secondsSinceLastSend < resendDelay) {
        const waitSeconds = Math.ceil(resendDelay - secondsSinceLastSend);
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

    // Only check "already verified" if not skipping (skip for MFA contexts where codes are needed even if email is verified)
    if (!skipAlreadyVerifiedCheck && user.isEmailVerified) {
      throw new NAuthException(AuthErrorCode.ALREADY_VERIFIED, 'Email already verified');
    }

    // Invalidate existing tokens - use internal id for database query
    await this.verificationTokenRepo.update(
      {
        userId: user.id, // Use internal id for foreign key query
        type: 'email',
        usedAt: IsNull(), // Only invalidate unused tokens
      },
      {
        usedAt: new Date(), // Mark as used to invalidate
      },
    );

    // Generate verification code (6 digits)
    const code = this.generateCode();

    // Generate verification token (for link-based verification)
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    // Create verification token - use internal id for foreign key
    // Get client info internally
    const clientInfo = this.clientInfoService.get();
    const ipAddress = clientInfo.ipAddress;
    const userAgent = clientInfo.userAgent;

    const verificationToken = this.verificationTokenRepo.create({
      userId: user.id, // Use internal id for foreign key
      challengeSessionId: challengeSessionId ?? null, // Link to challenge session if provided
      type: 'email',
      token: tokenHash,
      code,
      expiresAt: new Date(Date.now() + (this.config.signup?.emailVerification?.expiresIn || 3600) * 1000), // Default: 1 hour
      attempts: 0,
      ipAddress,
      userAgent,
    });

    await this.verificationTokenRepo.save(verificationToken);

    // Generate verification link only if baseUrl is provided
    // Consumer apps can build their own verification links if needed
    const verificationLink = baseUrl ? `${baseUrl}/verify-email?token=${token}` : undefined;

    // Send email (link is optional - only sent if provided)
    await this.emailProvider.sendVerificationEmail(user.email, code, verificationLink);

    // ============================================================================
    // Audit: Record email verification request
    // ============================================================================
    try {
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.EMAIL_VERIFICATION_REQUESTED,
        eventStatus: 'INFO',
        metadata: {
          verificationTokenId: (verificationToken as unknown as IVerificationToken).id,
        },
        // Client info automatically included from context
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record EMAIL_VERIFICATION_REQUESTED audit event: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
      });
    }

    return { tokenId: (verificationToken as unknown as IVerificationToken).id };
  }

  /**
   * Verify email with code (6-digit OTP)
   * Marks email as verified and activates user account
   *
   * @param dto - Request DTO containing email and code
   * @returns Response DTO with success message
   */
  async verifyEmailWithCode(dto: VerifyEmailWithCodeDTO): Promise<VerifyEmailResponseDTO> {
    dto = await ensureValidatedDto(VerifyEmailWithCodeDTO, dto);
    const { email, code, challengeSessionId } = dto;
    // ============================================================================
    // Security: Rate limit configuration
    // IP-based rate limiting applies only to INVALID attempts to prevent brute force
    // Valid codes should not be blocked by IP rate limits
    // ============================================================================
    const maxAttemptsPerIP = this.config.signup?.emailVerification?.maxAttemptsPerIP ?? 20;
    const attemptWindow = this.config.signup?.emailVerification?.attemptWindow ?? 3600; // 1 hour
    const clientInfo = this.clientInfoService.get();

    // Find user by email
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Find active verification token
    // If challengeSessionId is provided, ensure token belongs to that specific session
    // This prevents old tokens from being used with new challenge sessions
    const whereClause = {
      userId: user.id,
      type: 'email' as const,
      code,
      usedAt: IsNull(),
      ...(challengeSessionId !== undefined && { challengeSessionId }), // Include if provided
    };

    const verificationToken = (await this.verificationTokenRepo.findOne({
      where: whereClause,
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
      // Invalid attempt - increment IP rate limit
      await incrementIPRateLimit();
      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid or expired verification code');
    }

    // Check expiry
    const isExpired = verificationToken.isExpired
      ? verificationToken.isExpired()
      : verificationToken.expiresAt < new Date();
    if (isExpired) {
      // Expired token - increment IP rate limit
      await incrementIPRateLimit();
      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_EXPIRED, 'Verification code has expired');
    }

    // Check max attempts (configurable, default 3)
    const maxAttempts = this.config.signup?.emailVerification?.maxAttempts ?? 3;
    const maxAttemptsExceeded = verificationToken.maxAttemptsExceeded
      ? verificationToken.maxAttemptsExceeded(maxAttempts)
      : verificationToken.attempts >= maxAttempts;
    if (maxAttemptsExceeded) {
      // Token exceeded max attempts - increment IP rate limit
      await incrementIPRateLimit();
      throw new NAuthException(
        AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS,
        'Too many failed attempts. Request a new code.',
      );
    }

    // ============================================================================
    // Security: Rate limit verification attempts per user (for invalid attempts only)
    // This prevents users from exhausting their own tokens through repeated attempts
    // Valid codes should not be blocked by user rate limits
    // ============================================================================
    const maxAttemptsPerUser = this.config.signup?.emailVerification?.maxAttemptsPerUser ?? 10;

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

    // Increment attempts (even on success to prevent reuse)
    verificationToken.attempts += 1;

    // Invalid code - increment attempts and return false
    if (verificationToken.code !== code) {
      // Invalid code - increment both IP and user rate limits
      await incrementIPRateLimit();
      await incrementUserRateLimit();

      await this.verificationTokenRepo.save(verificationToken);

      // ============================================================================
      // Audit: Record email verification failure
      // ============================================================================
      try {
        await this.auditService?.recordEvent({
          userId: user.id as number,
          eventType: AuthAuditEventType.EMAIL_VERIFICATION_FAILED,
          eventStatus: 'FAILURE',
          reason: 'invalid_code',
          description: 'Invalid verification code provided',
          // Client info automatically included from context
          metadata: {
            verificationTokenId: (verificationToken as IVerificationToken).id,
            attempts: verificationToken.attempts,
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record EMAIL_VERIFICATION_FAILED audit event: ${errorMessage}`, {
          error: auditError,
          userId: user.id,
        });
      }

      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid verification code');
    }

    // ============================================================================
    // Code is valid - proceed without rate limit checks
    // Valid codes should always be allowed through
    // ============================================================================

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

    // Mark token as used
    verificationToken.usedAt = new Date();
    await this.verificationTokenRepo.save(verificationToken);

    // Update user - use internal id for database update
    await this.userRepo.update(user.id, {
      isEmailVerified: true,
      // Auto-activate if not already active
      isActive: true,
    });

    // ============================================================================
    // Audit: Record email verification success
    // ============================================================================
    try {
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.EMAIL_VERIFIED,
        eventStatus: 'SUCCESS',
        metadata: {
          verificationTokenId: (verificationToken as IVerificationToken).id,
          verificationMethod: 'code',
          // Client info automatically included from context
        },
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record EMAIL_VERIFIED audit event: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
      });
    }

    // ============================================================================
    // Hook: Execute user profile updated hooks
    // ============================================================================
    try {
      // Refetch user to get complete updated state
      const updatedUser = (await this.userRepo.findOne({ where: { id: user.id } })) as IUser | null;
      if (updatedUser) {
        // Get client info from ClientInfoService
        const clientInfo = this.clientInfoService.get();

        // Execute hooks (non-blocking)
        await this.hookRegistry.executeUserProfileUpdated({
          user: updatedUser,
          changedFields: [
            {
              fieldName: 'isEmailVerified',
              oldValue: false,
              newValue: true,
            },
          ],
          updateSource: 'email_verification',
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
            source: 'email_verification',
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

    // TODO: maybe refactor to return user save user query in parent function
    return {
      message: 'Email verified successfully. Please log in to continue.',
    };
  }

  /**
   * Verify email with link token
   * Marks email as verified and activates user account
   *
   * @param dto - Request DTO containing token
   * @returns Response DTO with success message
   */
  async verifyEmailWithToken(dto: VerifyEmailWithTokenDTO): Promise<VerifyEmailResponseDTO> {
    dto = await ensureValidatedDto(VerifyEmailWithTokenDTO, dto);
    const { token } = dto;
    const tokenHash = this.hashToken(token);

    // Find verification token
    const verificationToken = (await this.verificationTokenRepo.findOne({
      where: {
        token: tokenHash,
        type: 'email',
        usedAt: IsNull(),
      },
    })) as IVerificationToken | null;

    if (!verificationToken) {
      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid or expired verification link');
    }

    // Check expiry
    const isExpired = verificationToken.isExpired
      ? verificationToken.isExpired()
      : verificationToken.expiresAt < new Date();
    if (isExpired) {
      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_EXPIRED, 'Verification link has expired');
    }

    // Mark token as used
    verificationToken.usedAt = new Date();
    await this.verificationTokenRepo.save(verificationToken);

    // Get user for audit logging
    const user = (await this.userRepo.findOne({
      where: { id: verificationToken.userId },
    })) as IUser | null;

    const verificationMethod = this.config.signup?.verificationMethod ?? 'email';
    const wasOnboardingCompleteBefore = !user
      ? false
      : verificationMethod === 'none'
        ? true
        : verificationMethod === 'email'
          ? !!user.isEmailVerified
          : verificationMethod === 'phone'
            ? !!user.isPhoneVerified
            : verificationMethod === 'both'
              ? !!user.isEmailVerified && !!user.isPhoneVerified
              : !!user.isEmailVerified;

    // Update user
    await this.userRepo.update(verificationToken.userId, {
      isEmailVerified: true,
      // Auto-activate if not already active
      isActive: true,
    });

    // ============================================================================
    // Audit: Record email verification success (token-based)
    // ============================================================================
    if (user) {
      try {
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.EMAIL_VERIFIED,
          eventStatus: 'SUCCESS',
          metadata: {
            verificationTokenId: (verificationToken as IVerificationToken).id,
            verificationMethod: 'token',
            // Client info automatically included from context
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record EMAIL_VERIFIED audit event (token-based): ${errorMessage}`, {
          error: auditError,
          userId: user?.id,
        });
      }

      // ============================================================================
      // Hook: Execute user profile updated hooks
      // ============================================================================
      try {
        // Refetch user to get complete updated state
        const updatedUser = (await this.userRepo.findOne({ where: { id: user.id } })) as IUser | null;
        if (updatedUser) {
          // Get client info from ClientInfoService
          const clientInfo = this.clientInfoService.get();

          // Execute hooks (non-blocking)
          await this.hookRegistry.executeUserProfileUpdated({
            user: updatedUser,
            changedFields: [
              {
                fieldName: 'isEmailVerified',
                oldValue: false,
                newValue: true,
              },
            ],
            updateSource: 'email_verification',
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
              source: 'email_verification',
              completedAt: new Date(),
            });
          }
        }
      } catch (hookError) {
        // Non-blocking: Log but continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(`Failed to execute userProfileUpdated hooks: ${errorMessage}`, {
          error: hookError,
          userId: user?.id,
        });
      }
    }

    return {
      message: 'Email verified successfully. Please log in to continue.',
    };
  }

  /**
   * Resend verification email
   * Supports both sub and email-based resend
   *
   * @param dto - Request DTO containing sub or email, and optional baseUrl
   * @returns Response DTO with verification token ID
   */
  async resendVerificationEmail(dto: ResendVerificationEmailDTO): Promise<ResendVerificationEmailResponseDTO> {
    dto = await ensureValidatedDto(ResendVerificationEmailDTO, dto);
    // Validate that either sub or email is provided
    if (!dto.sub && !dto.email) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Either sub or email must be provided');
    }

    if (dto.sub) {
      return this.resendVerificationEmailBySub(dto.sub, dto.baseUrl, dto.challengeSessionId);
    }

    return this.resendVerificationEmailByEmail(dto.email!, dto.baseUrl, dto.challengeSessionId);
  }

  private async resendVerificationEmailBySub(
    sub: string,
    baseUrl?: string,
    challengeSessionId?: number,
  ): Promise<ResendVerificationEmailResponseDTO> {
    // Get user by sub to get internal id
    const user = await this.userRepo.findOne({ where: { sub } });
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    // Check resend delay - use config value (default 60 seconds)
    const resendDelay = this.config.signup?.emailVerification?.resendDelay ?? 60;
    const lastToken = (await this.verificationTokenRepo.findOne({
      where: { userId: user.id, type: 'email' },
      order: { createdAt: 'DESC' },
    })) as IVerificationToken | null;

    if (lastToken) {
      const secondsSinceLastSend = (Date.now() - lastToken.createdAt.getTime()) / 1000;
      if (secondsSinceLastSend < resendDelay) {
        const waitSeconds = Math.ceil(resendDelay - secondsSinceLastSend);
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

    // Send new verification email - use sub (external identifier)
    // Use provided challengeSessionId if available, otherwise preserve from last token
    const dto = Object.assign(new SendVerificationEmailDTO(), {
      sub,
      baseUrl,
      challengeSessionId: challengeSessionId ?? lastToken?.challengeSessionId ?? undefined,
    });
    return this.sendVerificationEmail(dto);
  }

  private async resendVerificationEmailByEmail(
    email: string,
    baseUrl?: string,
    challengeSessionId?: number,
  ): Promise<ResendVerificationEmailResponseDTO> {
    const user = (await this.userRepo.findOne({ where: { email } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    return this.resendVerificationEmailBySub(user.sub, baseUrl, challengeSessionId);
  }

  /**
   * Generate 6-digit verification code
   * @returns 6-digit numeric code
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate secure random token
   * @returns Random token (32 bytes, hex encoded)
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash token with SHA-256
   * @param token - Plain token
   * @returns Hashed token
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
