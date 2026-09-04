---
title: OIDCGateStatus
description: "The session verdict on an OIDC interaction: authenticated, login_required (recoverable) or denied"
keywords: [OIDCGateStatus, oidc, interaction, session gate, type]
image: /img/api-social-card.png
---

# OIDCGateStatus

**Package:** `@nauth-toolkit/client`
**Type:** Union type

nauth-toolkit's verdict on the session behind an OpenID Connect interaction request.

```typescript
type OIDCGateStatus = 'authenticated' | 'login_required' | 'denied';
```

## Values

| Value | Meaning | What to do |
| --- | --- | --- |
| `authenticated` | A completed login stands behind the request | Continue to consent, or complete the login step |
| `denied` | The account may not be issued credentials at all | Abort the interaction so the client is told |
| `login_required` | Recoverable — no session, a forced password change, or an unverified email | Stash the interaction id, send the user through login, return |

## Used By

- [OIDCInteractionState](./oidc-interaction-state)

## What's Next

- [Build the consent screen](/docs/guides/oauth-provider/consent-screen)
