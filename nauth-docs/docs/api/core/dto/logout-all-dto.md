---
title: LogoutAllDTO
description: Request DTO for logging out user from all sessions. Requires user UUID for security validation.
keywords: [logout, all, sessions, dto, request, uuid, api]
image: /img/api-social-card.png
sidebar_position: 16
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LogoutAllDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for logging out a user from all active sessions.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { LogoutAllDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { LogoutAllDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { LogoutAllDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property        | Type      | Required | Description                                                                                          |
| --------------- | --------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `sub`           | `string`  | Yes      | User identifier. UUID v4 format. Trimmed and lowercased.                                             |
| `forgetDevices` | `boolean` | No       | If `true`, also revokes all trusted devices for the user. Default: `false` (devices remain trusted). |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "forgetDevices": false
}
```

## Security

:::warning Authentication Required
This endpoint **requires authentication**. The user must be logged in to call this endpoint. The `sub` field is automatically extracted from the authenticated user's JWT token by the framework adapters.
:::

When `forgetDevices` is `true`:

- All trusted devices for the user are revoked
- Users will be required to complete MFA on next login from any device
- Device token cookies are cleared (cookies mode)
- Device tokens are removed from storage (JSON mode)

```

## Used By

- [AuthService.logoutAll()](../services/auth-service#logoutall)
```
