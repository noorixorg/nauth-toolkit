---
title: InteractionStateDTO
description: "What a pending OIDC authorization request needs: uid, prompt, client metadata, requested and missing scopes, the session gate verdict, and the signed-in user's sub"
keywords: [InteractionStateDTO, interaction, consent, scopes, session gate, dto]
image: /img/api-social-card.png
sidebar_position: 9
---

# InteractionStateDTO

**Package:** `@nauth-toolkit/oidc-provider`
**Type:** DTO (Response)

What the consent screen needs in order to ask the user.

```typescript
import type { InteractionStateDTO } from '@nauth-toolkit/oidc-provider';
```

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `client` | `{ clientId: string; clientName?: string; logoUri?: string; clientUri?: string }` | The client making the request, as the user should see it |
| `gate` | `'authenticated' \| 'login_required' \| 'denied'` | nauth-toolkit's verdict on the current session |
| `gateReason` | `string` | Why, when the gate is not `authenticated`. Absent otherwise |
| `missingScopes` | `string[]` | Scopes still needing consent — the rest are already granted |
| `prompt` | `'login' \| 'consent' \| string` | What the provider is asking for |
| `scopes` | `string[]` | Scopes the client asked for |
| `sub` | `string` | External identifier of the signed-in user, when there is one |
| `uid` | `string` | The pending interaction id |

`gateReason` is `'no_session'`, `'password_change_required'` or `'email_verification_required'` for a `login_required` gate, and `'account_disabled'`, `'account_locked'` or `'account_unavailable'` for a `denied` one.

## Example

```json
{
  "uid": "kPz3Q8sLm2",
  "prompt": "consent",
  "client": {
    "clientId": "partner",
    "clientName": "Partner App",
    "clientUri": "https://myapp.com"
  },
  "scopes": ["openid", "email", "profile"],
  "missingScopes": ["email", "profile"],
  "gate": "authenticated",
  "sub": "6f1c0f8e-8b1a-4a2e-9d4c-3f1e2a7b5c90"
}
```

## Used By

- [OIDCInteractionBridge.getState()](./interaction-bridge#getstate)
- [createOIDCInteractionController](./interaction-controller)

The frontend SDK exposes the same shape as [`OIDCInteractionState`](/docs/frontend-sdk/api/types/oidc-interaction-state).

## What's Next

- [Build the consent screen](/docs/guides/oauth-provider/consent-screen)
