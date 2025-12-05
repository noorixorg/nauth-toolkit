"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthResponseDTO = void 0;
/**
 * Unified Authentication Response DTO
 *
 * Used for ALL authentication operations:
 * - Email/password login
 * - User signup
 * - Social authentication (Google, Apple, Facebook)
 * - Token refresh
 * - Challenge completions
 *
 * This provides a consistent interface regardless of authentication method,
 * improving developer experience and code maintainability.
 *
 * When challenges are present, tokens will not be issued until all challenges
 * are completed. This ensures proper verification and security enforcement.
 *
 * No validators needed - this is generated internally by the library.
 *
 * @example
 * ```typescript
 * // Successful auth with no challenges
 * const loginResult = await authService.login(dto);
 * // { accessToken: '...', refreshToken: '...', user: {...} }
 *
 * // Auth with pending challenge
 * const signupResult = await authService.signup(dto);
 * // { challengeName: 'VERIFY_EMAIL', session: '...', challengeParameters: {...} }
 * ```
 */
var AuthResponseDTO = /** @class */ (function () {
    function AuthResponseDTO() {
    }
    return AuthResponseDTO;
}());
exports.AuthResponseDTO = AuthResponseDTO;
