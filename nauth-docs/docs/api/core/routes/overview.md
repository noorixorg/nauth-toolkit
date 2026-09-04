---
title: Shipped Routes
description: "Route manifest reference: NAuthRouteMountOptions (prefix, groups, exclude, delivery, guards), route groups, all 72 route keys, and the mount functions for NestJS, Express and Fastify"
keywords: [routes, mount, manifest, endpoints, exclude, groups, controllers]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Shipped Routes

**Package:** `@nauth-toolkit/core`
**Type:** Route manifest

nauth-toolkit ships every auth endpoint as a framework-agnostic manifest. Mount it instead of
hand-writing controllers; `exclude` individual keys where you need your own behaviour.

## Mount options

```typescript
interface NAuthRouteMountOptions {
  enabled?: boolean;
  prefix?: string;
  groups?: readonly NAuthRouteGroup[];
  exclude?: readonly NAuthRouteKey[];
  delivery?: 'json' | 'cookies';
  guards?: readonly GuardLike[];
  adminGuards?: readonly GuardLike[];
  routeGuards?: Partial<Record<NAuthRouteKey, readonly GuardLike[]>>;
}
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `adminGuards` | `GuardLike[]` | `[]` | Guards applied only to routes with `access: 'admin'`. |
| `delivery` | `'json' \| 'cookies'` | inherit | Forces one transport for the bundle. Requires `tokenDelivery.method: 'hybrid'` unless it matches the configured method. |
| `enabled` | `boolean` | `true` | Set false to mount nothing. |
| `exclude` | `NAuthRouteKey[]` | `[]` | Individual routes to leave out. An unknown key throws at mount time. |
| `groups` | `NAuthRouteGroup[]` | all except `admin`, `apiKeysAdmin` | Which bundles to mount. |
| `guards` | `GuardLike[]` | `[]` | Guards applied to every route in the bundle. |
| `prefix` | `string` | `'auth'` | Path prefix, relative to any framework-wide prefix. |
| `routeGuards` | `Partial<Record<NAuthRouteKey, GuardLike[]>>` | `{}` | Guards for named routes, merged with the above. |

A `GuardLike` is a guard class, guard instance, or DI token on NestJS; a middleware function on
Express and Fastify. DI tokens only mean anything to NestJS — on Express and Fastify a guard is
pushed straight into the middleware chain, so pass a function there.

## Groups

`groups` selects which bundles to mount. Omit it and every group except `admin` and
`apiKeysAdmin` is registered.

| Group | Routes | Default | Purpose |
| --- | --- | --- | --- |
| `core` | 12 | Yes | Sign-up, sign-in, refresh, sign-out, password recovery, and the challenge responses that complete them |
| `profile` | 3 | Yes | The caller's own profile and password |
| `mfa` | 7 | Yes | The caller's own MFA enrolment and devices |
| `social` | 10 | Yes | OAuth sign-in, linking, and credentials for social-origin users |
| `device` | 4 | Yes | Sessions and device trust |
| `audit` | 1 | Yes | The caller's own sign-in history |
| `apiKeys` | 5 | Yes | The caller's own API keys |
| `admin` | 25 | **No** | Operations on other users' accounts |
| `apiKeysAdmin` | 5 | **No** | API keys on another user's behalf |

**[Route Groups](./groups) lists every route in each group**, with its method, path and access
level.

:::warning[Admin groups require an authorization provider]
Mounting `admin` or `apiKeysAdmin` without one is refused at startup. The toolkit ships no role
model, so those endpoints would otherwise be reachable by any authenticated caller. See
[Authorization](/docs/concepts/authorization).
:::

## Mount functions

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

Configured declaratively — `AuthModule.forRoot()` builds the controllers.

```typescript title="src/config/auth.config.ts"
export const authConfig: NAuthModuleConfig = {
  // ...jwt, providers, and the rest of your configuration
  tokenDelivery: { method: 'hybrid' },
  routes: [
    { prefix: 'auth', delivery: 'cookies' },
    { prefix: 'mobile/auth', delivery: 'json', groups: ['core', 'social'] },
  ],
};
```

`createNAuthRoutesController(mount)` is also exported for registering a bundle in your own module.

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/index.ts"
import { registerNAuthExpressRoutes } from '@nauth-toolkit/core';

const webRouter = express.Router();
registerNAuthExpressRoutes(webRouter, nauth, { delivery: 'cookies' });
app.use('/auth', webRouter);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/index.ts"
import { registerNAuthFastifyRoutes } from '@nauth-toolkit/core';

await fastify.register(
  async (scope) => registerNAuthFastifyRoutes(scope, nauth, { delivery: 'cookies' }),
  { prefix: '/auth' },
);
```

Fastify takes the prefix in `register()`, not in the mount options.

</TabItem>
</Tabs>

## Self-service routes

Paths are relative to the bundle prefix. Where a route has a client-SDK counterpart, its key
matches the corresponding `defaultEndpoints` key — several shipped routes have no SDK key, and
the SDK's `mfaBackupCodes` has no route (see [NAuthEndpoints](/docs/frontend-sdk/api/types/nauth-endpoints)).

