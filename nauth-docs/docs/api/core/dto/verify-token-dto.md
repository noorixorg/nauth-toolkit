---
title: VerifyTokenDTO
description: Native mobile app token verification DTO with provider-aware validation. Supports Google, Apple, and Facebook (classic + Limited Login).
keywords: [token, verify, mobile, native, dto, request, google, apple, facebook, ios, android]

image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VerifyTokenDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Token verification request for native mobile app authentication using provider SDKs.

Supports provider-aware conditional validation:

- **google**: requires `idToken`, `accessToken` optional
- **apple**: requires `idToken`, `accessToken` optional, `profileData` optional
- **facebook**:
  - Classic login: requires `accessToken` (when `idToken` not provided)
  - Limited Login (OIDC): requires `idToken` (JWT, when `accessToken` not provided)

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyTokenDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyTokenDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyTokenDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type                      | Required    | Description                                                                                                           |
| ------------- | ------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `provider`    | `string`                  | Yes         | Provider name: `'google'`, `'apple'`, or `'facebook'`. Trimmed and lowercased.                                        |
| `idToken`     | `string`                  | Conditional | Required for google/apple. Required for facebook Limited Login (when accessToken not provided). Max 10000 characters. |
| `accessToken` | `string`                  | Conditional | Required for facebook classic login (when idToken not provided). Optional for google. Max 2000 characters.            |
| `profileData` | `Record<string, unknown>` | No          | Optional profile data from native SDK (e.g., Apple first-time signin). Must be an object.                             |

## Example

### Google Sign-In (iOS/Android)

```json
{
  "provider": "google",
  "idToken": "eyJhbGciOiJSUzI1NiIs...",
  "accessToken": "ya29.a0AfH6SM..."
}
```

### Sign in with Apple (iOS)

```json
{
  "provider": "apple",
  "idToken": "eyJraWQiOiJlWGF1bm...",
  "profileData": {
    "name": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "email": "user@privaterelay.appleid.com"
  }
}
```

### Facebook Classic Login

```json
{
  "provider": "facebook",
  "accessToken": "EAABwzLixnjYBO..."
}
```

### Facebook Limited Login (iOS)

```json
{
  "provider": "facebook",
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

## Used By

- `POST /auth/social/:provider/verify` - HTTP endpoint for native mobile token verification
- `BaseSocialAuthProviderService.verifyToken()` - Internal provider method
