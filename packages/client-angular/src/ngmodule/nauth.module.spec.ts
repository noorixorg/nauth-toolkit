/**
 * NAuth Module Unit Tests
 */
import 'reflect-metadata';
import { NAuthModule } from './nauth.module';
import { NAUTH_CLIENT_CONFIG } from './tokens';
import { NAuthClientConfig } from '@nauth-toolkit/client';

// Mock Angular inject
const mockInject = jest.fn();
jest.mock('@angular/core', () => {
  const actual = jest.requireActual('../../__mocks__/angular-core');
  return {
    ...actual,
    inject: (token: unknown, options?: { optional?: boolean }) => mockInject(token, options),
  };
});

describe('NAuthModule', () => {
  let mockConfig: NAuthClientConfig;

  beforeEach(() => {
    mockConfig = {
      baseUrl: 'http://localhost:3000',
      tokenDelivery: 'cookies',
    } as NAuthClientConfig;
  });

  it('should return ModuleWithProviders with correct structure', () => {
    const result = NAuthModule.forRoot(mockConfig);

    expect(result).toHaveProperty('ngModule');
    expect(result).toHaveProperty('providers');
    expect(result.ngModule).toBe(NAuthModule);
    expect(Array.isArray(result.providers)).toBe(true);
  });

  it('should provide NAUTH_CLIENT_CONFIG with useValue', () => {
    const result = NAuthModule.forRoot(mockConfig);
    const configProvider = result.providers?.find((p: any) => p.provide === NAUTH_CLIENT_CONFIG) as any;

    expect(configProvider).toBeDefined();
    expect(configProvider?.useValue).toBe(mockConfig);
  });

  it('should provide AngularHttpAdapter', () => {
    const result = NAuthModule.forRoot(mockConfig);
    const adapterProvider = result.providers?.find((p: any) => p === require('./http-adapter').AngularHttpAdapter);

    expect(adapterProvider).toBeDefined();
  });

  it('should provide AuthService with factory', () => {
    const result = NAuthModule.forRoot(mockConfig);
    const authServiceProvider = result.providers?.find((p: any) => p.provide === require('./auth.service').AuthService) as any;

    expect(authServiceProvider).toBeDefined();
    expect(authServiceProvider?.useFactory).toBeDefined();
    // Verify deps structure: [AngularHttpAdapter, [Optional(), RecaptchaService]]
    expect(authServiceProvider?.deps).toHaveLength(2);
    expect(authServiceProvider?.deps[0]).toBe(require('./http-adapter').AngularHttpAdapter);
    expect(Array.isArray(authServiceProvider?.deps[1])).toBe(true);
    expect(authServiceProvider?.deps[1][1]).toBe(require('../lib/recaptcha.service').RecaptchaService);
  });

  it('should provide HTTP_INTERCEPTORS with AuthInterceptorClass', () => {
    const result = NAuthModule.forRoot(mockConfig);
    // Find provider with useClass matching AuthInterceptorClass
    const interceptorProvider = result.providers?.find(
      (p: any) => p && typeof p === 'object' && p.useClass === require('./auth.interceptor.class').AuthInterceptorClass,
    ) as any;

    expect(interceptorProvider).toBeDefined();
    expect(interceptorProvider?.useClass).toBe(require('./auth.interceptor.class').AuthInterceptorClass);
    expect(interceptorProvider?.multi).toBe(true);
  });

  it('should provide AuthGuard', () => {
    const result = NAuthModule.forRoot(mockConfig);
    const guardProvider = result.providers?.find((p: any) => p === require('../lib/auth.guard').AuthGuard);

    expect(guardProvider).toBeDefined();
  });
});
