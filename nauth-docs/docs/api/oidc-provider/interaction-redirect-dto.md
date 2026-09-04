---
title: InteractionRedirectDTO
description: "The absolute URL to navigate to after an OIDC interaction decision, returned by completeLogin, completeConsent and abort instead of a 302"
keywords: [InteractionRedirectDTO, redirectTo, interaction, consent, dto]
image: /img/api-social-card.png
sidebar_position: 10
---

# InteractionRedirectDTO

**Package:** `@nauth-toolkit/oidc-provider`
**Type:** DTO (Response)

Where to send the browser after a decision.

```typescript
import type { InteractionRedirectDTO } from '@nauth-toolkit/oidc-provider';
```

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `redirectTo` | `string` | Absolute URL to navigate to |

:::note[Why JSON and not a 302]
Returning the URL rather than redirecting lets a single-page app drive the whole flow with `fetch`. Navigate with `window.location.assign(redirectTo)` — never a router navigation, because the browser is leaving your app: the provider resumes the authorization request and redirects on to the client from there.
:::

## Example

```json
{
  "redirectTo": "https://auth.example.com/oidc/auth/kPz3Q8sLm2"
}
```

## Used By

- [OIDCInteractionBridge.abort()](./interaction-bridge#abort)
- [OIDCInteractionBridge.completeConsent()](./interaction-bridge#completeconsent)
- [OIDCInteractionBridge.completeLogin()](./interaction-bridge#completelogin)

The frontend SDK exposes the same shape as [`OIDCInteractionRedirect`](/docs/frontend-sdk/api/types/oidc-interaction-redirect).

## What's Next

- [Build the consent screen](/docs/guides/oauth-provider/consent-screen)
