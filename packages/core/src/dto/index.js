"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Core Auth DTOs
__exportStar(require("./signup.dto"), exports);
__exportStar(require("./login.dto"), exports);
__exportStar(require("./change-password.dto"), exports);
__exportStar(require("./change-password-request.dto"), exports);
__exportStar(require("./change-password-response.dto"), exports);
__exportStar(require("./user-response.dto"), exports);
__exportStar(require("./user-update.dto"), exports);
__exportStar(require("./update-user-attributes-request.dto"), exports);
__exportStar(require("./verify-email.dto"), exports);
__exportStar(require("./verify-phone.dto"), exports);
__exportStar(require("./verify-phone-by-sub.dto"), exports);
__exportStar(require("./reset-password.dto"), exports);
__exportStar(require("./refresh-token.dto"), exports);
__exportStar(require("./auth-response.dto"), exports);
__exportStar(require("./auth-challenge.dto"), exports);
__exportStar(require("./challenge-response.dto"), exports);
__exportStar(require("./respond-challenge.dto"), exports);
__exportStar(require("./get-setup-data.dto"), exports);
__exportStar(require("./get-setup-data-response.dto"), exports);
__exportStar(require("./get-challenge-data.dto"), exports);
__exportStar(require("./get-challenge-data-response.dto"), exports);
__exportStar(require("./get-available-methods.dto"), exports);
__exportStar(require("./get-mfa-status.dto"), exports);
__exportStar(require("./get-user-devices.dto"), exports);
__exportStar(require("./has-provider.dto"), exports);
__exportStar(require("./list-providers-response.dto"), exports);
__exportStar(require("./remove-devices.dto"), exports);
__exportStar(require("./set-mfa-exemption.dto"), exports);
__exportStar(require("./set-preferred-method.dto"), exports);
__exportStar(require("./setup-mfa.dto"), exports);
__exportStar(require("./verify-mfa-code.dto"), exports);
__exportStar(require("./get-client-info.dto"), exports);
__exportStar(require("./get-ip-address-response.dto"), exports);
__exportStar(require("./get-user-agent-response.dto"), exports);
__exportStar(require("./get-device-token-response.dto"), exports);
__exportStar(require("./get-session-id-response.dto"), exports);
__exportStar(require("./resend-code.dto"), exports);
__exportStar(require("./resend-code-response.dto"), exports);
__exportStar(require("./get-user-by-email.dto"), exports);
__exportStar(require("./get-user-by-id.dto"), exports);
__exportStar(require("./get-user-response.dto"), exports);
__exportStar(require("./logout.dto"), exports);
__exportStar(require("./logout-response.dto"), exports);
__exportStar(require("./logout-all.dto"), exports);
__exportStar(require("./logout-all-response.dto"), exports);
__exportStar(require("./set-must-change-password.dto"), exports);
__exportStar(require("./set-must-change-password-response.dto"), exports);
// Note: trust-device.dto.ts removed - trustDevice() no longer takes parameters
__exportStar(require("./trust-device-response.dto"), exports);
__exportStar(require("./social-auth.dto"), exports);
// Note: Social and MFA DTOs moved to their respective packages
// - social-login.dto → @nauth-toolkit/social-*
// - mfa.dto → @nauth-toolkit/mfa-*
