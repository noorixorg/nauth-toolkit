---
title: StartSocialRedirectQueryDTO
description: Query DTO for starting redirect-first social login flow
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

| Property     | Type                | Required | Description                                                                                                                                                                                                                                                  |
| ------------ | ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `action`     | `'login' \| 'link'` | No       | Redirect action type. `login` for standard social login/signup, `link` to link social account to existing user. Default: `login`                                                                                                                            |
| `appState`   | `string`            | No       | Opaque, non-secret state to round-trip back to the frontend. Max 2000 characters. Trimmed.                                                                                                                                                                  |
| `returnTo`   | `string`            | No       | Frontend path or absolute URL to redirect to after authentication completes. Max 2048 characters. Trimmed. Default: `/auth/callback`                                                                                                                        |
| `oauthParams` | `string`            | No       | Additional OAuth parameters to pass to the provider. Passed as JSON string in query parameter. These parameters override config defaults and are appended to the provider's authorization URL. Max 2000 characters. Trimmed. Used for provider-specific customization. |

## OAuth Parameters

The `oauthParams` property allows per-request customization of the OAuth flow. Pass provider-specific parameters as a JSON string. These override any defaults set in the backend configuration. The handler parses the JSON string automatically; the consumer controller passes the DTO as-is to `SocialRedirectHandler.start(provider, dto)`.

### Common Parameters by Provider

**Google:**
- `prompt`: `'select_account'`, `'consent'`, `'none'`
- `hd`: Restrict to Google Workspace domain
- `login_hint`: Pre-fill email address
- `include_granted_scopes`: `'true'` for incremental auth

**Facebook:**
- `auth_type`: `'reauthenticate'`, `'rerequest'`
- `display`: `'page'`, `'popup'`, `'touch'`
- `auth_nonce`: For replay attack prevention

**Apple:**
- `nonce`: For ID token validation

## Example

### Basic Request

```http
GET /auth/social/google/redirect?returnTo=/auth/callback&appState=user123&action=login HTTP/1.1
Host: api.example.com
```

### With OAuth Parameters (Force Google Account Chooser)

```http
GET /auth/social/google/redirect?returnTo=/dashboard&oauthParams={"prompt":"select_account"} HTTP/1.1
Host: api.example.com
```

### Multiple OAuth Parameters

```http
GET /auth/social/google/redirect?returnTo=/dashboard&oauthParams={"prompt":"select_account consent","hd":"company.com"} HTTP/1.1
Host: api.example.com
```

## Used By

- [`SocialRedirectHandler.start()`](../services/social-auth-service)

## Related

- [`StartSocialRedirectResponseDTO`](./start-social-redirect-response-dto) - Response returned by start()
- [`SocialCallbackQueryDTO`](./social-callback-query-dto) - OAuth callback query parameters
- [`SocialCallbackFormDTO`](./social-callback-form-dto) - OAuth callback form data (Apple)
- [`SocialExchangeDTO`](./social-exchange-dto) - Exchange token for auth response
