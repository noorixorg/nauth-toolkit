---
title: ChangePasswordRequestDTO
description: Password change request DTO extending ChangePasswordDTO with user sub. Includes current and new password validation.
keywords: [password, change, dto, request, uuid, api]
image: /img/api-social-card.png
sidebar_position: 220
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ChangePasswordRequestDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for changing user password, extending ChangePasswordDTO with user identifier.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ChangePasswordRequestDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ChangePasswordRequestDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ChangePasswordRequestDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type     | Required | Description                                                      |
| ------------- | -------- | -------- | ---------------------------------------------------------------- |
| `sub`         | `string` | Yes      | User identifier. UUID v4 format. Trimmed and lowercased.          |
| `oldPassword` | `string` | Yes      | Current password for verification. Not trimmed.                   |
| `newPassword` | `string` | Yes      | New password. 8-128 characters. Not trimmed.                    |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "oldPassword": "CurrentPass123!",
  "newPassword": "NewSecurePass456!"
}
```

## Used By

- [AuthService.changePassword()](../services/auth-service#changepassword)
