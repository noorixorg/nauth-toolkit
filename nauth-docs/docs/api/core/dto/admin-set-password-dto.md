---
title: AdminSetPasswordDTO
description: Admin-only password reset DTOs for resetting user passwords by sub with configurable force change and session revocation.
keywords: [admin, password, reset, dto, request, response, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminSetPasswordDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for admin-initiated password reset by sub (UUID).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminSetPasswordDTO, AdminSetPasswordResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminSetPasswordDTO, AdminSetPasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminSetPasswordDTO, AdminSetPasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## AdminSetPasswordDTO (Request)

| Property             | Type      | Required | Description                                                                                      |
| -------------------- | --------- | -------- | ------------------------------------------------------------------------------------------------ |
| `sub`                | `string`  | Yes      | User sub (UUID v4). Trimmed, lowercased for consistency.                                        |
| `newPassword`        | `string`  | Yes      | New password. 8-128 characters. Not trimmed.                                                     |
| `mustChangePassword` | `boolean` | No       | Require password change on next login. Default: `true` (applied by service when not provided).   |
| `revokeSessions`     | `boolean` | No       | Revoke all active sessions. Default: `true` (applied by service when not provided).              |

## AdminSetPasswordResponseDTO (Response)

| Property             | Type      | Description                                      |
| -------------------- | --------- | ------------------------------------------------ |
| `success`            | `boolean` | Always true on success.                          |
| `mustChangePassword` | `boolean` | Whether user must change password on next login. |
| `sessionsRevoked`    | `number`  | Number of sessions revoked.                      |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "newPassword": "NewSecurePassword123!",
  "mustChangePassword": true,
  "revokeSessions": true
}
```

## Used By

- [AdminAuthService.setPassword()](../services/admin-auth-service#setpassword)
