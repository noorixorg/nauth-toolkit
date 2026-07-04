---
title: ApiKeyResponseDTO
description: Sanitized API key metadata. Never includes the plaintext key or its hash.
keywords: [dto, api key, response]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ApiKeyResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Sanitized API key metadata. Never includes the plaintext key or its hash.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ApiKeyResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ApiKeyResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ApiKeyResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description with validation inline |
| -------- | ---- | -------- | ---------------------------------- |
| `keyId` | `string` | Yes | External key identifier (UUID v4). |
| `name` | `string \| null` | No | User-friendly label. |
| `lastFour` | `string \| null` | No | Last few characters of the key (display hint). |
| `allowedIps` | `string[] \| null` | No | Allowed IPs / CIDR ranges (null = any IP). |
| `expiresAt` | `Date \| null` | No | Expiry timestamp, or null if never expires. |
| `isActive` | `boolean` | Yes | Whether the key is active. |
| `createdByAdmin` | `boolean` | Yes | Whether an admin created the key. |
| `lastUsedAt` | `Date \| null` | No | Last successful use. |
| `lastUsedIp` | `string \| null` | No | IP of last use (when tracking enabled). |
| `usageCount` | `number` | Yes | Total successful authentications. |
| `createdAt` | `Date` | Yes | Creation timestamp. |

## Example

```json
{
  "keyId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "CI pipeline",
  "lastFour": "a1b2",
  "allowedIps": ["203.0.113.0/24"],
  "expiresAt": "2026-10-01T00:00:00.000Z",
  "isActive": true,
  "createdByAdmin": false,
  "usageCount": 12,
  "createdAt": "2026-07-01T00:00:00.000Z"
}
```

## Used By

- [ApiKeyService.listKeys()](../services/api-key-service#listkeys)
- [ApiKeyService.updateKey()](../services/api-key-service#updatekeydto)
