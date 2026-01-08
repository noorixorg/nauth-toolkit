---
title: SetMustChangePasswordDTO
description: Request DTO for requiring user to change password on next login. Includes UUID validation for security.
keywords: [password, change, required, dto, request, uuid, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SetMustChangePasswordDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for requiring a user to change their password on next login.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SetMustChangePasswordDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SetMustChangePasswordDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SetMustChangePasswordDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `userId` | `string` | Yes      | User identifier. UUID v4 format. Trimmed and lowercased.          |

## Example

```json
{
  "userId": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

## Used By

- [AuthService.setMustChangePassword()](../services/auth-service#setmustchangepassword)
