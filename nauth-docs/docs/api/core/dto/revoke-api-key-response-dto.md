---
title: RevokeApiKeyResponseDTO
description: Response for revoking (soft-deleting) an API key.
keywords: [dto, api key, revoke, response]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RevokeApiKeyResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response for revoking (soft-deleting) an API key.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { RevokeApiKeyResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { RevokeApiKeyResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { RevokeApiKeyResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description with validation inline |
| -------- | ---- | -------- | ---------------------------------- |
| `success` | `boolean` | Yes | Whether the key was revoked. |

## Example

```json
{
  "success": true
}
```

## Used By

- [ApiKeyService.revokeKey()](../services/api-key-service#revokekeydto)
