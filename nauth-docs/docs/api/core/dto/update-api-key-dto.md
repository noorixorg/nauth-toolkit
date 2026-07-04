---
title: UpdateApiKeyDTO
description: Update an API key's mutable fields (label and IP allowlist). The secret and expiry are immutable.
keywords: [dto, api key, update, ip allowlist]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# UpdateApiKeyDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Update an API key's mutable fields (label and IP allowlist). The secret and expiry are immutable.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { UpdateApiKeyDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { UpdateApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { UpdateApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description with validation inline |
| -------- | ---- | -------- | ---------------------------------- |
| `keyId` | `string` | Yes | External key identifier (UUID v4). |
| `name` | `string` | No | New label. Max 255 chars. |
| `allowedIps` | `string[]` | No | Replacement allowlist. Empty array clears restrictions. |

## Example

```json
{
  "keyId": "550e8400-e29b-41d4-a716-446655440000",
  "allowedIps": ["203.0.113.5"]
}
```

## Used By

- [ApiKeyService.updateKey()](../services/api-key-service#updatekeydto)
