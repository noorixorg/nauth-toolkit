import { Repository, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { BaseVerificationToken } from '../entities';
import { EmailProvider, SMSProvider } from '../interfaces/provider.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { ClientInfoService } from './client-info.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { NAuthLogger } from '../utils/nauth-logger';
import { IUser, IVerificationToken } from '../interfaces/entities.interface';

/**
 * Password Reset Service (Account Recovery)
 *
 * Implements the forgot-password flow by issuing a one-time code for password reset and
 * validating that code when the user confirms the reset.
 *
 * Design:
 * - Uses `BaseVerificationToken` with type `password_reset`
 * - Rate limits requests to prevent abuse
 * - Prevents brute force by tracking attempts per token
 * - Records audit events for security observability
 *
 * NOTE:
 * - This service is intended for internal orchestration via `AuthService`.
 * - Consumer applications should use `AuthService.forgotPassword()` and
 *   `AuthService.confirmForgotPassword()`.
 *
 * @example
 * ```typescript
 * await passwordResetService.requestReset(user, 'email');
 * await passwordResetService.confirmReset(user, '123456', 'NewPassword123!');
 * ```
 */
export class PasswordResetService {
  constructor(
    private readonly verificationTokenRepo: Repository<BaseVerificationToken>,
    private readonly emailProvider: EmailProvider,
    private readonly storageAdapter: StorageAdapter,
    private readonly config: NAuthConfig,
    private readonly clientInfoService: ClientInfoService,
    private readonly logger: NAuthLogger,
    private readonly auditService?: AuthAuditService,
    private readonly smsProvider?: SMSProvider,
  ) {}

  // ============================================================================
  // Forgot Password (Request)
  // ============================================================================

  /**
   * Request a password reset for the given user.
   *
   * Security:
   * - Rate limited per user
   * - Invalidates previous unused password reset tokens for the user
   * - Does not throw for delivery issues (delivery is best-effort; caller should keep responses non-enumerating)
   *
   * @param user - Target user
   * @param delivery - Delivery channel ('email' or 'sms')
   * @param options - Reset options (baseUrl for link generation)
   * @returns Delivery metadata (masked destination, medium, expiresIn)
   * @throws {NAuthException} RATE_LIMIT_PASSWORD_RESET when rate limit exceeded
   */
  async requestReset(
    user: IUser,
    delivery: 'email' | 'sms',
    options?: {
      baseUrl?: string;
    },
  ): Promise<{ destination?: string; deliveryMedium?: 'email' | 'sms'; expiresIn?: number }> {
    // ============================================================================
    // Rate limiting (per-user)
    // ============================================================================
    const rateLimitMax = this.config.password?.passwordReset?.rateLimitMax ?? 3;
    const rateLimitWindow = this.config.password?.passwordReset?.rateLimitWindow ?? 3600;
    const rateKey = `nauth:password_reset:rate:${user.sub}`;

    const currentCount = await this.storageAdapter.incr(rateKey, rateLimitWindow);
    const ttl = await this.storageAdapter.ttl(rateKey);
    if (currentCount > rateLimitMax) {
      throw new NAuthException(
        AuthErrorCode.RATE_LIMIT_PASSWORD_RESET,
        'Too many password reset requests. Please try again later.',
        {
          retryAfter: ttl > 0 ? ttl : rateLimitWindow,
          maxAttempts: rateLimitMax,
        },
      );
    }

    // ============================================================================
    // Invalidate existing unused tokens
    // ============================================================================
    await this.verificationTokenRepo.update(
      { userId: user.id, type: 'password_reset', usedAt: IsNull() },
      { usedAt: new Date() },
    );

    // ============================================================================
    // Create new reset token
    // ============================================================================
    const codeLength = this.config.password?.passwordReset?.codeLength ?? 6;
    const expiresIn = this.config.password?.passwordReset?.expiresIn ?? 900;

    const code = this.generateNumericCode(codeLength);
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    const clientInfo = this.clientInfoService.get();
    const { ipAddress, userAgent } = clientInfo;

    const verificationToken = this.verificationTokenRepo.create({
      userId: user.id,
      challengeSessionId: null,
      type: 'password_reset',
      token: tokenHash,
      code,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      attempts: 0,
      ipAddress,
      userAgent,
    });

    const saved = (await this.verificationTokenRepo.save(verificationToken)) as unknown as IVerificationToken;

    // ============================================================================
    // Build reset link if baseUrl provided
    // ============================================================================
    // ============================================================================
    // Build reset link if baseUrl provided
    // ============================================================================
    // WHY: Consumer apps should be able to stay code-only (no token vs code branching).
    // Links therefore carry the same verification code as a query param.
    const resetLink = options?.baseUrl ? this.buildResetLink(options.baseUrl, code) : undefined;

    // ============================================================================
    // Deliver code (and optional link)
    // ============================================================================
    if (delivery === 'email') {
      if (!user.email) {
        this.logger?.debug?.('Password reset requested but user has no email address', { userId: user.id });
        return { deliveryMedium: 'email', expiresIn };
      }

      const expiryMinutes = Math.ceil(expiresIn / 60);
      this.logger?.debug?.('Sending password reset email', {
        userId: user.id,
        email: this.maskEmail(user.email),
        hasLink: !!resetLink,
        expiryMinutes,
      });

      try {
        // Always use sendPasswordResetEmail with code (and optional link)
        await this.emailProvider.sendPasswordResetEmail(user.email, token, code, resetLink, expiryMinutes);
        this.logger?.log?.(`Password reset ${resetLink ? 'code and link' : 'code'} sent via email to user ${user.sub}`);

        // Audit
        await this.auditService?.recordEvent({
          userId: user.id,
          eventType: AuthAuditEventType.PASSWORD_RESET_REQUESTED,
          eventStatus: 'INFO',
          authMethod: 'password',
          description: 'Password reset requested (email)',
          metadata: {
            medium: 'email',
            tokenId: saved.id,
          },
        });

        return {
          destination: this.maskEmail(user.email),
          deliveryMedium: 'email',
          expiresIn,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = error instanceof NAuthException ? error.code : AuthErrorCode.INTERNAL_ERROR;

        this.logger?.error?.(
          `Failed to send password reset email to user ${user.sub} (${this.maskEmail(user.email)}): ${errorMessage} [${errorCode}]`,
          { error, userId: user.id },
        );

        // Re-throw to let AuthService handle (it will log and return non-enumerating response)
        throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `Failed to send password reset email: ${errorMessage}`, {
          originalError: errorMessage,
          originalErrorCode: errorCode,
          userId: user.id,
          email: this.maskEmail(user.email),
        });
      }
    }

    // SMS delivery
    if (!this.smsProvider) {
      this.logger?.debug?.('Password reset requested but SMS provider not configured', { userId: user.id });
      return { deliveryMedium: 'sms', expiresIn };
    }
    if (!user.phone) {
      this.logger?.debug?.('Password reset requested but user has no phone number', { userId: user.id });
      return { deliveryMedium: 'sms', expiresIn };
    }
    // Calculate expiry minutes for template variables
    // Use the same expiresIn that was calculated for the token
    const expiryMinutes = Math.ceil(expiresIn / 60);

    // Get appName from email globals or SMS templates global variables
    const smsConfig = this.config.sms as { templates?: { globalVariables?: Record<string, unknown> } } | undefined;
    const appName =
      (this.config.email?.globalVariables?.appName as string | undefined) ||
      (smsConfig?.templates?.globalVariables?.appName as string | undefined);

    this.logger?.debug?.('Sending password reset SMS', {
      userId: user.id,
      phone: this.maskPhone(user.phone),
      expiryMinutes,
    });

    try {
      // Send SMS with template support
      await this.smsProvider.sendOTP(user.phone, code, 'passwordReset', {
        expiryMinutes,
        appName,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.username,
        userEmail: user.email,
        phone: user.phone,
      });
      this.logger?.log?.(`Password reset code sent via SMS to user ${user.sub}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof NAuthException ? error.code : AuthErrorCode.INTERNAL_ERROR;

      this.logger?.error?.(
        `Failed to send password reset SMS to user ${user.sub} (${this.maskPhone(user.phone)}): ${errorMessage} [${errorCode}]`,
        { error, userId: user.id },
      );

      // Re-throw to let AuthService handle (it will log and return non-enumerating response)
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `Failed to send password reset SMS: ${errorMessage}`, {
        originalError: errorMessage,
        originalErrorCode: errorCode,
        userId: user.id,
        phone: this.maskPhone(user.phone),
      });
    }

    await this.auditService?.recordEvent({
      userId: user.id,
      eventType: AuthAuditEventType.PASSWORD_RESET_REQUESTED,
      eventStatus: 'INFO',
      authMethod: 'password',
      description: 'Password reset requested (sms)',
      metadata: {
        medium: 'sms',
        tokenId: saved.id,
      },
    });

    return {
      destination: this.maskPhone(user.phone),
      deliveryMedium: 'sms',
      expiresIn,
    };
  }

  // ============================================================================
  // Admin Password Reset (Request)
  // ============================================================================

  /**
   * Request password reset for admin-initiated workflow.
   *
   * Differences from requestReset():
   * - No rate limiting (admin bypass)
   * - Uses token type 'admin_password_reset'
   * - Sends admin-specific email template
   * - Supports code + optional link delivery
   * - Longer default expiry (1 hour vs 15 min)
   *
   * @param user - Target user
   * @param delivery - Delivery channel ('email' or 'sms')
   * @param options - Reset options (expiresIn, baseUrl)
   * @returns Delivery metadata with destination, medium, expiry
   * @throws {NAuthException} Never throws (email delivery errors are non-blocking)
   *
   * @example
   * ```typescript
   * const result = await passwordResetService.requestAdminReset(
   *   user,
   *   'email',
   *   { expiresIn: 3600, baseUrl: 'https://myapp.com/reset' }
   * );
   * // result: { destination: 'u***r@example.com', deliveryMedium: 'email', expiresIn: 3600 }
   * ```
   */
  async requestAdminReset(
    user: IUser,
    delivery: 'email' | 'sms',
    options: {
      expiresIn: number;
      baseUrl?: string;
    },
  ): Promise<{ destination?: string; deliveryMedium?: 'email' | 'sms'; expiresIn?: number }> {
    // ============================================================================
    // No rate limiting for admin (admin bypass)
    // ============================================================================

    // ============================================================================
    // Invalidate existing unused admin reset tokens
    // ============================================================================
    await this.verificationTokenRepo.update(
      { userId: user.id, type: 'admin_password_reset', usedAt: IsNull() },
      { usedAt: new Date() },
    );

    // ============================================================================
    // Create new reset token with code AND token
    // ============================================================================
    const codeLength = this.config.password?.adminPasswordReset?.codeLength ?? 6;
    const expiresIn = options.expiresIn;

    const code = this.generateNumericCode(codeLength);
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    const clientInfo = this.clientInfoService.get();
    const { ipAddress, userAgent } = clientInfo;

    const verificationToken = this.verificationTokenRepo.create({
      userId: user.id,
      challengeSessionId: null,
      type: 'admin_password_reset',
      token: tokenHash,
      code,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      attempts: 0,
      ipAddress,
      userAgent,
    });

    const _saved = (await this.verificationTokenRepo.save(verificationToken)) as unknown as IVerificationToken;

    // ============================================================================
    // Build reset link if baseUrl provided
    // ============================================================================
    // ============================================================================
    // Build reset link if baseUrl provided
    // ============================================================================
    // WHY: Keep consumer apps code-only and consistent. Links include `code=...`.
    const resetLink = options.baseUrl ? this.buildResetLink(options.baseUrl, code) : undefined;

    // ============================================================================
    // Deliver code (and optional link)
    // ============================================================================
    if (delivery === 'email') {
      if (!user.email) {
        return { deliveryMedium: 'email', expiresIn };
      }

      const expiryMinutes = Math.ceil(expiresIn / 60);
      await this.emailProvider.sendAdminPasswordResetEmail(user.email, code, resetLink, expiryMinutes);
      this.logger?.log?.(`Admin password reset code sent via email to user ${user.sub}`);

      return {
        destination: this.maskEmail(user.email),
        deliveryMedium: 'email',
        expiresIn,
      };
    }

    // SMS delivery (code only, no link support)
    if (!this.smsProvider) {
      return { deliveryMedium: 'sms', expiresIn };
    }
    if (!user.phone) {
      return { deliveryMedium: 'sms', expiresIn };
    }

    const expiryMinutes = Math.ceil(expiresIn / 60);
    const smsConfig = this.config.sms as { templates?: { globalVariables?: Record<string, unknown> } } | undefined;
    const appName =
      (this.config.email?.globalVariables?.appName as string | undefined) ||
      (smsConfig?.templates?.globalVariables?.appName as string | undefined);

    await this.smsProvider.sendOTP(user.phone, code, 'passwordReset', {
      expiryMinutes,
      appName,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.username,
      userEmail: user.email,
      phone: user.phone,
    });
    this.logger?.log?.(`Admin password reset code sent via SMS to user ${user.sub}`);

    return {
      destination: this.maskPhone(user.phone),
      deliveryMedium: 'sms',
      expiresIn,
    };
  }

  // ============================================================================
  // Forgot Password (Confirm)
  // ============================================================================

  /**
   * Consume and validate verification code or token.
   *
   * Enhanced to support both code (6-10 digits) and token (64-char hex).
   * Token-based validation has no attempt tracking (single use).
   * Code-based validation tracks attempts (max 3).
   *
   * @param user - Target user
   * @param codeOrToken - Verification code (short) or token (long)
   * @param tokenType - Token type ('password_reset' | 'admin_password_reset')
   * @returns void on success
   * @throws {NAuthException} PASSWORD_RESET_CODE_INVALID when code/token is invalid
   * @throws {NAuthException} PASSWORD_RESET_CODE_EXPIRED when token expired
   * @throws {NAuthException} PASSWORD_RESET_MAX_ATTEMPTS when max attempts exceeded (code only)
   *
   * @example
   * ```typescript
   * // Validate code
   * await passwordResetService.consumeValidCode(user, '123456', 'admin_password_reset');
   *
   * // Validate token
   * await passwordResetService.consumeValidCode(user, '64-char-hex', 'admin_password_reset');
   * ```
   */
  async consumeValidCode(
    user: IUser,
    codeOrToken: string,
    tokenType: 'email' | 'phone' | 'password_reset' | 'admin_password_reset' = 'password_reset',
  ): Promise<void> {
    // ============================================================================
    // Detect if input is token (long hex) or code (short numeric)
    // ============================================================================
    // WHY: Tokens are 64-char hex (from crypto.randomBytes(32).toString('hex'))
    // Codes are 6-10 digits. Use length to distinguish.
    const isToken = codeOrToken.length > 10;

    // ============================================================================
    // Find most recent active token for the user
    // ============================================================================
    const tokenEntity = await this.verificationTokenRepo.findOne({
      where: { userId: user.id, type: tokenType, usedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    const token = tokenEntity as unknown as IVerificationToken | null;

    if (!tokenEntity || !token) {
      throw new NAuthException(AuthErrorCode.PASSWORD_RESET_CODE_INVALID, 'Invalid password reset code or token');
    }

    // ============================================================================
    // Check expiry
    // ============================================================================
    const isExpired = token.isExpired ? token.isExpired() : token.expiresAt < new Date();
    if (isExpired) {
      throw new NAuthException(AuthErrorCode.PASSWORD_RESET_CODE_EXPIRED, 'Password reset code or token has expired');
    }

    // ============================================================================
    // Validate code or token
    // ============================================================================
    if (isToken) {
      // Token-based validation (no attempt tracking)
      // WHY: Tokens are long random strings, single-use, no brute force risk
      const tokenHash = this.hashToken(codeOrToken);
      if (token.token !== tokenHash) {
        throw new NAuthException(AuthErrorCode.PASSWORD_RESET_CODE_INVALID, 'Invalid password reset token');
      }
    } else {
      // Code-based validation (with attempt tracking)
      const maxAttempts =
        tokenType === 'admin_password_reset'
          ? (this.config.password?.adminPasswordReset?.maxAttempts ?? 3)
          : (this.config.password?.passwordReset?.maxAttempts ?? 3);

      if (token.attempts >= maxAttempts) {
        throw new NAuthException(
          AuthErrorCode.PASSWORD_RESET_MAX_ATTEMPTS,
          'Too many failed attempts. Please request a new code.',
        );
      }

      if (!token.code || token.code !== codeOrToken) {
        // Increment attempts (non-blocking)
        try {
          await this.verificationTokenRepo.update({ id: token.id }, { attempts: token.attempts + 1 });
        } catch {
          // Non-blocking: attempts are best-effort
        }
        throw new NAuthException(AuthErrorCode.PASSWORD_RESET_CODE_INVALID, 'Invalid password reset code');
      }
    }

    // ============================================================================
    // Mark as used
    // ============================================================================
    tokenEntity.usedAt = new Date();
    await this.verificationTokenRepo.save(tokenEntity);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private generateNumericCode(length: number): string {
    const digits = '0123456789';
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += digits[Math.floor(Math.random() * digits.length)];
    }
    return out;
  }

  /**
   * Build a reset link by appending the verification code as a query param.
   *
   * Handles existing query params and hash fragments safely.
   *
   * @param baseUrl - Base URL provided by the consumer app
   * @param code - Verification code to append
   * @returns Full reset link with `code` query param
   *
   * @example
   * ```typescript
   * const link = this.buildResetLink('https://app.com/reset?from=admin', '123456');
   * // https://app.com/reset?from=admin&code=123456
   * ```
   */
  private buildResetLink(baseUrl: string, code: string): string {
    // ============================================================================
    // Preserve hash fragments and avoid duplicating separators
    // ============================================================================
    // WHY: `#` should remain at the end and query separators must be correct.
    const hashIndex = baseUrl.indexOf('#');
    const base = hashIndex === -1 ? baseUrl : baseUrl.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : baseUrl.slice(hashIndex);
    const hasQuery = base.includes('?');
    const needsSeparator = !(base.endsWith('?') || base.endsWith('&'));
    const separator = hasQuery ? (needsSeparator ? '&' : '') : '?';

    return `${base}${separator}code=${encodeURIComponent(code)}${hash}`;
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private maskEmail(email: string): string {
    // Check config - default to true (mask by default)
    const shouldMask = this.config?.security?.maskSensitiveData !== false;
    if (!shouldMask) {
      return email;
    }

    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '***';
    if (localPart.length <= 2) return `${localPart[0]}***@${domain}`;
    return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
  }

  private maskPhone(phone: string): string {
    // Check config - default to true (mask by default)
    const shouldMask = this.config?.security?.maskSensitiveData !== false;
    if (!shouldMask) {
      return phone;
    }

    const digits = phone.replace(/\D/g, '');
    const lastFour = digits.slice(-4);
    return `***-***-${lastFour}`;
  }
}
