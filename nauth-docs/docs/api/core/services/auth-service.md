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

### adminSignup()

Admin-only: Create user account with override capabilities.

```typescript
async adminSignup(dto: AdminSignupDTO): Promise<AdminSignupResponseDTO>
```

**Parameters**

- `dto` - [`AdminSignupDTO`](../dto/admin-signup-dto)

**Returns**

- [`AdminSignupResponseDTO`](../dto/admin-signup-dto)

**Errors**

| Code            | When                   | Details                |
| --------------- | ---------------------- | ---------------------- |
| `EMAIL_EXISTS`  | Email already exists   | `undefined`            |
| `USERNAME_EXISTS` | Username already exists | `undefined`            |
| `PHONE_EXISTS`  | Phone already exists   | `undefined`            |
| `WEAK_PASSWORD` | Policy violation       | `{ errors: string[] }` |

:::note Admin capabilities
- Bypass email/phone verification requirements
- Force password change on first login
- Auto-generate secure passwords
- Skip signup.enabled check
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private authService: AuthService) {}

  @Post('create-user')
  async createUser(@Body() dto: AdminSignupDTO) {
    return this.authService.adminSignup(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/create-user',
  nauth.helpers.requireAuth(),
  requireAdmin,
  async (req, res) => {
    const result = await nauth.authService.adminSignup(req.body);
    res.json(result);
  }
);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post('/admin/create-user',
  { preHandler: [nauth.helpers.requireAuth(), requireAdmin] },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.adminSignup(req.body);
  })
);
```

</TabItem>
</Tabs>

:::note
Admin authorization required. This method does not check admin status - protect routes with admin guards.
:::

---

### adminSetPassword()

Admin-only: Reset user password by identifier.

```typescript
async adminSetPassword(dto: AdminSetPasswordDTO): Promise<AdminSetPasswordResponseDTO>
```

**Parameters**

- `dto` - [`AdminSetPasswordDTO`](../dto/admin-set-password-dto)

**Returns**

- [`AdminSetPasswordResponseDTO`](../dto/admin-set-password-dto)

**Errors**

| Code                          | When                       | Details                |
| ----------------------------- | -------------------------- | ---------------------- |
| `NOT_FOUND`                   | User not found             | `undefined`            |
| `WEAK_PASSWORD`               | Policy violation           | `{ errors: string[] }` |
| `PASSWORD_REUSED`             | Password recently used     | `undefined`            |

::::note Social-first accounts
Admins can also use this method to **set the first password** for a social-only (social-first) account.
::::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private authService: AuthService) {}

  @Post('reset-password')
  async resetPassword(@Body() dto: AdminSetPasswordDTO) {
    return this.authService.adminSetPassword(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/reset-password',
  nauth.helpers.requireAuth(),
  requireAdmin,
  async (req, res) => {
    const result = await nauth.authService.adminSetPassword(req.body);
    res.json(result);
  }
);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post('/admin/reset-password',
  { preHandler: [nauth.helpers.requireAuth(), requireAdmin] },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.adminSetPassword(req.body);
  })
);
```

</TabItem>
</Tabs>

:::note
Admin authorization required. This method does not check admin status - protect routes with admin guards.
:::

---

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
| `NOT_FOUND`                   | User not found or no password | `{ userId?: string }`  |
| `PASSWORD_INCORRECT`          | Current password incorrect | `undefined`            |
| `WEAK_PASSWORD`               | Policy violation           | `{ errors: string[] }` |
| `PASSWORD_REUSED`             | Password recently used     | `undefined`            |
| `PASSWORD_CHANGE_NOT_ALLOWED` | Social-only account        | `undefined`            |

:::warning Social-only users
This method **requires an existing password**. Social-only users (users who signed up via OAuth and have no password) cannot use this method.

