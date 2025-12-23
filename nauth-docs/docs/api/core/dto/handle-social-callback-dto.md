---
title: HandleSocialCallbackDTO
description: Request DTO for handling OAuth callback. Includes provider, authorization code, and CSRF state parameter.
keywords: [social, auth, oauth, dto, request, callback, api]
image: /img/api-social-card.png
sidebar_position: 39
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# HandleSocialCallbackDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for handling OAuth callback.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { HandleSocialCallbackDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { HandleSocialCallbackDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { HandleSocialCallbackDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type     | Required | Description                                                                                    |
| ---------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `provider` | `string` | Yes      | Social provider name (e.g., 'google', 'apple', 'facebook'). Trimmed and lowercased. Max 50 chars. |
| `code`     | `string` | Yes      | Authorization code from OAuth callback. Trimmed. Max 1000 chars.                               |
| `state`    | `string` | Yes      | State parameter from OAuth callback (for CSRF validation). Trimmed. Max 500 chars.           |

## Example

```json
{
  "provider": "google",
  "code": "4/0AeanS...",
  "state": "csrf-token-123"
}
```

## Used By

- [SocialAuthService.handleSocialCallback()](../services/social-auth-service#handlesocialcallback)

