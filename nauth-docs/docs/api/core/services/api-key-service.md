---
title: ApiKeyService
description: Create, list, update, revoke, delete, and validate API keys that authenticate as their owning user. Available when apiKeys.enabled is true.
keywords: [service, api key, api-key, machine auth, ip allowlist, validate]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ApiKeyService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Manages the API key lifecycle and validates keys presented on requests. A key authenticates **as its owning user**. Available when [`apiKeys.enabled`](../../../concepts/configuration.md) is `true`.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ApiKeyService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ApiKeyService } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ApiKeyService } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Overview

- Keys are stored as SHA-256 hashes; the plaintext is returned **once** at creation.
- Expiry is **mandatory** at creation (a number of days or `null` for never, subject to config).
- Optional per-key IP allowlists (IPs / IPv4 CIDR ranges); an empty list means any IP.
- Route access is opt-in — see the [API Keys guide](../../../guides/api-keys.md) for `@AllowApiKey()` / `@DenyApiKey()`.

:::note Authorization
This service does not enforce endpoint authorization. Protect management routes with your own guard, and use the decorators/helpers to control which routes accept API-key auth.
:::

## Methods

### createKey(params)

Creates a key and returns the plaintext once.

```typescript
const { key, apiKey } = await apiKeyService.createKey({
  userId: user.id,
  name: 'CI pipeline',
  expiresInDays: 90,          // required: number of days, or null for never
  allowedIps: ['203.0.113.0/24'], // optional IP allowlist
});
```

| Param | Type | Notes |
| --- | --- | --- |
| `userId` | `number` | Owning user (required) |
| `name` | `string?` | Optional label |
| `expiresInDays` | `number \| null` | Required. Positive integer, or `null` for never (if allowed) |
| `allowedIps` | `string[]?` | IPs / IPv4 CIDR ranges |
| `createdByAdmin` | `boolean?` | Bypasses `allowUserCreation` (set by the admin API) |

Returns `{ key: string; apiKey: ApiKeyResponseDTO }`.

### updateKey(params)

Updates the label and/or IP allowlist. The secret and expiry are immutable.

```typescript
await apiKeyService.updateKey({ userId: user.id, keyId, allowedIps: ['203.0.113.5'] });
```

### listKeys(userId)

Returns sanitized `ApiKeyResponseDTO[]` (never the secret).

### revokeKey(params)

Soft-disables a key (`{ userId, keyId }`; retained for audit). Returns `{ success: true }`.

### deleteKey(params)

Permanently deletes a key (`{ userId, keyId }`). Returns `{ success: true }`.

### validateKey(rawKey, callerIp?)

Validates a presented key and resolves its owner. Throws a precise `NAuthException` on failure (invalid/expired/IP-blocked) — used internally by the guard/handler.

```typescript
const { keyId, userId, sub } = await apiKeyService.validateKey(rawKey, callerIp);
```

## Errors

`API_KEY_INVALID` · `API_KEY_EXPIRED` · `API_KEY_IP_NOT_ALLOWED` · `API_KEY_CREATION_DISABLED` · `API_KEY_LIMIT_REACHED` · `API_KEY_EXPIRY_REQUIRED` · `API_KEY_INDEFINITE_NOT_ALLOWED` · `API_KEY_EXPIRY_TOO_LONG` — see the [API Keys guide](../../../guides/api-keys.md#errors).
