import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  MaxLength,
  ArrayMaxSize,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for creating an API key (user self-service)
 *
 * Security:
 * - Expiry is explicit and mandatory (enforced in the service layer):
 *   provide a positive number of days, or `null` for a never-expiring key
 *   (only allowed when `apiKeys.allowIndefinite` is true).
 * - Optional per-key IP allowlist restricts which source IPs may use the key.
 *
 * Note: The owning user is derived from the authenticated request, never from the body.
 */
export class CreateApiKeyDTO {
  /**
   * User-friendly label for the key (optional)
   *
   * Validation:
   * - Max 255 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  /**
   * Key expiry in days, or `null` for a key that never expires
   *
   * This field is mandatory at creation. The service rejects the request when it
   * is omitted (`API_KEY_EXPIRY_REQUIRED`), when `null` is used but indefinite keys
   * are disallowed (`API_KEY_INDEFINITE_NOT_ALLOWED`), or when it exceeds the
   * configured maximum (`API_KEY_EXPIRY_TOO_LONG`).
   *
   * Validation:
   * - When provided and not null: positive integer
   */
  @ValidateIf((o) => o.expiresInDays !== undefined && o.expiresInDays !== null)
  @IsInt({ message: 'expiresInDays must be an integer number of days or null' })
  @Min(1, { message: 'expiresInDays must be at least 1' })
  expiresInDays?: number | null;

  /**
   * Allowed source IPs / CIDR ranges for this key (optional)
   *
   * When omitted or empty, the key may be used from any IP. Each entry must be a
   * valid IPv4/IPv6 address or CIDR range (validated in the service layer).
   *
   * Validation:
   * - Array of strings, max 100 entries at the DTO layer (per-key cap enforced by config)
   */
  @IsOptional()
  @IsArray({ message: 'allowedIps must be an array of IP addresses or CIDR ranges' })
  @ArrayMaxSize(100, { message: 'allowedIps has too many entries' })
  @IsString({ each: true, message: 'Each allowedIps entry must be a string' })
  allowedIps?: string[];
}

/**
 * DTO for updating an API key (user self-service)
 *
 * Only the label and IP allowlist are mutable. The secret and expiry are immutable —
 * to rotate or extend a key, delete it and create a new one.
 */
export class UpdateApiKeyDTO {
  /**
   * External key identifier (UUID v4)
   */
  @IsUUID('4', { message: 'keyId must be a valid UUID v4' })
  keyId!: string;

  /**
   * New label for the key (optional)
   */
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  /**
   * Replacement IP allowlist (optional)
   *
   * Pass an empty array to clear restrictions (open to any IP).
   */
  @IsOptional()
  @IsArray({ message: 'allowedIps must be an array of IP addresses or CIDR ranges' })
  @ArrayMaxSize(100, { message: 'allowedIps has too many entries' })
  @IsString({ each: true, message: 'Each allowedIps entry must be a string' })
  allowedIps?: string[];
}

/**
 * DTO for revoking an API key (soft delete)
 */
export class RevokeApiKeyDTO {
  /**
   * External key identifier (UUID v4)
   */
  @IsUUID('4', { message: 'keyId must be a valid UUID v4' })
  keyId!: string;
}

/**
 * DTO for permanently deleting an API key
 */
export class DeleteApiKeyDTO {
  /**
   * External key identifier (UUID v4)
   */
  @IsUUID('4', { message: 'keyId must be a valid UUID v4' })
  keyId!: string;
}

/**
 * Sanitized API key response
 *
 * Never includes the plaintext key or its hash. Returned by list and update operations.
 */
export class ApiKeyResponseDTO {
  /** External key identifier (UUID v4) */
  keyId!: string;

  /** User-friendly label */
  name?: string | null;

  /** Last few characters of the key (display hint) */
  lastFour?: string | null;

  /** Allowed source IPs / CIDR ranges (empty/null = any IP) */
  allowedIps?: string[] | null;

  /** Expiry timestamp, or null if the key never expires */
  expiresAt?: Date | null;

  /** Whether the key is active */
  isActive!: boolean;

  /** Whether the key was created by an administrator */
  createdByAdmin!: boolean;

  /** Last successful use timestamp, or null if never used */
  lastUsedAt?: Date | null;

  /** IP of the last successful use (only when usage IP tracking is enabled) */
  lastUsedIp?: string | null;

  /** Total number of successful authentications with this key */
  usageCount!: number;

  /** Creation timestamp */
  createdAt!: Date;
}

/**
 * Response returned once when a key is created
 *
 * The plaintext `key` is shown only here and never again — the caller must store it securely.
 */
export class CreateApiKeyResponseDTO {
  /**
   * The full plaintext API key (shown once)
   *
   * Security: Never stored in plaintext. Deliver securely to the consumer.
   */
  key!: string;

  /**
   * Sanitized metadata for the created key
   */
  apiKey!: ApiKeyResponseDTO;
}
