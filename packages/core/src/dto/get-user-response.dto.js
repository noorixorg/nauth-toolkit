"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetUserResponseDTO = void 0;
// Re-export UserResponseDto for consistency
var user_response_dto_1 = require("./user-response.dto");
Object.defineProperty(exports, "GetUserResponseDTO", { enumerable: true, get: function () { return user_response_dto_1.UserResponseDto; } });
