---
title: StartSocialRedirectQueryDTO
description: Query DTO for starting redirect-first social login flow
sidebar_position: 880
keywords: [dto, social, oauth, redirect, query, start, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# StartSocialRedirectQueryDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request Query Parameters)

Query DTO for initiating a backend-first OAuth redirect flow where the provider redirects back to the backend callback endpoint. Used with [`SocialRedirectHandler`](../services/social-auth-service).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { StartSocialRedirectQueryDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { StartSocialRedirectQueryDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { StartSocialRedirectQueryDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type                | Required | Description                                                                                                                          |
| ---------- | ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `action`   | `'login' \| 'link'` | No       | Redirect action type. `login` for standard social login/signup, `link` to link social account to existing user. Default: `login`     |
| `appState` | `string`            | No       | Opaque, non-secret state to round-trip back to the frontend. Max 2000 characters. Trimmed.                                           |
| `returnTo` | `string`            | No       | Frontend path or absolute URL to redirect to after authentication completes. Max 2048 characters. Trimmed. Default: `/auth/callback` |

## Example

```http
GET /auth/social/google/redirect?returnTo=/auth/callback&appState=user123&action=login HTTP/1.1
Host: api.example.com
```

## Used By

- [`SocialRedirectHandler.start()`](../services/social-auth-service)

## Related

- [`SocialCallbackQueryDTO`](./social-callback-query-dto) - OAuth callback query parameters
- [`SocialCallbackFormDTO`](./social-callback-form-dto) - OAuth callback form data (Apple)
- [`SocialExchangeDTO`](./social-exchange-dto) - Exchange token for auth response
