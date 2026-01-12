import { NAuthClient } from './client';
import { NAuthClientConfig, NAuthStorageAdapter } from '../types/config.types';

class MockStorage implements NAuthStorageAdapter {
  private data = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    this.data.delete(key);
  }
  async clear(): Promise<void> {
    this.data.clear();
  }
}

type FetchMock = jest.MockInstance<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

const getFetchMock = (): FetchMock => globalThis.fetch as unknown as FetchMock;

const createMockResponse = (params: {
  ok: boolean;
  status: number;
  body: unknown;
}): Response => {
  const rawText = typeof params.body === 'string' ? params.body : JSON.stringify(params.body);

  // Minimal Response shape required by FetchAdapter:
  // - ok/status/text()
  // - headers.forEach()
  return {
    ok: params.ok,
    status: params.status,
    text: async () => rawText,
    headers: {
      forEach: (_cb: (value: string, key: string) => void): void => undefined,
    } as unknown as Headers,
  } as unknown as Response;
};

describe('NAuthClient', () => {
  const baseConfig: NAuthClientConfig = {
    baseUrl: 'https://api.example.com/auth',
    tokenDelivery: 'json',
    storage: new MockStorage(),
    onSessionExpired: () => undefined,
  };

  beforeEach(() => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('handles login token response', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    const response = await client.login('user@example.com', 'password');
    expect(response.accessToken).toBe('a1');
    const token = await client.getAccessToken();
    expect(token).toBe('a1');
  });

  it('throws on non-OK response', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 401,
        body: { code: 'AUTH_INVALID_CREDENTIALS', message: 'invalid' },
      }),
    );
    await expect(client.login('x', 'y')).rejects.toThrow('invalid');
  });

  it('sends device token header in JSON mode (trusted device feature)', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_device_token', 'dt1');

    const client = new NAuthClient({
      ...baseConfig,
      storage,
    });

    getFetchMock().mockImplementation(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.endsWith('/login')) {
        return createMockResponse({
          ok: true,
          status: 200,
          body: {
            accessToken: 'a1',
            refreshToken: 'r1',
            accessTokenExpiresAt: 10,
            refreshTokenExpiresAt: 20,
            user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
          },
        });
      }

      if (url.endsWith('/is-trusted-device')) {
        const headers = (options?.headers ?? {}) as Record<string, string>;
        expect(headers['X-Device-Token']).toBe('dt1');
        return createMockResponse({
          ok: true,
          status: 200,
          body: { trusted: true },
        });
      }

      return createMockResponse({
        ok: true,
        status: 200,
        body: {},
      });
    });

    await client.login('user@example.com', 'password');
    const result = await client.isTrustedDevice();
    expect(result.trusted).toBe(true);
  });

  it('refreshTokens in cookies mode does not persist tokens to storage', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({
      baseUrl: 'https://api.example.com',
      authPathPrefix: '/auth',
      tokenDelivery: 'cookies',
      storage,
      onSessionExpired: () => undefined,
    });

    getFetchMock().mockImplementation(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === 'https://api.example.com/auth/refresh') {
        expect(options?.method).toBe('POST');
        expect(options?.credentials).toBe('include');
        return createMockResponse({
          ok: true,
          status: 200,
          body: {
            accessToken: 'a2',
            refreshToken: 'r2',
            accessTokenExpiresAt: 10,
            refreshTokenExpiresAt: 20,
          },
        });
      }

      return createMockResponse({
        ok: true,
        status: 200,
        body: {},
      });
    });

    const tokens = await client.refreshTokens();
    expect(tokens.accessToken).toBe('a2');

    // Cookies mode should not persist tokens client-side
    expect(await storage.getItem('nauth_access_token')).toBeNull();
    expect(await storage.getItem('nauth_refresh_token')).toBeNull();
  });

  it('clearLocalAuthState clears persisted user and tokens', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_user', JSON.stringify({ sub: 'u1', email: 'user@example.com' }));
    await storage.setItem('nauth_access_token', 'a1');
    await storage.setItem('nauth_refresh_token', 'r1');
    await storage.setItem('nauth_access_token_expires_at', '10');
    await storage.setItem('nauth_refresh_token_expires_at', '20');

    const client = new NAuthClient({
      ...baseConfig,
      storage,
    });

    await client.initialize();
    expect(client.isAuthenticatedSync()).toBe(true);

    await client.clearLocalAuthState();

    expect(client.isAuthenticatedSync()).toBe(false);
    expect(await storage.getItem('nauth_user')).toBeNull();
    expect(await storage.getItem('nauth_access_token')).toBeNull();
    expect(await storage.getItem('nauth_refresh_token')).toBeNull();
    expect(await storage.getItem('nauth_access_token_expires_at')).toBeNull();
    expect(await storage.getItem('nauth_refresh_token_expires_at')).toBeNull();
  });
});
