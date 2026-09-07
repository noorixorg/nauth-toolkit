---
title: AuthResponseDTO
description: Unified authentication response DTO for all auth operations. Contains tokens on success or challenge information when verification required.
keywords: [auth, response, dto, tokens, challenge, jwt, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AuthResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Unified response DTO for all authentication operations. Returns tokens when successful or challenge information when verification is required.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AuthResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AuthResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property                 | Type                      | Required | Description                                                      |
| ------------------------ | ------------------------- | -------- | ---------------------------------------------------------------- |
| `accessToken`            | `string`                  | Conditional | JWT access token. Present when authentication complete.        |
| `refreshToken`           | `string`                  | Conditional | JWT refresh token. Present when authentication complete.        |
| `accessTokenExpiresAt`   | `number`                  | Conditional | Access token expiration (Unix timestamp). Present when tokens available. |
| `refreshTokenExpiresAt`  | `number`                  | Conditional | Refresh token expiration (Unix timestamp). Present when tokens available. |
| `authMethod`             | `string`                  | Conditional | Authentication method used to create the current session (e.g., `password`, `google`, `apple`, `facebook`). Present when authentication complete. |
| `trusted`                | `boolean`                 | Conditional | Whether device is trusted. Present when authentication complete. |
| `deviceToken`            | `string`                  | Conditional | Device trust token (UUID v4). Present when device trusted.       |
| `user`                   | [`AuthResponseUser`](../interfaces/auth-response-user) | Conditional | User information. Present when authentication complete.          |
| `challengeName`           | [`AuthChallenge`](./auth-challenge-dto)           | Conditional | Challenge type. Present when challenge required.                 |
| `session`                | `string`                  | Conditional | Challenge session token (UUID v4). Present when challenge required. |
| `challengeParameters`    | `Record<string, unknown>` | Conditional | Challenge-specific parameters. Present when challenge required.  |
| `sub`                    | `string`                  | Conditional | User identifier (UUID v4). Present in both success and challenge responses. |
| `mfaGracePeriod`         | [`MfaGracePeriodInfo`](#mfagraceperiodinfo) | Conditional | MFA grace period status. Present in both success and challenge responses while MFA setup is pending but not yet enforced. |


## Example

**Successful Authentication:**

```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "accessTokenExpiresAt": 1730000000,
  "refreshTokenExpiresAt": 1732592000,
  "authMethod": "google",
  "trusted": true,
  "deviceToken": "a21b654c-2746-4168-acee-c175083a65cd",
  "user": {
    "sub": "b32c765d-3857-5279-bdff-d286194b76de",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+14155551234",
    "isEmailVerified": true,
    "isPhoneVerified": true,
    "socialProviders": ["google"],
    "hasPasswordHash": true
  }
}
```

**Challenge Required:**

```json
{
  "challengeName": "VERIFY_EMAIL",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "email": "user@example.com",
    "codeDeliveryDestination": "u***@example.com"
  },
  "sub": "b32c765d-3857-5279-bdff-d286194b76de"
}
```

**Signup Inside an MFA Grace Period:**

```json
{
  "challengeName": "VERIFY_EMAIL",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "email": "user@example.com",
    "codeDeliveryDestination": "u***@example.com"
  },
  "sub": "b32c765d-3857-5279-bdff-d286194b76de",
  "mfaGracePeriod": {
    "active": true,
    "endsAt": "2025-02-01T00:00:00.000Z",
    "daysRemaining": 7,
    "enforcement": "REQUIRED"
  }
}
```

## Related Types

- [`AuthResponseUser`](../interfaces/auth-response-user) - User property interface
- [`MfaGracePeriodInfo`](#mfagraceperiodinfo) - MFA grace period property interface
- [`TokenResponse`](#tokenresponse) - Token refresh response interface
- [`toAuthResponseUser()`](#toauthresponseuser) - Conversion utility function

## Used By

- [AuthService.login()](../services/auth-service#login)
- [AuthService.signup()](../services/auth-service#signup)
- [AuthService.respondToChallenge()](../services/auth-service#respondtochallenge)

---

## MfaGracePeriodInfo

Interface describing an MFA setup that is pending but not yet enforced. Attached to `AuthResponseDTO.mfaGracePeriod` on **both** challenge and success responses, so a client learns at signup that MFA setup is coming and can offer an optional setup flow before enforcement makes it mandatory.

```typescript
import { MfaGracePeriodInfo } from '@nauth-toolkit/core';
```

The field is present only when all of the following hold:

- `mfa.enabled` is `true` and `mfa.enforcement` is `REQUIRED` or `ADAPTIVE`
- The user has not enrolled MFA and is not exempt (`mfaExempt`)
- Either the `mfa.gracePeriod` window is still open, or the setup challenge was skipped for this signup via [`mfa.grace.skipForSignup`](/docs/concepts/configuration#multi-factor-authentication)

Once the grace ends, the field is absent and the flow returns the `MFA_SETUP_REQUIRED` challenge instead.

| Property               | Type                        | Required | Description                                                                                       |
| ---------------------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `active`               | `boolean`                   | Yes      | Always `true` when the object is present. Acts as a discriminator for clients holding a nullable copy. |
| `daysRemaining`        | `number`                    | Yes      | Whole days left, rounded up. `0` when the grace covers only the signup flow.                       |
| `endsAt`               | `string`                    | No       | ISO 8601 timestamp when MFA setup becomes mandatory. Absent when the grace covers only the signup flow. |
| `enforcement`          | `'REQUIRED' \| 'ADAPTIVE'`  | Yes      | Enforcement policy that applies once the grace period ends.                                        |
| `requiredAtNextLogin`  | `boolean`                   | No       | `true` when the user's very next login will be challenged with `MFA_SETUP_REQUIRED`.               |

**Example (day-based grace window):**

```json
{
  "active": true,
  "endsAt": "2025-02-01T00:00:00.000Z",
  "daysRemaining": 7,
  "enforcement": "REQUIRED"
}
```

**Example (frictionless signup, `gracePeriod: 0` with `grace.skipForSignup`):**

```json
{
  "active": true,
  "daysRemaining": 0,
  "enforcement": "REQUIRED",
  "requiredAtNextLogin": true
}
```

**Used By:** [AuthService.signup()](../services/auth-service#signup), [AuthService.login()](../services/auth-service#login), [AuthService.respondToChallenge()](../services/auth-service#respondtochallenge)

---

## TokenResponse

Interface returned by token refresh operations. Contains new access and refresh tokens with expiration timestamps.

```typescript
import { TokenResponse } from '@nauth-toolkit/core';
```

| Property                | Type     | Description                                 |
| ----------------------- | -------- | ------------------------------------------- |
| `accessToken`           | `string` | New JWT access token                        |
| `refreshToken`          | `string` | New JWT refresh token                       |
| `accessTokenExpiresAt`  | `number` | Access token expiration (Unix timestamp)    |
| `refreshTokenExpiresAt` | `number` | Refresh token expiration (Unix timestamp)   |

**Example:**

```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "accessTokenExpiresAt": 1730000900,
  "refreshTokenExpiresAt": 1732592900
}
```

**Used By:** [AuthService.refreshToken()](../services/auth-service#refreshtoken)

---

## toAuthResponseUser()

Utility function to convert `IUser` entity to `AuthResponseUser` interface.

```typescript
function toAuthResponseUser(user: IUser): AuthResponseUser
```

**Parameters**

- `user` - [`IUser`](../interfaces/user) entity from database

**Returns**

- [`AuthResponseUser`](../interfaces/auth-response-user) - Sanitized user object

**Example**

```typescript
import { toAuthResponseUser, IUser } from '@nauth-toolkit/core';

const user: IUser = await userRepository.findOne({ where: { sub } });
const responseUser = toAuthResponseUser(user);
```
