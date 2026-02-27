import * as argon2 from 'argon2';
import { PasswordConfig } from '../interfaces/config.interface';
import { loadCommonPasswords } from '../utils/common-passwords';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * Validation result for password policy checks
 */
export interface PasswordValidationResult {
  /** Whether the password passes all validation rules */
  valid: boolean;

  /** List of validation errors if any */
  errors: string[];
}

/**
 * Default password hashing configuration
 * Based on OWASP recommendations for 2025
 */
const DEFAULT_ARGON2_CONFIG = {
  type: argon2.argon2id, // Hybrid mode (best security)
  memoryCost: 65536, // 64 MB memory usage
  timeCost: 3, // 3 iterations
  parallelism: 2, // 2 parallel threads
  hashLength: 32, // 256-bit hash output
} as const;

/**
 * Password Service
 *
 * Handles all password-related operations including:
 * - Hashing passwords with Argon2id
 * - Verifying passwords against hashes
 * - Validating password policy compliance
 * - Checking password history to prevent reuse
 *
 * Security Features:
 * - Argon2id hashing (winner of Password Hashing Competition)
 * - Configurable password policy
 * - Common password detection (10,000+ passwords loaded from file)
 * - Password history tracking
 * - Protection against timing attacks
 *
 * SECURITY FIX #8: Now loads 10K+ common passwords from bundled file
 *
 * @example
 * ```typescript
 * const passwordService = new PasswordService(config);
 *
 * // Hash a password
 * const hash = await passwordService.hashPassword('SecurePass123!');
 *
 * // Verify a password
 * const isValid = await passwordService.verifyPassword('SecurePass123!', hash);
 *
 * // Validate password policy
 * const validation = await passwordService.validatePassword('weak');
 * if (!validation.valid) {
 *   logger.error('Password validation failed', { errors: validation.errors });
 * }
 * ```
 */
export class PasswordService {
  /** Password policy configuration */
  private readonly config: Required<PasswordConfig>;

  /** Common passwords Set (10K+ passwords loaded at startup) */
  private readonly commonPasswords: Set<string>;

  constructor(passwordConfig?: PasswordConfig) {
    // ============================================================================
    // MEDIUM SECURITY FIX #8: Load Comprehensive Password List (10K+ passwords)
    // ============================================================================
    this.commonPasswords = loadCommonPasswords();

    // Merge provided config with sensible defaults
    this.config = {
      minLength: passwordConfig?.minLength ?? 8,
      maxLength: passwordConfig?.maxLength ?? 128,
      requireUppercase: passwordConfig?.requireUppercase ?? true,
      requireLowercase: passwordConfig?.requireLowercase ?? true,
      requireNumbers: passwordConfig?.requireNumbers ?? true,
      requireSpecialChars: passwordConfig?.requireSpecialChars ?? true,
      specialChars: passwordConfig?.specialChars ?? '!@#$%^&*()_+=[{}|;:,.<>?-]', // Move - to end to avoid range interpretation
      preventCommon: passwordConfig?.preventCommon ?? true,
      preventUserInfo: passwordConfig?.preventUserInfo ?? true,
      historyCount: passwordConfig?.historyCount ?? 5,
      expiryDays: passwordConfig?.expiryDays ?? 0, // 0 = disabled
      passwordReset: {
        codeLength: passwordConfig?.passwordReset?.codeLength ?? 6,
        expiresIn: passwordConfig?.passwordReset?.expiresIn ?? 900, // 15 minutes
        rateLimitMax: passwordConfig?.passwordReset?.rateLimitMax ?? 3,
        rateLimitWindow: passwordConfig?.passwordReset?.rateLimitWindow ?? 3600, // 1 hour
        maxAttempts: passwordConfig?.passwordReset?.maxAttempts ?? 3,
      },
      adminPasswordReset: {
        codeLength: passwordConfig?.adminPasswordReset?.codeLength ?? 6,
        expiresIn: passwordConfig?.adminPasswordReset?.expiresIn ?? 3600,
        maxAttempts: passwordConfig?.adminPasswordReset?.maxAttempts ?? 3,
      },
    };
  }

  // ============================================================================
  // Password Hashing
  // ============================================================================

