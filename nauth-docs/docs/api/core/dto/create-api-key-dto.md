---
title: CreateApiKeyDTO
description: Create an API key for the authenticated user. Expiry is mandatory; IP allowlist is optional.
keywords: [dto, api key, create, expiry, ip allowlist]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# CreateApiKeyDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Create an API key for the authenticated user. Expiry is mandatory; IP allowlist is optional.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { CreateApiKeyDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { CreateApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { CreateApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description with validation inline |
| -------- | ---- | -------- | ---------------------------------- |
| `name` | `string` | No | Optional label. Max 255 chars. |
| `expiresInDays` | `number \| null` | Yes | Expiry in days, or null for never (if allowed). Positive integer when set. |
| `allowedIps` | `string[]` | No | IPs / IPv4 CIDR ranges. Empty = any IP. |

## Example

```json
{
  "name": "CI pipeline",
  "expiresInDays": 90,
  "allowedIps": ["203.0.113.0/24"]
}
```

## Used By

- [ApiKeyService.createKey()](../services/api-key-service#createkeyparams)
