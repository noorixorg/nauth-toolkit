---
title: SetPasswordForSocialUserResponseDTO
description: Response DTO for set password for social user operation. Returns success message.
keywords: [social, auth, dto, response, password, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SetPasswordForSocialUserResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for set password for social user operation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SetPasswordForSocialUserResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SetPasswordForSocialUserResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SetPasswordForSocialUserResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type     | Required | Description              |
| --------- | -------- | -------- | ------------------------ |
| `message` | `string` | Yes      | Success message          |

## Example

```json
{
  "message": "Password set successfully"
}
```

## Used By

- [SocialAuthService.setPasswordForSocialUser()](../services/social-auth-service#setpasswordforsocialuser)

