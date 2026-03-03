# @nauth-toolkit/database-typeorm-postgres

PostgreSQL database adapter for [nauth-toolkit](https://nauth.dev).

Provides TypeORM entity definitions for all auth tables — users, sessions, MFA devices, social accounts, audit logs, and more. Plug into your existing TypeORM `DataSource` and nauth-toolkit manages the rest.

**[Documentation](https://nauth.dev)** · **[GitHub](https://github.com/noorixorg/nauth)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/core @nauth-toolkit/database-typeorm-postgres
```

---

## Usage

```typescript
import { DataSource } from 'typeorm';
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: getNAuthEntities(),
  synchronize: true, // dev only
});
```

Use `getNAuthEntities()` in your TypeORM config. If using `DatabaseStorageAdapter`, also add `getNAuthTransientStorageEntities()`.

---

## Also available

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/database-typeorm-mysql`](https://www.npmjs.com/package/@nauth-toolkit/database-typeorm-mysql) | MySQL / MariaDB — same structure, different driver |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

Free to use. See [license](https://nauth.dev/docs/license).
