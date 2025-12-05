---
title: Memory Adapter
description: In-memory storage adapter for development
keywords: [storage, memory, development, adapter, api]
image: /img/api-social-card.png
sidebar_position: 4
---

# Memory Adapter

**Package:** `@nauth-toolkit/core`
**Type:** Storage Adapter (Development)

In-memory storage. Data lost on restart. Development only.

## Class

```typescript
new MemoryStorageAdapter()
```

No configuration required.

## Usage

```typescript
import { MemoryStorageAdapter } from '@nauth-toolkit/core';

config: {
  storageAdapter: new MemoryStorageAdapter(),
}
```

## Limitations

- Data lost on server restart
- Not suitable for production
- Not suitable for multi-instance deployments
- No persistence

## Related

- [Redis](/docs/api/storage/redis)
- [Session Storage](/docs/api/storage/overview)

