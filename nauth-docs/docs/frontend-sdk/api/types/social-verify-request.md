---
title: SocialVerifyRequest
description: Request payload for verifying native social tokens (mobile apps)
sidebar_position: 260
keywords: [social, native, mobile, verify, request, dto, api]
image: /img/api-social-card.png
---

# SocialVerifyRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for verifying native social authentication tokens from mobile apps (Capacitor, React Native).

```typescript
import { SocialVerifyRequest } from '@nauth-toolkit/client';
```

## Properties

| Property            | Type             | Required | Description                                           |
| ------------------- | ---------------- | -------- | ----------------------------------------------------- |
| `provider`          | `SocialProvider` | Yes      | Social provider (`'google'`, `'apple'`, `'facebook'`) |
| `idToken`           | `string`         | No       | ID token from native OAuth (Google/Apple)             |
| `accessToken`       | `string`         | No       | Access token from native OAuth                        |
| `authorizationCode` | `string`         | No       | Authorization code (Apple Sign-In)                    |

## SocialProvider Type

`SocialProvider` is a type alias: `'google' | 'apple' | 'facebook'`

## Example

```json
{
  "provider": "google",
  "idToken": "eyJhbGciOiJSUzI1NiIs...",
  "accessToken": "ya29.a0AfH6SMC..."
}
```

## Used By

- [NAuthClient.verifyNativeSocial()](../nauth-client#verifynativesocial) - Accepts [`SocialVerifyRequest`](./social-verify-request)

## Related Types

- [`SocialAuthUrlRequest`](./social-auth-url-request) - Web OAuth URL request
- [`SocialCallbackRequest`](./social-callback-request) - Web OAuth callback
- [`AuthResponse`](./auth-response) - Authentication response
