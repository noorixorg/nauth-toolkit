---
title: GetUserSessionsDTO
description: Request DTO for retrieving all active sessions for a user. Supports both user and admin use cases.
keywords: [dto, sessions, user, admin, request, api]
image: /img/api-social-card.png
sidebar_position: 460
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetUserSessionsDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for retrieving all active sessions for a user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetUserSessionsDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetUserSessionsDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetUserSessionsDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `sub`    | `string` | Yes      | User identifier. UUID v4 format. Trimmed and lowercased.        |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

## Security

:::warning Authentication Required
This endpoint **requires authentication**. For user endpoints, extract `sub` from authenticated user context. For admin endpoints, protect with admin guards and accept `sub` from route parameter.
:::

## Used By

- [AuthService.getUserSessions()](../services/auth-service#getusersessions)