  /**
   * Hash a password using Argon2id algorithm
   *
   * Argon2id is the recommended password hashing algorithm as of 2025.
   * It combines Argon2i (resistant to side-channel attacks) and Argon2d
   * (resistant to GPU cracking attacks).
   *
   * @param password - Plain text password to hash
   * @returns Hashed password string (includes salt and algorithm parameters)
   *
   * @example
   * ```typescript
   * const hash = await passwordService.hashPassword('MySecurePassword123!');
   * // Returns: $argon2id$v=19$m=65536,t=3,p=4$...
   * ```
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, DEFAULT_ARGON2_CONFIG);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `Failed to hash password: ${errorMessage}`);
    }
  }

  /**
   * Verify a password against its hash
   *
   * This method is resistant to timing attacks by using constant-time
   * comparison internally via Argon2's verify function.
   *
   * @param password - Plain text password to verify
   * @param hash - Hashed password to compare against
   * @returns True if password matches hash, false otherwise
   *
   * @example
   * ```typescript
   * const isValid = await passwordService.verifyPassword(
   *   'MyPassword123!',
   *   '$argon2id$v=19$m=65536,t=3,p=4$...'
   * );
   * ```
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // If verification fails due to invalid hash format, return false
      // rather than throwing (could be malformed data)
      return false;
    }
  }

  // ============================================================================
  // Password Validation
  // ============================================================================

  /**
   * Validate a password against configured policy rules
   *
   * Checks multiple security criteria:
   * - Length requirements (min/max)
   * - Character complexity (uppercase, lowercase, numbers, special chars)
   * - Common password detection
   * - User information leakage (username/email in password)
   *
   * @param password - Password to validate
   * @param userInfo - Optional user information to check against (email, username)
   * @returns Validation result with any errors
   *
   * @example
   * ```typescript
   * const result = await passwordService.validatePassword('weak', {
   *   email: 'user@example.com',
   *   username: 'john'
   * });
   *
   * if (!result.valid) {
   *   logger.error('Password validation failed', { errors: result.errors });
   *   // ['Password must be at least 8 characters', ...]
   * }
   * ```
   */
  async validatePassword(
    password: string,
    userInfo?: { email?: string; username?: string },
  ): Promise<PasswordValidationResult> {
    const errors: string[] = [];

    // Check length requirements
    if (password.length < this.config.minLength) {
      errors.push(`Password must be at least ${this.config.minLength} characters long`);
    }

    if (password.length > this.config.maxLength) {
      errors.push(`Password must not exceed ${this.config.maxLength} characters`);
    }

    // Check character complexity requirements
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.config.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.config.requireSpecialChars) {
      // Use a more robust approach to check for special characters
      const hasSpecialChar = this.config.specialChars.split('').some((char) => password.includes(char));
      if (!hasSpecialChar) {
        errors.push(`Password must contain at least one special character ${this.config.specialChars}`);
      }
    }

    // Check against common passwords (10K+ passwords loaded from file)
    // TODO: this is not truly functional, need to work on it later
    if (this.config.preventCommon) {
      if (this.commonPasswords.has(password.toLowerCase())) {
        errors.push('Password is too common and easy to guess');
      }
    }

    // Check for user information in password
    if (this.config.preventUserInfo && userInfo) {
      const passwordLower = password.toLowerCase();

      if (userInfo.email) {
        const emailUsername = userInfo.email.split('@')[0].toLowerCase();
        if (passwordLower.includes(emailUsername)) {
          errors.push('Password must not contain your email or username');
        }
      }

      if (userInfo.username) {
        const usernameLower = userInfo.username.toLowerCase();
        if (passwordLower.includes(usernameLower)) {
          errors.push('Password must not contain your email or username');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if a password has been used before (password history check)
   *
   * Prevents users from reusing recent passwords, which is a security
   * best practice to limit the impact of compromised passwords.
   *
   * @param password - Plain text password to check
   * @param passwordHistory - Array of previous password hashes
   * @returns True if password was used before, false otherwise
   *
   * @example
   * ```typescript
   * const isReused = await passwordService.isPasswordInHistory(
   *   'NewPassword123!',
   *   user.passwordHistory // Last 5 passwords
   * );
   *
   * if (isReused) {
   *   throw new Error('Cannot reuse recent passwords');
   * }
   * ```
   */
  async isPasswordInHistory(password: string, passwordHistory: string[]): Promise<boolean> {
    // Check if password matches any of the historical passwords
    for (const oldHash of passwordHistory) {
      const matches = await this.verifyPassword(password, oldHash);
      if (matches) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add a password hash to history, maintaining the configured limit
   *
   * @param currentHistory - Current password history array
   * @param newHash - New password hash to add
   * @returns Updated history array with new hash
   *
   * @example
   * ```typescript
   * user.passwordHistory = passwordService.addToHistory(
   *   user.passwordHistory,
   *   newPasswordHash
   * );
   * ```
   */
  addToHistory(currentHistory: string[], newHash: string): string[] {
    const history = [...currentHistory, newHash];

    // Keep only the most recent N passwords (configured limit)
    if (history.length > this.config.historyCount) {
      return history.slice(-this.config.historyCount);
    }

    return history;
  }
}
