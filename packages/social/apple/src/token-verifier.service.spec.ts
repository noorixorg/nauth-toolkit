import { TokenVerifierService } from './token-verifier.service';
import { NAuthConfig, NAuthLogger, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Mock jose
jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  createRemoteJWKSet: jest.fn(),
}));

describe('TokenVerifierService (Apple)', () => {
  let service: TokenVerifierService;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test-secret', expiresIn: '15m' },
        refreshToken: { secret: 'test-refresh-secret', expiresIn: '7d' },
      },
      logger: mockLogger,
    } as NAuthConfig;

    (createRemoteJWKSet as jest.Mock).mockReturnValue(jest.fn());

    service = new TokenVerifierService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyAppleToken', () => {
    it('should verify valid Apple ID token', async () => {
      const payload = {
        sub: 'apple-user-id',
        email: 'user@example.com',
        email_verified: true,
        is_private_email: false,
      };

      (jwtVerify as jest.Mock).mockResolvedValue({ payload });

      const result = await service.verifyAppleToken('id-token', 'client-id');

      expect(result).toEqual({
        sub: 'apple-user-id',
        email: 'user@example.com',
        email_verified: true,
        is_private_email: false,
      });
      expect(jwtVerify).toHaveBeenCalledWith(
        'id-token',
        (expect as any).any(Function),
        (expect as any).objectContaining({
          issuer: 'https://appleid.apple.com',
          audience: 'client-id',
        }),
      );
    });

    it('should handle email_verified as string "true"', async () => {
      const payload = {
        sub: 'apple-user-id',
        email: 'user@example.com',
        email_verified: 'true',
        is_private_email: false,
      };

      (jwtVerify as jest.Mock).mockResolvedValue({ payload });

      const result = await service.verifyAppleToken('id-token', 'client-id');

      expect(result.email_verified).toBe(true);
    });

    it('should throw error when token verification fails', async () => {
      (jwtVerify as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      try {
        await service.verifyAppleToken('invalid-token', 'client-id');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_TOKEN_INVALID);
        expect((error as NAuthException).message).toContain('Apple token verification failed');
      }
    });
  });
});
