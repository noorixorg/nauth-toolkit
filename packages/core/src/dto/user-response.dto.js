"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserResponseDto = void 0;
/**
 * User Response DTO
 *
 * Sanitized user object for API responses.
 * Excludes all sensitive and internal fields.
 *
 * Security:
 * - Never exposes password hash
 * - Never exposes MFA secrets
 * - Never exposes internal tracking fields
 * - Exposes 'sub' (external UUID) instead of internal 'id'
 *
 * No validators needed - this is generated internally by the library via fromEntity().
 *
 * @example
 * ```typescript
 * const user = await userRepository.findOne({ where: { sub } });
 * return UserResponseDto.fromEntity(user);
 * ```
 */
var UserResponseDto = /** @class */ (function () {
    function UserResponseDto() {
    }
    /**
     * Convert User entity to safe response DTO
     *
     * @param user - User entity from database
     * @returns Sanitized user object with external identifier (sub)
     */
    UserResponseDto.fromEntity = function (user) {
        var dto = new UserResponseDto();
        // Essential fields only
        dto.sub = user.sub; // External UUID identifier
        dto.email = user.email;
        dto.username = user.username;
        dto.firstName = user.firstName;
        dto.lastName = user.lastName;
        dto.phone = user.phone;
        dto.isEmailVerified = user.isEmailVerified;
        dto.isPhoneVerified = user.isPhoneVerified;
        dto.isActive = user.isActive;
        dto.mfaEnabled = user.mfaEnabled;
        dto.socialProviders = user.socialProviders;
        dto.hasPasswordHash = !!user.passwordHash; // Check if password exists
        dto.createdAt = user.createdAt;
        dto.updatedAt = user.updatedAt;
        return dto;
    };
    /**
     * Convert array of User entities to safe response DTOs
     *
     * @param users - Array of User entities
     * @returns Array of sanitized user objects
     */
    UserResponseDto.fromEntities = function (users) {
        return users.map(function (user) { return UserResponseDto.fromEntity(user); });
    };
    return UserResponseDto;
}());
exports.UserResponseDto = UserResponseDto;
