---
title: ListApiKeysResponseDTO
description: Response for listing API keys — a sanitized array of the user's keys.
keywords: [dto, api key, list, response]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ListApiKeysResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response for listing API keys — a sanitized array of the user's keys.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ListApiKeysResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ListApiKeysResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ListApiKeysResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description with validation inline |
| -------- | ---- | -------- | ---------------------------------- |
| `apiKeys` | `ApiKeyResponseDTO[]` | Yes | The user's API keys (never includes secrets). |

## Example

```json
{
  "apiKeys": [
    { "keyId": "550e8400-...", "name": "CI", "isActive": true, "usageCount": 12 }
  ]
}
```

## Used By

- [ApiKeyService.listKeys()](../services/api-key-service#listkeys)
