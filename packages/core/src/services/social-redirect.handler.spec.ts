import { SocialRedirectHandler } from './social-redirect.handler';
import { NAuthConfig } from '../interfaces/config.interface';
import { SocialProviderRegistry } from './social-provider-registry.service';
import { ISocialAuthStateStore } from '../interfaces/social-auth-state-store.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { AuthResponseDTO } from '../dto/auth-response.dto';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { ContextStorage } from '../utils/context-storage';

describe('SocialRedirectHandler', () => {
  let handler: SocialRedirectHandler;
  let mockConfig: NAuthConfig;
  let mockProviderRegistry: jest.Mocked<SocialProviderRegistry>;
  let mockStateStore: jest.Mocked<ISocialAuthStateStore>;
  let mockStorage: jest.Mocked<StorageAdapter>;

  beforeEach(() => {
    mockConfig = {
      tokenDelivery: {
        method: 'cookies',
        cookieOptions: {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/',
        },
      },
      social: {
        redirect: {
          frontendBaseUrl: 'https://frontend.example.com',
        },
      },
    } as unknown as NAuthConfig;

    mockProviderRegistry = {
      getProvider: jest.fn(),
    } as unknown as jest.Mocked<SocialProviderRegistry>;

    mockStateStore = {
      createCsrfState: jest.fn().mockResolvedValue('csrf-state-123'),
      setRedirectContext: jest.fn().mockResolvedValue(undefined),
      consumeRedirectContext: jest.fn().mockResolvedValue({
        returnTo: '/auth/callback',
        appState: 'app-state-123',
        action: 'login',
        delivery: 'cookies',
      }),
      validateAndConsumeCsrfState: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<ISocialAuthStateStore>;

    mockStorage = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<StorageAdapter>;

    handler = new SocialRedirectHandler(mockConfig, mockProviderRegistry, mockStateStore, mockStorage, undefined, 60);
  });

  describe('callback - cookies mode sanitization', () => {
    it('should remove tokens and expiries from authResponse in cookies mode', async () => {
      // Use future expiration timestamps (15 minutes and 30 days from now)
      const futureAccessExp = Math.floor(Date.now() / 1000) + 15 * 60; // 15 minutes
      const futureRefreshExp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

      const mockAuthResponse: AuthResponseDTO = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        accessTokenExpiresAt: futureAccessExp,
        refreshTokenExpiresAt: futureRefreshExp,
        deviceToken: 'device-token-789',
        user: {
          sub: 'user-sub-123',
          email: 'user@example.com',
          isEmailVerified: true,
        },
        authMethod: 'google',
      };

      const mockProvider = {
        handleCallback: jest.fn().mockResolvedValue(mockAuthResponse),
        getAuthUrl: jest.fn().mockResolvedValue('https://provider.com/auth'),
      };

      mockProviderRegistry.getProvider = jest.fn().mockReturnValue(mockProvider);

      const result = await handler.callback({
        provider: 'google',
        code: 'oauth-code-123',
        state: 'csrf-state-123',
        req: {},
      });

      // Verify cookies are set
      expect(result.cookies).toBeDefined();
      expect(result.cookies?.length).toBeGreaterThan(0);

      // Verify authResponse is sanitized (tokens and expiries removed)
      expect(result.authResponse).toBeDefined();
      expect(result.authResponse?.accessToken).toBeUndefined();
      expect(result.authResponse?.refreshToken).toBeUndefined();
      expect(result.authResponse?.accessTokenExpiresAt).toBeUndefined();
      expect(result.authResponse?.refreshTokenExpiresAt).toBeUndefined();
      expect(result.authResponse?.deviceToken).toBeUndefined();

      // Verify user data is preserved
      expect(result.authResponse?.user).toBeDefined();
      expect(result.authResponse?.user?.sub).toBe('user-sub-123');
      expect(result.authResponse?.user?.email).toBe('user@example.com');
      expect(result.authResponse?.authMethod).toBe('google');
    });

    it('should preserve all non-token fields in cookies mode', async () => {
      // Use future expiration timestamps (15 minutes and 30 days from now)
      const futureAccessExp = Math.floor(Date.now() / 1000) + 15 * 60; // 15 minutes
      const futureRefreshExp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

      const mockAuthResponse: AuthResponseDTO = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        accessTokenExpiresAt: futureAccessExp,
        refreshTokenExpiresAt: futureRefreshExp,
        deviceToken: 'device-token-789',
        user: {
          sub: 'user-sub-123',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isEmailVerified: true,
          socialProviders: ['google'],
        },
        authMethod: 'google',
        trusted: true,
      };

      const mockProvider = {
        handleCallback: jest.fn().mockResolvedValue(mockAuthResponse),
        getAuthUrl: jest.fn().mockResolvedValue('https://provider.com/auth'),
      };

      mockProviderRegistry.getProvider = jest.fn().mockReturnValue(mockProvider);

      const result = await handler.callback({
        provider: 'google',
        code: 'oauth-code-123',
        state: 'csrf-state-123',
        req: {},
      });

      // Verify tokens are removed
      expect(result.authResponse?.accessToken).toBeUndefined();
      expect(result.authResponse?.refreshToken).toBeUndefined();
      expect(result.authResponse?.accessTokenExpiresAt).toBeUndefined();
      expect(result.authResponse?.refreshTokenExpiresAt).toBeUndefined();
      expect(result.authResponse?.deviceToken).toBeUndefined();

      // Verify all other fields are preserved
      expect(result.authResponse?.user).toBeDefined();
      expect(result.authResponse?.user?.sub).toBe('user-sub-123');
      expect(result.authResponse?.user?.email).toBe('user@example.com');
      expect(result.authResponse?.user?.firstName).toBe('John');
      expect(result.authResponse?.user?.lastName).toBe('Doe');
      expect(result.authResponse?.user?.isEmailVerified).toBe(true);
      expect(result.authResponse?.user?.socialProviders).toEqual(['google']);
      expect(result.authResponse?.authMethod).toBe('google');
      expect(result.authResponse?.trusted).toBe(true);
    });

    it('should not sanitize in json mode', async () => {
      // Override config for json mode
      mockConfig.tokenDelivery = {
        method: 'json',
      } as NAuthConfig['tokenDelivery'];

      const handlerJson = new SocialRedirectHandler(
        mockConfig,
        mockProviderRegistry,
        mockStateStore,
        mockStorage,
        undefined,
        60,
      );

      const mockAuthResponse: AuthResponseDTO = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        accessTokenExpiresAt: 1234567890,
        refreshTokenExpiresAt: 1234567890,
        user: {
          sub: 'user-sub-123',
          email: 'user@example.com',
          isEmailVerified: true,
        },
      };

      const mockProvider = {
        handleCallback: jest.fn().mockResolvedValue(mockAuthResponse),
        getAuthUrl: jest.fn().mockResolvedValue('https://provider.com/auth'),
      };

      mockProviderRegistry.getProvider = jest.fn().mockReturnValue(mockProvider);

      mockStateStore.consumeRedirectContext = jest.fn().mockResolvedValue({
        returnTo: '/auth/callback',
        appState: 'app-state-123',
        action: 'login',
        delivery: 'json',
      });

      const result = await handlerJson.callback({
        provider: 'google',
        code: 'oauth-code-123',
        state: 'csrf-state-123',
        req: {},
      });

      // In json mode, should return exchangeToken (no authResponse in result)
      expect(result.authResponse).toBeUndefined();
      expect(result.redirectUrl).toContain('exchangeToken');
    });

    it('should re-inject deviceToken into request context when captured in redirect context', async () => {
      const futureAccessExp = Math.floor(Date.now() / 1000) + 15 * 60;
      const futureRefreshExp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      const mockAuthResponse: AuthResponseDTO = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        accessTokenExpiresAt: futureAccessExp,
        refreshTokenExpiresAt: futureRefreshExp,
        user: { sub: 'user-sub-123', email: 'user@example.com', isEmailVerified: true },
        authMethod: 'google',
      };

      const mockProvider = {
        handleCallback: jest.fn().mockResolvedValue(mockAuthResponse),
        getAuthUrl: jest.fn().mockResolvedValue('https://provider.com/auth'),
      };
      mockProviderRegistry.getProvider = jest.fn().mockReturnValue(mockProvider);

      mockStateStore.consumeRedirectContext = jest.fn().mockResolvedValue({
        returnTo: '/auth/callback',
        appState: 'app-state-123',
        action: 'login',
        delivery: 'cookies',
        deviceToken: 'device-token-from-start',
      });

      await ContextStorage.run(async () => {
        ContextStorage.set('CLIENT_INFO', { ipAddress: '1.2.3.4', userAgent: 'ua' });

        await handler.callback({
          provider: 'google',
          code: 'oauth-code-123',
          state: 'csrf-state-123',
          req: { headers: {}, cookies: {} },
        });

        const clientInfo = ContextStorage.get('CLIENT_INFO') as any;
        expect(clientInfo?.deviceToken).toBe('device-token-from-start');
      });
    });
  });
});
