/**
 * Base API Key Entity
 *
 * Stores long-lived API keys that authenticate as their owning user.
 * Only a hash of the secret is persisted; the plaintext key is shown once at creation.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 *
 * Security:
 * - The plaintext key is never stored; only `keyHash` (SHA-256) is persisted, in a unique index.
 * - Presented keys are hashed and looked up by `keyHash` (O(1), no plaintext comparison).
 * - `allowedIps` restricts which source IPs may use the key (empty/null = any IP).
 */
export class BaseApiKey {
  /**
   * Internal API key ID (auto-increment integer)
   */
  id!: number;

  /**
   * External API key identifier (UUID v4)
   * Exposed in API responses instead of the internal integer id.
   */
  keyId!: string;

  /**
   * Internal user ID (foreign key to users table)
   * The key authenticates as this user.
   */
  userId!: number;

  /**
   * SHA-256 hash of the plaintext key (indexed, unique)
   *
   * The plaintext key is never stored. Presented keys are hashed and looked up by this value.
   */
  keyHash!: string;

  /**
   * User-friendly key label (optional)
   * E.g. "CI pipeline", "Zapier integration".
   */
  name?: string | null;

  /**
   * Last few characters of the plaintext key (display hint)
   * Helps users identify a key in listings without exposing the secret.
   */
  lastFour?: string | null;

  /**
   * Allowed source IPs / CIDR ranges for this key
   *
   * When empty or null, the key may be used from any IP.
   * When populated, requests from IPs outside the list are rejected.
   */
  allowedIps?: string[] | null;

  /**
   * Key expiration timestamp
   * NULL means the key never expires (only allowed when config permits).
   */
  expiresAt?: Date | null;

  /**
   * Whether the key is active
   * Set to false on revoke (soft delete) to disable without removing history.
   */
  isActive!: boolean;

  /**
   * When the key was revoked
   * NULL if not revoked.
   */
  revokedAt?: Date | null;

  /**
   * Reason the key was revoked (optional)
   */
  revokeReason?: string | null;

  /**
   * Whether the key was created by an administrator on behalf of the user
   */
  createdByAdmin!: boolean;

  /**
   * When the key was last used for authentication
   * NULL if never used. Updated on a throttled basis (see config).
   */
  lastUsedAt?: Date | null;

  /**
   * IP address of the most recent successful use
   * Only populated when usage IP tracking is enabled.
   */
  lastUsedIp?: string | null;

  /**
   * Total number of successful authentications with this key
   */
  usageCount!: number;

  /**
   * Additional metadata (JSON)
   */
  metadata?: Record<string, unknown> | null;

  /**
   * Creation timestamp
   */
  createdAt!: Date;

  /**
   * Last update timestamp
   */
  updatedAt!: Date;

  /**
   * Check if the key is expired
   *
   * @returns true if the key has an expiry that is in the past
   *
   * @example
   * ```typescript
   * if (apiKey.isExpired()) {
   *   throw new Error('API key has expired');
   * }
   * ```
   */
  isExpired(): boolean {
    return this.expiresAt !== null && this.expiresAt !== undefined && new Date() > this.expiresAt;
  }

  /**
   * Check whether a given source IP is allowed to use this key
   *
   * An empty or null allowlist permits any IP. Otherwise the IP must match
   * one of the configured entries (exact IPv4/IPv6 or CIDR range).
   *
   * @param ip - Source IP address of the request
   * @param matcher - IP/CIDR match function (injected to keep this class dependency-free)
   * @returns true if the IP is allowed
   */
  isIpAllowed(ip: string | null | undefined, matcher: (ip: string, allow: string) => boolean): boolean {
    if (!this.allowedIps || this.allowedIps.length === 0) {
      return true;
    }
    if (!ip) {
      return false;
    }
    return this.allowedIps.some((entry) => matcher(ip, entry));
  }
}
