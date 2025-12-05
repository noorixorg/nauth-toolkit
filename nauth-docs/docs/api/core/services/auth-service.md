---
title: AuthService
description: Core authentication service providing signup, login, password management, MFA, session handling, and token generation for Node.js applications.
keywords: [auth, authentication, service, api, login, signup, password, session, mfa, jwt]
image: /img/api-social-card.png
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AuthService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Main authentication service that orchestrates all authentication operations including user signup, login, password management, session management, and token generation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AuthService } from '@nauth-toolkit/core';
// Access via nauth.authService after NAuth.create()
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AuthService } from '@nauth-toolkit/core';
// Access via nauth.authService after NAuth.create()
```

</TabItem>
</Tabs>

## Overview

Central service for all authentication operations including signup, login, password management, session handling, and token generation.

:::note
Automatically injected by your framework adapter. No manual instantiation required.
:::

## Methods

### changePassword()

Change user's password. Requires current password verification.

```typescript
async changePassword(dto: ChangePasswordRequestDTO): Promise<ChangePasswordResponseDTO>
```

**Parameters**

- `dto` - [`ChangePasswordRequestDTO`](../dto/change-password-request-dto)

**Returns**

- [`ChangePasswordResponseDTO`](../dto/change-password-response-dto)

**Errors**

| Code                          | When                       | Details                |
| ----------------------------- | -------------------------- | ---------------------- |
| `NOT_FOUND`                   | User not found             | `{ userId?: string }`  |
| `PASSWORD_INCORRECT`          | Current password incorrect | `undefined`            |
| `WEAK_PASSWORD`               | Policy violation           | `{ errors: string[] }` |
| `PASSWORD_REUSED`             | Password recently used     | `undefined`            |
| `PASSWORD_CHANGE_NOT_ALLOWED` | Social-only account        | `undefined`            |

**Example**

```typescript
await authService.changePassword({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
  oldPassword: 'OldPass123!',
  newPassword: 'NewPass456!',
});
```

---

### getUserByEmail()

Retrieve user by email address.

```typescript
async getUserByEmail(dto: GetUserByEmailDTO): Promise<UserResponseDto | null>
```

**Parameters**

- `dto` - [`GetUserByEmailDTO`](../dto/get-user-by-email-dto)

**Returns**

- [`UserResponseDto`](../dto/user-response-dto) or `null` if not found

**Example**

```typescript
const user = await authService.getUserByEmail({
  email: 'user@example.com',
  requireEmailVerified: true,
});
```

---

### getUserById()

Retrieve user by ID.

```typescript
async getUserById(dto: GetUserByIdDTO): Promise<UserResponseDto | null>
```

**Parameters**

- `dto` - [`GetUserByIdDTO`](../dto/get-user-by-id-dto)

**Returns**

- [`UserResponseDto`](../dto/user-response-dto) or `null` if not found

**Example**

```typescript
const user = await authService.getUserById({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
});
```

---

### login()

Authenticate user with email, username, or phone.

```typescript
async login(dto: LoginDTO): Promise<AuthResponseDTO>
```

**Parameters**

- `dto` - [`LoginDTO`](../dto/login-dto)

**Returns**

- [`AuthResponseDTO`](../dto/auth-response-dto) - Tokens if successful, challenge if MFA/verification required

**Errors**

| Code                       | When                     | Details                                          |
| -------------------------- | ------------------------ | ------------------------------------------------ |
| `INVALID_CREDENTIALS`      | Invalid credentials      | `undefined`                                      |
| `ACCOUNT_LOCKED`           | Too many failed attempts | `{ lockoutUntil?: string, retryAfter?: number }` |
| `ACCOUNT_INACTIVE`         | Account disabled         | `undefined`                                      |
| `RATE_LIMIT_LOGIN`         | Too many login attempts  | `{ retryAfter: number }`                         |
| `SIGNIN_BLOCKED_HIGH_RISK` | High risk detected       | `{ riskScore: number, riskFactors: string[] }`   |

**Example**

```typescript
const result = await authService.login({
  identifier: 'user@example.com',
  password: 'SecurePass123!',
});
```

---

### logout()

Logout user from current session.

```typescript
async logout(dto: LogoutDTO): Promise<LogoutResponseDTO>
```

**Parameters**

- `dto` - [`LogoutDTO`](../dto/logout-dto)

**Returns**

- [`LogoutResponseDTO`](../dto/logout-response-dto)

**Errors**

| Code                | When                      | Details                  |
| ------------------- | ------------------------- | ------------------------ |
| `SESSION_NOT_FOUND` | Session not found/revoked | `{ sessionId?: string }` |

**Example**

```typescript
await authService.logout({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
  forgetMe: false,
});
```

---

### logoutAll()

Logout user from all sessions.

```typescript
async logoutAll(dto: LogoutAllDTO): Promise<LogoutAllResponseDTO>
```

**Parameters**

- `dto` - [`LogoutAllDTO`](../dto/logout-all-dto)

**Returns**

- [`LogoutAllResponseDTO`](../dto/logout-all-response-dto) - Contains count of revoked sessions

**Errors**

| Code        | When           | Details               |
| ----------- | -------------- | --------------------- |
| `NOT_FOUND` | User not found | `{ userId?: string }` |

**Example**

```typescript
const result = await authService.logoutAll({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
});
```

---

### refreshToken()

Generate new access token using refresh token.

```typescript
async refreshToken(dto: RefreshTokenDTO): Promise<TokenResponse>
```

**Parameters**

- `dto` - [`RefreshTokenDTO`](../dto/refresh-token-dto)

**Returns**

- [`TokenResponse`](../dto/auth-response-dto)

**Errors**

| Code                   | When                      | Details                                        |
| ---------------------- | ------------------------- | ---------------------------------------------- |
| `TOKEN_INVALID`        | Invalid/malformed token   | `undefined`                                    |
| `TOKEN_EXPIRED`        | Token expired             | `undefined`                                    |
| `TOKEN_REUSE_DETECTED` | Token reused (security)   | `{ sessionId?: string, tokenFamily?: string }` |
| `SESSION_NOT_FOUND`    | Session not found/revoked | `{ sessionId?: string }`                       |
| `RATE_LIMIT_LOGIN`     | Too many refresh attempts | `{ retryAfter: number }`                       |

**Example**

```typescript
const tokens = await authService.refreshToken({
  refreshToken: 'eyJhbGci...',
});
```

---

### resendCode()

Resend verification code via email or SMS.

```typescript
async resendCode(dto: ResendCodeDTO): Promise<ResendCodeResponseDTO>
```

**Parameters**

- `dto` - [`ResendCodeDTO`](../dto/resend-code-dto)

**Returns**

- [`ResendCodeResponseDTO`](../dto/resend-code-response-dto) - Contains masked destination

**Errors**

| Code                | When                      | Details                                      |
| ------------------- | ------------------------- | -------------------------------------------- |
| `VALIDATION_FAILED` | Invalid challenge/no user | `{ field?: string, reason?: string }`        |
| `RATE_LIMIT_RESEND` | Too many resend attempts  | `{ retryAfter: number }`                     |
| `CHALLENGE_EXPIRED` | Challenge session expired | `{ sessionId?: string, expiredAt?: string }` |
| `CHALLENGE_INVALID` | Challenge session invalid | `{ sessionId?: string }`                     |
| `INTERNAL_ERROR`    | Service unavailable       | `{ service?: string }`                       |

**Example**

```typescript
const result = await authService.resendCode({
  session: 'a21b654c-2746-4168-acee-c175083a65cd',
});
```

---

### respondToChallenge()

Respond to authentication challenge (MFA, email verification, etc.).

```typescript
async respondToChallenge(dto: RespondChallengeDTO): Promise<AuthResponseDTO>
```

**Parameters**

- `dto` - [`RespondChallengeDTO`](../dto/respond-challenge-dto)

**Returns**

- [`AuthResponseDTO`](../dto/auth-response-dto) - Tokens if passed, next challenge if multi-step

**Errors**

| Code                        | When                   | Details                                                    |
| --------------------------- | ---------------------- | ---------------------------------------------------------- |
| `VALIDATION_FAILED`         | Invalid format/missing | `{ field?: string, expected?: string, provided?: string }` |
| `CHALLENGE_INVALID`         | Invalid session        | `{ sessionId?: string, userId?: string }`                  |
| `CHALLENGE_EXPIRED`         | Session expired        | `{ sessionId?: string, expiredAt?: string }`               |
| `CHALLENGE_TYPE_MISMATCH`   | Wrong challenge type   | `{ expected: string, provided: string }`                   |
| `VERIFICATION_CODE_INVALID` | Code incorrect         | `{ attemptsRemaining?: number }`                           |
| `VERIFICATION_CODE_EXPIRED` | Code expired           | `{ codeExpiredAt?: string }`                               |
| `WEAK_PASSWORD`             | Policy violation       | `{ errors: string[] }`                                     |
| `INTERNAL_ERROR`            | Service unavailable    | `{ service?: string }`                                     |

**Example**

```typescript
const dto = Object.assign(new RespondChallengeDTO(), {
  session: challengeSession,
  type: 'MFA_REQUIRED',
  code: '123456',
});
const result = await authService.respondToChallenge(dto);
```

---

### setMustChangePassword()

Force user to change password on next login.

```typescript
async setMustChangePassword(dto: SetMustChangePasswordDTO): Promise<SetMustChangePasswordResponseDTO>
```

**Parameters**

- `dto` - [`SetMustChangePasswordDTO`](../dto/set-must-change-password-dto)

**Returns**

- [`SetMustChangePasswordResponseDTO`](../dto/set-must-change-password-response-dto)

**Errors**

| Code                          | When                | Details               |
| ----------------------------- | ------------------- | --------------------- |
| `NOT_FOUND`                   | User not found      | `{ userId?: string }` |
| `PASSWORD_CHANGE_NOT_ALLOWED` | Social-only account | `{ reason?: string }` |

**Example**

```typescript
await authService.setMustChangePassword({
  userId: 'a21b654c-2746-4168-acee-c175083a65cd',
});
```

---

### signup()

Register new user account.

```typescript
async signup(dto: SignupDTO): Promise<AuthResponseDTO>
```

**Parameters**

- `dto` - [`SignupDTO`](../dto/signup-dto)

**Returns**

- [`AuthResponseDTO`](../dto/auth-response-dto) - Tokens if no verification needed, challenge if verification required

**Errors**

| Code              | When                       | Details                     |
| ----------------- | -------------------------- | --------------------------- |
| `SIGNUP_DISABLED` | Signups disabled           | `undefined`                 |
| `EMAIL_EXISTS`    | Email already registered   | `{ conflictType?: string }` |
| `USERNAME_EXISTS` | Username taken             | `undefined`                 |
| `PHONE_EXISTS`    | Phone already registered   | `undefined`                 |
| `WEAK_PASSWORD`   | Policy violation           | `{ errors: string[] }`      |
| `PHONE_REQUIRED`  | Phone required but missing | `undefined`                 |

**Example**

```typescript
const result = await authService.signup({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe',
});
```

---

### trustDevice()

Mark current device as trusted for MFA bypass.

```typescript
async trustDevice(): Promise<TrustDeviceResponseDTO>
```

**Returns**

- [`TrustDeviceResponseDTO`](../dto/trust-device-response-dto) - Device trust token

**Errors**

| Code                | When                      | Details                  |
| ------------------- | ------------------------- | ------------------------ |
| `FORBIDDEN`         | Not available in MFA mode | `{ reason?: string }`    |
| `INTERNAL_ERROR`    | Service unavailable       | `{ service?: string }`   |
| `SESSION_NOT_FOUND` | Session not found/revoked | `{ sessionId?: string }` |
| `NOT_FOUND`         | User not found            | `{ userId?: string }`    |

**Example**

```typescript
const result = await authService.trustDevice();
```

---

### updateUserAttributes()

Update user profile information.

```typescript
async updateUserAttributes(dto: UpdateUserAttributesRequestDTO): Promise<UserResponseDTO>
```

**Parameters**

- `dto` - [`UpdateUserAttributesRequestDTO`](../dto/update-user-attributes-request-dto)

**Returns**

- [`UserResponseDTO`](../dto/user-response-dto)

**Errors**

| Code                | When                     | Details                   |
| ------------------- | ------------------------ | ------------------------- |
| `NOT_FOUND`         | User not found           | `{ userId?: string }`     |
| `VALIDATION_FAILED` | Uniqueness violation     | `{ conflicts: string[] }` |
| `USERNAME_EXISTS`   | Username taken           | `undefined`               |
| `EMAIL_EXISTS`      | Email already registered | `undefined`               |
| `PHONE_EXISTS`      | Phone already registered | `undefined`               |

**Example**

```typescript
const updatedUser = await authService.updateUserAttributes({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
  username: 'newusername',
  firstName: 'John',
  lastName: 'Doe',
});
```

---

## Error Handling

All methods throw [`NAuthException`](../exceptions/nauth-exception) with structured error data.

```typescript
try {
  await authService.login(dto);
} catch (error) {
  if (error instanceof NAuthException) {
    console.log(error.code); // AuthErrorCode enum
    console.log(error.message); // Human-readable
    console.log(error.details); // Optional metadata
  }
}
```

See [Error Handling Guide](/docs/concepts/error-handling) for complete patterns.

---

## Related APIs

- [MFAService](./mfa-service) - Multi-factor authentication
- [EmailVerificationService](./email-verification-service) - Email verification
- [PhoneVerificationService](./phone-verification-service) - Phone verification
- [SocialAuthService](./social-auth-service) - Social authentication
- [NAuthException](../exceptions/nauth-exception) - Error handling
