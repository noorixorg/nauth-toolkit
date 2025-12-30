import 'reflect-metadata';
import { SocialAuthStateStore } from './social-auth-state-store.service';
import { AuthErrorCode, NAuthException } from '../index';
import type { StorageAdapter } from '../interfaces/storage-adapter.interface';

/**
 * Unit tests for SocialAuthStateStore.
 *
 * These tests use a mocked StorageAdapter to validate:
 * - one-time state consumption (replay protection via NX marker)
 * - provider mismatch handling
 * - redirect context round-trip behavior
 */
describe('SocialAuthStateStore', () => {
  const makeStorage = (): jest.Mocked<StorageAdapter> =>
    ({
      initialize: jest.fn(),
      isHealthy: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      lpush: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),
      keys: jest.fn(),
      scan: jest.fn(),
      cleanup: jest.fn(),
      disconnect: jest.fn(),
    }) as unknown as jest.Mocked<StorageAdapter>;

  it('should create a CSRF state and store it with TTL', async () => {
    const storage = makeStorage();
    storage.set.mockResolvedValue(undefined);

    const store = new SocialAuthStateStore(storage, undefined, 300);
    const state = await store.createCsrfState('google');

    expect(typeof state).toBe('string');
    expect(state.length).toBeGreaterThan(10);
    expect(storage.set).toHaveBeenCalledTimes(1);
    const [key, value, ttlSeconds] = storage.set.mock.calls[0];
    expect(String(key)).toContain('social:oauth_csrf:');
    expect(typeof value).toBe('string');
    expect(ttlSeconds).toBe(300);
  });

  it('should validate and consume CSRF state once (replay protection)', async () => {
    const storage = makeStorage();
    storage.set.mockResolvedValueOnce('1'); // used marker NX success
    storage.get.mockResolvedValueOnce(JSON.stringify({ provider: 'google', createdAt: Date.now() }));
    storage.del.mockResolvedValue(undefined);

    const store = new SocialAuthStateStore(storage, undefined, 300);
    await store.validateAndConsumeCsrfState('google', 'state-abc');

    // used marker + get + del
    expect(storage.set).toHaveBeenCalledWith('social:oauth_csrf_used:state-abc', '1', 300, { nx: true });
    expect(storage.get).toHaveBeenCalledWith('social:oauth_csrf:state-abc');
    expect(storage.del).toHaveBeenCalledWith('social:oauth_csrf:state-abc');
  });

  it('should reject CSRF state replay', async () => {
    const storage = makeStorage();
    storage.set.mockResolvedValueOnce(null); // used marker NX fails => replay

    const store = new SocialAuthStateStore(storage, undefined, 300);
    await expect(store.validateAndConsumeCsrfState('google', 'state-abc')).rejects.toBeInstanceOf(NAuthException);

    try {
      await store.validateAndConsumeCsrfState('google', 'state-abc');
    } catch (e) {
      const err = e as NAuthException;
      expect(err.code).toBe(AuthErrorCode.VALIDATION_FAILED);
    }
  });

  it('should reject provider mismatch', async () => {
    const storage = makeStorage();
    storage.set.mockResolvedValueOnce('1'); // used marker NX success
    storage.get.mockResolvedValueOnce(JSON.stringify({ provider: 'facebook', createdAt: Date.now() }));

    const store = new SocialAuthStateStore(storage, undefined, 300);
    await expect(store.validateAndConsumeCsrfState('google', 'state-abc')).rejects.toBeInstanceOf(NAuthException);
  });

  it('should store and consume redirect context', async () => {
    const storage = makeStorage();
    storage.set.mockResolvedValue(undefined);
    storage.get.mockResolvedValueOnce(
      JSON.stringify({ returnTo: '/auth/callback', appState: '12345', action: 'login', createdAt: Date.now() }),
    );
    storage.del.mockResolvedValue(undefined);

    const store = new SocialAuthStateStore(storage, undefined, 300);
    await store.setRedirectContext('state-abc', { returnTo: '/auth/callback', appState: '12345', action: 'login' });
    const ctx = await store.consumeRedirectContext('state-abc');

      expect(storage.set).toHaveBeenCalledWith(
        'social:oauth_redirect:state-abc',
        expect.any(String),
        300,
      );
    expect(ctx).toEqual({ returnTo: '/auth/callback', appState: '12345', action: 'login' });
    expect(storage.del).toHaveBeenCalledWith('social:oauth_redirect:state-abc');
  });

  it('should return null when redirect context missing', async () => {
    const storage = makeStorage();
    storage.get.mockResolvedValueOnce(null);

    const store = new SocialAuthStateStore(storage, undefined, 300);
    const ctx = await store.consumeRedirectContext('state-abc');
    expect(ctx).toBeNull();
  });
});


