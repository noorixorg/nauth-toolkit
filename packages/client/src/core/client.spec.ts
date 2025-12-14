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
}

describe('NAuthClient', () => {
  const baseConfig: NAuthClientConfig = {
    baseUrl: 'https://api.example.com/auth',
    tokenDelivery: 'json',
    storage: new MockStorage(),
    onSessionExpired: () => undefined,
  };

  beforeEach(() => {
    // @ts-expect-error mocking fetch on global
    global.fetch = jest.fn();
  });

  it('handles login token response', async () => {
    const client = new NAuthClient(baseConfig);
    // @ts-expect-error mock
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        }),
    });

    const response = await client.login('user@example.com', 'password');
    expect(response.accessToken).toBe('a1');
    const token = await client.getAccessToken();
    expect(token).toBe('a1');
  });

  it('throws on non-OK response', async () => {
    const client = new NAuthClient(baseConfig);
    // @ts-expect-error mock
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ code: 'AUTH_INVALID_CREDENTIALS', message: 'invalid' }),
    });
    await expect(client.login('x', 'y')).rejects.toThrow('invalid');
  });
});
