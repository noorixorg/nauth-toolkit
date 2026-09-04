---
title: Authorization
description: "When the ready-made admin routes need an IAuthorizationProvider, when they do not, and how to answer from your existing roles or permissions"
keywords: [authorization, admin, roles, permissions, rbac, access control, provider]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Authorization

nauth-toolkit handles **authentication** — proving who the caller is. Deciding what they may do
is your app's job, and you almost certainly already do it: a `role` column, a permissions table,
CASL, a policy service. Nothing on this page replaces that.

This page is only about one thing: the ready-made
[**admin routes**](/docs/api/core/routes/groups#admin). They need to know who is allowed to use
them, and nauth-toolkit has no way to know that on its own.

## Do you need to do anything?

| You want to… | Then… |
| --- | --- |
| **Mount the ready-made admin routes** ([`groups: ['admin']`](/docs/api/core/routes/groups#admin)) | Yes — give nauth-toolkit a small [*provider*](/docs/api/core/interfaces/authorization-provider) that answers "may this user do this?" from whatever your app already has. Usually 15–20 lines. |
| **Write your own admin controllers** and call [`AdminAuthService`](/docs/api/core/services/admin-auth-service) / [`MFAService`](/docs/api/core/services/mfa-service) from them | No. Guard them the way you guard everything else. No provider, nothing to configure. |

The provider is not a second permission system. It is a bridge: nauth-toolkit asks a question,
your existing roles or permissions answer it. If the bridge ever feels like more work than it is
worth, write your own controllers instead — that is a fully supported path, shown in
[Admin Operations](/docs/guides/admin-operations#option-b-write-the-routes-yourself).

:::note[If you do configure a provider, it applies everywhere]
The check runs inside the services, so it also covers controllers you write and scripts. With
your own guards in front, that is simply a second check — harmless, but worth knowing.
:::

## Writing the provider

One class implementing [`IAuthorizationProvider`](/docs/api/core/interfaces/authorization-provider),
one method. nauth-toolkit calls it with the signed-in user and an
[`action`](#actions) such as `'admin.user.delete'`; you return `{ allow: true }` or
`{ allow: false, reason }`. The reason is what the caller sees in the
[`FORBIDDEN`](/docs/api/core/enums/auth-error-code) `403`, and it goes into the
[audit log](/docs/concepts/audit-logs).

Pick whichever matches what your app already has. Each example injects one of **your** services —
swap in the real name.

### If your app has roles

Any user with the admin role may use all admin routes:

```typescript title="src/auth/role.authorizer.ts"
import { Injectable } from '@nestjs/common';
import type {
  AuthorizationContext,
  AuthorizationDecision,
  IAuthorizationProvider,
} from '@nauth-toolkit/nestjs';
import { UsersService } from '../users/users.service';

@Injectable()
export class RoleAuthorizer implements IAuthorizationProvider {
  constructor(private readonly users: UsersService) {}

  async authorize({ actor }: AuthorizationContext): Promise<AuthorizationDecision> {
    if (!actor) return { allow: false, reason: 'Authentication required' };

    const role = await this.users.getRole(actor.sub);
    return role === 'admin'
      ? { allow: true }
      : { allow: false, reason: 'Requires the admin role' };
  }
}
```

### If your app has permissions

Map each [action](#actions) to one of your permissions. Anything not in the map is refused, so a
support role holding `users:create` and `users:reset-password` gets a `403` on every MFA route
and on delete — no extra code:

```typescript title="src/auth/role.authorizer.ts"
import { Injectable } from '@nestjs/common';
import type {
  AuthAction,
  AuthorizationContext,
  AuthorizationDecision,
  IAuthorizationProvider,
} from '@nauth-toolkit/nestjs';
import { PermissionsService } from '../permissions/permissions.service';

const REQUIRED: Partial<Record<AuthAction, string>> = {
  'admin.user.create': 'users:create',
  'admin.user.read': 'users:read',
  'admin.user.list': 'users:read',
  'admin.user.resetPassword': 'users:reset-password',
  'admin.user.delete': 'users:delete',
  'admin.mfa.removeDevice': 'mfa:manage',
  // add the rest as you need them — full list under Reference > Actions below
};

@Injectable()
export class RoleAuthorizer implements IAuthorizationProvider {
  constructor(private readonly permissions: PermissionsService) {}

  async authorize({ actor, action }: AuthorizationContext): Promise<AuthorizationDecision> {
    if (!actor) return { allow: false, reason: 'Authentication required' };

    const needed = REQUIRED[action];
    if (!needed) return { allow: false, reason: `${action} is not enabled` };

    // Using CASL, accesscontrol or similar? Ask your ability here instead,
    // e.g. ability.can('delete', 'User') for 'admin.user.delete'.
    const ok = await this.permissions.has(actor.sub, needed);
    return ok ? { allow: true } : { allow: false, reason: `Requires ${needed}` };
  }
}
```

Two things to know while writing it:

- Look the user up by [**`actor.sub`**](/docs/api/core/interfaces/user). `actor` carries only
  nauth-toolkit's own [`IUser`](/docs/api/core/interfaces/user) fields — a column you added to
  your user entity will not be on it.
- **Do not read the role from [`user.metadata`](/docs/api/core/interfaces/user).** Users can
  write their own `metadata` through [`POST /auth/signup`](/docs/api/core/routes/overview) and
  [`PUT /auth/profile`](/docs/api/core/routes/overview), so anyone could make themselves an admin.

## Registering it

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/auth.module.ts"
AuthModule.forRoot({ ...authConfig, authorization: RoleAuthorizer })
```

Pass the class to [`AuthModule.forRoot()`](/docs/api/nestjs/overview) — it becomes a normal
NestJS provider, so it can inject your services.

</TabItem>
<TabItem value="express" label="Express">

Same class without `@Injectable()`, importing the types from `@nauth-toolkit/core`:

```typescript title="src/index.ts"
const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(),
  authorization: new RoleAuthorizer(usersService),
});
```

Pass an instance to [`NAuth.create()`](/docs/api/express/overview#usage).

</TabItem>
<TabItem value="fastify" label="Fastify">

Same class without `@Injectable()`, importing the types from `@nauth-toolkit/core`:

```typescript title="src/index.ts"
const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new FastifyAdapter(),
  authorization: new RoleAuthorizer(usersService),
});
```

Pass an instance to [`NAuth.create()`](/docs/api/fastify/overview#usage).

</TabItem>
</Tabs>

That is it — mount the admin routes and they are protected. See
[Admin Operations](/docs/guides/admin-operations#option-a-mount-the-shipped-routes) for
mounting, and [Configuration > Authorization](/docs/concepts/configuration#authorization) for
the option itself.

## Your first admin

If nobody has the admin role yet, no admin route can grant it. Do it once from a seed script.
[`runAsSystem()`](/docs/api/core/interfaces/authorization-provider#runassystem) skips the
provider for the code inside it:

```typescript title="scripts/seed.ts"
import { runAsSystem } from '@nauth-toolkit/core';

await runAsSystem(async () => {
  const { user } = await adminAuthService.signup({ email: 'owner@example.com', password: seed });
  await usersService.setRole(user.sub, 'admin'); // however your app does it
});
```

[`adminAuthService.signup()`](/docs/api/core/services/admin-auth-service#signup) creates the
account; the role is written by your own code. Only use `runAsSystem()` in seeds, migrations,
cron jobs and tests — never inside a route.

## Reference

### Actions

The [`action`](/docs/api/core/interfaces/authorization-provider#authaction) passed to your
provider, and the service method that enforces it. It is the same action whatever route or code
path reached the method, and `AuthAction` is a closed union, so a typo in your provider is a
compile error.

| Action | What it allows | Enforced by |
| --- | --- | --- |
| `admin.user.create` | Create a user directly, bypassing signup | [`AdminAuthService.signup()`](/docs/api/core/services/admin-auth-service#signup) |
| `admin.user.createSocial` | Create a user from a social identity, bypassing the OAuth flow | [`AdminAuthService.signupSocial()`](/docs/api/core/services/admin-auth-service#signupsocial) |
| `admin.user.read` | Read another user's profile, by `sub` or by email | [`getUserById()`](/docs/api/core/services/admin-auth-service#getuserbyid), [`getUserByEmail()`](/docs/api/core/services/admin-auth-service#getuserbyemail) |
| `admin.user.list` | List or search users | [`AdminAuthService.getUsers()`](/docs/api/core/services/admin-auth-service#getusers) |
| `admin.user.update` | Edit another user's attributes | [`AdminAuthService.updateUserAttributes()`](/docs/api/core/services/admin-auth-service#updateuserattributes) |
| `admin.user.delete` | Permanently delete a user | [`AdminAuthService.deleteUser()`](/docs/api/core/services/admin-auth-service#deleteuser) |
| `admin.user.disable` | Disable a user, blocking sign-in | [`AdminAuthService.disableUser()`](/docs/api/core/services/admin-auth-service#disableuser) |
| `admin.user.enable` | Re-enable a disabled user | [`AdminAuthService.enableUser()`](/docs/api/core/services/admin-auth-service#enableuser) |
| `admin.user.forcePasswordChange` | Force a password change on next sign-in | [`AdminAuthService.setMustChangePassword()`](/docs/api/core/services/admin-auth-service#setmustchangepassword) |
| `admin.user.updateVerifiedStatus` | Override email/phone verified flags | [`AdminAuthService.updateVerifiedStatus()`](/docs/api/core/services/admin-auth-service#updateverifiedstatus) |
| `admin.user.resetPassword` | Begin an admin-initiated password reset (sends the user a code) | [`AdminAuthService.resetPassword()`](/docs/api/core/services/admin-auth-service#resetpassword) |
| `admin.user.setPassword` | Set a user's password outright, without their involvement | [`AdminAuthService.setPassword()`](/docs/api/core/services/admin-auth-service#setpassword) |
| `admin.session.list` | List another user's active sessions | [`AdminAuthService.getUserSessions()`](/docs/api/core/services/admin-auth-service#getusersessions) |
| `admin.session.revoke` | Revoke one of another user's sessions | [`AdminAuthService.revokeUserSession()`](/docs/api/core/services/admin-auth-service#revokeusersession) |
| `admin.session.revokeAll` | Revoke every session belonging to another user | [`AdminAuthService.logoutAll()`](/docs/api/core/services/admin-auth-service#logoutall) |
| `admin.mfa.readStatus` | Read another user's MFA enrolment status | [`MFAService.adminGetMfaStatus()`](/docs/api/core/services/mfa-service#admingetmfastatus) |
| `admin.mfa.listDevices` | List another user's MFA devices | [`MFAService.adminGetUserDevices()`](/docs/api/core/services/mfa-service#admingetuserdevices) |
| `admin.mfa.removeDevice` | Remove one of another user's MFA devices | [`MFAService.adminRemoveDevice()`](/docs/api/core/services/mfa-service#adminremovedevice) |
| `admin.mfa.setPreferred` | Change which of another user's MFA devices is preferred | [`MFAService.adminSetPreferredDevice()`](/docs/api/core/services/mfa-service#adminsetpreferreddevice) |
| `admin.mfa.setExemption` | Grant or revoke an exemption from MFA enforcement | [`MFAService.setMFAExemption()`](/docs/api/core/services/mfa-service#setmfaexemption) |
| `admin.audit.read` | Read audit history beyond the caller's own | [`AuthAuditService.getUserAuthHistory()`](/docs/api/core/services/auth-audit-service#getuserauthhistory), [`getEventsByType()`](/docs/api/core/services/auth-audit-service#geteventsbytype), [`getSuspiciousActivity()`](/docs/api/core/services/auth-audit-service#getsuspiciousactivity), [`getRiskAssessmentHistory()`](/docs/api/core/services/auth-audit-service#getriskassessmenthistory) |
| `admin.apiKey.create` | Issue an API key on another user's behalf | [`ApiKeyService.adminCreateKey()`](/docs/api/core/services/api-key-service#admin-methods-target-user-by-sub) |
| `admin.apiKey.list` | List another user's API keys | [`ApiKeyService.adminListKeys()`](/docs/api/core/services/api-key-service#admin-methods-target-user-by-sub) |
| `admin.apiKey.update` | Modify another user's API key | [`ApiKeyService.adminUpdateKey()`](/docs/api/core/services/api-key-service#admin-methods-target-user-by-sub) |
| `admin.apiKey.revoke` | Revoke another user's API key | [`ApiKeyService.adminRevokeKey()`](/docs/api/core/services/api-key-service#admin-methods-target-user-by-sub) |
| `admin.apiKey.delete` | Delete another user's API key | [`ApiKeyService.adminDeleteKey()`](/docs/api/core/services/api-key-service#admin-methods-target-user-by-sub) |

### What `authorize()` receives

The full [`AuthorizationContext`](/docs/api/core/interfaces/authorization-provider#authorizationcontext):

| Field | Type | Description |
| --- | --- | --- |
| `actor` | [`IUser`](/docs/api/core/interfaces/user) `\| undefined` | The signed-in caller. |
| `action` | [`AuthAction`](/docs/api/core/interfaces/authorization-provider#authaction) | The operation being attempted. |
| `targetSub` | `string \| undefined` | The user being acted on, when there is one — handy for "admins cannot edit other admins". |
| `request` | [`NAuthRequest`](/docs/api/core/interfaces/nauth-request) `\| undefined` | The live request. `request.body` lets you go finer than per-action if you ever need to. |
| `viaApiKey` | `boolean \| undefined` | True when the caller used an [API key](/docs/guides/api-keys). |

### When your provider is not called

| Situation | Result |
| --- | --- |
| No provider configured | Allowed. [Admin routes](/docs/api/core/routes/groups#admin) will not mount, but your own controllers work. |
| Inside [`runAsSystem()`](/docs/api/core/interfaces/authorization-provider#runassystem) | Allowed. |
| No signed-in user | Denied. |
| Your provider throws | Denied — a failing policy service never counts as a yes. |

### Good to know

- Denying an action leaves the endpoint mounted, answering `403`. To remove it from the app
  entirely, use [`exclude`](/docs/guides/routes) when mounting.
- Every denial is written to the [audit log](/docs/concepts/audit-logs) as
  [`AUTHORIZATION_DENIED`](/docs/api/core/enums/auth-audit-event-type) with the action, actor,
  target and reason.
- [API keys](/docs/guides/api-keys) are rejected on the shipped admin routes before your provider
  is asked.
- [`AdminAuthService.confirmResetPassword()`](/docs/api/core/services/admin-auth-service#confirmresetpassword),
  [`MFAService.getSetupData()`](/docs/api/core/services/mfa-service#getsetupdata) and
  [`MFAService.getChallengeData()`](/docs/api/core/services/mfa-service#getchallengedata) are
  never authorized — their callers are not signed in yet.

## What's Next

- [Admin Operations](/docs/guides/admin-operations) — mounting the routes, or writing your own controllers
- [IAuthorizationProvider](/docs/api/core/interfaces/authorization-provider) — full type reference
- [Authentication Routes](/docs/guides/routes) — route groups and `exclude`
- [Audit Logs](/docs/concepts/audit-logs) — reading the trail, including denials
