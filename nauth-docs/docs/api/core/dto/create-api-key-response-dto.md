---
title: CreateApiKeyResponseDTO
description: Returned once when a key is created. The plaintext key is shown only here.
keywords: [dto, api key, create, response]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# CreateApiKeyResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Returned once when a key is created. The plaintext key is shown only here.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { CreateApiKeyResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { CreateApiKeyResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { CreateApiKeyResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description with validation inline |
| -------- | ---- | -------- | ---------------------------------- |
| `key` | `string` | Yes | Full plaintext API key (shown once; store securely). |
| `apiKey` | `ApiKeyResponseDTO` | Yes | Sanitized metadata for the created key. |

## Example

```json
{
  "key": "Zdh-wUDorVIDtYEiW2q1fT5m9jdXxss-cmyZbIZ73Qg",
  "apiKey": { "keyId": "550e8400-...", "isActive": true }
}
```

## Used By

- [ApiKeyService.createKey()](../services/api-key-service#createkeydto)
