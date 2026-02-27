---
title: StartSocialRedirectResponseDTO
description: Response DTO returned by SocialRedirectHandler.start()
keywords: [dto, social, oauth, redirect, response, start, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# StartSocialRedirectResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** Response DTO (interface)

Response DTO returned by [`SocialRedirectHandler.start()`](../services/social-auth-service). Use with NestJS `@Redirect()` or equivalent to perform the redirect to the OAuth provider.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { StartSocialRedirectResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { StartSocialRedirectResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { StartSocialRedirectResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                      |
| -------- | -------- | -------- | ------------------------------------------------ |
| `url`    | `string` | Yes      | Redirect URL to the OAuth provider authorization endpoint. |

## Used By

- [`SocialRedirectHandler.start()`](../services/social-auth-service)

## Related

- [`StartSocialRedirectQueryDTO`](./start-social-redirect-query-dto) - Query parameters for start
- [`SocialRedirectCallbackResponseDTO`](./social-redirect-callback-response-dto) - Callback response
