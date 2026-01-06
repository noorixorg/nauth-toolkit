/**
 * Public API Surface of @nauth-toolkit/client-angular/standalone
 * 
 * This entry point is for standalone component-based Angular apps (Angular 14+).
 * For NgModule apps, use: @nauth-toolkit/client-angular
 */

// Re-export core client types and utilities
export * from '@nauth-toolkit/client';

// Export standalone-specific components (functional)
export * from './tokens';
export * from './auth.service';
export * from './http-adapter';
export * from './auth.interceptor';
export * from './auth.guard';
export * from './social-redirect-callback.guard';

