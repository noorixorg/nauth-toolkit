---
title: AdminManageApiKeyDTO
description: Administrative list/revoke/delete of a user's API keys by sub. keyId required for revoke/delete.
keywords: [dto, admin, api key, manage]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminManageApiKeyDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Administrative list/revoke/delete of a user's API keys by sub. keyId required for revoke/delete.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminManageApiKeyDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminManageApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminManageApiKeyDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description with validation inline |
| -------- | ---- | -------- | ---------------------------------- |
| `sub` | `string` | Yes | Target user sub (UUID v4). |
| `keyId` | `string` | No | External key identifier. Required for revoke/delete, omitted for list. |

## Example

```json
{
  "sub": "550e8400-...",
  "keyId": "660e8400-..."
}
```

## Used By

- [AdminAuthService.listUserApiKeys() / revokeUserApiKey() / deleteUserApiKey()](../services/admin-auth-service)
