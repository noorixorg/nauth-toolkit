/**
 * Get User Response DTO
 *
 * Response DTO for user retrieval operations.
 *
 * Note: Methods like getUserById and getUserByEmail return UserResponseDto | null directly.
 * This file exists for type consistency but UserResponseDto is used directly.
 *
 * @example
 * ```typescript
 * const user = await authService.getUserById({ sub: 'user-uuid' });
 * // Returns: UserResponseDto | null
 * ```
 */

// Re-export UserResponseDto for consistency
export { UserResponseDTO as GetUserResponseDTO } from './user-response.dto';
