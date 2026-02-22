---
title: UnlinkSocialAccountDTO
description: Request DTO for unlinking social account. Includes user identifier and provider name.
keywords: [social, auth, dto, request, unlink, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# UnlinkSocialAccountDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for unlinking social account.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { UnlinkSocialAccountDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { UnlinkSocialAccountDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { UnlinkSocialAccountDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type     | Required | Description                                                                                    |
| ---------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `provider` | `string` | Yes      | Social provider name (e.g., `google`, `apple`, `facebook`). Trimmed and lowercased. Max 50 chars. |

:::note
The user is resolved from the authenticated JWT context — no `userId` field is required in the request body.
:::

## Example

```json
{
  "provider": "google"
}
```

## Used By

- [SocialAuthService.unlinkSocialAccount()](../services/social-auth-service#unlinksocialaccount)

