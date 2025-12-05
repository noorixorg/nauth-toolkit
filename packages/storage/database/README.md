# @nauth-toolkit/storage-database

Database storage adapter for nauth-toolkit using TypeORM repositories.

## Overview

`DatabaseStorageAdapter` implements the `StorageAdapter` interface using your existing TypeORM connection. It stores transient state (rate limits, distributed locks, token reuse tracking) in database tables, making it perfect for multi-server deployments without requiring Redis.

## Features

- ✅ **Multi-server compatible** - All servers share the same database
- ✅ **No separate connection** - Uses your existing TypeORM DataSource
- ✅ **Atomic operations** - Database-level increment/decrement for thread-safety
- ✅ **TTL support** - Automatic expiration via `expiresAt` column
- ✅ **PostgreSQL & MySQL** - Works with both database types
- ✅ **Zero external dependencies** - No Redis required

## Installation

```bash
yarn add @nauth-toolkit/storage-database
```

## Usage

### 1. Include Storage Entities

Storage entities (`RateLimit`, `StorageLock`) must be included in your TypeORM configuration:

```typescript
import { getNAuthEntities, getNAuthStorageEntities } from '@nauth-toolkit/database-typeorm-postgres';
// or
// import { getNAuthEntities, getNAuthStorageEntities } from '@nauth-toolkit/database-typeorm-mysql';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres', // or 'mysql'
      // ... your DB config
      entities: [
        ...getNAuthEntities(),        // Core entities (User, Session, etc.)
        ...getNAuthStorageEntities(), // Storage entities (RateLimit, StorageLock)
      ],
    }),
    AuthModule.forRoot({
      jwt: { ... },
      storageAdapter: new DatabaseStorageAdapter(),
    }),
  ],
})
export class AppModule {}
```

### 2. Configure Storage Adapter

```typescript
import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';

AuthModule.forRoot({
  jwt: { ... },
  storageAdapter: new DatabaseStorageAdapter(),
});
```

The adapter automatically injects `RateLimitRepository` and `StorageLockRepository` via NestJS dependency injection.

## Database Tables

The adapter creates two tables:

### `nauth_rate_limits`

Stores rate limit counters and key-value pairs.

**Schema:**
- `id`: Primary key
- `key`: VARCHAR(255) UNIQUE - Storage key
- `value`: TEXT - Stored value (counter or JSON)
- `expiresAt`: TIMESTAMP - Expiration time
- `createdAt`: TIMESTAMP
- `updatedAt`: TIMESTAMP

**Indexes:**
- `idx_rate_limits_key` (UNIQUE) on `key`
- `idx_rate_limits_expires` on `expiresAt`

### `nauth_storage_locks`

Stores distributed locks for concurrent operations.

**Schema:**
- `id`: Primary key
- `key`: VARCHAR(255) UNIQUE - Lock key
- `value`: TEXT - Lock value
- `expiresAt`: TIMESTAMP - Lock expiration
- `createdAt`: TIMESTAMP

**Indexes:**
- `idx_storage_locks_key` (UNIQUE) on `key`
- `idx_storage_locks_expires` on `expiresAt`

## Cleanup

Expired records are cleaned up via:

1. **Automatic expiration** - Queries check `expiresAt` and delete expired records
2. **Scheduled cleanup** - Run `adapter.cleanup()` periodically or set up a database-level scheduled job

**PostgreSQL (pg_cron):**
```sql
SELECT cron.schedule(
  'cleanup-expired-storage',
  '*/5 * * * *', -- Every 5 minutes
  'DELETE FROM nauth_rate_limits WHERE expiresAt < NOW(); DELETE FROM nauth_storage_locks WHERE expiresAt < NOW();'
);
```

**MySQL (EVENT SCHEDULER):**
```sql
CREATE EVENT cleanup_expired_storage
ON SCHEDULE EVERY 5 MINUTE
DO
  DELETE FROM nauth_rate_limits WHERE expiresAt < NOW();
  DELETE FROM nauth_storage_locks WHERE expiresAt < NOW();
```

## Performance Considerations

- **Atomic operations** use database-level `UPDATE ... SET value = value + 1` for optimal concurrency
- **Indexes** on `key` and `expiresAt` ensure fast lookups
- **Hash/list operations** stored as JSON in the `value` column
- **Cleanup** should run periodically to prevent table bloat

## Comparison with Other Adapters

| Feature | MemoryStorageAdapter | DatabaseStorageAdapter | RedisStorageAdapter |
|---------|---------------------|------------------------|---------------------|
| Multi-server | ❌ | ✅ | ✅ |
| Persistence | ❌ | ✅ | ✅ (optional) |
| Performance | ⚡⚡⚡ | ⚡⚡ | ⚡⚡⚡ |
| External dependency | ❌ | ❌ | ✅ (Redis) |
| Setup complexity | 🟢 Low | 🟡 Medium | 🟡 Medium |

## License

MIT

