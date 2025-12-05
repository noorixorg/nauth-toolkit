"use strict";
/**
 * Response DTO for listing MFA providers
 *
 * Used to return all registered MFA provider method names.
 *
 * @example
 * ```typescript
 * const providers = await mfaService.listProviders();
 * // Returns: { providers: ['totp', 'sms', 'passkey'] }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListProvidersResponseDTO = void 0;
/**
 * Response DTO for listing providers
 */
var ListProvidersResponseDTO = /** @class */ (function () {
    function ListProvidersResponseDTO() {
    }
    return ListProvidersResponseDTO;
}());
exports.ListProvidersResponseDTO = ListProvidersResponseDTO;
