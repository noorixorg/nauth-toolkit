---
title: GetLinkedAccountsResponseDTO
description: Response DTO for get linked accounts operation. Returns array of linked social accounts with provider details.
keywords: [social, auth, dto, response, accounts, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetLinkedAccountsResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for get linked accounts operation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetLinkedAccountsResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetLinkedAccountsResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetLinkedAccountsResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type     | Required | Description                                                                                    |
| --------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `accounts` | `Array`  | Yes      | Array of linked social accounts                                                                |
|           |          |          | - `provider` - `string` - Provider name                                                       |
|           |          |          | - `providerEmail` - `string` (optional) - Email from provider                                  |
|           |          |          | - `linkedAt` - `Date` - When account was linked                                                |
|           |          |          | - `lastUsedAt` - `Date` (optional) - When account was last used                               |

## Example

```json
{
  "accounts": [
    {
      "provider": "google",
      "providerEmail": "user@gmail.com",
      "linkedAt": "2024-01-15T10:30:00Z",
      "lastUsedAt": "2024-01-20T14:22:00Z"
    }
  ]
}
```

## Used By

- [SocialAuthService.getLinkedAccounts()](../services/social-auth-service#getlinkedaccounts)

