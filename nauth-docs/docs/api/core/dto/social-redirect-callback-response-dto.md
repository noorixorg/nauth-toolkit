---
title: SocialRedirectCallbackResponseDTO
description: Response DTO returned by SocialRedirectHandler.callback()
keywords: [dto, social, oauth, redirect, response, callback, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SocialRedirectCallbackResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** Response DTO (interface)

Response DTO returned by [`SocialRedirectHandler.callback()`](../services/social-auth-service). Use with NestJS `@Redirect()` or equivalent to redirect the user to the frontend. In cookies mode, the handler applies cookies to the HTTP response via ContextStorage before returning; the controller only returns this DTO.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SocialRedirectCallbackResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SocialRedirectCallbackResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SocialRedirectCallbackResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                                          |
| -------- | -------- | -------- | -------------------------------------------------------------------- |
| `url`    | `string` | Yes      | Redirect URL to the frontend (e.g. returnTo with appState or exchangeToken). |

## Used By

- [`SocialRedirectHandler.callback()`](../services/social-auth-service)

## Related

- [`SocialCallbackQueryDTO`](./social-callback-query-dto) - GET callback query
- [`SocialCallbackFormDTO`](./social-callback-form-dto) - POST callback form (Apple)
- [`StartSocialRedirectResponseDTO`](./start-social-redirect-response-dto) - Start response
