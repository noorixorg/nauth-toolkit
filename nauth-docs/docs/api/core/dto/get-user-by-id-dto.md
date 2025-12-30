---
title: GetUserByIdDTO
description: Request DTO for retrieving user by UUID identifier. Includes UUID v4 format validation and sanitization.
keywords: [get, user, dto, request, uuid, api]
image: /img/api-social-card.png
sidebar_position: 730
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetUserByIdDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for retrieving a user by their unique identifier.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetUserByIdDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetUserByIdDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetUserByIdDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `sub`    | `string` | Yes      | User identifier. UUID v4 format. Trimmed and lowercased.          |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

## Used By

- [AuthService.getUserById()](../services/auth-service#getuserbyid)
