---
title: SetPasswordForSocialUserDTO
description: Request DTO for setting password for social-only user. Includes user identifier and new password.
keywords: [social, auth, dto, request, password, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SetPasswordForSocialUserDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for setting password for social-only user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SetPasswordForSocialUserDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SetPasswordForSocialUserDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SetPasswordForSocialUserDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type     | Required | Description                                                                                    |
| ---------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `userId`   | `string` | Yes      | User identifier (UUID v4). Trimmed and lowercased.                                           |
| `password` | `string` | Yes      | New password. Min 1 char, max 128 chars (actual validation in AuthService). Not trimmed.    |

## Example

```json
{
  "userId": "a21b654c-2746-4168-acee-c175083a65cd",
  "password": "newpassword123"
}
```

## Used By

- [SocialAuthService.setPasswordForSocialUser()](../services/social-auth-service#setpasswordforsocialuser)

