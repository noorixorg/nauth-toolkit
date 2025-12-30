---
title: CanSetPasswordDTO
description: Request DTO for checking if user can set password. Includes user identifier (UUID v4).
keywords: [social, auth, dto, request, password, api]
image: /img/api-social-card.png
sidebar_position: 580
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# CanSetPasswordDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for checking if user can set password.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { CanSetPasswordDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { CanSetPasswordDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { CanSetPasswordDTO } from '@nauth-toolkit/core';
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

- [SocialAuthService.canSetPassword()](../services/social-auth-service#cansetpassword)

