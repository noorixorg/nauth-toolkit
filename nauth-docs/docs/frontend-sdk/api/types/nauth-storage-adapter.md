---
title: NAuthStorageAdapter
description: Interface for custom storage adapters used by the client SDK
sidebar_position: 220
keywords: [storage, adapter, interface, api]
image: /img/api-social-card.png
---

# NAuthStorageAdapter

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Interface for custom storage adapters. Implement this interface to provide custom storage solutions (e.g., Capacitor Preferences, React Native AsyncStorage).

```typescript
import { NAuthStorageAdapter } from '@nauth-toolkit/client';
```

## Methods

| Method       | Signature                                       | Description           |
| ------------ | ----------------------------------------------- | --------------------- |
| `getItem`    | `(key: string) => Promise<string \| null>`      | Retrieve value by key |
| `setItem`    | `(key: string, value: string) => Promise<void>` | Persist value         |
| `removeItem` | `(key: string) => Promise<void>`                | Remove stored value   |

## Built-in Implementations

- [`BrowserStorage`](../nauth-client-config#built-in-adapters) - localStorage/sessionStorage adapter (see [NAuthClientConfig](../nauth-client-config))
- [`InMemoryStorage`](../nauth-client-config#built-in-adapters) - In-memory storage adapter (see [NAuthClientConfig](../nauth-client-config))

## Example

### Capacitor Storage Adapter

```typescript
import { NAuthStorageAdapter } from '@nauth-toolkit/client';
import { Preferences } from '@capacitor/preferences';

class CapacitorStorage implements NAuthStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }

  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}

const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'json',
  storage: new CapacitorStorage(),
  onSessionExpired: () => {},
});
```

## Used By

- [NAuthClientConfig](../nauth-client-config) - `storage` property accepts [`NAuthStorageAdapter`](./nauth-storage-adapter)

## Related Types

- [`NAuthClientConfig`](../nauth-client-config) - Client configuration
- [`BrowserStorage`](../nauth-client-config#built-in-adapters) - Built-in browser storage
- [`InMemoryStorage`](../nauth-client-config#built-in-adapters) - Built-in in-memory storage
