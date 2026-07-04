---
title: DeleteApiKeyResponseDTO
description: Response for permanently deleting an API key.
keywords: [dto, api key, delete, response]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# DeleteApiKeyResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response for permanently deleting an API key.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { DeleteApiKeyResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { DeleteApiKeyResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { DeleteApiKeyResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description with validation inline |
| -------- | ---- | -------- | ---------------------------------- |
| `success` | `boolean` | Yes | Whether the key was deleted. |

## Example

```json
{
  "success": true
}
```

## Used By

- [ApiKeyService.deleteKey()](../services/api-key-service#deletekeydto)
