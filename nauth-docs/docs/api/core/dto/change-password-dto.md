---
title: ChangePasswordDTO
description: Password change DTO with current and new password validation. Requires current password verification for security.
keywords: [password, change, dto, authentication, request, security, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ChangePasswordDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for changing user password. Requires current password verification.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ChangePasswordDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ChangePasswordDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ChangePasswordDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type     | Required | Description                                                      |
| ------------- | -------- | -------- | ---------------------------------------------------------------- |
| `oldPassword` | `string` | Yes      | Current password for verification. Not trimmed.                  |
| `newPassword` | `string` | Yes      | New password. 8-128 characters. Not trimmed.                    |

## Example

```json
{
  "oldPassword": "CurrentPass123!",
  "newPassword": "NewSecurePass456!"
}
```

## Used By

- [ChangePasswordRequestDTO](./change-password-request-dto) - Extends this DTO
- [AuthService.changePassword()](../services/auth-service#changepassword)
