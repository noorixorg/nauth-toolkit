/**
 * Rate limiting for the provider endpoints.
 *
 * `oidc-provider` ships none and the mount sits outside nauth's guard chain, so this
 * is the only thing standing between `POST /token` and an unauthenticated brute-force
 * attempt against client secrets and authorization codes.
 */
import { MemoryStorageAdapter } from '@nauth-toolkit/core';
import { createOIDCRateLimiter } from './rate-limit';

describe('createOIDCRateLimiter', () => {
  let storage: MemoryStorageAdapter;

  /** Drive one request through the limiter and report what happened. */
  const call = async (
    limiter: ReturnType<typeof createOIDCRateLimiter>,
    url: string,
    ip = '203.0.113.10',
  ): Promise<{ passed: boolean; status?: number; body?: string; retryAfter?: string }> =>
    new Promise((resolve) => {
      const headers: Record<string, string> = {};
      const res = {
        statusCode: 200,
        setHeader: (n: string, v: string) => {
          headers[n] = v;
        },
        end: (body?: string) => resolve({ passed: false, status: res.statusCode, body, retryAfter: headers['retry-after'] }),
      };
      limiter({ url, method: 'POST', headers: { 'x-forwarded-for': ip } }, res, () => resolve({ passed: true }));
    });

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.disconnect();
  });

  it('lets everything through when nothing is configured', async () => {
    const limiter = createOIDCRateLimiter(storage, {});
    for (let i = 0; i < 50; i += 1) {
      await expect(call(limiter, '/oidc/token')).resolves.toMatchObject({ passed: true });
    }
  });

  it('allows requests up to the limit, then rejects with 429 and Retry-After', async () => {
    const limiter = createOIDCRateLimiter(storage, { token: { max: 3, windowSeconds: 60 } });

    for (let i = 0; i < 3; i += 1) {
      await expect(call(limiter, '/oidc/token')).resolves.toMatchObject({ passed: true });
    }

    const blocked = await call(limiter, '/oidc/token');
    expect(blocked.passed).toBe(false);
    expect(blocked.status).toBe(429);
    expect(blocked.retryAfter).toBe('60');
    expect(JSON.parse(blocked.body as string)).toMatchObject({ error: 'temporarily_unavailable' });
  });

  it('counts each source address separately', async () => {
    const limiter = createOIDCRateLimiter(storage, { token: { max: 2, windowSeconds: 60 } });

    await call(limiter, '/oidc/token', '198.51.100.1');
    await call(limiter, '/oidc/token', '198.51.100.1');
    await expect(call(limiter, '/oidc/token', '198.51.100.1')).resolves.toMatchObject({ passed: false });

    // A different caller is unaffected by the first one's exhaustion.
    await expect(call(limiter, '/oidc/token', '198.51.100.2')).resolves.toMatchObject({ passed: true });
  });

  it('does not let the token limit swallow the introspection endpoint', async () => {
    // /oidc/token is a prefix of /oidc/token/introspection; matching must be exact.
    const limiter = createOIDCRateLimiter(storage, {
      token: { max: 1, windowSeconds: 60 },
      introspection: { max: 5, windowSeconds: 60 },
    });

    await call(limiter, '/oidc/token');
    await expect(call(limiter, '/oidc/token')).resolves.toMatchObject({ passed: false });

    // Introspection has its own, larger budget.
    for (let i = 0; i < 5; i += 1) {
      await expect(call(limiter, '/oidc/token/introspection')).resolves.toMatchObject({ passed: true });
    }
  });

  it('ignores endpoints that have no configured limit', async () => {
    const limiter = createOIDCRateLimiter(storage, { token: { max: 1, windowSeconds: 60 } });
    await call(limiter, '/oidc/token');

    for (let i = 0; i < 10; i += 1) {
      await expect(call(limiter, '/oidc/jwks')).resolves.toMatchObject({ passed: true });
    }
  });

  it('honours a custom path prefix', async () => {
    const limiter = createOIDCRateLimiter(storage, { token: { max: 1, windowSeconds: 60 } }, { pathPrefix: '/sso' });

    await expect(call(limiter, '/sso/token')).resolves.toMatchObject({ passed: true });
    await expect(call(limiter, '/sso/token')).resolves.toMatchObject({ passed: false });
  });

  it('ignores the query string when matching', async () => {
    const limiter = createOIDCRateLimiter(storage, { authorize: { max: 1, windowSeconds: 60 } });

    await expect(call(limiter, '/oidc/auth?client_id=a&state=b')).resolves.toMatchObject({ passed: true });
    await expect(call(limiter, '/oidc/auth?client_id=a&state=c')).resolves.toMatchObject({ passed: false });
  });

  it('fails open when storage is unavailable, rather than taking the provider down', async () => {
    const broken = {
      incr: async () => {
        throw new Error('redis is down');
      },
    } as unknown as MemoryStorageAdapter;
    const limiter = createOIDCRateLimiter(broken, { token: { max: 1, windowSeconds: 60 } });

    await expect(call(limiter, '/oidc/token')).resolves.toMatchObject({ passed: true });
  });
});
