import { IUser } from '../interfaces/entities.interface';

/**
 * User Response DTO
 *
 * Sanitized user object for API responses.
 * Excludes all sensitive and internal fields.
 *
 * Security:
 * - Never exposes password hash
 * - Never exposes MFA secrets
 * - Never exposes internal tracking fields
 * - Exposes 'sub' (external UUID) instead of internal 'id'
 *
 * No validators needed - this is generated internally by the library via fromEntity().
 *
 * @example
 * ```typescript
 * const user = await userRepository.findOne({ where: { sub } });
 * return UserResponseDto.fromEntity(user);
 * ```
 */
export class UserResponseDTO {
  /**
   * External user identifier (UUID v4)
   * This is the 'sub' (subject) field from JWT tokens
   */
  sub!: string;

  /**
   * User's email address
   */
  email!: string;

  /**
   * User's username (optional)
   */
  username?: string | null;

  /**
   * User's first name (optional)
   */
  firstName?: string | null;

  /**
   * User's last name (optional)
   */
  lastName?: string | null;

  /**
   * User's phone number (optional)
   * E.164 format validated in service layer if present
   */
  phone?: string | null;

  /**
   * Email verification status
   */
  isEmailVerified!: boolean;

  /**
   * Phone verification status
   */
  isPhoneVerified!: boolean;

  /**
   * Account active status
   */
  isActive!: boolean;

  /**
   * Account lock status
   * Locked accounts cannot login until unlocked
   */
  isLocked!: boolean;

  /**
   * MFA enabled status
   */
  mfaEnabled!: boolean;

  /**
   * MFA exemption status (admin-granted bypass of MFA at login)
   */
  mfaExempt!: boolean;

  /**
   * Array of social providers linked to this account
   *
   * Examples: ['google', 'apple', 'facebook']
   * null/undefined means no social auth, only password-based
   */
  socialProviders?: string[] | null;

  /**
   * Whether this user has a password set
   * Used to determine if user can use password-based authentication
   * or is a pure social signup (no password, only social auth)
   */
  hasPasswordHash!: boolean;

  /**
   * Account creation timestamp
   */
  createdAt!: Date;

  /**
   * Last account update timestamp
   */
  updatedAt!: Date;

  /**
   * Convert User entity to safe response DTO
   *
   * @param user - User entity from database
   * @returns Sanitized user object with external identifier (sub)
   */
  static fromEntity(user: IUser): UserResponseDTO {
    const dto = new UserResponseDTO();

    // Essential fields only
    dto.sub = user.sub; // External UUID identifier
    dto.email = user.email;
    dto.username = user.username;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.phone = user.phone;
    dto.isEmailVerified = user.isEmailVerified;
    dto.isPhoneVerified = user.isPhoneVerified;
    dto.isActive = user.isActive;
    dto.isLocked = user.isLocked;
    dto.mfaEnabled = user.mfaEnabled;
    dto.mfaExempt = !!(user.mfaExempt === true || (user.mfaExempt as unknown) === 1);
    dto.socialProviders = user.socialProviders;
    dto.hasPasswordHash = !!user.passwordHash; // Check if password exists
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;

    return dto;
  }

  /**
   * Convert array of User entities to safe response DTOs
   *
   * @param users - Array of User entities
   * @returns Array of sanitized user objects
   */
  static fromEntities(users: IUser[]): UserResponseDTO[] {
    return users.map((user) => UserResponseDTO.fromEntity(user));
  }
}
