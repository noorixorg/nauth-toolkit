/**
 * Auth Module Unit Tests
 *
 * Tests AuthModule functionality including:
 * - Module configuration
 * - Provider registration
 * - Configuration validation
 */

import { AuthModule } from './auth.module';
import { NAuthConfig, NAuthException, AuthErrorCode, AuthService, SocialAuthService } from '@nauth-toolkit/core';

describe('AuthModule', () => {
  let mockConfig: NAuthConfig;

  beforeEach(() => {
    // Create a valid config that passes Zod validation
    const validSecret = 'a'.repeat(32); // Minimum 32 characters for refresh token
    mockConfig = {
      jwt: {
        accessToken: { secret: validSecret, expiresIn: 3600 },
        refreshToken: { secret: validSecret, expiresIn: 86400 },
      },
      emailProvider: {
        sendVerificationEmail: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        sendWelcomeEmail: jest.fn(),
      } as any,
      signup: {
        verificationMethod: 'none' as const,
      },
    } as NAuthConfig;
  });

  describe('forRoot', () => {
    it('should return DynamicModule', () => {
      const module = AuthModule.forRoot(mockConfig);
      expect(module).toBeDefined();
      expect(module.module).toBe(AuthModule);
    });

    it('should include providers array', () => {
      const module = AuthModule.forRoot(mockConfig);
      expect(module.providers).toBeDefined();
      expect(Array.isArray(module.providers)).toBe(true);
      expect(module.providers!.length).toBeGreaterThan(0);
    });

    it('should include exports array', () => {
      const module = AuthModule.forRoot(mockConfig);
      expect(module.exports).toBeDefined();
      expect(Array.isArray(module.exports)).toBe(true);
      expect(module.exports!.length).toBeGreaterThan(0);
    });

    it('should include imports array', () => {
      const module = AuthModule.forRoot(mockConfig);
      expect(module.imports).toBeDefined();
      expect(Array.isArray(module.imports)).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      expect(() => AuthModule.forRoot(mockConfig)).not.toThrow();
    });

    it('should throw NAuthException for invalid configuration', () => {
      const invalidConfig = {} as NAuthConfig;
      expect(() => AuthModule.forRoot(invalidConfig)).toThrow(NAuthException);
      try {
        AuthModule.forRoot(invalidConfig);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
      }
    });

    it('should throw error for missing JWT config', () => {
      const invalidConfig = {
        emailProvider: mockConfig.emailProvider,
      } as NAuthConfig;
      expect(() => AuthModule.forRoot(invalidConfig)).toThrow();
    });
  });

  describe('social auth wiring', () => {
    /** Find a factory provider in the module by the token it provides. */
    const findProvider = (
      providers: unknown[],
      token: unknown,
    ): { inject?: unknown[]; useFactory?: (...args: unknown[]) => unknown } | undefined =>
      providers.find(
        (provider): provider is { provide: unknown; inject?: unknown[] } =>
          typeof provider === 'object' && provider !== null && (provider as { provide?: unknown }).provide === token,
      );

    it('injects the real AuthService into SocialAuthService', () => {
      const module = AuthModule.forRoot({
        ...mockConfig,
        social: {
          redirect: { frontendBaseUrl: 'https://app.example.com' },
          google: { enabled: true, clientId: 'id', clientSecret: 'secret' },
        },
      } as NAuthConfig);

      const socialProvider = findProvider(module.providers ?? [], SocialAuthService);

      expect(socialProvider).toBeDefined();
      // WHY: SocialAuthService.setPasswordForSocialUser() delegates to
      // AuthService.changePassword(). Built with null - as it was to dodge a DI cycle -
      // POST /auth/social/set-password answered 500 "AuthService is not available" on
      // every NestJS deployment, while Express and Fastify worked.
      expect(socialProvider?.inject).toContain(AuthService);
    });

    it('does not inject SocialAuthService back into AuthService', () => {
      const module = AuthModule.forRoot({
        ...mockConfig,
        social: {
          redirect: { frontendBaseUrl: 'https://app.example.com' },
          google: { enabled: true, clientId: 'id', clientSecret: 'secret' },
        },
      } as NAuthConfig);

      const authProvider = findProvider(module.providers ?? [], AuthService);

      expect(authProvider).toBeDefined();
      // The reverse edge is what made the cycle. AuthService declares the parameter but
      // never reads it, so re-adding this would break social set-password again.
      expect(authProvider?.inject).not.toContain(SocialAuthService);
    });
  });
});
