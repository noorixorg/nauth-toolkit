import { IsString, IsUUID } from 'class-validator';

/**
 * DTO for administrative user deletion
 *
 * Permanently deletes user and ALL associated data:
 * - Sessions, verification tokens, MFA devices, trusted devices
 * - Social accounts, login attempts, challenge sessions, audit logs
 *
 * Warning: IRREVERSIBLE - All user data permanently removed from database.
 *
 * @example
 * ```typescript
 * const result = await authService.deleteUser({
 *   sub: 'user-uuid-123'
 * });
 * ```
 */
export class DeleteUserDTO {
  /**
   * User UUID (sub) to delete
   *
   * Must be valid UUID format
   */
  @IsString()
  @IsUUID()
  sub!: string;
}

/**
 * Response DTO for administrative user deletion
 *
 * Confirms deletion and provides counts of cascade-deleted records.
 *
 * @example
 * ```typescript
 * {
 *   success: true,
 *   deletedUserId: 'user-uuid-123',
 *   deletedRecords: {
 *     sessions: 5,
 *     verificationTokens: 2,
 *     mfaDevices: 1,
 *     trustedDevices: 3,
 *     socialAccounts: 2,
 *     loginAttempts: 10,
 *     challengeSessions: 1,
 *     auditLogs: 50
 *   }
 * }
 * ```
 */
export class DeleteUserResponseDTO {
  /**
   * Deletion success flag
   */
  success!: boolean;

  /**
   * Deleted user's UUID
   */
  deletedUserId!: string;

  /**
   * Count of cascade-deleted records by table
   */
  deletedRecords!: {
    sessions: number;
    verificationTokens: number;
    mfaDevices: number;
    trustedDevices: number;
    socialAccounts: number;
    loginAttempts: number;
    challengeSessions: number;
    auditLogs: number;
  };
}
