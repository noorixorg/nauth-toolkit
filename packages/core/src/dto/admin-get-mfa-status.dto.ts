/**
 * Admin Get MFA Status DTO
 *
 * Admin-only request DTO for retrieving MFA status for a target user.
 *
 * Security:
 * - Requires target user sub (UUID v4)
 *
 * @example
 * ```typescript
 * const status = await mfaService.adminGetMfaStatus({
 *   sub: 'a21b654c-2746-4168-acee-c175083a65cd',
 * });
 * ```
 */
import { IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Admin request DTO for getting MFA status (includes target user sub)
 */
export class AdminGetMFAStatusDTO {
  /**
   * User's unique identifier (UUID v4)
   *
   * Validation:
   * - Must be a valid UUID v4 format
   * - Matches DB constraint: char(36) or uuid
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  sub!: string;
}

