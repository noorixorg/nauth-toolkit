---
title: TypeORM MySQL
description: MySQL/MariaDB database entities for NAuth
keywords: [database, typeorm, mysql, mariadb, entities, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# TypeORM MySQL

**Package:** `@nauth-toolkit/database-typeorm-mysql`
**Type:** Database Package

MySQL/MariaDB entity implementations using TypeORM.

```bash npm2yarn
npm install @nauth-toolkit/database-typeorm-mysql
```

## Exports

| Export | Description |
|--------|-------------|
| `getNAuthEntities()` | User/session entities (always include) |
| `getNAuthTransientStorageEntities()` | Rate limit/lock entities (only if using `DatabaseStorageAdapter`) |
| `runNAuthMigrations` | Run pending nauth-toolkit migrations. Called automatically during bootstrap. |
| `acquireMigrationLock` | Take the same cross-instance migration lock nauth uses. For applying migrations out-of-band. |
| `computeNamedLockKey` | Derive the lock identifier from a migrations table name. |
| Individual entities | `User`, `Session`, `MFADevice`, `SocialProviderSecret`, etc. |

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
- `SocialProviderSecret` - Apple JWT client secret storage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-mysql';

TypeOrmModule.forRoot({
  type: 'mysql',
  entities: [
    ...getNAuthEntities(),
    // Your app entities...
  ],
})
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-mysql';
import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'mysql',
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
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-mysql';
import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'mysql',
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
} from '@nauth-toolkit/database-typeorm-mysql';
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
} from '@nauth-toolkit/database-typeorm-mysql';
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
} from '@nauth-toolkit/database-typeorm-mysql';
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
| `DatabaseStorageAdapter` | **Yes** (required) |

## Migrations

nauth-toolkit owns its own migration table (`<tablePrefix>migrations`, default `nauth_migrations`) and applies pending migrations during `NAuth.create()` / module bootstrap. It uses a dedicated `DataSource` built from your connection settings, so your own migrations are never touched.

### Parallel container starts

Running several instances that boot at the same time — ECS tasks, Kubernetes pods, a rolling deploy — is safe with no configuration. Each run is serialized behind a MySQL/MariaDB session-scoped **named lock** (`GET_LOCK`) derived from the migrations table name:

- One instance applies the migrations; the others wait, then find nothing pending and continue.
- On a first deployment this is what stops two instances creating the same tables.
- The lock lives on a dedicated connection, so MySQL/MariaDB drops it automatically if an instance crashes — a dead task can never wedge a deploy.
- Deriving the lock from the table name means two apps sharing one database under different `tablePrefix` values never block each other.

If an instance waits 5 minutes and migrations are still pending, startup fails with an explicit error rather than migrating concurrently.

### Applying migrations out-of-band

To apply migrations from a release task instead of at boot, turn off auto-run in the application containers:

```typescript title="src/config/auth.config.ts"
export const authConfig: NAuthModuleConfig = {
  migrations: { autoRun: false },
  // ...
};
```

`migrations.autoRun` is the only migration option. Locking is always on and has no settings.

## Related

- [TypeORM PostgreSQL](./typeorm-postgres)
- [Database Storage](../storage/database)
- [Session Storage](../storage/overview)

