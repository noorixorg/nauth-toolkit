import { TokenManager } from './refresh';
import { NAuthStorageAdapter } from '../types/config.types';

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

describe('TokenManager', () => {
  it('stores and retrieves tokens', async () => {
    const storage = new MockStorage();
    const manager = new TokenManager(storage);
    await manager.setTokens({
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiresAt: 1,
      refreshTokenExpiresAt: 2,
    });
    const state = await manager.getTokens();
    expect(state.accessToken).toBe('a');
    expect(state.refreshToken).toBe('r');
  });

  it('deduplicates refresh calls', async () => {
    const storage = new MockStorage();
    const manager = new TokenManager(storage);
    let calls = 0;
    const refreshFn = async () => {
      calls += 1;
      return {
        accessToken: 'x',
        refreshToken: 'y',
        accessTokenExpiresAt: 10,
        refreshTokenExpiresAt: 20,
      };
    };
    await Promise.all([manager.refreshOnce(refreshFn), manager.refreshOnce(refreshFn)]);
    expect(calls).toBe(1);
  });

  it('does not persist tokens when persist=false (cookies mode safety)', async () => {
    const storage = new MockStorage();
    const manager = new TokenManager(storage);

    const refreshFn = async () => {
      return {
        accessToken: 'x',
        refreshToken: 'y',
        accessTokenExpiresAt: 10,
        refreshTokenExpiresAt: 20,
      };
    };

    const tokens = await manager.refreshOnce(refreshFn, { persist: false });
    expect(tokens.accessToken).toBe('x');

    const state = await manager.getTokens();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it('should clear all tokens and user data', async () => {
    const storage = new MockStorage();
    const manager = new TokenManager(storage);

    await manager.setTokens({
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiresAt: 1,
      refreshTokenExpiresAt: 2,
    });
    await storage.setItem('nauth_user', 'user-data');
    await storage.setItem('nauth_challenge_session', 'challenge-data');

    await manager.clearTokens();

    const state = await manager.getTokens();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(await storage.getItem('nauth_user')).toBeNull();
    expect(await storage.getItem('nauth_challenge_session')).toBeNull();
  });

  it('should throw error when refresh token is missing', async () => {
    const storage = new MockStorage();
    const manager = new TokenManager(storage);

    await expect(manager.assertHasRefreshToken()).rejects.toThrow('No refresh token available');
  });

  it('should not throw when refresh token exists', async () => {
    const storage = new MockStorage();
    const manager = new TokenManager(storage);

    await manager.setTokens({
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiresAt: 1,
      refreshTokenExpiresAt: 2,
    });

    await expect(manager.assertHasRefreshToken()).resolves.not.toThrow();
  });

  it('should handle refresh errors and clear promise', async () => {
    const storage = new MockStorage();
    const manager = new TokenManager(storage);

    const refreshFn = jest.fn().mockRejectedValue(new Error('Refresh failed'));

    await expect(manager.refreshOnce(refreshFn)).rejects.toThrow('Refresh failed');

    // Should clear promise on error
    const refreshFn2 = jest.fn().mockResolvedValue({
      accessToken: 'x',
      refreshToken: 'y',
      accessTokenExpiresAt: 10,
      refreshTokenExpiresAt: 20,
    });

    await manager.refreshOnce(refreshFn2);
    expect(refreshFn2).toHaveBeenCalled();
  });

  it('should handle token expiration times as strings', async () => {
    const storage = new MockStorage();
    const manager = new TokenManager(storage);

    await manager.setTokens({
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiresAt: 1000,
      refreshTokenExpiresAt: 2000,
    });

    const state = await manager.getTokens();
    expect(state.accessTokenExpiresAt).toBe(1000);
    expect(state.refreshTokenExpiresAt).toBe(2000);
  });
});
