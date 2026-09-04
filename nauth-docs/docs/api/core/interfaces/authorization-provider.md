---
title: IAuthorizationProvider
description: "IAuthorizationProvider contract with AuthorizationContext (actor, action, targetSub, request, viaApiKey), AuthorizationDecision, the AuthAction union, and runAsSystem()"
keywords: [authorization, provider, interface, admin, AuthAction, runAsSystem, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# IAuthorizationProvider

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Decides whether a privileged (admin) operation may proceed. Consulted by
[AdminAuthService](../services/admin-auth-service), [MFAService](../services/mfa-service),
[ApiKeyService](../services/api-key-service) and [AuthAuditService](../services/auth-audit-service)
before each admin method runs. See [Authorization](/docs/concepts/authorization) for how to write one.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import type { IAuthorizationProvider, AuthorizationContext, AuthorizationDecision, AuthAction } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import type { IAuthorizationProvider, AuthorizationContext, AuthorizationDecision, AuthAction } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import type { IAuthorizationProvider, AuthorizationContext, AuthorizationDecision, AuthAction } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `authorize(context)` | `Promise<AuthorizationDecision> \| AuthorizationDecision` | Decide whether `context.action` may proceed. Throwing is treated as a denial. |

## AuthorizationContext

Passed to `authorize()`.

| Property | Type | Description |
| --- | --- | --- |
| `action` | [`AuthAction`](#authaction) | The operation being attempted |
| `actor` | [`IUser`](./user) `\| undefined` | The authenticated caller. Undefined outside a request; such calls are denied unless wrapped in [`runAsSystem()`](#runassystem) |
| `request` | [`NAuthRequest`](./nauth-request) `\| undefined` | The active request, when one exists |
| `targetSub` | `string \| undefined` | `sub` of the user being acted upon. Absent for non-targeted actions such as `admin.user.list` |
| `viaApiKey` | `boolean \| undefined` | True when the caller authenticated with an API key rather than a session |

## AuthorizationDecision

Returned from `authorize()`.

| Property | Type | Description |
| --- | --- | --- |
| `allow` | `boolean` | Whether the action may proceed |
| `reason` | `string \| undefined` | Surfaced as the `FORBIDDEN` message and stored on the [`AUTHORIZATION_DENIED`](../enums/auth-audit-event-type) audit record |

## AuthAction

A closed union of 26 string literals naming each privileged operation independently of any
route: `admin.user.*`, `admin.session.*`, `admin.mfa.*`, `admin.apiKey.*`, `admin.audit.*`.
The full list, with the service method that enforces each one, is in
[Authorization > Actions](/docs/concepts/authorization#actions).

## runAsSystem()

```typescript
import { runAsSystem } from '@nauth-toolkit/core';

await runAsSystem(async () => {
  // provider is not consulted in here
});
```

Runs the callback with authorization bypassed. For seeds, migrations, scheduled jobs and tests —
code with no authenticated caller. Never call it on a request path.

## Configuration

| Platform | Where |
| --- | --- |
| NestJS | `AuthModule.forRoot({ authorization: YourProviderClass })` — a class, registered as a NestJS provider |
| Express / Fastify | `NAuth.create({ authorization: new YourProvider() })` — an instance |

See [Configuration > Authorization](/docs/concepts/configuration#authorization).

## Related APIs

- [Authorization](/docs/concepts/authorization) - Writing and registering a provider
- [AdminAuthService](../services/admin-auth-service) - User, password and session admin methods
- [MFAService](../services/mfa-service) - Admin MFA methods
- [Route Groups](../routes/groups#admin) - The `admin` group that requires a provider
