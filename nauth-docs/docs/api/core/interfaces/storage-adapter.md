---
title: StorageAdapter
description: Interface for shared state adapters used for rate limits, locks, and token reuse detection
keywords: [storage, adapter, redis, database, interface, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# StorageAdapter

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Shared state adapter used by nauth-toolkit for transient state (rate limits, locks, token reuse detection). Required for production deployments.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { StorageAdapter } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { StorageAdapter } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { StorageAdapter } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `initialize()` | `Promise<void>` | Initialize adapter |
| `isHealthy()` | `Promise<boolean>` | Health check |
| `get(key)` | `Promise<string \| null>` | Read value |
| `set(key, value, ttlSeconds?, options?)` | `Promise<string \| null \| void>` | Write value (optional TTL / NX) |
| `del(key)` | `Promise<void>` | Delete key |
| `exists(key)` | `Promise<boolean>` | Key existence |
| `incr(key, ttlSeconds?)` | `Promise<number>` | Atomic increment |
| `decr(key)` | `Promise<number>` | Atomic decrement |
| `expire(key, ttl)` | `Promise<void>` | Set TTL |
| `ttl(key)` | `Promise<number>` | Get TTL |
| `hget(key, field)` | `Promise<string \| null>` | Hash get |
| `hset(key, field, value)` | `Promise<void>` | Hash set |
| `hgetall(key)` | `Promise<Record<string, string>>` | Hash get all |
| `hdel(key, ...fields)` | `Promise<number>` | Hash delete |
| `lpush(key, value)` | `Promise<void>` | List push |
| `lrange(key, start, stop)` | `Promise<string[]>` | List range |
| `llen(key)` | `Promise<number>` | List length |
| `keys(pattern)` | `Promise<string[]>` | Pattern keys |
| `scan(cursor, pattern, count)` | `Promise<[number, string[]]>` | Cursor scan |
| `cleanup()` | `Promise<void>` | Cleanup resources |
| `disconnect()` | `Promise<void>` | Disconnect |

## Related APIs

- [Storage Overview](/docs/api/storage/overview) - Built-in adapters
- [Configuration](/docs/concepts/configuration) - `NAuthConfig` reference


