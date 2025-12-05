"use strict";
/**
 * Resend Code Response DTO
 *
 * Response DTO for resending verification codes.
 * No validators needed - this is generated internally by the library.
 *
 * Security:
 * - Email/phone masked for privacy
 * - Only shows destination, not full details
 *
 * @example
 * ```typescript
 * const result = await authService.resendCode({ session: 'session-uuid' });
 * // Returns: { destination: 'u***r@example.com' }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendCodeResponseDTO = void 0;
/**
 * Response DTO for resend code
 */
var ResendCodeResponseDTO = /** @class */ (function () {
    function ResendCodeResponseDTO() {
    }
    return ResendCodeResponseDTO;
}());
exports.ResendCodeResponseDTO = ResendCodeResponseDTO;