| Key | Group | Method | Path | Access |
| --- | --- | --- | --- | --- |
| `signup` | core | POST | `signup` | public |
| `login` | core | POST | `login` | public |
| `refresh` | core | POST | `refresh` | public |
| `logout` | core | GET | `logout` | authenticated |
| `logoutAll` | core | POST | `logout/all` | authenticated |
| `forgotPassword` | core | POST | `forgot-password` | public |
| `confirmForgotPassword` | core | POST | `forgot-password/confirm` | public |
| `confirmAdminResetPassword` | core | POST | `reset-password/confirm` | public |
| `respondChallenge` | challenge | POST | `respond-challenge` | public |
| `resendCode` | challenge | POST | `challenge/resend` | public |
| `getSetupData` | challenge | POST | `challenge/setup-data` | public |
| `getChallengeData` | challenge | POST | `challenge/challenge-data` | public |
| `profile` | profile | GET | `profile` | authenticated |
| `updateProfile` | profile | PUT | `profile` | authenticated |
| `changePassword` | profile | POST | `change-password` | authenticated |
| `mfaStatus` | mfa | GET | `mfa/status` | authenticated |
| `mfaAvailableMethods` | mfa | GET | `mfa/available-methods` | authenticated |
| `mfaSetupData` | mfa | POST | `mfa/setup-data` | authenticated |
| `mfaVerifySetup` | mfa | POST | `mfa/verify-setup` | authenticated |
| `mfaDevices` | mfa | GET | `mfa/devices` | authenticated |
| `mfaPreferred` | mfa | POST | `mfa/devices/:deviceId/preferred` | authenticated |
| `mfaRemoveDevice` | mfa | DELETE | `mfa/devices/:deviceId` | authenticated |
| `socialLinked` | social | GET | `social/linked` | authenticated |
| `socialLink` | social | POST | `social/link` | authenticated |
| `socialUnlink` | social | POST | `social/unlink` | authenticated |
| `socialCanSetPassword` | social | GET | `social/can-set-password` | authenticated |
| `socialSetPassword` | social | POST | `social/set-password` | authenticated |
| `socialExchange` | social | POST | `social/exchange` | public |
| `socialRedirectStart` | social | GET | `social/:provider/redirect` | public |
| `socialCallback` | social | GET | `social/:provider/callback` | public |
| `socialCallbackPost` | social | POST | `social/:provider/callback` | public |
| `socialVerify` | social | POST | `social/:provider/verify` | public |
| `sessions` | device | GET | `sessions` | authenticated |
| `logoutSession` | device | DELETE | `sessions/:sessionId` | authenticated |
| `trustDevice` | device | POST | `trust-device` | authenticated |
| `isTrustedDevice` | device | GET | `is-trusted-device` | authenticated |
| `auditHistory` | audit | GET | `audit/history` | authenticated |
| `apiKeyCreate` | apiKeys | POST | `api-keys` | authenticated |
| `apiKeyList` | apiKeys | GET | `api-keys` | authenticated |
| `apiKeyUpdate` | apiKeys | PATCH | `api-keys/:keyId` | authenticated |
| `apiKeyRevoke` | apiKeys | POST | `api-keys/:keyId/revoke` | authenticated |
| `apiKeyDelete` | apiKeys | DELETE | `api-keys/:keyId` | authenticated |

## Administrative routes

| Key | Group | Method | Path | Access |
| --- | --- | --- | --- | --- |
| `adminSignup` | admin | POST | `signup` | admin |
| `adminSignupSocial` | admin | POST | `signup-social` | admin |
| `adminSetPassword` | admin | POST | `set-password` | admin |
| `adminResetPasswordInitiate` | admin | POST | `reset-password/initiate` | admin |
| `adminGetUserByEmail` | admin | GET | `users/by-email` | admin |
| `adminGetUsers` | admin | GET | `users` | admin |
| `adminGetUser` | admin | GET | `users/:sub` | admin |
| `adminUpdateUser` | admin | PUT | `users/:sub` | admin |
| `adminDeleteUser` | admin | DELETE | `users/:sub` | admin |
| `adminDisableUser` | admin | POST | `users/:sub/disable` | admin |
| `adminEnableUser` | admin | POST | `users/:sub/enable` | admin |
| `adminForcePasswordChange` | admin | POST | `users/:sub/force-password-change` | admin |
| `adminUpdateVerifiedStatus` | admin | POST | `users/:sub/verified-status` | admin |
| `adminGetUserSessions` | admin | GET | `users/:sub/sessions` | admin |
| `adminRevokeUserSession` | admin | DELETE | `users/:sub/sessions/:sessionId` | admin |
| `adminLogoutAll` | admin | POST | `users/:sub/logout-all` | admin |
| `adminSetMfaExemption` | admin | POST | `mfa/exemption` | admin |
| `adminRemoveMfaDevice` | admin | DELETE | `mfa/devices/:deviceId` | admin |
| `adminGetMfaStatus` | admin | GET | `users/:sub/mfa/status` | admin |
| `adminGetMfaDevices` | admin | GET | `users/:sub/mfa/devices` | admin |
| `adminSetPreferredMfaDevice` | admin | POST | `users/:sub/mfa/devices/:deviceId/preferred` | admin |
| `adminGetEventsByType` | admin | GET | `audit/events` | admin |
| `adminGetSuspiciousActivity` | admin | GET | `audit/suspicious` | admin |
| `adminGetRiskAssessmentHistory` | admin | GET | `audit/risk` | admin |
| `adminGetAuditHistory` | admin | GET | `audit/history` | admin |
| `adminApiKeyCreate` | apiKeysAdmin | POST | `api-keys` | admin |
| `adminApiKeyList` | apiKeysAdmin | GET | `api-keys` | admin |
| `adminApiKeyUpdate` | apiKeysAdmin | PATCH | `api-keys/:keyId` | admin |
| `adminApiKeyRevoke` | apiKeysAdmin | POST | `api-keys/:keyId/revoke` | admin |
| `adminApiKeyDelete` | apiKeysAdmin | DELETE | `api-keys/:keyId` | admin |

## Related APIs

- [Authorization](/docs/concepts/authorization) - the provider admin routes require
- [Authentication Routes](/docs/guides/routes) - mounting, overriding, and surface reduction
- [Token Management](/docs/concepts/token-management) - delivery modes and the hybrid requirement
