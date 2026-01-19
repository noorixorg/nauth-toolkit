/**
 * Public API Surface of @nauth-toolkit/client-angular (NgModule)
 *
 * This is the default entry point for NgModule-based Angular apps.
 * For standalone components, use: @nauth-toolkit/client-angular/standalone
 */

// Re-export core client types and utilities
export * from '@nauth-toolkit/client';

// Export NgModule-specific components (class-based)
export * from './ngmodule/tokens';
export * from './ngmodule/auth.service';
export * from './ngmodule/http-adapter';
export * from './ngmodule/auth.interceptor.class';
export * from './ngmodule/nauth.module';

// Export functional components (for flexibility in NgModule apps too)
export * from './lib/auth.interceptor';
export * from './lib/auth.guard';
export * from './lib/social-redirect-callback.guard';
export * from './lib/recaptcha.service';
export * from './lib/recaptcha-provider';
