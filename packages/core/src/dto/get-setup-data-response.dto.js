"use strict";
/**
 * Response DTO for getting MFA setup data
 *
 * Used to return method-specific setup data during MFA enrollment.
 * Structure varies by method (TOTP returns QR code, Passkey returns options, etc.).
 *
 * @example
 * ```typescript
 * const setupData = await mfaService.getSetupData({
 *   session: 'challenge-session-token',
 *   method: 'totp'
 * });
 * // Returns: { secret: '...', qrCode: '...', manualEntryKey: '...' }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetSetupDataResponseDTO = void 0;
/**
 * Response DTO for setup data
 */
var GetSetupDataResponseDTO = /** @class */ (function () {
    function GetSetupDataResponseDTO() {
    }
    return GetSetupDataResponseDTO;
}());
exports.GetSetupDataResponseDTO = GetSetupDataResponseDTO;
