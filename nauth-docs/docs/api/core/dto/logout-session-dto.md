---
title: LogoutSessionDTO
description: Request DTO for logging out from a specific session by session ID. Validates session ownership for security.
keywords: [logout, session, dto, request, device, api]
image: /img/api-social-card.png
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

| Property    | Type     | Required | Description              |
| ----------- | -------- | -------- | ------------------------ |
| `sessionId` | `string` | Yes      | Session ID to terminate. |

## Example

```json
{
  "sessionId": "123"
}
```

## Security

:::warning[Authentication Required]
This endpoint **requires authentication**. The user's identity is extracted from the authenticated JWT token. Session ownership is validated automatically.
:::

## Used By

- [AuthService.logoutSession()](../services/auth-service#logoutsession)

