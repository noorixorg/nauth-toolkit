---
title: OIDCOperations
description: "client.oidc reference: getInteraction, completeLogin, approve, deny, abort, the pending-interaction stash (set/get/clear/take), interactionRoute, and the oidc.basePath / oidc.interactionPath config"
keywords: [OIDCOperations, client.oidc, consent screen, interaction, openid connect, frontend sdk]
image: /img/api-social-card.png
---

# OIDCOperations

**Package:** `@nauth-toolkit/client`
**Type:** Operations namespace

Drives the consent screen of an application that **is** an OpenID Connect provider — one whose backend runs [`@nauth-toolkit/oidc-provider`](/docs/api/oidc-provider/overview). A relying party signing in with someone else's provider needs none of this; use an OIDC client library.

```typescript
import { NAuthClient } from '@nauth-toolkit/client';

const client = new NAuthClient({ baseUrl: 'https://api.example.com', tokenDelivery: 'cookies' });
await client.oidc.getInteraction(uid);
```

With Angular, reach it through `AuthService`:

```typescript
const state = await this.auth.oidc.getInteraction(uid);
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `oidc.basePath` | `string` | `{baseUrl}/oidc/interaction` | Where the backend mounted the interaction routes. Must match `interaction.path` in `OIDCProviderModule.forRoot()`, plus any global prefix |
| `oidc.interactionPath` | `string` | `/interaction` | The in-app route that renders the consent screen. The interaction id is appended to it |

```typescript title="src/app/app.config.ts"
const config: NAuthClientConfig = {
  baseUrl: 'https://api.example.com',
  tokenDelivery: 'cookies',
  oidc: { basePath: 'https://api.example.com/oidc/interaction', interactionPath: '/interaction' },
};
```

## Methods

### abort()

Abandon a pending interaction, so the client gets a clean protocol error rather than waiting on a browser tab that is never coming back.

```typescript
async abort(uid: string): Promise<OIDCInteractionRedirect>
```

**Returns** [`OIDCInteractionRedirect`](./types/oidc-interaction-redirect)

---

### approve()

Grant the client what it asked for.

```typescript
async approve(uid: string, scopes?: string[]): Promise<OIDCInteractionRedirect>
```

**Parameters**

- `uid` - The pending interaction id
- `scopes` - A narrowed set of scopes to grant. Omit to grant everything asked for

**Returns** [`OIDCInteractionRedirect`](./types/oidc-interaction-redirect)

---

### clearPendingInteraction()

Forget the pending interaction. Call it once you have acted on it.

```typescript
async clearPendingInteraction(): Promise<void>
```

---

### completeLogin()

Complete the login step for the currently authenticated user. Used when `getInteraction()` reports `prompt === 'login'` and the gate is `authenticated`: nothing needs showing, the interaction just needs resolving.

```typescript
async completeLogin(uid: string): Promise<OIDCInteractionRedirect>
```

**Returns** [`OIDCInteractionRedirect`](./types/oidc-interaction-redirect)

---

### deny()

Refuse the request. The client is told `access_denied`.

```typescript
async deny(uid: string): Promise<OIDCInteractionRedirect>
```

**Returns** [`OIDCInteractionRedirect`](./types/oidc-interaction-redirect)

---

### getInteraction()

Read a pending interaction, so the page can decide what to render. Answers for a signed-out caller too — a `login_required` gate is precisely the signal to send the user through login.

```typescript
async getInteraction(uid: string): Promise<OIDCInteractionState>
```

**Returns** [`OIDCInteractionState`](./types/oidc-interaction-state)

---

### getPendingInteraction()

The interaction waiting to be resumed, if any.

```typescript
async getPendingInteraction(): Promise<string | null>
```

---

### interactionRoute()

The in-app route that renders the consent screen for a given interaction — `oidc.interactionPath` with the id appended, e.g. `/interaction/kPz3Q8sLm2`. Use it wherever you navigate to the consent screen, so a route guard, a navigation handler and a component all agree.

```typescript
interactionRoute(uid: string): string
```

---

### setPendingInteraction()

Remember an interaction to return to once the user has finished logging in.

```typescript
async setPendingInteraction(uid: string): Promise<void>
```

Stored in session-scoped storage rather than a query parameter, because the login that follows may run several challenge steps — forced password change, email or phone verification, MFA setup — each with its own URL. A query parameter does not survive that; this does. Bring the user back with [`oidcReturnGuard`](../angular/guards#oidcreturnguard) or a `navigationHandler`.

---

### takePendingInteraction()

Read the pending interaction and forget it in one step — what a navigation handler or route guard wants, so a later visit to the same route is not diverted a second time.

```typescript
async takePendingInteraction(): Promise<string | null>
```

## Errors

Every method rejects with an [`NAuthClientError`](./nauth-client-error).

| Code | Status | When |
| --- | --- | --- |
| `OIDC_INTERACTION_NOT_FOUND` | 404 | The request expired or was already resolved |
| `OIDC_LOGIN_REQUIRED` | 401 | Recoverable — `details.uid` says what to resume |

A refused account does not reject: the call resolves with a `redirectTo` that carries `access_denied` back to the relying party.

## Example

```typescript
const state = await client.oidc.getInteraction(uid);

if (state.gate === 'login_required') {
  await client.oidc.setPendingInteraction(uid);
  router.navigate(['/login']);
} else if (state.prompt === 'login') {
  window.location.assign((await client.oidc.completeLogin(uid)).redirectTo);
} else {
  window.location.assign((await client.oidc.approve(uid)).redirectTo);
}
```

## Related APIs

- [NAuthClient](./nauth-client) - Where `oidc` lives
- [Angular Guards](../angular/guards#oidcreturnguard) - `oidcReturnGuard()`, the return path after login
- [OIDCInteractionBridge](/docs/api/oidc-provider/interaction-bridge) - What these routes call on the backend

## What's Next

- [Build the consent screen](/docs/guides/oauth-provider/consent-screen) - The full walkthrough
- [How the provider works](/docs/guides/oauth-provider/how-oauth-provider-works)
