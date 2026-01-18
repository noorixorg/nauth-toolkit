/**
 * Auth Module Unit Tests
 *
 * Tests AuthModule functionality including:
 * - Module configuration
 * - Provider registration
 * - Configuration validation
 */

import { AuthModule } from './auth.module';
import { NAuthConfig, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

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
});
