---
title: Route Groups
description: "What each shipped route group contains: core (sign-in and challenges), profile, mfa, social, device, audit, apiKeys, admin, apiKeysAdmin — with every route, its method, path and access level"
keywords: [route groups, groups, core, admin, mfa, social, mounting, endpoints]
image: /img/api-social-card.png
sidebar_position: 2
---

# Route Groups

`groups` selects which bundles a mount registers. Each group is **self-sufficient**: mounting one
never leaves a flow half-served.

```typescript
{ prefix: 'mobile/auth', delivery: 'json', groups: ['core', 'profile', 'mfa'] }
```

| Group | Routes | Default | Purpose |
| --- | --- | --- | --- |
| [`core`](#core) | 12 | Yes | Sign-up, sign-in, refresh, sign-out, password recovery, and the challenge responses that complete them |
| [`profile`](#profile) | 3 | Yes | The caller's own profile and password |
| [`mfa`](#mfa) | 7 | Yes | The caller's own MFA enrolment and devices |
| [`social`](#social) | 10 | Yes | OAuth sign-in, account linking, and credentials for social-origin users |
| [`device`](#device) | 4 | Yes | Sessions and device trust |
| [`audit`](#audit) | 1 | Yes | The caller's own sign-in history |
| [`apiKeys`](#apikeys) | 5 | Yes | The caller's own API keys |
| [`admin`](#admin) | 25 | **No** | Operations on other users' accounts |
| [`apiKeysAdmin`](#apikeysadmin) | 5 | **No** | API keys on another user's behalf |

Omit `groups` and every non-admin group is mounted.

:::warning[Admin groups are opt-in and gated]
`admin` and `apiKeysAdmin` are never mounted by default, and mounting either requires an
[authorization provider](/docs/concepts/authorization) — the toolkit ships no role model, so
without one those endpoints would be reachable by any authenticated caller. Mounting them
without a provider is refused at startup.
:::

## core

Everything needed to get a user signed in, and signed out again.

**Challenge responses live here, not in a group of their own.** `login` can answer with
`VERIFY_EMAIL`, `MFA_REQUIRED` or `FORCE_CHANGE_PASSWORD`, and a caller with no way to respond
could not finish signing in. Splitting them would let you mount a login that cannot complete.

| Key | Method | Path | Access |
| --- | --- | --- | --- |
| `signup` | POST | `signup` | public |
| `login` | POST | `login` | public |
| `refresh` | POST | `refresh` | public |
| `logout` | GET | `logout` | authenticated |
| `logoutAll` | POST | `logout/all` | authenticated |
| `forgotPassword` | POST | `forgot-password` | public |
| `confirmForgotPassword` | POST | `forgot-password/confirm` | public |
| `confirmAdminResetPassword` | POST | `reset-password/confirm` | public |
| `respondChallenge` | POST | `respond-challenge` | public |
| `resendCode` | POST | `challenge/resend` | public |
| `getSetupData` | POST | `challenge/setup-data` | public |
| `getChallengeData` | POST | `challenge/challenge-data` | public |

`reset-password/confirm` is public by necessity: an administrator initiates the reset, but the
end user completes it from an emailed link with no session yet. The same is true of
`challenge/setup-data` and `challenge/challenge-data`, which are reached mid-sign-in and
authorized by the challenge session token rather than a JWT.

## profile

The caller acting on their own account.

| Key | Method | Path | Access |
| --- | --- | --- | --- |
| `profile` | GET | `profile` | authenticated |
| `updateProfile` | PUT | `profile` | authenticated |
| `changePassword` | POST | `change-password` | authenticated |

`change-password` requires the current password. A user who signed up through a social provider
has none — see [`social`](#social) for how they add one.

## mfa

Enrolment and device management for the signed-in user. Requires MFA to be configured; the
routes are dropped from the mount otherwise.

| Key | Method | Path | Access |
| --- | --- | --- | --- |
| `mfaStatus` | GET | `mfa/status` | authenticated |
| `mfaAvailableMethods` | GET | `mfa/available-methods` | authenticated |
| `mfaSetupData` | POST | `mfa/setup-data` | authenticated |
| `mfaVerifySetup` | POST | `mfa/verify-setup` | authenticated |
| `mfaDevices` | GET | `mfa/devices` | authenticated |
| `mfaPreferred` | POST | `mfa/devices/:deviceId/preferred` | authenticated |
| `mfaRemoveDevice` | DELETE | `mfa/devices/:deviceId` | authenticated |

These are for a user managing their factors while signed in. The MFA steps *during* sign-in are
challenge responses, and live in [`core`](#core).

## social

OAuth sign-in, linking providers to an existing account, and the credential routes that only
apply to social-origin users.

| Key | Method | Path | Access |
| --- | --- | --- | --- |
| `socialLinked` | GET | `social/linked` | authenticated |
| `socialLink` | POST | `social/link` | authenticated |
| `socialUnlink` | POST | `social/unlink` | authenticated |
| `socialCanSetPassword` | GET | `social/can-set-password` | authenticated |
| `socialSetPassword` | POST | `social/set-password` | authenticated |
| `socialExchange` | POST | `social/exchange` | public |
| `socialRedirectStart` | GET | `social/:provider/redirect` | public |
| `socialCallback` | GET | `social/:provider/callback` | public |
| `socialCallbackPost` | POST | `social/:provider/callback` | public |
| `socialVerify` | POST | `social/:provider/verify` | public |

**Why `set-password` is here rather than in [`profile`](#profile).** It is self-service — it
refuses unless the caller is acting on their own account — but it only applies to a user who has
**no** password, which in practice means they signed up through a provider. It refuses outright
if a password already exists. `can-set-password` tells the frontend which of the two to offer.
Mount `profile` without `social` and no such user can exist.

`:provider/callback` is where the OAuth provider redirects the browser back to; it must match
the `callbackUrl` you register with that provider. Both verbs are served because Apple posts a
form when name scopes are requested.

## device

| Key | Method | Path | Access |
| --- | --- | --- | --- |
| `sessions` | GET | `sessions` | authenticated |
| `logoutSession` | DELETE | `sessions/:sessionId` | authenticated |
| `trustDevice` | POST | `trust-device` | authenticated |
| `isTrustedDevice` | GET | `is-trusted-device` | authenticated |

## audit

| Key | Method | Path | Access |
| --- | --- | --- | --- |
| `auditHistory` | GET | `audit/history` | authenticated |

Reading another user's history is [`admin.audit.read`](/docs/concepts/authorization#actions) and
lives in [`admin`](#admin).

## apiKeys

The caller's own keys. Requires `apiKeys.enabled`; dropped from the mount otherwise.

| Key | Method | Path | Access |
| --- | --- | --- | --- |
| `apiKeyCreate` | POST | `api-keys` | authenticated |
| `apiKeyList` | GET | `api-keys` | authenticated |
| `apiKeyUpdate` | PATCH | `api-keys/:keyId` | authenticated |
| `apiKeyRevoke` | POST | `api-keys/:keyId/revoke` | authenticated |
| `apiKeyDelete` | DELETE | `api-keys/:keyId` | authenticated |

Every route denies API-key authentication, so a key cannot mint another key.

## admin

Operations one user performs on another's account. **Not mounted by default**, and refused at
startup without an [authorization provider](/docs/concepts/authorization).

Mount it on its own prefix so the surface can be firewalled off separately:

```typescript
{ prefix: 'admin', groups: ['admin'] }
```

| Key | Method | Path | Access |
| --- | --- | --- | --- |
| `adminSignup` | POST | `signup` | admin |
| `adminSignupSocial` | POST | `signup-social` | admin |
| `adminSetPassword` | POST | `set-password` | admin |
| `adminResetPasswordInitiate` | POST | `reset-password/initiate` | admin |
| `adminGetUserByEmail` | GET | `users/by-email` | admin |
| `adminGetUsers` | GET | `users` | admin |
| `adminGetUser` | GET | `users/:sub` | admin |
| `adminUpdateUser` | PUT | `users/:sub` | admin |
| `adminDeleteUser` | DELETE | `users/:sub` | admin |
| `adminDisableUser` | POST | `users/:sub/disable` | admin |
| `adminEnableUser` | POST | `users/:sub/enable` | admin |
| `adminForcePasswordChange` | POST | `users/:sub/force-password-change` | admin |
| `adminUpdateVerifiedStatus` | POST | `users/:sub/verified-status` | admin |
| `adminGetUserSessions` | GET | `users/:sub/sessions` | admin |
| `adminRevokeUserSession` | DELETE | `users/:sub/sessions/:sessionId` | admin |
| `adminLogoutAll` | POST | `users/:sub/logout-all` | admin |
| `adminSetMfaExemption` | POST | `mfa/exemption` | admin |
| `adminRemoveMfaDevice` | DELETE | `mfa/devices/:deviceId` | admin |
| `adminGetMfaStatus` | GET | `users/:sub/mfa/status` | admin |
| `adminGetMfaDevices` | GET | `users/:sub/mfa/devices` | admin |
| `adminSetPreferredMfaDevice` | POST | `users/:sub/mfa/devices/:deviceId/preferred` | admin |
| `adminGetEventsByType` | GET | `audit/events` | admin |
| `adminGetSuspiciousActivity` | GET | `audit/suspicious` | admin |
| `adminGetRiskAssessmentHistory` | GET | `audit/risk` | admin |
| `adminGetAuditHistory` | GET | `audit/history` | admin |

Every route denies API-key authentication, so `apiKeys.globalAllowlist` cannot expose them.
Each declares an [action](/docs/concepts/authorization#actions) that the service authorizes
independently — so the same policy covers a controller you write and a script, not just these
routes.

## apiKeysAdmin

API keys issued and managed on another user's behalf. Same gating as [`admin`](#admin).

APIKEYS| Key | Method | Path | Access |
| --- | --- | --- | --- |
| `adminSignup` | POST | `signup` | admin |
| `adminSignupSocial` | POST | `signup-social` | admin |
| `adminSetPassword` | POST | `set-password` | admin |
| `adminResetPasswordInitiate` | POST | `reset-password/initiate` | admin |
| `adminGetUserByEmail` | GET | `users/by-email` | admin |
| `adminGetUsers` | GET | `users` | admin |
| `adminGetUser` | GET | `users/:sub` | admin |
| `adminUpdateUser` | PUT | `users/:sub` | admin |
| `adminDeleteUser` | DELETE | `users/:sub` | admin |
| `adminDisableUser` | POST | `users/:sub/disable` | admin |
| `adminEnableUser` | POST | `users/:sub/enable` | admin |
| `adminForcePasswordChange` | POST | `users/:sub/force-password-change` | admin |
| `adminUpdateVerifiedStatus` | POST | `users/:sub/verified-status` | admin |
| `adminGetUserSessions` | GET | `users/:sub/sessions` | admin |
| `adminRevokeUserSession` | DELETE | `users/:sub/sessions/:sessionId` | admin |
| `adminLogoutAll` | POST | `users/:sub/logout-all` | admin |
| `adminSetMfaExemption` | POST | `mfa/exemption` | admin |
| `adminRemoveMfaDevice` | DELETE | `mfa/devices/:deviceId` | admin |
| `adminGetMfaStatus` | GET | `users/:sub/mfa/status` | admin |
| `adminGetMfaDevices` | GET | `users/:sub/mfa/devices` | admin |
| `adminSetPreferredMfaDevice` | POST | `users/:sub/mfa/devices/:deviceId/preferred` | admin |
| `adminGetEventsByType` | GET | `audit/events` | admin |
| `adminGetSuspiciousActivity` | GET | `audit/suspicious` | admin |
| `adminGetRiskAssessmentHistory` | GET | `audit/risk` | admin |
| `adminGetAuditHistory` | GET | `audit/history` | admin |

## Related

- [Shipped Routes](./overview) — mount options, and the complete route table
- [Authorization](/docs/concepts/authorization) — the provider admin groups require
- [Authentication Routes](/docs/guides/routes) — mounting, overriding and surface reduction
