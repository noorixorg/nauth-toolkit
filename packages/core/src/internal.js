"use strict";
/**
 * @packageDocumentation
 * @internal
 *
 * Internal Services - Framework Adapters Only
 *
 * This module exports internal implementation services that are used by
 * framework adapters (NestJS, Express) but should NOT be used directly
 * by consumer applications.
 *
 * **WARNING:** These APIs are considered internal implementation details
 * and may change without notice. Use the public API instead:
 * - `AuthService` - Main authentication API
 * - `MFAService` - MFA operations
 * - `SocialAuthService` - Social authentication
 * - `EmailVerificationService` - Email verification
 * - `PhoneVerificationService` - Phone verification
 * - `ClientInfoService` - Access client context
 *
 * **When to use this module:**
 * - You are building a new framework adapter (e.g., Fastify, Hapi)
 * - You need access to low-level services for dependency injection
 *
 * **When NOT to use this module:**
 * - You are building a consumer application
 * - You are implementing authentication in your app
 * - You need authentication features (use public API instead)
 *
 * @example
 * ```typescript
 * // ✅ Framework adapter usage
 * import { ChallengeService, PasswordService } from '@nauth-toolkit/core/internal';
 *
 * // Inject internal services in adapter setup
 * const challengeService = new ChallengeService(...);
 * const authService = new AuthService(..., challengeService, ...);
 * ```
 */
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
exports.AuthAuditService = exports.SocialProviderRegistry = exports.BaseSocialAuthProviderService = exports.BaseMFAProviderService = exports.AdaptiveMFADecisionService = exports.RiskScoringService = exports.RiskDetectionService = exports.GeoLocationService = exports.TrustedDeviceService = exports.SessionService = exports.JwtService = exports.PasswordService = exports.AuthFlowContextBuilder = exports.AuthFlowStateMachineService = exports.AuthChallengeHelperService = exports.ChallengeService = void 0;
// ============================================================================
// Challenge System (Internal Orchestration)
// ============================================================================
/**
 * Challenge session management service
 * @internal
 */
var challenge_service_1 = require("./services/challenge.service");
Object.defineProperty(exports, "ChallengeService", { enumerable: true, get: function () { return challenge_service_1.ChallengeService; } });
/**
 * Challenge orchestration helper service
 * @internal
 */
var auth_challenge_helper_service_1 = require("./services/auth-challenge-helper.service");
Object.defineProperty(exports, "AuthChallengeHelperService", { enumerable: true, get: function () { return auth_challenge_helper_service_1.AuthChallengeHelperService; } });
// ============================================================================
// Authentication Flow State Machine (Internal)
// ============================================================================
/**
 * State machine service for authentication flows
 * @internal
 */
var auth_flow_state_machine_service_1 = require("./services/auth-flow-state-machine.service");
Object.defineProperty(exports, "AuthFlowStateMachineService", { enumerable: true, get: function () { return auth_flow_state_machine_service_1.AuthFlowStateMachineService; } });
/**
 * Context builder for state machine
 * @internal
 */
var auth_flow_context_builder_service_1 = require("./services/auth-flow-context-builder.service");
Object.defineProperty(exports, "AuthFlowContextBuilder", { enumerable: true, get: function () { return auth_flow_context_builder_service_1.AuthFlowContextBuilder; } });
/**
 * State machine types
 * @internal
 */
__exportStar(require("./services/auth-flow-state-machine.types"), exports);
/**
 * State machine rules
 * @internal
 */
__exportStar(require("./services/auth-flow-rules"), exports);
/**
 * State definitions
 * @internal
 */
__exportStar(require("./services/auth-flow-state-definitions"), exports);
// ============================================================================
// Low-Level Service Primitives (Internal)
// ============================================================================
/**
 * Password hashing and validation service
 * @internal
 */
var password_service_1 = require("./services/password.service");
Object.defineProperty(exports, "PasswordService", { enumerable: true, get: function () { return password_service_1.PasswordService; } });
/**
 * JWT token generation and validation service
 * @internal
 */
var jwt_service_1 = require("./services/jwt.service");
Object.defineProperty(exports, "JwtService", { enumerable: true, get: function () { return jwt_service_1.JwtService; } });
/**
 * Session management service
 * @internal
 */
var session_service_1 = require("./services/session.service");
Object.defineProperty(exports, "SessionService", { enumerable: true, get: function () { return session_service_1.SessionService; } });
/**
 * Trusted device management service
 * @internal
 */
var trusted_device_service_1 = require("./services/trusted-device.service");
Object.defineProperty(exports, "TrustedDeviceService", { enumerable: true, get: function () { return trusted_device_service_1.TrustedDeviceService; } });
/**
 * Geolocation service for IP-based location detection
 * @internal
 */
var geo_location_service_1 = require("./services/geo-location.service");
Object.defineProperty(exports, "GeoLocationService", { enumerable: true, get: function () { return geo_location_service_1.GeoLocationService; } });
// ============================================================================
// Risk & Adaptive Security (Internal)
// ============================================================================
/**
 * Risk detection service - analyzes authentication attempts
 * @internal
 */
var risk_detection_service_1 = require("./services/risk-detection.service");
Object.defineProperty(exports, "RiskDetectionService", { enumerable: true, get: function () { return risk_detection_service_1.RiskDetectionService; } });
/**
 * Risk scoring service - calculates risk scores
 * @internal
 */
var risk_scoring_service_1 = require("./services/risk-scoring.service");
Object.defineProperty(exports, "RiskScoringService", { enumerable: true, get: function () { return risk_scoring_service_1.RiskScoringService; } });
/**
 * Adaptive MFA decision service - determines MFA requirements
 * @internal
 */
var adaptive_mfa_decision_service_1 = require("./services/adaptive-mfa-decision.service");
Object.defineProperty(exports, "AdaptiveMFADecisionService", { enumerable: true, get: function () { return adaptive_mfa_decision_service_1.AdaptiveMFADecisionService; } });
// ============================================================================
// Base Classes (Internal - for Provider Implementations)
// ============================================================================
/**
 * Base class for MFA provider implementations
 * @internal
 */
var mfa_base_service_1 = require("./services/mfa-base.service");
Object.defineProperty(exports, "BaseMFAProviderService", { enumerable: true, get: function () { return mfa_base_service_1.BaseMFAProviderService; } });
/**
 * Base class for social authentication provider implementations
 * @internal
 */
var social_auth_base_service_1 = require("./services/social-auth-base.service");
Object.defineProperty(exports, "BaseSocialAuthProviderService", { enumerable: true, get: function () { return social_auth_base_service_1.BaseSocialAuthProviderService; } });
/**
 * Social provider registry service
 * Internal registry for managing social auth provider instances
 * @internal
 */
var social_provider_registry_service_1 = require("./services/social-provider-registry.service");
Object.defineProperty(exports, "SocialProviderRegistry", { enumerable: true, get: function () { return social_provider_registry_service_1.SocialProviderRegistry; } });
// ============================================================================
// Audit Service (Internal - with recordEvent)
// ============================================================================
/**
 * Authentication audit service with event recording
 * Internal version that includes recordEvent() method for framework use
 * @internal
 */
var auth_audit_service_1 = require("./services/auth-audit.service");
Object.defineProperty(exports, "AuthAuditService", { enumerable: true, get: function () { return auth_audit_service_1.InternalAuthAuditService; } });
