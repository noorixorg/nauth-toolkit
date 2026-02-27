---
title: Database
description: Database storage adapter using TypeORM
keywords: [storage, database, typeorm, production, adapter, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Database Adapter

**Package:** `@nauth-toolkit/storage-database`
**Type:** Storage Adapter (Production)

TypeORM-based storage for transient authentication state.

```bash npm2yarn
npm install @nauth-toolkit/storage-database
```

:::note
Requires database package for entities. See [Database Packages](/docs/api/database/overview).
:::

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';
import { getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-postgres';

// Include transient storage entities in TypeORM
TypeOrmModule.forRoot({
  entities: [
    ...getNAuthTransientStorageEntities(),
    // your entities...
  ],
})

AuthModule.forRoot({
  storageAdapter: new DatabaseStorageAdapter(),
})
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';
import { getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-postgres';

// Include in DataSource
const dataSource = new DataSource({
  entities: [
    ...getNAuthTransientStorageEntities(),
    // your entities...
  ],
});

const nauth = await NAuth.create({
  config: {
    storageAdapter: new DatabaseStorageAdapter(),
  },
  dataSource,
  // ...
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';
import { getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-postgres';
import { FastifyAdapter } from '@nauth-toolkit/core';

const dataSource = new DataSource({
  entities: [
    ...getNAuthTransientStorageEntities(),
    // your entities...
  ],
});

const nauth = await NAuth.create({
  config: {
    storageAdapter: new DatabaseStorageAdapter(),
  },
  dataSource,
  adapter: new FastifyAdapter(),
  // ...
});
```

</TabItem>
</Tabs>

## When to Use

- Single-database architecture (no separate Redis)
- Lower infrastructure complexity
- Acceptable performance for moderate load

## Trade-offs vs Redis

| Aspect | Database | Redis |
|--------|----------|-------|
| Performance | Good | Excellent |
| Infrastructure | Existing DB | Additional service |
| Scaling | Vertical | Horizontal |

## Related

- [Redis](./redis) - Higher performance option
- [Session Storage](./overview)
- [Database Packages](/docs/api/database/overview)
