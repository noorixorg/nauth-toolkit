---
title: TypeORM PostgreSQL
description: PostgreSQL database entities for NAuth
keywords: [database, typeorm, postgres, entities, api]
image: /img/api-social-card.png
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# TypeORM PostgreSQL

**Package:** `@nauth-toolkit/database-typeorm-postgres`
**Type:** Database Package

PostgreSQL entity implementations using TypeORM.

```bash npm2yarn
npm install @nauth-toolkit/database-typeorm-postgres
```

## Exports

| Export | Description |
|--------|-------------|
| `getNAuthEntities()` | User/session entities (always include) |
| `getNAuthTransientStorageEntities()` | Rate limit/lock entities (only if using `DatabaseStorageAdapter`) |
| Individual entities | `User`, `Session`, `MFADevice`, etc. |

## getNAuthEntities()

Returns core authentication entities.

**Entities included:**
- `User` - User accounts
- `Session` - Active sessions
- `LoginAttempt` - Login history
- `VerificationToken` - Email/phone codes
- `SocialAccount` - OAuth accounts
- `ChallengeSession` - MFA challenges
- `MFADevice` - Registered devices
- `AuthAudit` - Audit logs
- `TrustedDevice` - Trusted devices

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';

TypeOrmModule.forRoot({
  type: 'postgres',
  entities: [
    ...getNAuthEntities(),
    // Your app entities...
  ],
})
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';
import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  entities: [
    ...getNAuthEntities(),
    // Your app entities...
  ],
});

await dataSource.initialize();
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';
import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  entities: [
    ...getNAuthEntities(),
    // Your app entities...
  ],
});

await dataSource.initialize();
```

</TabItem>
</Tabs>

## getNAuthTransientStorageEntities()

Returns transient storage entities. **Only use with `DatabaseStorageAdapter`.**

**Entities included:**
- `RateLimit` - Rate limiting
- `StorageLock` - Distributed locks

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import {
  getNAuthEntities,
  getNAuthTransientStorageEntities
} from '@nauth-toolkit/database-typeorm-postgres';
import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';

// Include storage entities
TypeOrmModule.forRoot({
  entities: [
    ...getNAuthEntities(),
    ...getNAuthTransientStorageEntities(),
  ],
})

// Use DatabaseStorageAdapter
AuthModule.forRoot({
  storageAdapter: new DatabaseStorageAdapter(),
})
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import {
  getNAuthEntities,
  getNAuthTransientStorageEntities
} from '@nauth-toolkit/database-typeorm-postgres';
import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';

const dataSource = new DataSource({
  entities: [
    ...getNAuthEntities(),
    ...getNAuthTransientStorageEntities(),
  ],
});

const nauth = await NAuth.create({
  dataSource,
  config: {
    storageAdapter: new DatabaseStorageAdapter(),
  },
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import {
  getNAuthEntities,
  getNAuthTransientStorageEntities
} from '@nauth-toolkit/database-typeorm-postgres';
import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';
import { FastifyAdapter } from '@nauth-toolkit/core';

const dataSource = new DataSource({
  entities: [
    ...getNAuthEntities(),
    ...getNAuthTransientStorageEntities(),
  ],
});

const nauth = await NAuth.create({
  dataSource,
  adapter: new FastifyAdapter(),
  config: {
    storageAdapter: new DatabaseStorageAdapter(),
  },
});
```

</TabItem>
</Tabs>

## When to Include Storage Entities

| Storage Adapter | Include `getNAuthTransientStorageEntities()`? |
|-----------------|----------------------------------------------|
| `RedisStorageAdapter` | No |
| `MemoryStorageAdapter` | No |
| `DatabaseStorageAdapter` | **Yes** |

## Related

- [TypeORM MySQL](./typeorm-mysql)
- [Database Storage](../storage/database)
- [Session Storage](../storage/overview)

