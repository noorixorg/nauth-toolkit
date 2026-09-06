---
title: SetPasswordForSocialUserDTO
description: Request DTO for setting a first password on a social-only account. Carries the new password; the account is the caller's own.
keywords: [social, auth, dto, request, password, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SetPasswordForSocialUserDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for setting a first password on a social-only account.

The account acted on is always the caller's own, resolved from the authenticated request context, so no user identifier is sent.

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
| `password` | `string` | Yes      | New password. Min 1 char, max 128 chars (actual validation in AuthService). Not trimmed.    |

## Example

```json
{
  "password": "newpassword123"
}
```

## Used By

- [SocialAuthService.setPasswordForSocialUser()](../services/social-auth-service#setpasswordforsocialuser)

