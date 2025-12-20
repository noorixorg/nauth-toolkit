import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { NAuthConfig, TOTPConfig, NAuthLogger, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';
import { SetupTOTPResponseDTO } from './dto/mfa.dto';

/**
 * TOTP (Time-based One-Time Password) Service
 *
 * Handles authenticator app functionality including:
 * - Secret generation for new TOTP devices
 * - QR code generation for easy setup
 * - TOTP code validation with time window
 * - Compatible with Google Authenticator, Authy, 1Password, etc.
 *
 * Uses industry-standard TOTP (RFC 6238) with configurable parameters.
 *
 * @example
 * ```typescript
 * // Generate TOTP setup
 * const setup = await totpService.generateSecret('user@example.com');
 * // Returns: { secret, qrCode, manualEntryKey, issuer, accountName }
 *
 * // Verify TOTP code
 * const isValid = totpService.verifyCode('base32secret', '123456');
 * // Returns: true if code is valid
 * ```
 */

export class TOTPService {
  private readonly defaultConfig: Required<TOTPConfig> = {
    window: 1,
    stepSeconds: 30,
    digits: 6,
    algorithm: 'sha1',
  };

  constructor(
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
  ) {
    // Configure otplib with settings from config
    this.configureAuthenticator();
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Configure otplib authenticator with config settings
   *
   * Applies TOTP configuration from NAuthConfig or uses defaults.
   * Called during service initialization.
   *
   * @private
   */
  private configureAuthenticator(): void {
    const totpConfig = this.getTOTPConfig();

    authenticator.options = {
      step: totpConfig.stepSeconds,
      window: totpConfig.window,
      digits: totpConfig.digits,
      algorithm: totpConfig.algorithm as any, // Type cast - otplib types don't match our config
    };

    this.logger?.debug?.(
      `TOTP configured: step=${totpConfig.stepSeconds}s, window=${totpConfig.window}, digits=${totpConfig.digits}`,
    );
  }

  /**
   * Get TOTP configuration with defaults
   *
   * @returns Complete TOTP configuration
   * @private
   */
  private getTOTPConfig(): Required<TOTPConfig> {
    return {
      ...this.defaultConfig,
      ...this.config.mfa?.totp,
    };
  }

  /**
   * Get issuer name for TOTP URIs
   *
   * @returns Issuer name from config or default
   * @private
   */
  private getIssuer(): string {
    return this.config.mfa?.issuer || 'nauth-toolkit';
  }

  // ============================================================================
  // Secret Generation
  // ============================================================================

  /**
   * Generate TOTP secret and QR code for user setup
   *
   * Creates a new TOTP secret, generates QR code and manual entry key.
   * User must scan QR code with authenticator app to complete setup.
   *
   * @param accountName - User's email or username (displayed in authenticator app)
   * @returns Setup information including QR code and secret
   * @throws {BadRequestException} If QR code generation fails
   *
   * @example
   * ```typescript
   * const setup = await totpService.generateSecret('user@example.com');
   * // Client displays QR code and manual entry key
   * // User scans QR with Google Authenticator, Authy, etc.
   * ```
   */
  async generateSecret(accountName: string): Promise<SetupTOTPResponseDTO> {
    this.logger?.log?.(`Generating TOTP secret for: ${accountName}`);

    // Generate base32-encoded secret
    const secret = authenticator.generateSecret();

    // Get issuer name
    const issuer = this.getIssuer();

    // Generate otpauth URI for QR code
    const otpauthUrl = authenticator.keyuri(accountName, issuer, secret);

    // Generate QR code as data URL
    let qrCode: string;
    try {
      qrCode = await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      this.logger?.error?.('Failed to generate QR code', error);
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Failed to generate QR code');
    }

    // Format secret for manual entry (groups of 4 characters)
    const manualEntryKey = this.formatSecretForManualEntry(secret);

    this.logger?.log?.(`TOTP secret generated successfully for: ${accountName}`);

    return {
      secret,
      qrCode,
      manualEntryKey,
      issuer,
      accountName,
    };
  }

  /**
   * Format secret for manual entry
   *
   * Converts base32 secret into groups of 4 characters for easy manual input.
   *
   * @param secret - Base32-encoded secret
   * @returns Formatted secret (e.g., 'ABCD EFGH IJKL MNOP')
   * @private
   *
   * @example
   * ```typescript
   * formatSecretForManualEntry('ABCDEFGHIJKLMNOP')
   * // Returns: 'ABCD EFGH IJKL MNOP'
   * ```
   */
  private formatSecretForManualEntry(secret: string): string {
    return secret.match(/.{1,4}/g)?.join(' ') || secret;
  }

  // ============================================================================
  // Code Verification
  // ============================================================================

  /**
   * Verify TOTP code against secret
   *
   * Validates a 6-digit TOTP code using time-based verification.
   * Checks current time step plus configured window (before/after).
   *
   * SECURITY: Uses time window to account for clock drift and user delay.
   * Default window of 1 checks 3 time steps (current, ±1).
   *
   * @param secret - Base32-encoded TOTP secret
   * @param code - 6-digit TOTP code from authenticator app
   * @returns True if code is valid within time window
   *
   * @example
   * ```typescript
   * // User enters code from Google Authenticator
   * const isValid = totpService.verifyCode(user.totpSecret, '123456');
   * if (isValid) {
   *   // Grant access
   * }
   * ```
   */
  verifyCode(secret: string, code: string): boolean {
    try {
      // Remove spaces and validate format
      const cleanCode = code.replace(/\s/g, '');

      if (!/^\d{6}$/.test(cleanCode)) {
        this.logger?.warn?.('Invalid TOTP code format');
        return false;
      }

      // Verify code using otplib
      const isValid = authenticator.verify({
        token: cleanCode,
        secret,
      });

      if (isValid) {
        this.logger?.debug?.('TOTP code verified successfully');
      } else {
        this.logger?.warn?.('TOTP code verification failed');
      }

      return isValid;
    } catch (error) {
      this.logger?.error?.('TOTP verification error', error);
      return false;
    }
  }

  /**
   * Verify TOTP code with additional validation
   *
   * Extended verification that checks code format and provides detailed error messages.
   *
   * @param secret - Base32-encoded TOTP secret
   * @param code - TOTP code to verify
   * @returns Verification result with error message if invalid
   *
   * @example
   * ```typescript
   * const result = totpService.verifyCodeWithDetails(secret, '123456');
   * if (!result.valid) {
   *   throw new BadRequestException(result.error);
   * }
   * ```
   */
  verifyCodeWithDetails(secret: string, code: string): { valid: boolean; error?: string } {
    // Validate code format
    const cleanCode = code.replace(/\s/g, '');

    if (!cleanCode) {
      return { valid: false, error: 'Code is required' };
    }

    if (!/^\d{6}$/.test(cleanCode)) {
      return { valid: false, error: 'Code must be 6 digits' };
    }

    // Verify secret format
    if (!secret || secret.length < 16) {
      return { valid: false, error: 'Invalid secret' };
    }

    // Verify code
    const isValid = this.verifyCode(secret, cleanCode);

    if (!isValid) {
      return { valid: false, error: 'Invalid or expired code' };
    }

    return { valid: true };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate current TOTP code for secret
   *
   * FOR TESTING ONLY - Do not use in production authentication flow.
   * This method generates the current valid code for a secret.
   *
   * @param secret - Base32-encoded TOTP secret
   * @returns Current 6-digit TOTP code
   *
   * @example
   * ```typescript
   * // Testing only
   * const code = totpService.generateCode(secret);
   * // Returns: '123456'
   * ```
   */
  generateCode(secret: string): string {
    return authenticator.generate(secret);
  }

  /**
   * Validate secret format
   *
   * Checks if a secret is valid base32 and has sufficient length.
   *
   * @param secret - Secret to validate
   * @returns True if secret is valid
   *
   * @example
   * ```typescript
   * if (!totpService.isValidSecret(secret)) {
   *   throw new BadRequestException('Invalid TOTP secret');
   * }
   * ```
   */
  isValidSecret(secret: string): boolean {
    if (!secret || typeof secret !== 'string') {
      return false;
    }

    // Check minimum length (16 characters for 80 bits of entropy)
    if (secret.length < 16) {
      return false;
    }

    // Check if valid base32 (A-Z, 2-7, no padding for otplib)
    if (!/^[A-Z2-7]+$/.test(secret)) {
      return false;
    }

    return true;
  }

  /**
   * Get time remaining until next code
   *
   * Returns seconds until the current TOTP code expires.
   * Useful for UI countdowns.
   *
   * @returns Seconds remaining (0-30 for default 30s step)
   *
   * @example
   * ```typescript
   * const remaining = totpService.getTimeRemaining();
   * // Returns: 15 (seconds until code changes)
   * ```
   */
  getTimeRemaining(): number {
    const totpConfig = this.getTOTPConfig();
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now % totpConfig.stepSeconds;
    return totpConfig.stepSeconds - elapsed;
  }
}
