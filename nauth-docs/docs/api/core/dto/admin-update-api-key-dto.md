---
title: AdminUpdateApiKeyDTO
description: Administrative update of a user's API key (label and IP allowlist).
keywords: [dto, admin, api key, update]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminUpdateApiKeyDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Administrative update of a user's API key (label and IP allowlist).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminUpdateApiKeyDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminUpdateApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminUpdateApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description with validation inline |
| -------- | ---- | -------- | ---------------------------------- |
| `sub` | `string` | Yes | Target user sub (UUID v4). |
| `keyId` | `string` | Yes | External key identifier (UUID v4). |
| `name` | `string` | No | New label. |
| `allowedIps` | `string[]` | No | Replacement allowlist (empty clears restrictions). |

## Example

```json
{
  "sub": "550e8400-...",
  "keyId": "660e8400-...",
  "allowedIps": ["203.0.113.5"]
}
```

## Used By

- [ApiKeyService.adminUpdateKey()](../services/api-key-service)
