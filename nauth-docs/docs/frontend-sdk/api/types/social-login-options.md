---
title: SocialLoginOptions
description: Options for starting the redirect-first web social login flow
sidebar_position: 240
keywords: [social, oauth, web, redirect, options, api]
image: /img/api-social-card.png
---

# SocialLoginOptions

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Options for starting the redirect-first web social login flow via [`NAuthClient.loginWithSocial()`](../nauth-client#loginwithsocial).

## Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `returnTo` | `string` | No | Frontend route or URL to return to after backend finishes OAuth. Default: `config.redirects.success` or `'/'`. |
| `appState` | `string` | No | Opaque, non-secret state to round-trip back to the frontend (URL-encoded). |
| `action` | `'login' \| 'link'` | No | Flow action. Default: `'login'`. |

## Example

```json
{
  "returnTo": "/auth/callback",
  "appState": "12345",
  "action": "login"
}
```

## Used By

- [`NAuthClient.loginWithSocial()`](../nauth-client#loginwithsocial)


