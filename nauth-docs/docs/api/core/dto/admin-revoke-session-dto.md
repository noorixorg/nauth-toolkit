---
title: AdminRevokeSessionDTO
description: Admin-only DTO for revoking a specific user session by session ID.
keywords: [admin, session, revoke, logout, dto, request, response, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminRevokeSessionDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for admin-initiated revocation of a specific user session.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminRevokeSessionDTO, LogoutSessionResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminRevokeSessionDTO, LogoutSessionResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminRevokeSessionDTO, LogoutSessionResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## AdminRevokeSessionDTO (Request)

| Property     | Type     | Required | Description                                                                                      |
| ------------ | -------- | -------- | ------------------------------------------------------------------------------------------------ |
| `sub`        | `string` | Yes      | User sub (UUID v4). Trimmed, lowercased for consistency.                                        |
| `sessionId`  | `string` | Yes      | Session ID to revoke.                                                                            |

## LogoutSessionResponseDTO (Response)

| Property            | Type      | Description                                      |
| ------------------ | --------- | ------------------------------------------------ |
| `success`          | `boolean` | Whether the session was successfully revoked.    |
| `wasCurrentSession` | `boolean` | Whether the revoked session was the current session. |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "sessionId": "session-uuid-123"
}
```

## Used By

- [AdminAuthService.revokeUserSession()](../services/admin-auth-service#revokeusersession)
