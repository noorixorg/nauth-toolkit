---
title: OIDCInteractionRedirect
description: "The absolute URL to navigate to after an OIDC interaction decision — returned by completeLogin, approve, deny and abort"
keywords: [OIDCInteractionRedirect, redirectTo, oidc, interaction, type]
image: /img/api-social-card.png
---

# OIDCInteractionRedirect

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Where to send the browser after a decision.

```typescript
import type { OIDCInteractionRedirect } from '@nauth-toolkit/client';
```

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `redirectTo` | `string` | Absolute URL to navigate to |

:::warning[Leave the app entirely]
Use `window.location.assign(redirectTo)`, never a router navigation. The browser is leaving your single-page app: the provider resumes the authorization request and redirects on to the client from there.
:::

## Example

```json
{
  "redirectTo": "https://auth.example.com/oidc/auth/kPz3Q8sLm2"
}
```

## Used By

- [OIDCOperations.abort()](../oidc-operations#abort)
- [OIDCOperations.approve()](../oidc-operations#approve)
- [OIDCOperations.completeLogin()](../oidc-operations#completelogin)
- [OIDCOperations.deny()](../oidc-operations#deny)

## What's Next

- [Build the consent screen](/docs/guides/oauth-provider/consent-screen)
