---
title: Memory Adapter
description: In-memory storage adapter (not recommended)
keywords: [storage, memory, development, adapter, api]
image: /img/api-social-card.png
sidebar_position: 4
---

# Memory Adapter

**Package:** `@nauth-toolkit/core`
**Type:** Storage Adapter (Not Recommended)

:::warning
**MemoryStorageAdapter is NOT recommended** even for development. Use `DatabaseStorageAdapter` or `RedisStorageAdapter` instead.

The toolkit will auto-create `DatabaseStorageAdapter` if storage entities are available in your TypeORM configuration, making it unnecessary to use MemoryStorageAdapter.
:::

## Why Not Recommended?

- Data lost on server restart
- Not shared across multiple server instances
- Rate limiting bypassed in multi-container deployments
- Never safe for production

## Recommended Alternatives

- **DatabaseStorageAdapter**: Auto-created if storage entities are configured, or explicitly use `createDatabaseStorageAdapter()` from `@nauth-toolkit/nestjs`
- **RedisStorageAdapter**: Best for production and multi-server deployments

See [Storage Guide](/docs/concepts/storage) for proper configuration.

## Related

- [Database Adapter](./database) - Recommended for single-server deployments
- [Redis Adapter](./redis) - Recommended for production
- [Storage Guide](/docs/concepts/storage) - Complete storage configuration guide

