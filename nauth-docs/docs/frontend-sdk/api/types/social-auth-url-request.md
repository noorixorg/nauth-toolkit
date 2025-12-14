---
title: SocialAuthUrlRequest
description: Request payload for obtaining OAuth redirect URL
sidebar_position: 240
keywords: [social, oauth, request, dto, api]
image: /img/api-social-card.png
---

# SocialAuthUrlRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for obtaining OAuth redirect URL from social authentication providers.

```typescript
import { SocialAuthUrlRequest } from '@nauth-toolkit/client';
```

## Properties

| Property   | Type             | Required | Description                                           |
| ---------- | ---------------- | -------- | ----------------------------------------------------- |
| `provider` | `SocialProvider` | Yes      | Social provider (`'google'`, `'apple'`, `'facebook'`) |
| `state`    | `string`         | No       | OAuth state parameter (for CSRF protection)           |

## SocialProvider Type

`SocialProvider` is a type alias: `'google' | 'apple' | 'facebook'`

## Example

```json
{
  "provider": "google",
  "state": "random-state-string"
}
```

## Used By

- [NAuthClient.getSocialAuthUrl()](../nauth-client#getsocialauthurl) - Accepts [`SocialAuthUrlRequest`](./social-auth-url-request)

## Related Types

- [`SocialCallbackRequest`](./social-callback-request) - OAuth callback request
- [`LinkedAccountsResponse`](./linked-accounts-response) - Linked accounts response
