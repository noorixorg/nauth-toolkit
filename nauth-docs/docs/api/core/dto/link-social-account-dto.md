---
title: LinkSocialAccountDTO
description: Request DTO for linking social account to existing user. Includes user ID, provider, authorization code, and state.
keywords: [social, auth, oauth, dto, request, link, api]
image: /img/api-social-card.png
sidebar_position: 620
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LinkSocialAccountDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for linking social account to existing user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { LinkSocialAccountDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { LinkSocialAccountDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { LinkSocialAccountDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type     | Required | Description                                                                                    |
| ---------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `userId`   | `string` | Yes      | User identifier (UUID v4). Trimmed and lowercased.                                           |
| `provider` | `string` | Yes      | Social provider name (e.g., 'google', 'apple', 'facebook'). Trimmed and lowercased. Max 50 chars. |
| `code`     | `string` | Yes      | Authorization code from OAuth callback. Trimmed. Max 1000 chars.                               |
| `state`    | `string` | Yes      | State parameter from OAuth callback (for CSRF validation). Trimmed. Max 500 chars.           |

## Example

```json
{
  "userId": "a21b654c-2746-4168-acee-c175083a65cd",
  "provider": "apple",
  "code": "c123456...",
  "state": "csrf-token-123"
}
```

## Used By

- [SocialAuthService.linkSocialAccount()](../services/social-auth-service#linksocialaccount)

