---
title: DeleteApiKeyDTO
description: Permanently delete an API key by identifier.
keywords: [dto, api key, delete]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# DeleteApiKeyDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Permanently delete an API key by identifier.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { DeleteApiKeyDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { DeleteApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { DeleteApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description with validation inline |
| -------- | ---- | -------- | ---------------------------------- |
| `keyId` | `string` | Yes | External key identifier (UUID v4). |

## Example

```json
{
  "keyId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Used By

- [ApiKeyService.deleteKey()](../services/api-key-service#deletekeyparams)
