"use strict";
/**
 * Response DTO for getting MFA challenge data
 *
 * Used to return method-specific challenge data during MFA verification.
 * Currently only passkey method requires challenge data (WebAuthn options).
 *
 * @example
 * ```typescript
 * const challengeData = await mfaService.getChallengeData({
 *   session: 'challenge-session-token',
 *   method: 'passkey'
 * });
 * // Returns: { publicKey: { challenge: '...', ... } }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetChallengeDataResponseDTO = void 0;
/**
 * Response DTO for challenge data
 */
var GetChallengeDataResponseDTO = /** @class */ (function () {
    function GetChallengeDataResponseDTO() {
    }
    return GetChallengeDataResponseDTO;
}());
exports.GetChallengeDataResponseDTO = GetChallengeDataResponseDTO;
