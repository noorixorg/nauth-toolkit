---
title: SocialCallbackQueryDTO
description: Query DTO for OAuth callbacks via GET query parameters
keywords: [dto, social, oauth, redirect, callback, query, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SocialCallbackQueryDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request Query Parameters)

Query DTO for OAuth callbacks via GET query parameters. Used by providers that redirect with query params (Google, Facebook). Handles both successful callbacks and error scenarios.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SocialCallbackQueryDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SocialCallbackQueryDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SocialCallbackQueryDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property            | Type     | Required | Description                                                                                                                                         |
| ------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authuser`          | `string` | No       | Google: Account index when user has multiple Google accounts. Used by Google to pre-select the correct session. Max 50 characters. Trimmed.         |
| `code`              | `string` | No       | OAuth authorization code from provider. Max 2000 characters. Trimmed.                                                                               |
| `error`             | `string` | No       | Provider error code (if user cancels or error occurs). Max 2000 characters. Trimmed.                                                                |
| `error_description` | `string` | No       | Provider error description. Max 4000 characters. Trimmed.                                                                                           |
| `error_uri`         | `string` | No       | Provider: Optional URI with more error details. Max 4000 characters. Trimmed.                                                                       |
| `hd`                | `string` | No       | Google: Hosted domain (Google Workspace). Returned when user signs in with a workspace account (e.g., `company.com`). Max 2000 characters. Trimmed. |
| `prompt`            | `string` | No       | Google: Prompt mode used (`none`, `consent`, `select_account`). Indicates which screens were shown during auth. Max 2000 characters. Trimmed.       |
| `scope`             | `string` | No       | Google: Space-delimited OAuth scopes granted by user (e.g., `openid profile email`). Max 4000 characters. Trimmed.                                  |
| `session_state`     | `string` | No       | Provider: Session state parameter. Max 2000 characters. Trimmed.                                                                                    |
| `state`             | `string` | No       | OAuth state parameter for CSRF protection. Max 500 characters. Trimmed.                                                                             |

## Example

```http
GET /auth/social/google/callback?code=4%2F0AY0e-g7...&state=xyz789&scope=openid+profile+email&authuser=0&hd=example.com&prompt=consent HTTP/1.1
Host: api.example.com
```

:::note[Provider-Specific Parameters]
**Google** includes extra parameters in callbacks: `scope` (granted scopes), `authuser` (account index), `hd` (workspace domain if applicable), `prompt` (auth screens shown). These are validated to prevent `forbidNonWhitelisted` errors.

**Facebook** and other providers use only standard OAuth parameters (`code`, `state`, `error`, `error_description`).
:::

## Used By

- [`SocialRedirectHandler.callback()`](../services/social-auth-service) - Pass the query DTO as-is: `return await this.socialRedirect.callback(provider, dto)`. Returns [`SocialRedirectCallbackResponseDTO`](./social-redirect-callback-response-dto).

## Related

- [`StartSocialRedirectQueryDTO`](./start-social-redirect-query-dto) - Start redirect flow
- [`SocialCallbackFormDTO`](./social-callback-form-dto) - Apple POST callback
- [`SocialExchangeDTO`](./social-exchange-dto) - Exchange token
