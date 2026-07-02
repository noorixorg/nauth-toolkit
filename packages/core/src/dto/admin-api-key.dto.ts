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
 * DTO for administrative API key creation on behalf of a user
 *
 * Warning: This endpoint should be protected by admin authentication.
 * The service does not enforce authorization - it is the responsibility of the
 * framework adapter (NestJS/Express/Fastify) to protect the endpoint.
 *
 * Admin-created keys bypass the `allowUserCreation` restriction but still obey
 * `maxKeysPerUser`, expiry, and IP-restriction rules.
 */
export class AdminCreateApiKeyDTO {
  /**
   * Target user sub (UUID v4)
   *
   * Sanitization: Trimmed and lowercased.
   */
  @IsUUID('4', { message: 'User sub must be a valid UUID v4' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  sub!: string;

  /**
   * User-friendly label for the key (optional)
   */
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  /**
   * Key expiry in days, or `null` for a key that never expires
   *
   * Mandatory at creation (see {@link CreateApiKeyDTO} for the rules the service enforces).
   */
  @ValidateIf((o) => o.expiresInDays !== undefined && o.expiresInDays !== null)
  @IsInt({ message: 'expiresInDays must be an integer number of days or null' })
  @Min(1, { message: 'expiresInDays must be at least 1' })
  expiresInDays?: number | null;

  /**
   * Allowed source IPs / CIDR ranges for this key (optional)
   */
  @IsOptional()
  @IsArray({ message: 'allowedIps must be an array of IP addresses or CIDR ranges' })
  @ArrayMaxSize(100, { message: 'allowedIps has too many entries' })
  @IsString({ each: true, message: 'Each allowedIps entry must be a string' })
  allowedIps?: string[];
}

/**
 * DTO for administrative API key update on behalf of a user
 */
export class AdminUpdateApiKeyDTO {
  /**
   * Target user sub (UUID v4)
   */
  @IsUUID('4', { message: 'User sub must be a valid UUID v4' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  sub!: string;

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
   * Replacement IP allowlist (optional). Pass an empty array to clear restrictions.
   */
  @IsOptional()
  @IsArray({ message: 'allowedIps must be an array of IP addresses or CIDR ranges' })
  @ArrayMaxSize(100, { message: 'allowedIps has too many entries' })
  @IsString({ each: true, message: 'Each allowedIps entry must be a string' })
  allowedIps?: string[];
}

/**
 * DTO for administrative API key management (list / revoke / delete) by user sub
 *
 * For list operations, only `sub` is required. For revoke/delete, `keyId` is also required.
 */
export class AdminManageApiKeyDTO {
  /**
   * Target user sub (UUID v4)
   */
  @IsUUID('4', { message: 'User sub must be a valid UUID v4' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  sub!: string;

  /**
   * External key identifier (UUID v4). Required for revoke/delete, omitted for list.
   */
  @IsOptional()
  @IsUUID('4', { message: 'keyId must be a valid UUID v4' })
  keyId?: string;
}
