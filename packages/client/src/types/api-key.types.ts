/**
 * API Key types for the NAuth client SDK.
 *
 * These mirror the backend `@nauth-toolkit/core` API key DTOs.
 */

/**
 * Sanitized API key metadata returned by list/update operations.
 * Never contains the plaintext key.
 */
export interface ApiKeyInfo {
  /** External key identifier (UUID) */
  keyId: string;
  /** User-friendly label */
  name?: string | null;
  /** Last few characters of the key (display hint) */
  lastFour?: string | null;
  /** Allowed source IPs / CIDR ranges (empty/null = any IP) */
  allowedIps?: string[] | null;
  /** ISO expiry timestamp, or null if the key never expires */
  expiresAt?: string | null;
  /** Whether the key is active */
  isActive: boolean;
  /** Whether the key was created by an administrator */
  createdByAdmin: boolean;
  /** ISO timestamp of the last successful use, or null */
  lastUsedAt?: string | null;
  /** IP of the last successful use (when usage IP tracking is enabled) */
  lastUsedIp?: string | null;
  /** Total number of successful authentications */
  usageCount: number;
  /** ISO creation timestamp */
  createdAt: string;
}

/**
 * Request body for creating an API key.
 *
 * `expiresInDays` is mandatory: a positive integer for a finite expiry, or `null`
 * for a never-expiring key (only allowed when the server permits it).
 */
export interface CreateApiKeyRequest {
  /** Optional label */
  name?: string;
  /** Expiry in days, or null for never */
  expiresInDays: number | null;
  /** Optional IP allowlist (IPs / IPv4 CIDR ranges) */
  allowedIps?: string[];
}

/**
 * Request body for updating an API key's mutable fields (label and IP allowlist).
 */
export interface UpdateApiKeyRequest {
  /** New label */
  name?: string;
  /** Replacement IP allowlist (empty array clears restrictions) */
  allowedIps?: string[];
}

/**
 * Result of creating a key. The plaintext `key` is shown once.
 */
export interface CreateApiKeyResult {
  /** Full plaintext API key (store securely; shown only once) */
  key: string;
  /** Sanitized metadata for the created key */
  apiKey: ApiKeyInfo;
}