**For social-only users:**
- To **set your first password**: Use [`SocialAuthService.setPasswordForSocialUser()`](./social-auth-service) or the [`forgotPassword()`](#forgotpassword) + [`confirmForgotPassword()`](#confirmforgotpassword) flow
- After setting a password, you can use `changePassword()` like any other user
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
await authService.changePassword({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
  oldPassword: 'OldPass123!',
  newPassword: 'NewPass456!',
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/auth/change-password', async (req, res) => {
  const result = await nauth.authService.changePassword(req.body);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post('/auth/change-password', async (req, reply) => {
  const result = await nauth.authService.changePassword(req.body);
  reply.send(result);
});
```

</TabItem>
</Tabs>

---

### confirmForgotPassword()

Confirm password reset code and set a new password.

```typescript
async confirmForgotPassword(dto: ConfirmForgotPasswordDTO): Promise<ConfirmForgotPasswordResponseDTO>
```

**Parameters**

- `dto` - [`ConfirmForgotPasswordDTO`](../dto/forgot-password-dto)

**Returns**

- [`ConfirmForgotPasswordResponseDTO`](../dto/forgot-password-dto)

**Errors**

| Code | When | Details |
| ---- | ---- | ------- |
| `PASSWORD_RESET_CODE_INVALID` | Code invalid or no active reset | `undefined` |
| `PASSWORD_RESET_CODE_EXPIRED` | Code expired | `undefined` |
| `PASSWORD_RESET_MAX_ATTEMPTS` | Too many failed attempts | `undefined` |
| `WEAK_PASSWORD` | Policy violation | `{ errors: string[] }` |
| `PASSWORD_REUSED` | Password recently used | `undefined` |
| `SERVICE_UNAVAILABLE` | Password reset not configured | `undefined` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
await authService.confirmForgotPassword({
  identifier: 'user@example.com',
  code: '123456',
  newPassword: 'NewSecurePass123!',
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/auth/forgot-password/confirm', async (req, res) => {
  const result = await nauth.authService.confirmForgotPassword(req.body);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post('/auth/forgot-password/confirm', async (req, reply) => {
  const result = await nauth.authService.confirmForgotPassword(req.body);
  reply.send(result);
});
```

</TabItem>
</Tabs>

---

### forgotPassword()

Request a password reset code (account recovery).

::::note Social-first accounts
This flow can also be used by social-only (social-first) accounts to **set a first password** after proving delivery-channel ownership via the reset code.
::::

```typescript
async forgotPassword(dto: ForgotPasswordDTO): Promise<ForgotPasswordResponseDTO>
```

**Parameters**

- `dto` - [`ForgotPasswordDTO`](../dto/forgot-password-dto)

**Returns**

- [`ForgotPasswordResponseDTO`](../dto/forgot-password-dto)

**Errors**

| Code | When | Details |
| ---- | ---- | ------- |
| `RATE_LIMIT_PASSWORD_RESET` | Too many requests | `{ retryAfter: number, maxAttempts: number }` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
await authService.forgotPassword({
  identifier: 'user@example.com',
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/auth/forgot-password', async (req, res) => {
  const result = await nauth.authService.forgotPassword(req.body);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post('/auth/forgot-password', async (req, reply) => {
  const result = await nauth.authService.forgotPassword(req.body);
  reply.send(result);
});
```

</TabItem>
</Tabs>

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

:::note Internal use
This method is primarily for use by social auth providers. For general user lookup, use `getUserById()`.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const user = await authService.getUserByEmail({
  email: 'user@example.com',
  requireEmailVerified: true,
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const user = await nauth.authService.getUserByEmail({
  email: 'user@example.com',
  requireEmailVerified: true,
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const user = await nauth.authService.getUserByEmail({
  email: 'user@example.com',
  requireEmailVerified: true,
});
```

</TabItem>
</Tabs>

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

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const user = await authService.getUserById({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const user = await nauth.authService.getUserById({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const user = await nauth.authService.getUserById({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
});
```

</TabItem>
</Tabs>

---

### getUserForAuthContext()

Get user for authentication context with sensitive fields removed.

```typescript
async getUserForAuthContext(sub: string): Promise<IUser>
```

**Parameters**

- `sub` - External user identifier (UUID)

**Returns**

- `IUser` - User object with `hasPasswordHash` flag, without sensitive fields

**Errors**

| Code                | When              | Details       |
| ------------------- | ----------------- | ------------- |
| `NOT_FOUND`         | User not found    | `undefined`    |
| `ACCOUNT_INACTIVE`  | Account disabled  | `undefined`   |

:::note Internal use
This method is primarily used by AuthHandler and AuthGuard to load authenticated users. It ensures consistent user object shape across platforms (core + NestJS) with sensitive fields removed.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const user = await authService.getUserForAuthContext('user-uuid-123');
// user.hasPasswordHash === true/false
// user.passwordHash === undefined (removed)
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const user = await nauth.authService.getUserForAuthContext('user-uuid-123');
// user.hasPasswordHash === true/false
// user.passwordHash === undefined (removed)
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const user = await nauth.authService.getUserForAuthContext('user-uuid-123');
// user.hasPasswordHash === true/false
// user.passwordHash === undefined (removed)
```

</TabItem>
</Tabs>

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

- `dto` - [`LogoutDTO`](../dto/logout-dto) - Contains `sub` (user identifier) and optional `forgetMe` flag

**Returns**

- [`LogoutResponseDTO`](../dto/logout-response-dto)

**Errors**

| Code                | When                      | Details                  |
| ------------------- | ------------------------- | ------------------------ |
| `SESSION_NOT_FOUND` | Session not found/revoked | `{ sessionId?: string }` |

:::warning Authentication Required
This method requires the user to be authenticated. The endpoint is protected and cannot be called publicly. The `sub` field is automatically extracted from the authenticated user's JWT token by framework adapters.
:::

**Example**

```typescript
// Normal logout (device remains trusted)
await authService.logout({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
  forgetMe: false,
});

// Logout and forget device (device untrusted, MFA required on next login)
await authService.logout({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
  forgetMe: true,
});
```

---

### logoutAll()

Logout user from all sessions across all devices.

```typescript
async logoutAll(dto: LogoutAllDTO): Promise<LogoutAllResponseDTO>
```

**Parameters**

- `dto` - [`LogoutAllDTO`](../dto/logout-all-dto) - Contains `sub` (user identifier) and optional `forgetDevices` flag

**Returns**

- [`LogoutAllResponseDTO`](../dto/logout-all-response-dto) - Contains count of revoked sessions

**Errors**

| Code        | When           | Details               |
| ----------- | -------------- | --------------------- |
| `NOT_FOUND` | User not found | `{ userId?: string }` |

:::warning Authentication Required
This method requires the user to be authenticated. The endpoint is protected and cannot be called publicly. The `sub` field is automatically extracted from the authenticated user's JWT token by framework adapters.
:::

**Example**

```typescript
// Revoke all sessions but keep devices trusted
const result = await authService.logoutAll({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
  forgetDevices: false,
});

// Revoke all sessions AND all trusted devices
const result2 = await authService.logoutAll({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
  forgetDevices: true,
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

### isTrustedDevice()

Check whether the **current device** is trusted (eligible for trusted-device MFA bypass).

```typescript
async isTrustedDevice(): Promise<IsTrustedDeviceResponseDTO>
```

**Returns**

- [`IsTrustedDeviceResponseDTO`](../dto/is-trusted-device-response-dto) - `{ trusted: boolean }`

**Example**

```typescript
const result = await authService.isTrustedDevice();
// result.trusted === true | false
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

:::warning MFA Device Deletion
When updating `email` or `phone`, associated MFA devices are **automatically deleted** (cannot be reactivated):

- **Email change**: All Email MFA devices are permanently deleted (requires re-setup)
- **Phone change**: All SMS MFA devices with the old number are permanently deleted (requires re-setup)

If the deleted device(s) were the only MFA method(s), MFA is **disabled** for the user. They will need to set up MFA again at next login if MFA is required.

**Audit events** are logged for all device deletions with reason `email_changed` or `phone_changed`.
:::

**Best Practices**

- Set `retainVerification: true` only when transferring between trusted systems
- Notify users when their MFA devices are removed due to profile changes
- Guide users through MFA setup after email/phone changes if MFA is required

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
