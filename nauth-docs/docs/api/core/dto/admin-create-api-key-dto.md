---
title: AdminCreateApiKeyDTO
description: Administrative API key creation on behalf of a user. Bypasses allowUserCreation.
keywords: [dto, admin, api key, create]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminCreateApiKeyDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Administrative API key creation on behalf of a user. Bypasses allowUserCreation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminCreateApiKeyDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminCreateApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminCreateApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description with validation inline |
| -------- | ---- | -------- | ---------------------------------- |
| `sub` | `string` | Yes | Target user sub (UUID v4). |
| `name` | `string` | No | Optional label. |
| `expiresInDays` | `number \| null` | Yes | Expiry in days, or null for never (if allowed). |
| `allowedIps` | `string[]` | No | IPs / IPv4 CIDR ranges. |

## Example

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "expiresInDays": 90,
  "allowedIps": ["203.0.113.0/24"]
}
```

## Used By

- [AdminAuthService.createApiKeyForUser()](../services/admin-auth-service)
