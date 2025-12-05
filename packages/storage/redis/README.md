# @nauth-toolkit/storage-redis

Redis storage adapter for nauth-toolkit using the `redis` package (node-redis).

## Overview

`RedisStorageAdapter` implements the `StorageAdapter` interface using the `redis` package (node-redis). Supports both single-instance Redis and Redis Cluster for high-availability production deployments.

## Features

- ✅ **Uses node-redis** - Official Redis client for Node.js
- ✅ **Redis Cluster Support** - Production-ready high-availability deployments
- ✅ **Multi-server compatible** - Shared Redis instance/cluster across all servers
- ✅ **High performance** - Optimized for transient state management
- ✅ **Automatic key prefixing** - All keys prefixed with `nauth_` to avoid collisions
- ✅ **TTL support** - Native Redis EXPIRE for automatic expiration
- ✅ **Production-ready** - Automatic topology discovery, command routing, and failover

## Installation

```bash
yarn add @nauth-toolkit/storage-redis redis
```

## Usage

### With Factory Functions (Recommended)

```typescript
import { createRedisStorageAdapter, createRedisClusterAdapter } from '@nauth-toolkit/nestjs';

// Single-instance Redis
AuthModule.forRoot({
  jwt: { ... },
  storageAdapter: createRedisStorageAdapter(process.env.REDIS_URL),
});

// Redis Cluster (for high-availability production)
AuthModule.forRoot({
  jwt: { ... },
  storageAdapter: createRedisClusterAdapter([
    { url: 'redis://redis-node-1:6379' },
    { url: 'redis://redis-node-2:6379' },
    { url: 'redis://redis-node-3:6379' },
  ]),
});
```

### With Manual Client Creation

```typescript
import { createClient, createCluster } from 'redis';
import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';

// Single-instance Redis
const redisClient = createClient({
  url: process.env.NAUTH_REDIS_URL || 'redis://localhost:6379',
});
await redisClient.connect();

AuthModule.forRoot({
  jwt: { ... },
  storageAdapter: new RedisStorageAdapter(redisClient),
});

// Redis Cluster
const clusterClient = createCluster({
  rootNodes: [
    { url: 'redis://redis-node-1:6379' },
    { url: 'redis://redis-node-2:6379' },
    { url: 'redis://redis-node-3:6379' },
  ],
});
await clusterClient.connect();

AuthModule.forRoot({
  jwt: { ... },
  storageAdapter: new RedisStorageAdapter(clusterClient),
});
```

### URL Format Support

Supports authentication in URL format:
- `redis://localhost:6379` (no auth)
- `redis://:password@localhost:6379` (password only)
- `redis://username:password@localhost:6379` (username + password)
- `rediss://localhost:6379` (TLS/SSL, with optional auth)

### Complete Example with Factory Functions

```typescript
import { Module } from '@nestjs/common';
import { createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
import { AuthModule } from '@nauth-toolkit/nestjs';

@Module({
  imports: [
    AuthModule.forRoot({
      jwt: {
        accessToken: {
          secret: process.env.JWT_SECRET,
          expiresIn: '15m',
        },
        refreshToken: {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: '7d',
        },
      },
      storageAdapter: createRedisStorageAdapter(process.env.REDIS_URL),
    }),
  ],
})
export class AppModule {}
```

### With Dragonfly

Dragonfly is Redis-protocol compatible, so it works with the same clients:

```typescript
import { createClient } from 'redis';
import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';

// Dragonfly uses same protocol as Redis
const dragonflyClient = createClient({
  url: 'dragonfly://localhost:6379', // or your Dragonfly URL
});

await dragonflyClient.connect();

AuthModule.forRoot({
  jwt: { ... },
  storageAdapter: new RedisStorageAdapter(dragonflyClient),
});
```

## Key Prefixing

All keys are automatically prefixed with `nauth_` to avoid collisions with other application keys:

- `ratelimit:user:123` → `nauth_:ratelimit:user:123`
- `refresh-lock:token-hash` → `nauth_:refresh-lock:token-hash`
- `used-token:hash` → `nauth_:used-token:hash`

## Client Requirements

The adapter validates that your Redis client has the following methods:

- `get(key)` - Get value
- `set(key, value, options?)` - Set value (with optional `{ EX: seconds }`)
- `del(key)` - Delete key
- `incr(key)` - Increment counter
- `decr(key)` - Decrement counter
- `expire(key, seconds)` - Set expiration
- `exists(key)` - Check existence
- `ttl(key)` - Get time to live
- `hget(key, field)` - Hash get
- `hset(key, field, value)` - Hash set
- `hgetall(key)` - Hash get all
- `hdel(key, ...fields)` - Hash delete
- `lpush(key, value)` - List push
- `lrange(key, start, stop)` - List range
- `llen(key)` - List length
- `ping()` - Health check

The `redis` package (node-redis) satisfies these requirements.

## Error Handling

The adapter includes connection health checks:

```typescript
const adapter = new RedisStorageAdapter(redisClient);

// Health check
const healthy = await adapter.isHealthy(); // Uses PING command

// Initialize (performs health check)
await adapter.initialize();
```

## Comparison with Other Adapters

| Feature | MemoryStorageAdapter | DatabaseStorageAdapter | RedisStorageAdapter |
|---------|---------------------|------------------------|---------------------|
| Multi-server | ❌ | ✅ | ✅ |
| Persistence | ❌ | ✅ | ✅ (optional) |
| Performance | ⚡⚡⚡ | ⚡⚡ | ⚡⚡⚡ |
| External dependency | ❌ | ❌ | ✅ (Redis) |
| Setup complexity | 🟢 Low | 🟡 Medium | 🟡 Medium |
| Redis Cluster | N/A | N/A | ✅ (high-availability) |

## Production Considerations

### Connection Pooling

The adapter doesn't manage connection pooling - your Redis client does. Configure pooling in your client:

**node-redis:**
```typescript
const redisClient = createClient({
  url: process.env.NAUTH_REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Too many retries');
      return Math.min(retries * 100, 3000);
    },
  },
});
```

**node-redis with reconnection:**
```typescript
const redisClient = createClient({
  url: process.env.NAUTH_REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Too many retries');
      return Math.min(retries * 100, 3000);
    },
  },
});
```

### TLS/SSL

Configure TLS in your Redis client:

```typescript
// TLS/SSL with authentication in URL
const redisClient = createClient({
  url: process.env.NAUTH_REDIS_URL, // e.g., 'rediss://:password@host:6380'
  socket: {
    tls: true,
    rejectUnauthorized: false, // Set to true in production with proper certs
  },
});

// Or use rediss:// protocol in URL (TLS automatically enabled)
const redisClient = createClient({
  url: 'rediss://:password@localhost:6380', // rediss:// = TLS enabled
});
```

### High Availability

For production, use Redis Cluster for high-availability:

```typescript
import { createRedisClusterAdapter } from '@nauth-toolkit/nestjs';

AuthModule.forRoot({
  jwt: { ... },
  storageAdapter: createRedisClusterAdapter([
    { url: 'redis://redis-node-1:6379' },
    { url: 'redis://redis-node-2:6379' },
    { url: 'redis://redis-node-3:6379' },
  ]),
});
```

The cluster client automatically handles:
- Topology discovery
- Command routing based on key hash slots
- Node failures and redirects (MOVED/ASK errors)
- High availability and horizontal scaling

**Other Options:**
- **Redis Sentinel** - Automatic failover (use with single-instance Redis client)
- **Dragonfly** - Drop-in Redis replacement with better performance (works with same client)

## License

MIT

