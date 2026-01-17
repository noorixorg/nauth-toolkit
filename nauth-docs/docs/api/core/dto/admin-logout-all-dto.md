---
title: AdminLogoutAllDTO
description: Admin-only DTO for logging out a target user from all sessions across all devices.
keywords: [admin, logout, session, dto, request, response, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminLogoutAllDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for admin-initiated logout from all sessions for a target user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminLogoutAllDTO, LogoutAllResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminLogoutAllDTO, LogoutAllResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminLogoutAllDTO, LogoutAllResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## AdminLogoutAllDTO (Request)

| Property         | Type      | Required | Description                                                                                      |
| ---------------- | --------- | -------- | ------------------------------------------------------------------------------------------------ |
| `sub`            | `string`  | Yes      | User sub (UUID v4). Trimmed, lowercased for consistency.                                        |
| `forgetDevices`  | `boolean` | No       | Whether to also revoke all trusted devices. Default: false.                                      |

## LogoutAllResponseDTO (Response)

| Property        | Type     | Description                      |
| --------------- | -------- | -------------------------------- |
| `revokedCount`  | `number` | Number of sessions revoked.      |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "forgetDevices": true
}
```

## Used By

- [AdminAuthService.logoutAll()](../services/admin-auth-service#logoutall)
