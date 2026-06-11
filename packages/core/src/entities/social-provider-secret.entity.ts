/**
 * Base Social Provider Secret Entity
 *
 * Stores generated OAuth client secrets (JWTs) for social providers that require
 * dynamic secret generation (e.g., Apple Sign in with Apple).
 *
 * This entity stores the generated JWT client secret and its expiration time,
 * allowing automatic rotation when the secret is close to expiring.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 *
 * @example
 * ```typescript
 * // Apple provider secret record
 * const secret = {
 *   provider: 'apple',
 *   clientSecretJwt: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IktFWV9JRCJ9...',
 *   expiresAt: new Date('2025-06-23T12:00:00Z')
 * };
 * ```
 */
export class BaseSocialProviderSecret {
  /**
   * Internal database ID (auto-increment integer)
   * Used for foreign key relationships and internal queries
   * NOT exposed externally
   */
  id!: number;

  /**
   * Social provider name
   * Examples: 'apple'
   * Unique constraint ensures one record per provider
   */
  provider!: string;

  /**
   * Generated client secret JWT
   * For Apple, this is the ES256-signed JWT used as client_secret in OAuth token exchange
   * Stored as plain text (not encrypted) since database access already grants access to sensitive data
   */
  clientSecretJwt!: string;

  /**
   * JWT expiration timestamp
   * When this JWT expires and needs to be regenerated
   * Used to determine when to refresh the secret (typically 30 days before expiry)
   */
  expiresAt!: Date;

  /**
   * Record creation timestamp
   */
  createdAt!: Date;

  /**
   * Last update timestamp
   * Updated whenever the JWT is regenerated
   */
  updatedAt!: Date;
}
