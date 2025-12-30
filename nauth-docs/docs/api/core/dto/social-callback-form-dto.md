---
title: SocialCallbackFormDTO
description: Form DTO for Apple form_post OAuth callbacks
sidebar_position: 660
keywords: [dto, social, oauth, redirect, callback, form, apple, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SocialCallbackFormDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request Body - Form)

Form DTO for Apple `form_post` OAuth callbacks. Apple uses POST with `application/x-www-form-urlencoded` instead of GET query parameters.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SocialCallbackFormDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SocialCallbackFormDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SocialCallbackFormDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property            | Type     | Required | Description                                                                          |
| ------------------- | -------- | -------- | ------------------------------------------------------------------------------------ |
| `code`              | `string` | No       | OAuth authorization code from provider. Max 2000 characters. Trimmed.                |
| `error`             | `string` | No       | Provider error code (if user cancels or error occurs). Max 2000 characters. Trimmed. |
| `error_description` | `string` | No       | Provider error description. Max 4000 characters. Trimmed.                            |
| `state`             | `string` | No       | OAuth state parameter for CSRF protection. Max 500 characters. Trimmed.              |

## Example

```http
POST /auth/social/apple/callback HTTP/1.1
Host: api.example.com
Content-Type: application/x-www-form-urlencoded

code=c1234567890abcdef&state=xyz789
```

:::note Apple Form Post
**Apple** uses `form_post` response mode (POST instead of GET) when requesting `name` or `email` scopes. Ensure your backend parses `application/x-www-form-urlencoded` bodies. Apple only returns standard OAuth parameters (`code`, `state`, `error`, `error_description`).
:::

## Used By

- [`SocialRedirectHandler.callback()`](../services/social-auth-service)

## Related

- [`StartSocialRedirectQueryDTO`](./start-social-redirect-query-dto) - Start redirect flow
- [`SocialCallbackQueryDTO`](./social-callback-query-dto) - GET callback (Google, Facebook)
- [`SocialExchangeDTO`](./social-exchange-dto) - Exchange token
