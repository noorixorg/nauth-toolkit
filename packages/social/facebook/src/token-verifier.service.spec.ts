import 'reflect-metadata';
import { TokenVerifierService } from './token-verifier.service';
import { NAuthConfig, NAuthLogger, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';
import { VerifiedFacebookTokenProfile } from './verified-token-profile.interface';

// Mock global fetch
global.fetch = jest.fn();

describe('TokenVerifierService (Facebook)', () => {
  let service: TokenVerifierService;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as NAuthLogger;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test-secret', expiresIn: '15m' },
        refreshToken: { secret: 'test-refresh-secret', expiresIn: '7d' },
      },
      logger: mockLogger,
    } as unknown as NAuthConfig;

    service = new TokenVerifierService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyFacebookToken', () => {
    it('should verify valid Facebook access token', async () => {
      const debugData = {
        data: {
          is_valid: true,
          app_id: 'app-id',
        },
      };

      const profileData: VerifiedFacebookTokenProfile = {
        id: 'facebook-user-id',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        picture: { data: { url: 'https://example.com/photo.jpg' } },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => debugData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => profileData,
        });

      const result = await service.verifyFacebookToken('access-token', 'app-id', 'app-secret');

      expect(result).toEqual(profileData);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when token is invalid', async () => {
      const debugData = {
        data: {
          is_valid: false,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => debugData,
      });

      try {
        await service.verifyFacebookToken('invalid-token', 'app-id', 'app-secret');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_TOKEN_INVALID);
      }
    });

    it('should throw error when token belongs to different app', async () => {
      const debugData = {
        data: {
          is_valid: true,
          app_id: 'different-app-id',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => debugData,
      });

      try {
        await service.verifyFacebookToken('access-token', 'app-id', 'app-secret');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_TOKEN_INVALID);
        expect((error as NAuthException).message).toContain('Token does not belong to this app');
      }
    });
  });

  describe('verifyFacebookIdToken', () => {
    it('should verify valid Facebook ID token (Limited Login)', async () => {
      const mockJose = {
        createRemoteJWKSet: jest.fn().mockReturnValue('jwks'),
        jwtVerify: jest.fn().mockResolvedValue({
          payload: {
            sub: 'facebook-user-sub',
            email: 'user@example.com',
            given_name: 'John',
            family_name: 'Doe',
            picture: 'https://example.com/photo.jpg',
          },
        }),
      };

      service = new TokenVerifierService(mockConfig, async () => mockJose as unknown as typeof import('jose'));

      const result = await service.verifyFacebookIdToken('header.payload.signature', 'app-id');

      expect(result.sub).toBe('facebook-user-sub');
      expect(result.email).toBe('user@example.com');
      expect(mockJose.jwtVerify).toHaveBeenCalledTimes(1);
    });

    it('should throw when sub is missing', async () => {
      const mockJose = {
        createRemoteJWKSet: jest.fn().mockReturnValue('jwks'),
        jwtVerify: jest.fn().mockResolvedValue({
          payload: {
            email: 'user@example.com',
          },
        }),
      };

      service = new TokenVerifierService(mockConfig, async () => mockJose as unknown as typeof import('jose'));

      await expect(service.verifyFacebookIdToken('header.payload.signature', 'app-id')).rejects.toBeInstanceOf(
        NAuthException,
      );
    });
  });
});
