---
title: "Single Logout"
description: "End OIDC sessions and grants on logout with OIDCSessionTerminator.terminateFor and terminateAndRevokeFor, plus RP-initiated logout at /oidc/session/end and post_logout_redirect_uris"
sidebar_position: 4
keywords: [single logout, rp-initiated logout, end session, oidc session, grants, revoke tokens]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Single Logout

The provider keeps its **own** SSO session, entirely separate from nauth-toolkit's. Logging out of your application does not end it.

Without wiring this up, a user who signs out leaves that session standing, and the next authorization request from any client silently issues a fresh authorization code for someone who believes they signed out.

## Ending the provider's session

Inject `NAUTH_OIDC_SESSIONS` and call it from your logout route, alongside your existing `authService.logout()`.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/auth.controller.ts"
import { Controller, Get, Inject, Logger, Query } from '@nestjs/common';
import { AuthService, CurrentUser, LogoutDTO, type LogoutResponseDTO } from '@nauth-toolkit/nestjs';
import { NAUTH_OIDC_SESSIONS, type OIDCSessionTerminator } from '@nauth-toolkit/oidc-provider/nestjs';

@Controller('auth')
export class CustomAuthController {
  private readonly logger = new Logger(CustomAuthController.name);

  constructor(
    private readonly authService: AuthService,
    @Inject(NAUTH_OIDC_SESSIONS) private readonly oidcSessions: OIDCSessionTerminator,
  ) {}

  @Get('logout')
  async logout(
    @Query() dto: LogoutDTO,
    @CurrentUser() user?: { sub: string },
  ): Promise<LogoutResponseDTO> {
    if (user?.sub) {
      try {
        await this.oidcSessions.terminateFor(user.sub);
      } catch (error) {
        // Never let this fail the logout itself.
        this.logger.warn(`Failed to end OIDC sessions: ${(error as Error).message}`);
      }
    }

    return this.authService.logout(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/auth.routes.ts"
import { OIDCSessionTerminator } from '@nauth-toolkit/oidc-provider';

const oidcSessions = new OIDCSessionTerminator(nauth.storage);

// Inside your logout handler:
await oidcSessions.terminateFor(user.sub);
await nauth.authService.logout({ forgetMe: false });
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/routes/auth.routes.ts"
import { OIDCSessionTerminator } from '@nauth-toolkit/oidc-provider';

const oidcSessions = new OIDCSessionTerminator(nauth.storage);

// Inside your logout handler:
await oidcSessions.terminateFor(user.sub);
await nauth.authService.logout({ forgetMe: false });
```

</TabItem>
</Tabs>

`terminateFor(sub)` returns `{ sessions, grants }` — how many of each were destroyed.

Destroying the **sessions** is what makes the provider's `_session` cookie stop resolving. Destroying the **grants** means the next authorization request asks for consent again rather than silently reusing a remembered one.

:::note[Issued tokens are deliberately left alone]
A third party holding a valid access token should not lose it because the user closed a browser tab. Those have their own lifecycle: they expire, or a client revokes them at `/oidc/token/revocation`.
:::

## Disabling or compromising an account

When an account is suspended, its third-party integrations must stop working immediately — not at the next token expiry. Use the stronger form:

```typescript title="src/admin/admin.controller.ts"
const result = await oidcSessions.terminateAndRevokeFor(sub);
// { sessions, grants, accessTokens, refreshTokens, authorizationCodes }
```

Call it from your admin "disable user" path, alongside [`AdminAuthService.disableUser()`](/docs/api/core/services/admin-auth-service).

## RP-initiated logout

A client can also start logout itself, at the `end_session` endpoint advertised in your discovery document (`/oidc/session/end` with the default `pathPrefix`). Register where the user may be sent afterwards:

```typescript title="src/config/oidc.config.ts"
{
  client_id: 'partner',
  redirect_uris: ['https://myapp.com/callback'],
  post_logout_redirect_uris: ['https://myapp.com'],
  // ...
}
```

The client then sends the user to `/oidc/session/end?id_token_hint=…&post_logout_redirect_uri=https://myapp.com`.

:::warning[The default logout screens come from `oidc-provider`]
`rpInitiatedLogout` is enabled by default and renders its own confirmation and post-logout pages. Both are generic defaults, and `oidc-provider` logs a notice asking you to replace them. Do that through `extraConfiguration`:

```typescript title="src/config/oidc.config.ts"
extraConfiguration: {
  features: {
    rpInitiatedLogout: {
      enabled: true,
      logoutSource: async (ctx, form) => { /* your confirmation page */ },
      postLogoutSuccessSource: async (ctx) => { /* your goodbye page */ },
    },
  },
},
```

Ending the provider's session this way does **not** end the nauth-toolkit session — that is your logout route's job. Wire both, or a user who logs out through a client is still signed in to your own application.
:::

## Checkpoint

Sign in through a client, then log out of your application. Start a fresh authorization request from the same client. You should be sent to your login page, not handed a code.

## What's Next

- [Build the consent screen](/docs/guides/oauth-provider/consent-screen) — the other half of the session story
- [`OIDCSessionTerminator`](/docs/api/oidc-provider/session-terminator) — the full API reference
- [Token Management](/docs/concepts/token-management) — how nauth-toolkit's own sessions work
