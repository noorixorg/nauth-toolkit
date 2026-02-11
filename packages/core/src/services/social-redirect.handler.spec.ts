import { SocialRedirectHandler } from './social-redirect.handler';
import { NAuthConfig } from '../interfaces/config.interface';
import { SocialProviderRegistry } from './social-provider-registry.service';
import { ISocialAuthStateStore } from '../interfaces/social-auth-state-store.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { AuthResponseDTO } from '../dto/auth-response.dto';
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

  describe('start', () => {
    it('returns url and stores context with delivery and deviceToken from ContextStorage', async () => {
      mockProviderRegistry.getProvider = jest.fn().mockReturnValue({
        getAuthUrl: jest.fn().mockResolvedValue('https://provider.com/authorize'),
      });

      await ContextStorage.run(async () => {
        ContextStorage.set('CLIENT_INFO', { ipAddress: '1.2.3.4', userAgent: 'ua', deviceToken: 'dt-123' });
        ContextStorage.set('ROUTE_DELIVERY_OVERRIDE', 'cookies');

        const result = await handler.start('google', { returnTo: '/auth/callback', appState: 'x' });

        expect(result).toEqual({ url: 'https://provider.com/authorize' });
        expect(mockStateStore.setRedirectContext).toHaveBeenCalledWith(
          'csrf-state-123',
          expect.objectContaining({
            returnTo: '/auth/callback',
            appState: 'x',
            action: 'login',
            delivery: 'cookies',
            deviceToken: 'dt-123',
          }),
        );
      });
    });

    it('parses oauthParams JSON string', async () => {
      const mockGetAuthUrl = jest.fn().mockResolvedValue('https://provider.com/authorize');
      mockProviderRegistry.getProvider = jest.fn().mockReturnValue({
        getAuthUrl: mockGetAuthUrl,
      });

      await ContextStorage.run(async () => {
        ContextStorage.set('CLIENT_INFO', {});
        ContextStorage.set('ROUTE_DELIVERY_OVERRIDE', 'cookies');

        await handler.start('google', { oauthParams: '{"prompt":"select_account"}' });

        expect(mockProviderRegistry.getProvider).toHaveBeenCalledWith('google');
        expect(mockGetAuthUrl).toHaveBeenCalledWith('csrf-state-123', { prompt: 'select_account' });
      });
    });
  });

  describe('callback - cookies mode', () => {
    it('applies cookies to HTTP_RESPONSE and returns url only', async () => {
      const futureAccessExp = Math.floor(Date.now() / 1000) + 15 * 60;
      const futureRefreshExp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

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

      const cookiesSet: Array<{ name: string; value: string }> = [];
      const mockRes = {
        cookie: (name: string, value: string) => {
          cookiesSet.push({ name, value });
        },
      };

      await ContextStorage.run(async () => {
        ContextStorage.set('CLIENT_INFO', { ipAddress: '1.2.3.4', userAgent: 'ua' });
        ContextStorage.set('HTTP_RESPONSE', mockRes);

        const result = await handler.callback('google', {
          code: 'oauth-code-123',
          state: 'csrf-state-123',
        });

        expect(result).toEqual({ url: expect.stringContaining('/auth/callback') });
        expect(result.url).not.toContain('exchangeToken');
        expect(cookiesSet.length).toBeGreaterThan(0);
        expect(cookiesSet.some((c) => c.name.includes('access') || c.name.includes('token'))).toBe(true);
      });
    });

    it('should not return authResponse or cookies in result (cookies applied to response)', async () => {
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

      const mockRes = { cookie: jest.fn() };

      await ContextStorage.run(async () => {
        ContextStorage.set('CLIENT_INFO', {});
        ContextStorage.set('HTTP_RESPONSE', mockRes);

        const result = await handler.callback('google', {
          code: 'oauth-code-123',
          state: 'csrf-state-123',
        });

        expect(result).toHaveProperty('url');
        expect(result).not.toHaveProperty('cookies');
        expect(result).not.toHaveProperty('authResponse');
      });
    });
  });

  describe('callback - json mode', () => {
    it('returns url with exchangeToken and does not set cookies', async () => {
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

      const result = await handlerJson.callback('google', {
        code: 'oauth-code-123',
        state: 'csrf-state-123',
      });

      expect(result.url).toContain('exchangeToken');
      expect(result).toEqual({ url: expect.stringContaining('exchangeToken') });
    });
  });

  describe('callback - deviceToken re-inject', () => {
    it('re-injects deviceToken into CLIENT_INFO when captured in redirect context', async () => {
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
        ContextStorage.set('HTTP_RESPONSE', { cookie: jest.fn() });

        await handler.callback('google', {
          code: 'oauth-code-123',
          state: 'csrf-state-123',
        });

        const clientInfo = ContextStorage.get('CLIENT_INFO') as { deviceToken?: string };
        expect(clientInfo?.deviceToken).toBe('device-token-from-start');
      });
    });
  });

  describe('callback - validation', () => {
    it('throws when state is missing', async () => {
      await expect(handler.callback('google', { code: 'c', state: '' })).rejects.toMatchObject({
        code: AuthErrorCode.VALIDATION_FAILED,
      });
    });

    it('throws when code is missing', async () => {
      await expect(
        handler.callback('google', { state: 'csrf-state-123' }),
      ).rejects.toMatchObject({ code: AuthErrorCode.VALIDATION_FAILED });
    });
  });
});
