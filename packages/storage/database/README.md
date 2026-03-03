# @nauth-toolkit/storage-database

Database-backed storage adapter for [nauth-toolkit](https://nauth.dev).

Stores rate limit counters, account lockout state, and distributed locks in your existing database via TypeORM. No additional infrastructure required — simpler than Redis for single-server deployments.

**[Documentation](https://nauth.dev)** · **[GitHub](https://github.com/noorixorg/nauth)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core` and a database package.

---

## Install

```bash
npm install @nauth-toolkit/storage-database
```

---

## Usage

Pass the adapter in your nauth config:

```typescript
import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';

const nauth = await NAuth.create({
  config: {
    ...authConfig,
    storageAdapter: new DatabaseStorageAdapter(),
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

Add `getNAuthTransientStorageEntities()` to your TypeORM entities for the storage tables.

---

## Also available

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/storage-redis`](https://www.npmjs.com/package/@nauth-toolkit/storage-redis) | Redis — recommended for production and multi-instance deployments |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

Free to use. See [license](https://nauth.dev/docs/license).
