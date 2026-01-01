/**
 * @nauth-toolkit/nestjs
 *
 * NestJS adapter for nauth-toolkit.
 * This package provides NestJS-specific integrations while re-exporting
 * all core functionality for seamless backward compatibility.
 */

// ============================================================================
// Re-export Public API from Core
// ============================================================================
// Note: Internal services (ChallengeService, AuthChallengeHelperService, etc.)
// are NOT re-exported. They are only available via '@nauth-toolkit/core/internal'
// for framework adapter development.
//
// Consumer applications should use the public services:
// - AuthService, MFAService, SocialAuthService, etc.
export * from '@nauth-toolkit/core';

// ============================================================================
// NestJS-Specific Exports
// ============================================================================

/**
 * NestJS Module - Main entry point for integrating NAuth into NestJS apps
 */
export { AuthModule, NAuthModuleConfig } from './auth.module';

/**
 * NestJS Guards - Route protection and authentication
 */
export { AuthGuard } from './guards/auth.guard';
export { NAuthContextGuard } from './guards/nauth-context.guard';
export { CsrfGuard } from './guards/csrf.guard';

/**
 * NestJS Interceptors - Request/response processing
 */
export { NAuthContextInterceptor } from './interceptors/nauth-context.interceptor';
export { CookieTokenInterceptor } from './interceptors/cookie-token.interceptor';

/**
 * NestJS Decorators - Parameter decorators and metadata
 */
export { CurrentUser } from './decorators/current-user.decorator';
export { Public, IS_PUBLIC_KEY } from './decorators/public.decorator';
export { ClientInfo } from './decorators/client-info.decorator';
export { TokenDelivery, TOKEN_DELIVERY_KEY, RouteDelivery } from './decorators/token-delivery.decorator';
export { PreSignupHook, PostSignupHook, HookDecoratorOptions } from './decorators/hook.decorator';

/**
 * NestJS Hook System - Lifecycle hook registration
 */
export { NAuthHooksModule } from './hooks/hooks.module';

/**
 * NestJS Filters - Exception handling
 */
export { NAuthHttpExceptionFilter } from './filters/nauth-http-exception.filter';

/**
 * NestJS Pipes - Validation & transformation
 */
export * from './pipes';

/**
 * NestJS Providers - Logger adapters and utilities
 */
export { NestJsLoggerAdapter } from './providers/nestjs-logger.adapter';

/**
 * NestJS Services - CSRF protection
 */
export { CsrfService } from './services/csrf.service';

/**
 * NestJS DTOs - Data Transfer Objects with class-validator
 */
export * from './dto';

/**
 * Factory Functions - Simplified adapter creation
 */
export {
  createDatabaseStorageAdapter,
  createRedisStorageAdapter,
  createRedisClusterAdapter,
} from './factories/storage-adapter.factory';
