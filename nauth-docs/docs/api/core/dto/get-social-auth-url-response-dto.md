---
title: GetSocialAuthUrlResponseDTO
description: Response DTO for get social auth URL operation. Returns OAuth authorization URL.
keywords: [social, auth, oauth, dto, response, url, api]
image: /img/api-social-card.png
sidebar_position: 28
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetSocialAuthUrlResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for get social auth URL operation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetSocialAuthUrlResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetSocialAuthUrlResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetSocialAuthUrlResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description              |
| -------- | -------- | -------- | ------------------------ |
| `url`    | `string` | Yes      | OAuth authorization URL  |

## Example

```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

## Used By

- [SocialAuthService.getSocialAuthUrl()](../services/social-auth-service#getsocialauthurl)

