---
title: AuthResponse
description: Unified authentication response containing user tokens or challenge data
sidebar_position: 70
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
| `userSub`               | `string`                                 | User subject identifier                                                   |

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
  "userSub": "user_123"
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
  "userSub": "user_123"
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
  "userSub": "user_123"
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
  "userSub": "user_123"
}
```

**Note:** For `MFA_REQUIRED` challenges, use [`getMaskedDestination()`](../utilities/challenge-helpers#getmaskeddestination) to get the correct masked destination based on `preferredMethod`. The helper automatically returns `maskedPhone` for SMS or `maskedEmail` for Email MFA.

## Related Types

- [`AuthUserSummary`](./auth-user-summary) - User info in response
- [`AuthUser`](./auth-user) - Complete user profile
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
