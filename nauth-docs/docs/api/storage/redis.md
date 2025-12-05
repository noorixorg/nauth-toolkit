---
title: Redis
description: Redis storage adapter for production deployments
keywords: [storage, redis, production, adapter, api]
image: /img/api-social-card.png
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Redis Adapter

**Package:** `@nauth-toolkit/storage-redis`
**Type:** Storage Adapter (Production)

High-performance Redis storage for transient authentication state.

```bash npm2yarn
npm install @nauth-toolkit/storage-redis redis
```

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { createClient } from 'redis';
import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';

const redisClient = createClient({ url: 'redis://localhost:6379' });
await redisClient.connect();

AuthModule.forRoot({
  storageAdapter: new RedisStorageAdapter(redisClient),
})
```

**Or with factory:**

```typescript
import { createRedisStorageAdapter } from '@nauth-toolkit/nestjs';

AuthModule.forRoot({
  storageAdapter: createRedisStorageAdapter('redis://localhost:6379'),
})
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { createClient } from 'redis';
import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';

const redisClient = createClient({ url: 'redis://localhost:6379' });
await redisClient.connect();

const nauth = await NAuth.create({
  config: {
    storageAdapter: new RedisStorageAdapter(redisClient),
  },
  // ...
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { createClient } from 'redis';
import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';
import { FastifyAdapter } from '@nauth-toolkit/core';

const redisClient = createClient({ url: 'redis://localhost:6379' });
await redisClient.connect();

const nauth = await NAuth.create({
  config: {
    storageAdapter: new RedisStorageAdapter(redisClient),
  },
  adapter: new FastifyAdapter(),
  // ...
});
```

</TabItem>
</Tabs>

## Features

- Automatic key prefixing (`nauth_`)
- Native TTL support
- Multi-server compatible
- High performance

## Related

- [Redis Cluster](./redis-cluster) - High availability
- [Session Storage](./overview)
