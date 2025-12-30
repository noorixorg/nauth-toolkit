---
title: GetLinkedAccountsDTO
description: Request DTO for getting linked social accounts. Includes user identifier (UUID v4).
keywords: [social, auth, dto, request, accounts, api]
image: /img/api-social-card.png
sidebar_position: 600
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetLinkedAccountsDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for getting linked social accounts.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetLinkedAccountsDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetLinkedAccountsDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetLinkedAccountsDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                          |
| -------- | -------- | -------- | ------------------------------------ |
| `userId` | `string` | Yes      | User identifier (UUID v4). Trimmed and lowercased. |

## Example

```json
{
  "userId": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

## Used By

- [SocialAuthService.getLinkedAccounts()](../services/social-auth-service#getlinkedaccounts)

