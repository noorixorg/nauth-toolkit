---
title: UnlinkSocialAccountResponseDTO
description: Response DTO for unlink social account operation. Returns success message.
keywords: [social, auth, dto, response, unlink, api]
image: /img/api-social-card.png
sidebar_position: 35
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# UnlinkSocialAccountResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for unlink social account operation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { UnlinkSocialAccountResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { UnlinkSocialAccountResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { UnlinkSocialAccountResponseDTO } from '@nauth-toolkit/core';
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
  "message": "google account unlinked successfully"
}
```

## Used By

- [SocialAuthService.unlinkSocialAccount()](../services/social-auth-service#unlinksocialaccount)

