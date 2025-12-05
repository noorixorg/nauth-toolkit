---
title: Session Storage
description: Storage adapters for transient authentication state
keywords: [storage, session, redis, database, memory, api]
image: /img/api-social-card.png
sidebar_position: 0
---

# Session Storage

Storage adapters for transient authentication state (rate limits, locks, token tracking).

## Available Adapters

| Adapter | Package | Use Case |
|---------|---------|----------|
| [Redis](./redis) | `@nauth-toolkit/storage-redis` | Production (single instance) |
| [Redis Cluster](./redis-cluster) | `@nauth-toolkit/storage-redis` | Production (high availability) |
| [Database](./database) | `@nauth-toolkit/storage-database` | Production (TypeORM) |
| [Memory](./memory) | `@nauth-toolkit/core` | Development only |

## Purpose

Session storage handles **transient** authentication data:
- Rate limiting counters
- Account lockout state
- Token reuse tracking
- MFA challenge data
- CSRF tokens

:::note
This is NOT user data storage. User accounts and sessions are stored in your database via TypeORM entities. See [Database Packages](/docs/api/database/overview).
:::

## StorageAdapter Interface

```typescript
interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, ttlSeconds?: number): Promise<number>;
  // Hash operations for complex state
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
}
```

## Related

- [Database Packages](/docs/api/database/overview) - User/session entity storage
