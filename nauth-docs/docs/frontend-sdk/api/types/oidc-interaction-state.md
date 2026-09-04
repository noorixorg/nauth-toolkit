---
title: OIDCInteractionState
description: "What a pending OIDC authorization request needs: uid, prompt, client metadata, requested and missing scopes, gate verdict and sub"
keywords: [OIDCInteractionState, oidc, consent screen, scopes, interaction, type]
image: /img/api-social-card.png
---

# OIDCInteractionState

**Package:** `@nauth-toolkit/client`
**Type:** Interface

What the consent screen needs in order to ask the user. Returned by [`client.oidc.getInteraction()`](../oidc-operations#getinteraction).

```typescript
import type { OIDCInteractionState } from '@nauth-toolkit/client';
```

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `client` | [`OIDCInteractionClient`](#oidcinteractionclient) | The client making the request, as the user should see it |
| `gate` | [`OIDCGateStatus`](./oidc-gate-status) | The session verdict |
| `gateReason` | `string` | Why, when the gate is not `authenticated` |
| `missingScopes` | `string[]` | Scopes still needing consent — the rest are already granted |
| `prompt` | `'login' \| 'consent' \| string` | What the provider is asking for |
| `scopes` | `string[]` | Scopes the client asked for |
| `sub` | `string` | External identifier of the signed-in user, when there is one |
| `uid` | `string` | The pending interaction id |

Render `missingScopes` rather than `scopes` when it is non-empty — it is the shorter list a returning user should be asked about.

`gateReason` is `'no_session'`, `'password_change_required'` or `'email_verification_required'` for a `login_required` gate, and `'account_disabled'`, `'account_locked'` or `'account_unavailable'` for a `denied` one.

### OIDCInteractionClient

| Property | Type | Description |
| --- | --- | --- |
| `clientId` | `string` | Public client identifier |
| `clientName` | `string` | Human-readable name. Fall back to `clientId` |
| `clientUri` | `string` | The client's home page |
| `logoUri` | `string` | Logo to show on the consent screen |

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

- [OIDCOperations.getInteraction()](../oidc-operations#getinteraction)

## What's Next

- [Build the consent screen](/docs/guides/oauth-provider/consent-screen)
