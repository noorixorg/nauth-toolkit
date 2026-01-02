---
title: LinkSocialAccountResponseDTO
description: Response DTO for link social account operation. Returns success message and provider name.
keywords: [social, auth, oauth, dto, response, link, api]
image: /img/api-social-card.png
sidebar_position: 530
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LinkSocialAccountResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for link social account operation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { LinkSocialAccountResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { LinkSocialAccountResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { LinkSocialAccountResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type     | Required | Description              |
| ---------- | -------- | -------- | ------------------------ |
| `message`  | `string` | Yes      | Success message          |
| `provider` | `string` | Yes      | Provider name            |

## Example

```json
{
  "message": "Account linked successfully",
  "provider": "apple"
}
```

## Used By

- [SocialAuthService.linkSocialAccount()](../services/social-auth-service#linksocialaccount)

