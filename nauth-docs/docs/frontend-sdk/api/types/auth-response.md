---
title: AuthResponse
description: Unified authentication response containing user tokens or challenge data
keywords: [response, authentication, challenge, tokens, api]
image: /img/api-social-card.png
---

# AuthResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Unified response from authentication operations. Contains either user/tokens on successful authentication or challenge data when additional verification is required.

```typescript
import { AuthResponse } from '@nauth-toolkit/client';
```

## Properties

| Property                | Type                                     | Description                                                               |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| `user`                  | [`AuthUserSummary`](./auth-user-summary) | User info (present on successful auth)                                    |
| `accessToken`           | `string`                                 | Access token (JSON mode only)                                             |
| `refreshToken`          | `string`                                 | Refresh token (JSON mode only)                                            |
| `accessTokenExpiresAt`  | `number`                                 | Access token expiry timestamp (milliseconds since epoch)                  |
| `refreshTokenExpiresAt` | `number`                                 | Refresh token expiry timestamp (milliseconds since epoch)                 |
| `authMethod`            | `string`                                 | Authentication method used to create the current session (`password`, `google`, `apple`, `facebook`) |
| `trusted`               | `boolean`                                | Whether device is trusted                                                 |
| `deviceToken`           | `string`                                 | Device trust token                                                        |
| `challengeName`         | [`AuthChallenge`](./auth-challenge)      | Challenge type (if auth incomplete)                                       |
| `session`               | `string`                                 | Challenge session token (required for challenge responses)                |
| `challengeParameters`   | `Record<string, unknown>`                | Challenge-specific data (e.g., masked email/phone, available MFA methods) |
| `sub`                   | `string`                                 | User subject identifier                                                   |
| `mfaGracePeriod`        | [`MfaGracePeriod`](#mfagraceperiod)      | MFA setup is pending but not yet enforced (present on success and challenge responses alike) |

## Example

### Successful Authentication

```json
{
  "user": {
    "sub": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+14155551234",
    "isEmailVerified": true,
    "isPhoneVerified": true,
    "socialProviders": ["google"],
    "hasPasswordHash": true
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "accessTokenExpiresAt": 1704067200000,
  "refreshTokenExpiresAt": 1704153600000,
  "authMethod": "password",
  "trusted": true,
  "deviceToken": "device_token_abc123"
}
```

### Challenge Response

#### VERIFY_EMAIL Challenge

```json
{
  "challengeName": "VERIFY_EMAIL",
  "session": "challenge_session_token_xyz",
  "challengeParameters": {
    "email": "user@example.com",
    "codeDeliveryDestination": "u***r@example.com"
  },
  "sub": "user_123"
}
```

#### VERIFY_PHONE Challenge

```json
{
  "challengeName": "VERIFY_PHONE",
  "session": "challenge_session_token_xyz",
  "challengeParameters": {
    "phone": "+14155551234",
    "codeDeliveryDestination": "***-***-1234",
    "requiresPhoneCollection": "false"
  },
  "sub": "user_123"
}
```

When phone collection is required (user has no phone number):

```json
{
  "challengeName": "VERIFY_PHONE",
  "session": "challenge_session_token_xyz",
  "challengeParameters": {
    "requiresPhoneCollection": "true",
    "instructions": "You must add a phone number and verify it to continue"
  },
  "sub": "user_123"
}
```

#### MFA_REQUIRED Challenge

```json
{
  "challengeName": "MFA_REQUIRED",
  "session": "challenge_session_token_xyz",
  "challengeParameters": {
    "preferredMethod": "sms",
    "maskedPhone": "***-***-9393",
    "maskedEmail": "m***2@example.com",
    "availableMethods": ["sms", "email", "totp", "backup"]
  },
  "sub": "user_123"
}
```

**Note:** For `MFA_REQUIRED` challenges, use [`getMaskedDestination()`](../utilities/challenge-helpers#getmaskeddestination) to get the correct masked destination based on `preferredMethod`. The helper automatically returns `maskedPhone` for SMS or `maskedEmail` for Email MFA.

## MfaGracePeriod

Present whenever the backend has MFA enforcement switched on (`REQUIRED` or `ADAPTIVE`), the user has not enrolled yet, and enforcement has not started. It rides along on **every** response of the signup flow — including the `VERIFY_EMAIL` / `VERIFY_PHONE` challenges — so the client can offer an optional MFA setup flow as soon as signup completes, rather than waiting for a later login to force it.

```typescript
import { MfaGracePeriod } from '@nauth-toolkit/client';
```

| Property              | Type                       | Description                                                                             |
| --------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| `active`              | `boolean`                  | Always `true` when the object is present                                                 |
| `daysRemaining`       | `number`                   | Whole days left, rounded up. `0` when the grace covers only the signup flow              |
| `endsAt`              | `string`                   | ISO 8601 timestamp when MFA setup becomes mandatory. Absent when the grace covers only signup |
| `enforcement`         | `'REQUIRED' \| 'ADAPTIVE'` | Enforcement policy that applies once the grace period ends                               |
| `requiredAtNextLogin` | `boolean`                  | `true` when the next login will be challenged with `MFA_SETUP_REQUIRED`                  |

When the field is absent, there is nothing pending: MFA is not enforced, the user already enrolled, the grace expired (the flow returns `MFA_SETUP_REQUIRED` instead), or this is a social login the backend exempts via `mfa.requireForSocialLogin: false`.

```typescript
const result = await client.signup({ email, password });

if (result.mfaGracePeriod?.requiredAtNextLogin) {
  // Setup is mandatory from the next login - prompt now
  router.navigate(['/security/mfa-setup']);
} else if (result.mfaGracePeriod) {
  // Optional for another `daysRemaining` days - show a dismissible banner
  showMfaReminder(result.mfaGracePeriod.daysRemaining);
}
```

**Signup inside a grace period:**

```json
{
  "challengeName": "VERIFY_EMAIL",
  "session": "challenge_session_token_xyz",
  "challengeParameters": {
    "email": "user@example.com",
    "codeDeliveryDestination": "u***r@example.com"
  },
  "sub": "user_123",
  "mfaGracePeriod": {
    "active": true,
    "endsAt": "2025-02-01T00:00:00.000Z",
    "daysRemaining": 7,
    "enforcement": "REQUIRED"
  }
}
```

## Related Types

- [`AuthUserSummary`](./auth-user-summary) - User info in response
- [`AuthUser`](./auth-user) - Complete user profile
- [`MfaGracePeriod`](#mfagraceperiod) - Pending MFA setup status
- [`AuthChallenge`](./auth-challenge) - Challenge type enum
- [`ChallengeResponse`](./challenge-response) - Challenge response union
- [`TokenResponse`](./token-response) - Token refresh response

## Used By

- [NAuthClient.login()](../nauth-client#login) - Returns [`AuthResponse`](./auth-response)
- [NAuthClient.signup()](../nauth-client#signup) - Returns [`AuthResponse`](./auth-response)
- [NAuthClient.respondToChallenge()](../nauth-client#respondtochallenge) - Returns [`AuthResponse`](./auth-response)
- [NAuthClient.exchangeSocialRedirect()](../nauth-client#exchangesocialredirect) - Returns [`AuthResponse`](./auth-response)
- [NAuthClient.verifyNativeSocial()](../nauth-client#verifynativesocial) - Returns [`AuthResponse`](./auth-response)
- [Angular AuthService](../../angular/auth-service) - Observable wrapper
