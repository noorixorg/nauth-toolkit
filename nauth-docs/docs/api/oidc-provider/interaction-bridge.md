---
title: OIDCInteractionBridge
description: "Interaction bridge reference: getState, completeLogin, completeConsent and abort, with the OIDC_LOGIN_REQUIRED / OIDC_INTERACTION_NOT_FOUND / access_denied outcomes each can produce"
keywords: [OIDCInteractionBridge, interaction, consent, session gate, getState, completeConsent, api]
image: /img/api-social-card.png
sidebar_position: 5
---

# OIDCInteractionBridge

**Package:** `@nauth-toolkit/oidc-provider`
**Type:** Service

Drives the login and consent steps of a pending authorization request from your own routes.

```typescript
import { OIDCInteractionBridge } from '@nauth-toolkit/oidc-provider';
```

## Overview

Call these from **ordinary routes in your application**, inside your guard chain, so the request context that identifies the current user is populated. Pass the framework request and response straight through — Express objects, Fastify request/reply, or `NAuthRequest.raw` / `NAuthResponse.raw` all work.

Every method answers with a `redirectTo` rather than issuing a 302, so a single-page app can drive the flow with `fetch` and navigate itself.

Every decision is also written to your audit trail as an `OIDC_*` [event](/docs/api/core/enums/auth-audit-event-type), with the relying party attached, unless `auditLogs.enabled` is `false`.

:::note
With NestJS, inject it with `@Inject(NAUTH_OIDC_BRIDGE)`. The [shipped controller](./interaction-controller) already does.
:::

## Constructing it yourself

Only needed outside NestJS, or when you register the bridge in your own module.

```typescript title="src/oidc.ts"
import { OIDCInteractionBridge } from '@nauth-toolkit/oidc-provider';
import { IdpSessionGate } from '@nauth-toolkit/core/internal';

const bridge = new OIDCInteractionBridge(
  provider,
  new IdpSessionGate(dataSource.getRepository(User), authConfig),
);
```

A third argument accepts an `AuthAuditService`; omit it and no audit events are written.

## Methods

### abort()

Abandon a pending interaction, so the relying party gets a clean `access_denied` instead of waiting on a browser tab the user closed.

```typescript
async abort(req: unknown, res: unknown): Promise<InteractionRedirectDTO>
```

**Parameters**

- `req` - The framework request
- `res` - The framework response

**Returns**

- [`InteractionRedirectDTO`](./interaction-redirect-dto)

**Errors**

| Code | When | Details |
| --- | --- | --- |
| `OIDC_INTERACTION_NOT_FOUND` | Expired or already resolved | `{ cause: string }` |

Throws [`NAuthException`](/docs/api/core/exceptions/nauth-exception) with the code listed above.

---

### completeConsent()

Record the user's consent decision. On approval this saves a `Grant` — the durable record of what this user let this client see — and resolves the interaction with its id.

```typescript
async completeConsent(
  req: unknown,
  res: unknown,
  decision: { approve: boolean; scopes?: string[] },
): Promise<InteractionRedirectDTO>
```

**Parameters**

- `req` - The framework request
- `res` - The framework response
- `decision.approve` - Whether the user approved
- `decision.scopes` - A narrowed scope set. Omit to grant every missing scope

**Returns**

- [`InteractionRedirectDTO`](./interaction-redirect-dto)

**Errors**

| Code | When | Details |
| --- | --- | --- |
| `OIDC_INTERACTION_NOT_FOUND` | Expired, or the grant is gone | `{ uid?: string, cause?: string }` |
| `OIDC_LOGIN_REQUIRED` | The session lapsed while the consent screen was open | `{ uid: string, reason: string }` |

Throws [`NAuthException`](/docs/api/core/exceptions/nauth-exception) with the codes listed above.

A `denied` account does **not** throw — the interaction resolves with `access_denied`, so the returned `redirectTo` carries a protocol error back to the relying party. `completeLogin()` behaves the same way.

---

### completeLogin()

Complete the login step for the currently authenticated user.

```typescript
async completeLogin(req: unknown, res: unknown): Promise<InteractionRedirectDTO>
```

The account is re-read from the database here, so a user disabled, locked, or newly required to change their password since their access token was issued cannot have an id_token minted for a third party.

**Parameters**

- `req` - The framework request
- `res` - The framework response

**Returns**

- [`InteractionRedirectDTO`](./interaction-redirect-dto)

**Errors**

| Code | When | Details |
| --- | --- | --- |
| `OIDC_INTERACTION_NOT_FOUND` | Expired or already resolved | `{ cause: string }` |
| `OIDC_LOGIN_REQUIRED` | No completed login behind the request | `{ uid: string, reason: string }` |

Throws [`NAuthException`](/docs/api/core/exceptions/nauth-exception) with the codes listed above.

`details.reason` is the session gate's verdict: `'no_session'`, `'password_change_required'` or `'email_verification_required'`.

---

### getState()

Describe a pending interaction so the frontend can decide what to render. Callable anonymously — the answer for a signed-out user is precisely what tells the frontend to send them to login.

```typescript
async getState(req: unknown, res: unknown): Promise<InteractionStateDTO>
```

**Parameters**

- `req` - The framework request
- `res` - The framework response

**Returns**

- [`InteractionStateDTO`](./interaction-state-dto)

**Errors**

| Code | When | Details |
| --- | --- | --- |
| `OIDC_INTERACTION_NOT_FOUND` | No such pending request | `{ cause: string }` |

Throws [`NAuthException`](/docs/api/core/exceptions/nauth-exception) with the codes listed above.

## Related APIs

- [createOIDCInteractionController](./interaction-controller) - The shipped NestJS routes
- [InteractionStateDTO](./interaction-state-dto) - What `getState()` returns
- [OIDCSessionTerminator](./session-terminator) - The logout side

## What's Next

- [Build the consent screen](/docs/guides/oauth-provider/consent-screen)
