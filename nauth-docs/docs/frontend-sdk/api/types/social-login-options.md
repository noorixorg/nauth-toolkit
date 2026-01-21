---
title: SocialLoginOptions
description: Options for starting the redirect-first web social login flow
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
| `returnTo` | `string` | No | Frontend route or URL to return to after backend finishes OAuth. Default: `config.redirects.loginSuccess` (or legacy `config.redirects.success`) or `'/'`. |
| `appState` | `string` | No | Opaque, non-secret state to round-trip back to the frontend (URL-encoded). |
| `action` | `'login' \| 'link'` | No | Flow action. Default: `'login'`. |
| `oauthParams` | `Record<string, string>` | No | Additional OAuth parameters to pass to the provider. Overrides config defaults. Used for provider-specific customization (e.g., Google's `prompt`, Facebook's `auth_type`). |

## OAuth Parameters

The `oauthParams` property allows per-request customization of the OAuth flow. These parameters override any defaults set in the backend configuration and are appended directly to the provider's authorization URL.

### Common Use Cases by Provider

**Google:**
- `prompt`: `'select_account'` (force account chooser), `'consent'` (force consent screen), `'none'` (silent auth)
- `hd`: Restrict to Google Workspace domain (e.g., `'company.com'`)
- `login_hint`: Pre-fill email address
- `include_granted_scopes`: `'true'` for incremental authorization

**Facebook:**
- `auth_type`: `'reauthenticate'` (force re-authentication), `'rerequest'` (rerequest declined permissions)
- `display`: `'page'`, `'popup'`, `'touch'` (customize UI mode)
- `auth_nonce`: For replay attack prevention

**Apple:**
- `nonce`: For ID token validation
- Any other Apple-supported parameters

## Examples

### Basic Social Login

```json
{
  "returnTo": "/auth/callback",
  "appState": "12345",
  "action": "login"
}
```

### Force Google Account Chooser

```json
{
  "returnTo": "/dashboard",
  "oauthParams": {
    "prompt": "select_account"
  }
}
```

### Multiple OAuth Parameters

```json
{
  "returnTo": "/dashboard",
  "oauthParams": {
    "prompt": "select_account consent",
    "hd": "company.com",
    "login_hint": "user@company.com"
  }
}
```

### Facebook Rerequest Permissions

```json
{
  "returnTo": "/settings",
  "oauthParams": {
    "auth_type": "rerequest",
    "display": "popup"
  }
}
```

## Used By

- [`NAuthClient.loginWithSocial()`](../nauth-client#loginwithsocial)


