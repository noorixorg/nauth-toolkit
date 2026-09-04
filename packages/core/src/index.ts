// ============================================================================
// Public Services API
// ============================================================================
// These are the services that consumer applications should use directly.
// For internal services needed by framework adapters, see ./internal.ts

/**
 * Main authentication service
 * Handles signup, login, logout, password management, and user operations
 */
export * from './services/auth.service';

/**
 * Administrative authentication service
 * Handles admin-only user and session management
 */
export * from './services/admin-auth.service';

/**
 * Multi-Factor Authentication service
 * Manages MFA setup, verification, and device management
 */
export * from './services/mfa.service';

/**
 * Social authentication service
 * Complete API for OAuth authentication, social account linking, and management
 */
export * from './services/social-auth.service';

/**
 * Email verification service
 * Handles email verification codes and verification workflows
 */
export * from './services/email-verification.service';

/**
 * Phone verification service
 * Handles SMS verification codes and phone verification workflows
 */
export * from './services/phone-verification.service';

/**
 * Client information service
 * Provides access to request context (IP, user agent, device token, session ID)
 */
export * from './services/client-info.service';

/**
 * Geolocation service
 * Provides IP geolocation using MaxMind GeoIP2 database files
 * Only available when geoLocation.maxMind is configured
 */
export { GeoLocationService } from './services/geo-location.service';

/**
 * Authentication audit service
 * Logs and queries authentication events for security monitoring
 *
 * Note: Only query methods are available in the public API.
 * Event recording is handled internally by the framework.
 */
export { AuthAuditService } from './services/auth-audit.service';

/**
 * Authorization enforcement for privileged operations.
 *
 * Consumers implement `IAuthorizationProvider` (exported from `./interfaces`); this is
 * the service that applies it, and is wired up automatically by `NAuth.create()`.
 */
export { AuthorizationService } from './services/authorization.service';
export type { AuthorizeOptions } from './services/authorization.service';

/**
 * CSRF Protection Service
 */
export { CsrfService } from './services/csrf.service';

/**
 * Hook Registry Service
 * Manages registration and execution of lifecycle hooks
 */
export { HookRegistryService } from './services/hook-registry.service';

/**
 * API Key service
 * Manages API key lifecycle (create/list/update/revoke/delete) and validation.
 * Available when apiKeys.enabled is true.
 */
export { ApiKeyService } from './services/api-key.service';
export type { ApiKeyValidationResult } from './services/api-key.service';

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
export * from './dto';

// Exceptions & Error Handling
export { NAuthException, getHttpStatusForErrorCode } from './exceptions/nauth.exception';
export { AuthErrorCode } from './enums/error-codes.enum';
export { AuthAuditEventType } from './enums/auth-audit-event-type.enum';
export { MFAMethod, MFADeviceMethod, MFAVerificationMethod, MFADeviceMethods } from './enums/mfa-method.enum';

// Interfaces (All interfaces stay in core for contracts)
export * from './interfaces';
// Re-export ClientInfo interface with alias to avoid naming conflicts with decorators
export type { ClientInfo as IClientInfo } from './interfaces/client-info.interface';

// Zod Schemas (Runtime validation)
export { authConfigSchema, type NAuthConfig as NAuthConfigFromSchema } from './schemas/auth-config.schema';
// Keep interface export for backward compatibility
export type { NAuthConfig } from './interfaces/config.interface';

// Base Entity Classes (Database-agnostic entities)
export * from './entities';

// Storage
export * from './storage';

// Templates (Shared base templates)
export * from './templates';

// Utilities
export * from './utils';

// Validators
export * from './validators/template.validator';

// ============================================================================
// Platform Agnostic Components (New Architecture)
// ============================================================================

// Bootstrap
export * from './bootstrap';

// Platform Interfaces
export * from './platform/interfaces';

// Adapters
export * from './adapters';

/**
 * Shipped auth routes — the manifest, mount options and resolution shared by the
 * NestJS, Express and Fastify mounts.
 */
export * from './routes';

// Storage Factories
export * from './adapters/storage.factory';

// ============================================================================
// Framework-neutral Handlers (for consumer backends to delegate to)
// ============================================================================
export * from './services/social-redirect.handler';
