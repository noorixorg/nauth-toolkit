import 'reflect-metadata';
import { TOTPService } from './totp.service';
import { NAuthConfig, NAuthLogger, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';

// Create a mock for QRCode.toDataURL
jest.mock('qrcode', () => {
  const actual = jest.requireActual('qrcode');
  return {
    ...actual,
    toDataURL: jest.fn(),
  };
});

const mockToDataURL = qrcode.toDataURL as jest.Mock;

/**
 * TOTP Service Unit Tests
 *
 * Tests TOTP secret generation, QR code creation, code verification,
 * and utility methods. Uses direct instantiation, no NestJS dependencies.
 */
describe('TOTPService', () => {
  let service: TOTPService;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create mock config
    mockConfig = {
      mfa: {
        issuer: 'TestApp',
        totp: {
          window: 1,
          stepSeconds: 30,
          digits: 6,
          algorithm: 'sha1',
        },
      },
    } as NAuthConfig;

    // Instantiate service directly
    service = new TOTPService(mockConfig, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should configure authenticator with config values', () => {
    const spy = jest.spyOn(authenticator, 'options', 'set');
    new TOTPService(mockConfig, mockLogger);

    expect(spy).toHaveBeenCalled();
  });

  it('should use default config when TOTP config not provided', () => {
    const configWithoutTotp = {} as NAuthConfig;
    const serviceWithDefaults = new TOTPService(configWithoutTotp, mockLogger);

    expect(serviceWithDefaults).toBeDefined();
  });

  // ============================================================================
  // generateSecret() Method
  // ============================================================================

  describe('generateSecret', () => {
    it('should generate secret and QR code', async () => {
      const mockSecret = 'ABCDEFGHIJKLMNOP';
      const mockQRCode = 'data:image/png;base64,test-qr-code';
      jest.spyOn(authenticator, 'generateSecret').mockReturnValue(mockSecret);
      jest
        .spyOn(authenticator, 'keyuri')
        .mockReturnValue('otpauth://totp/TestApp:user@example.com?secret=ABCDEFGHIJKLMNOP&issuer=TestApp');
      mockToDataURL.mockResolvedValue(mockQRCode);

      const result = await service.generateSecret('user@example.com');

      expect(result.secret).toBe(mockSecret);
      expect(result.qrCode).toBe(mockQRCode);
      expect(result.issuer).toBe('TestApp');
      expect(result.accountName).toBe('user@example.com');
      expect(result.manualEntryKey).toBe('ABCD EFGH IJKL MNOP');
    });

    it('should use default issuer when not configured', async () => {
      const configWithoutIssuer = {
        mfa: {
          totp: {
            window: 1,
            stepSeconds: 30,
            digits: 6,
            algorithm: 'sha1',
          },
        },
      } as NAuthConfig;

      const serviceWithoutIssuer = new TOTPService(configWithoutIssuer, mockLogger);
      const mockSecret = 'ABCDEFGHIJKLMNOP';
      jest.spyOn(authenticator, 'generateSecret').mockReturnValue(mockSecret);
      jest
        .spyOn(authenticator, 'keyuri')
        .mockReturnValue('otpauth://totp/nauth-toolkit:user@example.com?secret=ABCDEFGHIJKLMNOP&issuer=nauth-toolkit');
      mockToDataURL.mockResolvedValue('data:image/png;base64,test');

      const result = await serviceWithoutIssuer.generateSecret('user@example.com');

      expect(result.issuer).toBe('nauth-toolkit');
    });

    it('should format manual entry key with spaces', async () => {
      const mockSecret = 'ABCDEFGHIJKLMNOPQRST';
      jest.spyOn(authenticator, 'generateSecret').mockReturnValue(mockSecret);
      jest
        .spyOn(authenticator, 'keyuri')
        .mockReturnValue('otpauth://totp/TestApp:user@example.com?secret=ABCDEFGHIJKLMNOPQRST&issuer=TestApp');
      mockToDataURL.mockResolvedValue('data:image/png;base64,test');

      const result = await service.generateSecret('user@example.com');

      expect(result.manualEntryKey).toBe('ABCD EFGH IJKL MNOP QRST');
    });

    it('should throw error if QR code generation fails', async () => {
      const mockSecret = 'ABCDEFGHIJKLMNOP';
      jest.spyOn(authenticator, 'generateSecret').mockReturnValue(mockSecret);
      jest
        .spyOn(authenticator, 'keyuri')
        .mockReturnValue('otpauth://totp/TestApp:user@example.com?secret=ABCDEFGHIJKLMNOP&issuer=TestApp');
      mockToDataURL.mockRejectedValue(new Error('QR code generation failed'));

      try {
        await service.generateSecret('user@example.com');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.INTERNAL_ERROR);
        expect((error as NAuthException).message).toContain('Failed to generate QR code');
      }
    });

    it('should log generation success', async () => {
      const mockSecret = 'ABCDEFGHIJKLMNOP';
      jest.spyOn(authenticator, 'generateSecret').mockReturnValue(mockSecret);
      jest
        .spyOn(authenticator, 'keyuri')
        .mockReturnValue('otpauth://totp/TestApp:user@example.com?secret=ABCDEFGHIJKLMNOP&issuer=TestApp');
      mockToDataURL.mockResolvedValue('data:image/png;base64,test');

      await service.generateSecret('user@example.com');

      expect(mockLogger.log).toHaveBeenCalledWith((expect as any).stringContaining('Generating TOTP secret'));
      expect(mockLogger.log).toHaveBeenCalledWith(
        (expect as any).stringContaining('TOTP secret generated successfully'),
      );
    });
  });

  // ============================================================================
  // verifyCode() Method
  // ============================================================================

  describe('verifyCode', () => {
    it('should verify valid TOTP code', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '123456';
      jest.spyOn(authenticator, 'verify').mockReturnValue(true);

      const result = service.verifyCode(secret, code);

      expect(result).toBe(true);
      expect(authenticator.verify).toHaveBeenCalledWith({
        token: code,
        secret,
      });
    });

    it('should reject invalid TOTP code', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '123456';
      jest.spyOn(authenticator, 'verify').mockReturnValue(false);

      const result = service.verifyCode(secret, code);

      expect(result).toBe(false);
    });

    it('should remove spaces from code', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '123 456';
      jest.spyOn(authenticator, 'verify').mockReturnValue(true);

      service.verifyCode(secret, code);

      expect(authenticator.verify).toHaveBeenCalledWith({
        token: '123456',
        secret,
      });
    });

    it('should reject code with invalid format', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '12345'; // Too short

      const result = service.verifyCode(secret, code);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid TOTP code format');
    });

    it('should reject code with non-numeric characters', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '12345A'; // Contains letter

      const result = service.verifyCode(secret, code);

      expect(result).toBe(false);
    });

    it('should handle verification errors gracefully', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '123456';
      jest.spyOn(authenticator, 'verify').mockImplementation(() => {
        throw new Error('Verification error');
      });

      const result = service.verifyCode(secret, code);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('TOTP verification error', (expect as any).anything());
    });

    it('should log successful verification', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '123456';
      jest.spyOn(authenticator, 'verify').mockReturnValue(true);

      service.verifyCode(secret, code);

      expect(mockLogger.debug).toHaveBeenCalledWith('TOTP code verified successfully');
    });

    it('should log failed verification', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '123456';
      jest.spyOn(authenticator, 'verify').mockReturnValue(false);

      service.verifyCode(secret, code);

      expect(mockLogger.warn).toHaveBeenCalledWith('TOTP code verification failed');
    });
  });

  // ============================================================================
  // verifyCodeWithDetails() Method
  // ============================================================================

  describe('verifyCodeWithDetails', () => {
    it('should return valid result for correct code', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '123456';
      jest.spyOn(service, 'verifyCode').mockReturnValue(true);

      const result = service.verifyCodeWithDetails(secret, code);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for empty code', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '';

      const result = service.verifyCodeWithDetails(secret, code);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Code is required');
    });

    it('should return error for invalid code format', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '12345';

      const result = service.verifyCodeWithDetails(secret, code);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Code must be 6 digits');
    });

    it('should return error for invalid secret', () => {
      const secret = 'SHORT'; // Too short
      const code = '123456';

      const result = service.verifyCodeWithDetails(secret, code);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid secret');
    });

    it('should return error for null secret', () => {
      const secret = null as any;
      const code = '123456';

      const result = service.verifyCodeWithDetails(secret, code);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid secret');
    });

    it('should return error for invalid or expired code', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '123456';
      jest.spyOn(service, 'verifyCode').mockReturnValue(false);

      const result = service.verifyCodeWithDetails(secret, code);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or expired code');
    });

    it('should remove spaces from code', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const code = '123 456';
      jest.spyOn(service, 'verifyCode').mockReturnValue(true);

      service.verifyCodeWithDetails(secret, code);

      expect(service.verifyCode).toHaveBeenCalledWith(secret, '123456');
    });
  });

  // ============================================================================
  // generateCode() Method
  // ============================================================================

  describe('generateCode', () => {
    it('should generate current TOTP code', () => {
      const secret = 'ABCDEFGHIJKLMNOP';
      const mockCode = '123456';
      jest.spyOn(authenticator, 'generate').mockReturnValue(mockCode);

      const result = service.generateCode(secret);

      expect(result).toBe(mockCode);
      expect(authenticator.generate).toHaveBeenCalledWith(secret);
    });
  });

  // ============================================================================
  // isValidSecret() Method
  // ============================================================================

  describe('isValidSecret', () => {
    it('should return true for valid base32 secret', () => {
      const secret = 'ABCDEFGHIJKLMNOP';

      const result = service.isValidSecret(secret);

      expect(result).toBe(true);
    });

    it('should return false for secret shorter than 16 characters', () => {
      const secret = 'SHORT';

      const result = service.isValidSecret(secret);

      expect(result).toBe(false);
    });

    it('should return false for null secret', () => {
      const secret = null as any;

      const result = service.isValidSecret(secret);

      expect(result).toBe(false);
    });

    it('should return false for non-string secret', () => {
      const secret = 12345 as any;

      const result = service.isValidSecret(secret);

      expect(result).toBe(false);
    });

    it('should return false for secret with invalid characters', () => {
      const validSecret = 'ABCDEFGHIJKLMNOP'; // Valid base32 (A-Z only)
      const invalidSecret1 = 'ABCDEFGHIJKLMNOP0'; // Contains '0' which is invalid in base32
      const invalidSecret2 = 'ABCDEFGHIJKLMNOP1'; // Contains '1' which is invalid in base32

      expect(service.isValidSecret(validSecret)).toBe(true);
      expect(service.isValidSecret(invalidSecret1)).toBe(false); // '0' is invalid
      expect(service.isValidSecret(invalidSecret2)).toBe(false); // '1' is invalid
    });

    it('should accept valid base32 characters (A-Z, 2-7)', () => {
      expect(service.isValidSecret('ABCDEFGHIJKLMNOP')).toBe(true);
      expect(service.isValidSecret('234567ABCDEFGHIJ')).toBe(true);
      expect(service.isValidSecret('ABCDEFGH234567IJ')).toBe(true);
    });
  });

  // ============================================================================
  // getTimeRemaining() Method
  // ============================================================================

  describe('getTimeRemaining', () => {
    it('should return time remaining until next code', () => {
      const result = service.getTimeRemaining();

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(30); // Default stepSeconds is 30
    });

    it('should use configured stepSeconds', () => {
      const configWithCustomStep = {
        mfa: {
          totp: {
            stepSeconds: 60,
            window: 1,
            digits: 6,
            algorithm: 'sha1',
          },
        },
      } as NAuthConfig;

      const serviceWithCustomStep = new TOTPService(configWithCustomStep, mockLogger);
      const result = serviceWithCustomStep.getTimeRemaining();

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(60);
    });
  });
});
