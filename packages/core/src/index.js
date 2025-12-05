"use strict";
// ============================================================================
// Public Services API
// ============================================================================
// These are the services that consumer applications should use directly.
// For internal services needed by framework adapters, see ./internal.ts
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
exports.authConfigSchema = exports.MFADeviceMethods = exports.MFAMethod = exports.AuthAuditEventType = exports.AuthErrorCode = exports.getHttpStatusForErrorCode = exports.NAuthException = exports.CsrfService = exports.AuthAuditService = void 0;
/**
 * Main authentication service
 * Handles signup, login, logout, password management, and user operations
 */
__exportStar(require("./services/auth.service"), exports);
/**
 * Multi-Factor Authentication service
 * Manages MFA setup, verification, and device management
 */
__exportStar(require("./services/mfa.service"), exports);
/**
 * Social authentication service
 * Complete API for OAuth authentication, social account linking, and management
 */
__exportStar(require("./services/social-auth.service"), exports);
/**
 * Email verification service
 * Handles email verification codes and verification workflows
 */
__exportStar(require("./services/email-verification.service"), exports);
/**
 * Phone verification service
 * Handles SMS verification codes and phone verification workflows
 */
__exportStar(require("./services/phone-verification.service"), exports);
/**
 * Client information service
 * Provides access to request context (IP, user agent, device token, session ID)
 */
__exportStar(require("./services/client-info.service"), exports);
/**
 * Authentication audit service
 * Logs and queries authentication events for security monitoring
 *
 * Note: Only query methods are available in the public API.
 * Event recording is handled internally by the framework.
 */
var auth_audit_service_1 = require("./services/auth-audit.service");
Object.defineProperty(exports, "AuthAuditService", { enumerable: true, get: function () { return auth_audit_service_1.AuthAuditService; } });
/**
 * CSRF Protection Service
 */
var csrf_service_1 = require("./services/csrf.service");
Object.defineProperty(exports, "CsrfService", { enumerable: true, get: function () { return csrf_service_1.CsrfService; } });
// ============================================================================
// Internal Services - NOT EXPORTED
// ============================================================================
// Internal services are NOT exported from this file. They are only available
// via '@nauth-toolkit/core/internal' for framework adapter development.
//
// Consumer applications should use the public services above (AuthService,
// MFAService, etc.) which provide high-level APIs and automatically manage
// internal services like password hashing, JWT tokens, and sessions.
// ============================================================================
// DTOs, Exceptions, Interfaces, Entities, Storage, and Utilities
// ============================================================================
// DTOs (Core only - feature DTOs moved to feature packages)
__exportStar(require("./dto"), exports);
// Exceptions & Error Handling
var nauth_exception_1 = require("./exceptions/nauth.exception");
Object.defineProperty(exports, "NAuthException", { enumerable: true, get: function () { return nauth_exception_1.NAuthException; } });
Object.defineProperty(exports, "getHttpStatusForErrorCode", { enumerable: true, get: function () { return nauth_exception_1.getHttpStatusForErrorCode; } });
var error_codes_enum_1 = require("./enums/error-codes.enum");
Object.defineProperty(exports, "AuthErrorCode", { enumerable: true, get: function () { return error_codes_enum_1.AuthErrorCode; } });
var auth_audit_event_type_enum_1 = require("./enums/auth-audit-event-type.enum");
Object.defineProperty(exports, "AuthAuditEventType", { enumerable: true, get: function () { return auth_audit_event_type_enum_1.AuthAuditEventType; } });
var mfa_method_enum_1 = require("./enums/mfa-method.enum");
Object.defineProperty(exports, "MFAMethod", { enumerable: true, get: function () { return mfa_method_enum_1.MFAMethod; } });
Object.defineProperty(exports, "MFADeviceMethods", { enumerable: true, get: function () { return mfa_method_enum_1.MFADeviceMethods; } });
// Interfaces (All interfaces stay in core for contracts)
__exportStar(require("./interfaces"), exports);
// Zod Schemas (Runtime validation)
var auth_config_schema_1 = require("./schemas/auth-config.schema");
Object.defineProperty(exports, "authConfigSchema", { enumerable: true, get: function () { return auth_config_schema_1.authConfigSchema; } });
// Base Entity Classes (Database-agnostic entities)
__exportStar(require("./entities"), exports);
// Storage
__exportStar(require("./storage"), exports);
// Templates (Shared base templates)
__exportStar(require("./templates"), exports);
// Utilities
__exportStar(require("./utils"), exports);
// Validators
__exportStar(require("./validators/template.validator"), exports);
// ============================================================================
// Platform Agnostic Components (New Architecture)
// ============================================================================
// Bootstrap
__exportStar(require("./bootstrap"), exports);
// Platform Interfaces
__exportStar(require("./platform/interfaces"), exports);
// Adapters
__exportStar(require("./adapters"), exports);
// Storage Factories
__exportStar(require("./adapters/storage.factory"), exports);
