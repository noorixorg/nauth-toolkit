import { RedisStorageAdapter } from './redis-storage.adapter';

/**
 * A stand-in node-redis client that records how commands were called.
 *
 * Deliberately strict about argument types the way node-redis v5's encoder is: every
 * argument it puts on the wire must be a string or a Buffer, which is what makes the
 * variadic ioredis-style `scan(0, 'MATCH', …)` form fail there.
 */
class FakeRedisClient {
  readonly scanCalls: unknown[][] = [];
  isOpen = true;
  store = new Map<string, string>();

  scanResult: { cursor: string | number; keys: string[] } | [string | number, string[]] = {
    cursor: '0',
    keys: [],
  };

  async scan(cursor: unknown, options?: unknown): Promise<unknown> {
    this.scanCalls.push([cursor, options]);
    if (typeof cursor !== 'string') {
      throw new TypeError('"arguments[1]" must be of type "string | Buffer"');
    }
    return this.scanResult;
  }

  async sendCommand(): Promise<null> {
    return null;
  }

  async get(): Promise<null> {
    return null;
  }

  async set(): Promise<string> {
    return 'OK';
  }

  async del(): Promise<number> {
    return 1;
  }
}

/** The adapter namespaces every key with this, and strips it off again on the way out. */
const PREFIX = 'nauth_';

const buildAdapter = (client: FakeRedisClient): RedisStorageAdapter => new RedisStorageAdapter(client as never);

describe('RedisStorageAdapter', () => {
  describe('scan', () => {
    it('calls node-redis with a string cursor and an options object', async () => {
      // Regression guard: the variadic `scan(0, 'MATCH', pattern, 'COUNT', n)` form is
      // ioredis's, and node-redis v5 rejects a numeric cursor before sending anything —
      // which broke every prefix sweep built on keys(), single logout included.
      const client = new FakeRedisClient();
      client.scanResult = { cursor: '0', keys: ['oidc:g:abc:AccessToken:t1'] };

      const [cursor, keys] = await buildAdapter(client).scan(0, 'oidc:g:abc:*', 500);

      expect(client.scanCalls).toHaveLength(1);
      expect(client.scanCalls[0][0]).toBe('0');
      expect(client.scanCalls[0][1]).toEqual({ MATCH: `${PREFIX}oidc:g:abc:*`, COUNT: 500 });
      expect(cursor).toBe(0);
      expect(keys).toEqual(['oidc:g:abc:AccessToken:t1']);
    });

    it('normalises a string cursor back to a number', async () => {
      const client = new FakeRedisClient();
      client.scanResult = { cursor: '42', keys: [] };

      const [cursor] = await buildAdapter(client).scan(0, '*', 10);

      expect(cursor).toBe(42);
    });

    it('accepts the array answer shape too', async () => {
      const client = new FakeRedisClient();
      client.scanResult = ['7', ['a', 'b']];

      const [cursor, keys] = await buildAdapter(client).scan(0, '*', 10);

      expect(cursor).toBe(7);
      expect(keys).toEqual(['a', 'b']);
    });

    it('prefixes the pattern and strips the prefix off the results', async () => {
      const client = new FakeRedisClient();
      client.scanResult = { cursor: '0', keys: [`${PREFIX}oidc:Session:s1`] };

      const [, keys] = await buildAdapter(client).scan(0, 'oidc:Session:*', 10);

      expect(client.scanCalls[0][1]).toEqual({ MATCH: `${PREFIX}oidc:Session:*`, COUNT: 10 });
      expect(keys).toEqual(['oidc:Session:s1']);
    });
  });

  describe('keys', () => {
    it('pages until the cursor returns to zero', async () => {
      const client = new FakeRedisClient();
      const pages: { cursor: string; keys: string[] }[] = [
        { cursor: '11', keys: ['k1'] },
        { cursor: '0', keys: ['k2'] },
      ];
      client.scan = async (cursor: unknown, options?: unknown): Promise<unknown> => {
        client.scanCalls.push([cursor, options]);
        return pages.shift();
      };

      const keys = await buildAdapter(client).keys('oidc:*');

      expect(keys).toEqual(['k1', 'k2']);
      expect(client.scanCalls.map((call) => call[0])).toEqual(['0', '11']);
    });
  });
});
