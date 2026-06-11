# @nauth-toolkit/storage-redis

Redis storage adapter for [nauth-toolkit](https://nauth.dev).

Stores rate limit counters, account lockout state, and distributed locks in Redis. Compatible with Redis and Dragonfly. Designed for production deployments that need fast lookups and horizontal scaling.

**[Documentation](https://nauth.dev)** · **[GitHub](https://github.com/noorixorg/nauth-toolkit)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/storage-redis
```

---

## Usage

```typescript
import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';

const nauth = await NAuth.create({
  config: {
    ...authConfig,
    storageAdapter: new RedisStorageAdapter(process.env.REDIS_URL),
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

Uses the `redis` (node-redis) package.

---

## Also available

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/storage-database`](https://www.npmjs.com/package/@nauth-toolkit/storage-database) | Database-backed storage — no Redis required |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

MIT licensed. See [LICENSE](https://github.com/noorixorg/nauth-toolkit/blob/main/LICENSE).
