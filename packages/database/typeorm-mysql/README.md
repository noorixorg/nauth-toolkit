# @nauth-toolkit/database-typeorm-mysql

MySQL / MariaDB database adapter for [nauth-toolkit](https://nauth.dev).

Same entity structure and behavior as the PostgreSQL adapter — swap the driver, keep the same auth logic.

**[Documentation](https://nauth.dev)** · **[GitHub](https://github.com/noorixorg/nauth)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/core @nauth-toolkit/database-typeorm-mysql
```

---

## Usage

```typescript
import { DataSource } from 'typeorm';
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-mysql';

const dataSource = new DataSource({
  type: 'mysql',
  url: process.env.DATABASE_URL,
  entities: getNAuthEntities(),
  synchronize: true, // dev only
});
```

---

## Also available

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/database-typeorm-postgres`](https://www.npmjs.com/package/@nauth-toolkit/database-typeorm-postgres) | PostgreSQL — recommended for most deployments |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

Free to use. See [license](https://nauth.dev/docs/license).
