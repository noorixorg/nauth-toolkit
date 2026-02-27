---
title: Redis Cluster
description: Redis Cluster storage for high availability
keywords: [storage, redis, cluster, production, adapter, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Redis Cluster Adapter

**Package:** `@nauth-toolkit/storage-redis`
**Type:** Storage Adapter (Production HA)

High-availability Redis Cluster storage for production deployments.

```bash npm2yarn
npm install @nauth-toolkit/storage-redis redis
```

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { createCluster } from 'redis';
import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';

const clusterClient = createCluster({
  rootNodes: [
    { url: 'redis://node1:6379' },
    { url: 'redis://node2:6379' },
    { url: 'redis://node3:6379' },
  ],
});
await clusterClient.connect();

AuthModule.forRoot({
  storageAdapter: new RedisStorageAdapter(clusterClient),
})
```

**Or with factory:**

```typescript
import { createRedisClusterAdapter } from '@nauth-toolkit/nestjs';

AuthModule.forRoot({
  storageAdapter: createRedisClusterAdapter([
    { url: 'redis://node1:6379' },
    { url: 'redis://node2:6379' },
    { url: 'redis://node3:6379' },
  ]),
})
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { createCluster } from 'redis';
import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';

const clusterClient = createCluster({
  rootNodes: [
    { url: 'redis://node1:6379' },
    { url: 'redis://node2:6379' },
    { url: 'redis://node3:6379' },
  ],
});
await clusterClient.connect();

const nauth = await NAuth.create({
  config: {
    storageAdapter: new RedisStorageAdapter(clusterClient),
  },
  // ...
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { createCluster } from 'redis';
import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';
import { FastifyAdapter } from '@nauth-toolkit/core';

const clusterClient = createCluster({
  rootNodes: [
    { url: 'redis://node1:6379' },
    { url: 'redis://node2:6379' },
    { url: 'redis://node3:6379' },
  ],
});
await clusterClient.connect();

const nauth = await NAuth.create({
  config: {
    storageAdapter: new RedisStorageAdapter(clusterClient),
  },
  adapter: new FastifyAdapter(),
  // ...
});
```

</TabItem>
</Tabs>

## Features

- High availability (automatic failover)
- Horizontal scaling
- Same `RedisStorageAdapter` class as single instance
- Uses `createCluster()` instead of `createClient()`

## Related

- [Redis](./redis) - Single instance
- [Session Storage](./overview)
