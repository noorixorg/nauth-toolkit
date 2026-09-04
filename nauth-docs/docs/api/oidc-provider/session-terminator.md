---
title: OIDCSessionTerminator
description: "Single-logout reference: terminateFor ends OIDC sessions and grants for a user, terminateAndRevokeFor also revokes access tokens, refresh tokens and authorization codes"
keywords: [OIDCSessionTerminator, single logout, terminateFor, terminateAndRevokeFor, sessions, grants, api]
image: /img/api-social-card.png
sidebar_position: 7
---

# OIDCSessionTerminator

**Package:** `@nauth-toolkit/oidc-provider`
**Type:** Service

Ends a user's OpenID Connect sessions and grants.

```typescript
import { OIDCSessionTerminator } from '@nauth-toolkit/oidc-provider';
```

## Overview

The provider keeps its own SSO session, entirely separate from nauth-toolkit's. Without this, logging out of the application leaves that session standing, and the next authorization request from any client silently issues a fresh code for a user who believes they signed out.

Sessions and grants are found through the per-account marker keys the storage adapter writes, so this needs no extra index and no table.

:::note
With NestJS, inject it with `@Inject(NAUTH_OIDC_SESSIONS)`. Elsewhere, construct it with the storage adapter: `new OIDCSessionTerminator(nauth.storage)`.
:::

## Methods

### terminateAndRevokeFor()

End every session and grant, and revoke outstanding tokens too. The stronger form, for when an account is disabled or compromised: a suspended user's third-party integrations must stop working immediately, not at the next token expiry.

```typescript
async terminateAndRevokeFor(sub: string): Promise<{
  sessions: number;
  grants: number;
  accessTokens: number;
  refreshTokens: number;
  authorizationCodes: number;
}>
```

**Parameters**

- `sub` - The user's external identifier

**Returns**

- How many artifacts of each kind were destroyed

**Example**

```typescript title="src/admin/admin.controller.ts"
await this.adminAuthService.disableUser({ sub });
await this.oidcSessions.terminateAndRevokeFor(sub);
```

---

### terminateFor()

End every OpenID Connect session and grant belonging to a user.

```typescript
async terminateFor(sub: string): Promise<{ sessions: number; grants: number }>
```

Destroying the sessions is what makes the provider's `_session` cookie stop resolving; destroying the grants means the next authorization request asks for consent again rather than reusing a remembered one.

Tokens already issued to clients are deliberately **not** revoked — a third party holding a valid access token should not lose it because the user closed a browser tab.

**Parameters**

- `sub` - The user's external identifier

**Returns**

- How many sessions and grants were destroyed

**Example**

```typescript title="src/auth/auth.controller.ts"
await this.authService.logout();
await this.oidcSessions.terminateFor(user.sub);
```

## Related APIs

- [OIDCInteractionBridge](./interaction-bridge) - The login side
- [AdminAuthService](/docs/api/core/services/admin-auth-service) - Disabling accounts

## What's Next

- [Single logout](/docs/guides/oauth-provider/single-logout)
