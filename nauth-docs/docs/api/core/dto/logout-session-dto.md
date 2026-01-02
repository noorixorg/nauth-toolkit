---
title: LogoutSessionDTO
description: Request DTO for logging out from a specific session by session ID. Validates session ownership for security.
keywords: [logout, session, dto, request, device, api]
image: /img/api-social-card.png
sidebar_position: 600
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LogoutSessionDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for logging out from a specific session by session ID.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { LogoutSessionDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { LogoutSessionDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { LogoutSessionDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property    | Type     | Required | Description                                                                                          |
| ----------- | -------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `sub`       | `string` | Yes      | User identifier. UUID v4 format. Must match the session owner. Trimmed and lowercased.             |
| `sessionId` | `string` | Yes      | Session ID to revoke. Must belong to the user specified in `sub`.                                    |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "sessionId": "123"
}
```

## Security

:::warning Authentication Required
This endpoint **requires authentication**. For user endpoints, extract `sub` from authenticated user context. For admin endpoints, protect with admin guards and accept `sub` from route parameter. Session ownership is validated automatically.
:::

## Used By

- [AuthService.logoutSession()](../services/auth-service#logoutsession)

