---
title: SocialCallbackRequest
description: Request payload for handling OAuth callback
sidebar_position: 250
keywords: [social, oauth, callback, request, dto, api]
image: /img/api-social-card.png
---

# SocialCallbackRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for handling OAuth callback from social authentication providers.

```typescript
import { SocialCallbackRequest } from '@nauth-toolkit/client';
```

## Properties

| Property   | Type             | Required | Description                                           |
| ---------- | ---------------- | -------- | ----------------------------------------------------- |
| `provider` | `SocialProvider` | Yes      | Social provider (`'google'`, `'apple'`, `'facebook'`) |
| `code`     | `string`         | Yes      | OAuth authorization code from callback                |
| `state`    | `string`         | Yes      | OAuth state parameter (must match request)            |

## SocialProvider Type

`SocialProvider` is a type alias: `'google' | 'apple' | 'facebook'`

## Example

```json
{
  "provider": "google",
  "code": "4/0AeaYSH...",
  "state": "random-state-string"
}
```

## Used By

- [NAuthClient.handleSocialCallback()](../nauth-client#handlesocialcallback) - Accepts [`SocialCallbackRequest`](./social-callback-request)

## Related Types

- [`SocialAuthUrlRequest`](./social-auth-url-request) - OAuth URL request
- [`SocialVerifyRequest`](./social-verify-request) - Native social verification
- [`LinkedAccountsResponse`](./linked-accounts-response) - Linked accounts response
