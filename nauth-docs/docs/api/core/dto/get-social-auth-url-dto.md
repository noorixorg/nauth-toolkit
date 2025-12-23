---
title: GetSocialAuthUrlDTO
description: Request DTO for getting OAuth authorization URL. Includes provider name and optional CSRF state parameter.
keywords: [social, auth, oauth, dto, request, url, api]
image: /img/api-social-card.png
sidebar_position: 29
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetSocialAuthUrlDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for getting OAuth authorization URL.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetSocialAuthUrlDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetSocialAuthUrlDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetSocialAuthUrlDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type     | Required | Description                                                                                    |
| ---------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `provider` | `string` | Yes      | Social provider name (e.g., 'google', 'apple', 'facebook'). Trimmed and lowercased. Max 50 chars. |
| `state`    | `string` | No       | CSRF state parameter. Trimmed. Max 500 chars.                                                 |

## Example

```json
{
  "provider": "google",
  "state": "csrf-token-123"
}
```

## Used By

- [SocialAuthService.getSocialAuthUrl()](../services/social-auth-service#getsocialauthurl)

