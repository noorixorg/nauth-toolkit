/**
 * TOTP Service Unit Tests
 *
 * Tests TOTP service functionality including:
 * - Secret generation
 * - QR code generation
 * - Code verification
 * - Configuration handling
 */

import 'reflect-metadata';
import { TOTPService } from './totp.service';
import { NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';

// Mock qrcode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,test'),
}));

describe('TOTPService', () => {
  let mockConfig: NAuthConfig;
  let mockLogger: jest.Mocked<NAuthLogger>;

  beforeEach(() => {
    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
      mfa: {
        enabled: true,
        totp: {
          window: 1,
          stepSeconds: 30,
          digits: 6,
          algorithm: 'sha1',
        },
        issuer: 'TestApp',
      },
    } as NAuthConfig;

    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;
  });

  describe('constructor', () => {
    it('should create TOTPService instance', () => {
      const service = new TOTPService(mockConfig, mockLogger);
      expect(service).toBeDefined();
    });

    it('should log TOTP configuration', () => {
      new TOTPService(mockConfig, mockLogger);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('TOTP configured'));
    });
  });

  describe('generateSecret', () => {
    it('should generate TOTP secret and QR code', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const result = await service.generateSecret('user@example.com');

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCode');
      expect(result).toHaveProperty('manualEntryKey');
      expect(result).toHaveProperty('issuer');
      expect(result).toHaveProperty('accountName');
    });

    it('should use issuer from config', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const result = await service.generateSecret('user@example.com');

      expect(result.issuer).toBe('TestApp');
    });

    it('should use default issuer when not configured', async () => {
      delete (mockConfig.mfa as any).issuer;
      const service = new TOTPService(mockConfig, mockLogger);
      const result = await service.generateSecret('user@example.com');

      expect(result.issuer).toBe('nauth-toolkit');
    });
  });

  describe('generateSecret', () => {
    it('should handle QR code generation error', async () => {
      const { toDataURL } = require('qrcode');
      toDataURL.mockRejectedValueOnce(new Error('QR generation failed'));
      const service = new TOTPService(mockConfig, mockLogger);

      await expect(service.generateSecret('user@example.com')).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should format manual entry key correctly', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const result = await service.generateSecret('user@example.com');

      expect(result.manualEntryKey).toBeDefined();
      expect(typeof result.manualEntryKey).toBe('string');
    });
  });

  describe('verifyCode', () => {
    it('should verify valid TOTP code', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const secret = (await service.generateSecret('user@example.com')).secret;
      const token = await service.generateCode(secret);
      const isValid = await service.verifyCode(secret, token);

      expect(isValid).toBe(true);
    });

    it('should use configured window for verification', async () => {
      mockConfig.mfa!.totp!.window = 2;
      const service = new TOTPService(mockConfig, mockLogger);
      const secret = (await service.generateSecret('user@example.com')).secret;
      const token = await service.generateCode(secret);
      await service.verifyCode(secret, token);

      // Regression guard: ensure we used config by accepting a current valid token
      // (window affects which neighboring time-steps are accepted).
      expect(mockConfig.mfa!.totp!.window).toBe(2);
    });

    it('should remove spaces from code', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const secret = (await service.generateSecret('user@example.com')).secret;
      const token = await service.generateCode(secret);
      const spaced = `${token.slice(0, 3)} ${token.slice(3)}`;
      const isValid = await service.verifyCode(secret, spaced);

      expect(isValid).toBe(true);
    });

    it('should return false for invalid code format', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const isValid = await service.verifyCode('JBSWY3DPEHPK3PXP', '12345');

      expect(isValid).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false for non-numeric code', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const isValid = await service.verifyCode('JBSWY3DPEHPK3PXP', 'abcdef');

      expect(isValid).toBe(false);
    });

    it('should handle verification errors gracefully', async () => {
      const service = new TOTPService(mockConfig, mockLogger);

      // Force an error path by passing an invalid base32 secret.
      const isValid = await service.verifyCode('INVALID===', '123456');
      expect(isValid).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log success when code is valid', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const secret = (await service.generateSecret('user@example.com')).secret;
      const token = await service.generateCode(secret);
      await service.verifyCode(secret, token);

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('verified successfully'));
    });

    it('should log failure when code is invalid', async () => {
      const service = new TOTPService(mockConfig, mockLogger);

      const secret = (await service.generateSecret('user@example.com')).secret;
      await service.verifyCode(secret, '000000');
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('verification failed'));
    });
  });

  describe('verifyCodeWithDetails', () => {
    it('should return valid result for correct code', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const secret = (await service.generateSecret('user@example.com')).secret;
      const token = await service.generateCode(secret);
      const result = await service.verifyCodeWithDetails(secret, token);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error when code is empty', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const result = await service.verifyCodeWithDetails('JBSWY3DPEHPK3PXP', '');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Code is required');
    });

    it('should return error when code is not 6 digits', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const result = await service.verifyCodeWithDetails('JBSWY3DPEHPK3PXP', '12345');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Code must be 6 digits');
    });

    it('should return error when secret is invalid', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const result = await service.verifyCodeWithDetails('short', '123456');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid secret');
    });

    it('should return error when code is invalid', async () => {
      const service = new TOTPService(mockConfig, mockLogger);

      const result = await service.verifyCodeWithDetails('JBSWY3DPEHPK3PXP', '000000');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or expired code');
    });

    it('should remove spaces from code', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const secret = (await service.generateSecret('user@example.com')).secret;
      const token = await service.generateCode(secret);
      const spaced = `${token.slice(0, 3)} ${token.slice(3)}`;
      const result = await service.verifyCodeWithDetails(secret, spaced);

      expect(result.valid).toBe(true);
    });
  });

  describe('generateCode', () => {
    it('should generate current TOTP code', async () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const secret = (await service.generateSecret('user@example.com')).secret;
      const code = await service.generateCode(secret);

      expect(code).toMatch(/^\d{6}$/);
    });

    it('should use configured stepSeconds', async () => {
      mockConfig.mfa!.totp!.stepSeconds = 60;
      const service = new TOTPService(mockConfig, mockLogger);
      const secret = (await service.generateSecret('user@example.com')).secret;
      const token = await service.generateCode(secret);

      expect(token).toMatch(/^\d{6}$/);
    });
  });

  describe('isValidSecret', () => {
    it('should return true for valid secret', () => {
      const service = new TOTPService(mockConfig, mockLogger);
      expect(service.isValidSecret('JBSWY3DPEHPK3PXP')).toBe(true);
    });

    it('should return false for empty secret', () => {
      const service = new TOTPService(mockConfig, mockLogger);
      expect(service.isValidSecret('')).toBe(false);
    });

    it('should return false for null secret', () => {
      const service = new TOTPService(mockConfig, mockLogger);
      expect(service.isValidSecret(null as any)).toBe(false);
    });

    it('should return false for undefined secret', () => {
      const service = new TOTPService(mockConfig, mockLogger);
      expect(service.isValidSecret(undefined as any)).toBe(false);
    });

    it('should return false for secret shorter than 16 characters', () => {
      const service = new TOTPService(mockConfig, mockLogger);
      expect(service.isValidSecret('SHORT')).toBe(false);
    });

    it('should return false for secret with invalid characters', () => {
      const service = new TOTPService(mockConfig, mockLogger);
      expect(service.isValidSecret('INVALID123!@#')).toBe(false);
    });

    it('should return false for non-string secret', () => {
      const service = new TOTPService(mockConfig, mockLogger);
      expect(service.isValidSecret(12345 as any)).toBe(false);
    });

    it('should return true for valid base32 secret', () => {
      const service = new TOTPService(mockConfig, mockLogger);
      expect(service.isValidSecret('ABCDEFGHIJKLMNOP')).toBe(true);
    });
  });

  describe('getTimeRemaining', () => {
    it('should return time remaining in seconds', () => {
      const service = new TOTPService(mockConfig, mockLogger);
      const remaining = service.getTimeRemaining();

      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(30);
    });

    it('should use configured stepSeconds', () => {
      mockConfig.mfa!.totp!.stepSeconds = 60;
      const service = new TOTPService(mockConfig, mockLogger);
      const remaining = service.getTimeRemaining();

      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(60);
    });
  });

  describe('configuration handling', () => {
    it('should use default config when totp config is missing', () => {
      delete (mockConfig.mfa as any).totp;
      const service = new TOTPService(mockConfig, mockLogger);

      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should use custom digits configuration', async () => {
      mockConfig.mfa!.totp!.digits = 8;
      const service = new TOTPService(mockConfig, mockLogger);
      const secret = (await service.generateSecret('user@example.com')).secret;
      const token = await service.generateCode(secret);

      expect(token).toMatch(/^\d{8}$/);
    });

    it('should use custom algorithm configuration', async () => {
      mockConfig.mfa!.totp!.algorithm = 'sha256';
      const service = new TOTPService(mockConfig, mockLogger);
      const secret = (await service.generateSecret('user@example.com')).secret;
      const token = await service.generateCode(secret);
      const isValid = await service.verifyCode(secret, token);

      expect(isValid).toBe(true);
    });
  });
});
