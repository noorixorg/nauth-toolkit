/**
 * Base Social Account Entity
 *
 * Stores OAuth provider linkage (no token storage, one-time attribute import).
 * Each record represents a user's account linked to a specific social provider.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 *
 * @example
 * ```typescript
 * // User has Google and Apple accounts linked
 * const socialAccounts = [
 *   { provider: 'google', providerId: 'google_123', providerEmail: 'user@gmail.com' },
 *   { provider: 'apple', providerId: 'apple_456', providerEmail: 'user@icloud.com' }
 * ];
 * ```
 */
export class BaseSocialAccount {
  /**
   * Internal database ID (auto-increment integer)
   * Used for foreign key relationships and internal queries
   * NOT exposed externally
   */
  id!: number;

  /**
   * Foreign key to users table
   * References the user who owns this social account
   */
  userId!: number;

  /**
   * Social provider name
   * Examples: 'google', 'apple', 'facebook'
   */
  provider!: string;

  /**
   * Provider's unique identifier for this user
   * This is the ID that the OAuth provider uses to identify the user
   * Examples: Google sub, Apple user ID, Facebook ID
   */
  providerId!: string;

  /**
   * Email address from the provider (for audit/debugging)
   * May be different from user's primary email if they have multiple emails
   * Used for account linking by email verification
   */
  providerEmail?: string | null;

  /**
   * When this social account was linked to the user
   * Used for audit trails and account management
   */
  linkedAt!: Date;

  /**
   * When this social account was last used for authentication
   * Updated on each successful social login
   * Used for analytics and account cleanup
   */
  lastUsedAt?: Date | null;

  /**
   * Raw OAuth profile data from provider (for debugging)
   * Contains the full response from the OAuth provider
   * Useful for troubleshooting and attribute mapping
   *
   * @example
   * ```json
   * {
   *   "sub": "google_123",
   *   "email": "user@gmail.com",
   *   "given_name": "John",
   *   "family_name": "Doe",
   *   "picture": "https://...",
   *   "locale": "en"
   * }
   * ```
   */
  metadata?: Record<string, unknown> | null;

  /**
   * Account creation timestamp
   */
  createdAt!: Date;

  /**
   * Last account update timestamp
   */
  updatedAt!: Date;
}
