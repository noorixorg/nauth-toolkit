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
 * // Framework adapter usage
 * import { ChallengeService, PasswordService } from '@nauth-toolkit/core/internal';
 *
 * // Inject internal services in adapter setup
 * const challengeService = new ChallengeService(...);
 * const authService = new AuthService(..., challengeService, ...);
 * ```
 */

// ============================================================================
// Challenge System (Internal Orchestration)
// ============================================================================

/**
 * Challenge session management service
 * @internal
 */
export { ChallengeService } from './services/challenge.service';

/**
 * Challenge orchestration helper service
 * @internal
 */
export { AuthChallengeHelperService } from './services/auth-challenge-helper.service';

// ============================================================================
// Authentication Flow State Machine (Internal)
// ============================================================================

/**
 * State machine service for authentication flows
 * @internal
 */
export { AuthFlowStateMachineService } from './services/auth-flow-state-machine.service';

/**
 * Context builder for state machine
 * @internal
 */
export { AuthFlowContextBuilder } from './services/auth-flow-context-builder.service';

/**
 * State machine types
 * @internal
 */
export * from './services/auth-flow-state-machine.types';

/**
 * State machine rules
 * @internal
 */
export * from './services/auth-flow-rules';

/**
 * State definitions
 * @internal
 */
export * from './services/auth-flow-state-definitions';

// ============================================================================
// Low-Level Service Primitives (Internal)
// ============================================================================

/**
 * Password hashing and validation service
 * @internal
 */
export { PasswordService } from './services/password.service';

/**
 * JWT token generation and validation service
 * @internal
 */
export { JwtService } from './services/jwt.service';

/**
 * Session management service
 * @internal
 */
export { SessionService } from './services/session.service';

/**
 * Password reset (account recovery) service
 * @internal
 */
export { PasswordResetService } from './services/password-reset.service';

/**
 * Trusted device management service
 * @internal
 */
export { TrustedDeviceService } from './services/trusted-device.service';

/**
 * Geolocation service for IP-based location detection
 * @internal
 */
export { GeoLocationService } from './services/geo-location.service';

// ============================================================================
// Risk & Adaptive Security (Internal)
// ============================================================================

/**
 * Risk detection service - analyzes authentication attempts
 * @internal
 */
export { RiskDetectionService } from './services/risk-detection.service';

/**
 * Risk scoring service - calculates risk scores
 * @internal
 */
export { RiskScoringService } from './services/risk-scoring.service';

/**
 * Adaptive MFA decision service - determines MFA requirements
 * @internal
 */
export { AdaptiveMFADecisionService } from './services/adaptive-mfa-decision.service';

// ============================================================================
// Base Classes (Internal - for Provider Implementations)
// ============================================================================

/**
 * Base class for MFA provider implementations
 * @internal
 */
export { BaseMFAProviderService } from './services/mfa-base.service';

/**
 * Base class for social authentication provider implementations
 * @internal
 */
export { BaseSocialAuthProviderService } from './services/social-auth-base.service';

/**
 * Storage-backed OAuth CSRF + redirect context store
 * @internal
 */
export { SocialAuthStateStore } from './services/social-auth-state-store.service';

/**
 * Social provider registry service
 * Internal registry for managing social auth provider instances
 * @internal
 */
export { SocialProviderRegistry } from './services/social-provider-registry.service';

// ============================================================================
// Adapter Discovery Tokens (Internal)
// ============================================================================

/**
 * Injection token used by framework adapters to discover **all** registered MFA provider services.
 *
 * @remarks
 * Provider packages (e.g. `@nauth-toolkit/mfa-totp/nestjs`) should bind their provider service to this token
 * (typically via `{ provide: NAUTH_MFA_PROVIDER_TOKEN, useExisting: MyProviderService }`).
 *
 * Framework adapters (e.g. `@nauth-toolkit/nestjs`) can then discover all providers via `ModuleRef.get(..., { each: true })`
 * and register them into `MFAService` in an order-independent, deterministic way.
 */
export const NAUTH_MFA_PROVIDER_TOKEN = 'NAUTH_MFA_PROVIDER_TOKEN';

/**
 * Injection token used by framework adapters to discover **all** registered social auth provider services.
 *
 * @remarks
 * Social provider packages (e.g. `@nauth-toolkit/social-google/nestjs`) should bind their provider service to this token
 * (typically via `{ provide: NAUTH_SOCIAL_PROVIDER_TOKEN, useExisting: MySocialProviderService }`).
 *
 * Framework adapters (e.g. `@nauth-toolkit/nestjs`) can then discover all providers via `ModuleRef.get(..., { each: true })`
 * and register them into the `SocialProviderRegistry` in an order-independent, deterministic way.
 */
export const NAUTH_SOCIAL_PROVIDER_TOKEN = 'NAUTH_SOCIAL_PROVIDER_TOKEN';

// ============================================================================
// Audit Service (Internal - with recordEvent)
// ============================================================================

/**
 * Authentication audit service with event recording
 * Internal version that includes recordEvent() method for framework use
 * @internal
 */
export { InternalAuthAuditService as AuthAuditService } from './services/auth-audit.service';
