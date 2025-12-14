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
});
