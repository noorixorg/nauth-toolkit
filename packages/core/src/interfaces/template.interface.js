"use strict";
/**
 * Email Template System Interfaces
 *
 * Provides flexible template system for email notifications with support for:
 * - HTML templates with placeholder tokens ({{variable}})
 * - Built-in and custom variables
 * - Multiple template types (verification, password reset, etc.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateType = void 0;
/**
 * Template Type
 *
 * Enum of available email template types
 */
var TemplateType;
(function (TemplateType) {
    TemplateType["VERIFICATION"] = "verification";
    TemplateType["PASSWORD_RESET"] = "passwordReset";
    TemplateType["WELCOME"] = "welcome";
    TemplateType["ACCOUNT_LOCKOUT"] = "accountLockout";
    TemplateType["NEW_DEVICE"] = "newDevice";
    TemplateType["PASSWORD_CHANGED"] = "passwordChanged";
    TemplateType["EMAIL_CHANGED"] = "emailChanged";
    TemplateType["MFA_ENABLED"] = "mfaEnabled";
})(TemplateType || (exports.TemplateType = TemplateType = {}));
