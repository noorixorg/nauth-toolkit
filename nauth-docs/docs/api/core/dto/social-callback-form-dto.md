---
title: SocialCallbackFormDTO
description: Form DTO for Apple form_post OAuth callbacks
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
| `authuser`          | `string` | No       | Google account index. Sent by Google in some callback flows. Ignored by nauth.       |
| `code`              | `string` | No       | OAuth authorization code from provider. Max 2000 characters. Trimmed.                |
| `error`             | `string` | No       | Provider error code (if user cancels or error occurs). Max 2000 characters. Trimmed. |
| `error_description` | `string` | No       | Provider error description. Max 4000 characters. Trimmed.                            |
| `hd`                | `string` | No       | Hosted domain hint. Sent by Google for G Suite accounts. Ignored by nauth.           |
| `prompt`            | `string` | No       | OAuth prompt parameter echo. Sent by some providers. Ignored by nauth.               |
| `scope`             | `string` | No       | Granted OAuth scopes returned by provider. Ignored by nauth.                         |
| `state`             | `string` | No       | OAuth state parameter for CSRF protection. Max 500 characters. Trimmed.              |
| `user`              | `string` | No       | Apple-specific JSON string with user name/email (first sign-in only). Parsed by Apple provider. |

## Example

```http
POST /auth/social/apple/callback HTTP/1.1
Host: api.example.com
Content-Type: application/x-www-form-urlencoded

code=c1234567890abcdef&state=xyz789
```

:::note[Apple Form Post]
**Apple** uses `form_post` response mode (POST instead of GET) when requesting `name` or `email` scopes. Ensure your backend parses `application/x-www-form-urlencoded` bodies. The `user` field (JSON string with name/email) is only sent by Apple on the **first** sign-in.
:::

## Used By

- [`SocialRedirectHandler.callback()`](../services/social-auth-service) - Pass the form DTO as-is: `return await this.socialRedirect.callback(provider, dto)`. Returns [`SocialRedirectCallbackResponseDTO`](./social-redirect-callback-response-dto).

## Related

- [`StartSocialRedirectQueryDTO`](./start-social-redirect-query-dto) - Start redirect flow
- [`SocialCallbackQueryDTO`](./social-callback-query-dto) - GET callback (Google, Facebook)
- [`SocialExchangeDTO`](./social-exchange-dto) - Exchange token
