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

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code              | When                                                              | Details                |
| ----------------- | ----------------------------------------------------------------- | ---------------------- |
| `NOT_FOUND`       | User not found                                                    | `undefined`            |
| `WEAK_PASSWORD`   | Policy violation                                                  | `{ errors: string[] }` |
| `PASSWORD_REUSED` | Only if `password.historyCount` is configured AND password reused | `undefined`            |

**WEAK_PASSWORD details**

Example strings returned in `errors`:

```json
{
  "errors": [
    "Password must be at least 8 characters long",
    "Password must contain at least one uppercase letter",
    "Password must contain at least one number",
    "Password must contain at least one special character !@#$%^&*()_+=[{}|;:,.<>?-]"
  ]
}
```

::::info Social accounts
Admins can also use this method to **set the first password** for a social-only (social-first) account. This makes the account both password + social enabled.
::::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private authService: AuthService) {}

  @Post('reset-password')
  async resetPassword(@Body() dto: AdminSetPasswordDTO) {
    // API should not be exposed to normal users, this is an admin function
    return this.authService.adminSetPassword(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/reset-password', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.authService.adminSetPassword(req.body);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/admin/reset-password',
  { preHandler: [nauth.helpers.requireAuth(), requireAdmin] },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.adminSetPassword(req.body);
  }),
);
```

</TabItem>
</Tabs>

:::warning Authorisation
Please ensure you implement Admin authorisation as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

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

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code              | When                                                                 | Details                               |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------- |
| `EMAIL_EXISTS`    | Email already exists                                                 | `undefined`                           |
| `USERNAME_EXISTS` | Username already exists                                              | `undefined`                           |
| `PHONE_EXISTS`    | Only if `signup.allowDuplicatePhones = false` AND phone provided     | `undefined`                           |
| `WEAK_PASSWORD`   | Policy violation OR password missing when `generatePassword = false` | `undefined` \| `{ errors: string[] }` |

**WEAK_PASSWORD details**

When password validation fails, `details` includes an array of error strings:

```json
{
  "errors": [
    "Password must be at least 8 characters long",
    "Password must contain at least one uppercase letter",
    "Password must contain at least one number",
    "Password must contain at least one special character !@#$%^&*()_+=[{}|;:,.<>?-]"
  ]
}
```

When `generatePassword = false` and `password` is missing, `details` is `undefined`.

:::note Admin capabilities

- Can Bypass email/phone verification requirements by setting _isPhoneVerified_ and _isEmailVerified_ to true
- Force password change on first login
- Auto-generate secure passwords
- Skip signup.enabled check
  :::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private authService: AuthService) {}

  @Post('create-user')
  async createUser(@Body() dto: AdminSignupDTO) {
    // API should not be exposed to normal users, this is an admin function
    return this.authService.adminSignup(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/create-user', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.authService.adminSignup(req.body);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/admin/create-user',
  { preHandler: [nauth.helpers.requireAuth(), requireAdmin] },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.adminSignup(req.body);
  }),
);
```

</TabItem>
</Tabs>

:::warning Authorisation
Please ensure you implement Admin authorisation as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

### adminSignupSocial()

Admin-only: Import social user from external platform with social account linkage.

```typescript
async adminSignupSocial(dto: AdminSignupSocialDTO): Promise<AdminSignupSocialResponseDTO>
```

**Parameters**

- `dto` - [`AdminSignupSocialDTO`](../dto/admin-signup-social-dto)

**Returns**

- [`AdminSignupSocialResponseDTO`](../dto/admin-signup-social-response-dto)

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                    | When                                                             | Details                               |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| `EMAIL_EXISTS`          | Email already exists                                             | `undefined`                           |
| `USERNAME_EXISTS`       | Username already exists                                          | `undefined`                           |
| `PHONE_EXISTS`          | Only if `signup.allowDuplicatePhones = false` AND phone provided | `undefined`                           |
| `SOCIAL_ACCOUNT_EXISTS` | Provider + providerId combination already exists                 | `undefined`                           |
| `SOCIAL_CONFIG_MISSING` | Social auth not configured                                       | `undefined`                           |
| `WEAK_PASSWORD`         | Policy violation (only if password provided)                     | `undefined` \| `{ errors: string[] }` |

**WEAK_PASSWORD details**

When password validation fails (only relevant for hybrid social+password accounts), `details` includes an array of error strings:

```json
{
  "errors": ["Password must be at least 8 characters long", "Password must contain at least one uppercase letter"]
}
```

:::note Admin capabilities

- Import social users with pre-linked social accounts
- Create social-only users (no password) or hybrid users (social + password)
- Email automatically verified (like normal social signup)
- Bypass phone verification requirement (optional)
- Suitable for migrating users from Cognito, Auth0, or other platforms
- Social account (provider + providerId) must be unique
- User flags `hasSocialAuth` and `socialProviders` automatically updated

:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private authService: AuthService) {}

  @Post('import-social-user')
  async importSocialUser(@Body() dto: AdminSignupSocialDTO) {
    // Import user from external platform (e.g., Cognito migration)
    return this.authService.adminSignupSocial(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/import-social-user', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.authService.adminSignupSocial(req.body);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/admin/import-social-user',
  { preHandler: [nauth.helpers.requireAuth(), requireAdmin] },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.adminSignupSocial(req.body);
  }),
);
```

</TabItem>
</Tabs>

**Use Case: Cognito Migration**

```typescript
// Migrate Cognito user with Google social login
// Note: Email is automatically verified for social imports (like normal social signup)
const result = await authService.adminSignupSocial({
  email: 'user@example.com',
  provider: 'google',
  providerId: cognitoUser.identities[0].userId,
  providerEmail: cognitoUser.identities[0].providerAttributes.email,
  socialMetadata: cognitoUser.identities[0].providerAttributes,
  firstName: cognitoUser.given_name,
  lastName: cognitoUser.family_name,
});
```

:::warning Authorization
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

### deleteUser()

Hard delete user with complete cascade cleanup. Permanently removes user and ALL associated data including sessions, verification tokens, MFA devices, trusted devices, social accounts, login attempts, challenge sessions, and audit logs.

```typescript
async deleteUser(dto: DeleteUserDTO): Promise<DeleteUserResponseDTO>
```

**Parameters**

- `dto` - [`DeleteUserDTO`](../dto/delete-user-dto)

**Returns**

- [`DeleteUserResponseDTO`](../dto/delete-user-response-dto) - Deletion confirmation with cascade counts

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code             | When                        | Details     |
| ---------------- | --------------------------- | ----------- |
| `USER_NOT_FOUND` | User with sub doesn't exist | `undefined` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
export class AdminService {
  constructor(private readonly authService: AuthService) {}

  async deleteUser(sub: string) {
    const result = await this.authService.deleteUser({ sub });
    console.log(`Deleted ${result.deletedRecords.sessions} sessions`);
    return result;
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.delete('/admin/users/:sub', async (req, res) => {
  const result = await nauth.authService.deleteUser({
    sub: req.params.sub,
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.delete(
  '/admin/users/:sub',
  { preHandler: nauth.helpers.adminOnly() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.deleteUser({ sub: req.params.sub });
  }),
);
```

</TabItem>
</Tabs>

:::warning Authorization
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

:::danger Irreversible Operation
This operation permanently deletes all user data and cannot be undone. All associated records (sessions, tokens, devices, etc.) are deleted from the database.
:::

---

### disableUser()

Administrative permanent account locking. Sets permanent lock (lockedUntil=NULL) and immediately revokes all active sessions. Reuses existing rate-limit lock fields.

```typescript
async disableUser(dto: DisableUserDTO): Promise<DisableUserResponseDTO>
```

**Parameters**

- `dto` - [`DisableUserDTO`](../dto/disable-user-dto)

**Returns**

- [`DisableUserResponseDTO`](../dto/disable-user-response-dto) - User object and revoked session count

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code             | When                        | Details     |
| ---------------- | --------------------------- | ----------- |
| `USER_NOT_FOUND` | User with sub doesn't exist | `undefined` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
export class AdminService {
  constructor(private readonly authService: AuthService) {}

  async disableUser(sub: string, reason: string) {
    const result = await this.authService.disableUser({ sub, reason });
    console.log(`Revoked ${result.revokedSessions} sessions`);
    return result;
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/users/:sub/disable', async (req, res) => {
  const result = await nauth.authService.disableUser({
    sub: req.params.sub,
    reason: req.body.reason,
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/admin/users/:sub/disable',
  { preHandler: nauth.helpers.adminOnly() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.disableUser({
      sub: req.params.sub,
      reason: req.body.reason,
    });
  }),
);
```

</TabItem>
</Tabs>

:::note Permanent vs Temporary Locks
Rate limiting sets temporary locks with `lockedUntil` = future date. Admin `disableUser()` sets `lockedUntil = NULL` for permanent locks.
:::

:::warning Authorization
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

### enableUser()

Administrative account unlocking. Clears all lock fields (isLocked, lockReason, lockedAt, lockedUntil) and resets failed login attempts counter. Reverses the effect of disableUser() or rate-limit lockouts.

```typescript
async enableUser(dto: EnableUserDTO): Promise<EnableUserResponseDTO>
```

**Parameters**

- `dto` - [`EnableUserDTO`](../dto/enable-user-dto)

**Returns**

- [`EnableUserResponseDTO`](../dto/enable-user-response-dto) - User object with updated lock status

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code             | When                        | Details     |
| ---------------- | --------------------------- | ----------- |
| `USER_NOT_FOUND` | User with sub doesn't exist | `undefined` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
export class AdminService {
  constructor(private readonly authService: AuthService) {}

  async enableUser(sub: string) {
    const result = await this.authService.enableUser({ sub });
    console.log(`User unlocked: ${result.user.email}`);
    return result;
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/users/:sub/enable', async (req, res) => {
  const result = await nauth.authService.enableUser({
    sub: req.params.sub,
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/admin/users/:sub/enable',
  { preHandler: nauth.helpers.adminOnly() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.enableUser({
      sub: req.params.sub,
    });
  }),
);
```

</TabItem>
</Tabs>

:::note Unlocking Accounts
This method clears all lock fields including temporary rate-limit locks. Use this to unlock accounts that were locked by either `disableUser()` or automatic rate limiting.
:::

:::warning Authorization
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

### changePassword()

Change user's password. Requires current password verification. All user sessions are revoked on successful password change.

```typescript
async changePassword(dto: ChangePasswordRequestDTO): Promise<ChangePasswordResponseDTO>
```

**Parameters**

- `dto` - [`ChangePasswordRequestDTO`](../dto/change-password-request-dto)

**Returns**

- [`ChangePasswordResponseDTO`](../dto/change-password-response-dto) - `{ success: boolean }`

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                          | When                                                              | Details                |
| ----------------------------- | ----------------------------------------------------------------- | ---------------------- |
| `NOT_FOUND`                   | User not found or no password                                     | `undefined`            |
| `PASSWORD_INCORRECT`          | Current password incorrect                                        | `undefined`            |
| `WEAK_PASSWORD`               | Policy violation                                                  | `{ errors: string[] }` |
| `PASSWORD_REUSED`             | Only if `password.historyCount` is configured AND password reused | `undefined`            |
| `PASSWORD_CHANGE_NOT_ALLOWED` | Only if `hooks.beforePasswordChange` hook returns false           | `undefined`            |

**WEAK_PASSWORD details**

When password validation fails, `details` includes an array of error strings:

```json
{
  "errors": [
    "Password must be at least 8 characters long",
    "Password must contain at least one uppercase letter",
    "Password must contain at least one number",
    "Password must contain at least one special character !@#$%^&*()_+=[{}|;:,.<>?-]"
  ]
}
```

:::info Social-only users
This method **requires an existing password**. Social-only users (users who signed up via OAuth and have no password) cannot use this method.

**For social-only users:**

- Users without a password (such as those registered via OAuth/social login) can **set their initial password** by using either the [`SocialAuthService.setPasswordForSocialUser()`](./social-auth-service) method or the [`forgotPassword()`](#forgotpassword) and [`confirmForgotPassword()`](#confirmforgotpassword) flow.
- Once a password has been set, the `changePassword()` method is available for future password changes.

An administrator can also assign a password using the `adminSetPassword()` function.
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

Confirm password reset code and set a new password. All user sessions are revoked on successful password reset.

```typescript
async confirmForgotPassword(dto: ConfirmForgotPasswordDTO): Promise<ConfirmForgotPasswordResponseDTO>
```

**Parameters**

- `dto` - [`ConfirmForgotPasswordDTO`](../dto/forgot-password-dto)

**Returns**

- [`ConfirmForgotPasswordResponseDTO`](../dto/forgot-password-dto) - `{ success: boolean, mustChangePassword: boolean }`

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                          | When                                                                                           | Details                |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------- |
| `SERVICE_UNAVAILABLE`         | Password reset service not available (framework adapter setup issue - email provider required) | `undefined`            |
| `PASSWORD_RESET_CODE_INVALID` | Code invalid, user not found, or no active reset token                                         | `undefined`            |
| `PASSWORD_RESET_CODE_EXPIRED` | Code expired                                                                                   | `undefined`            |
| `PASSWORD_RESET_MAX_ATTEMPTS` | Only if `password.passwordReset.maxAttempts` exceeded (default: 3)                             | `undefined`            |
| `WEAK_PASSWORD`               | Policy violation                                                                               | `{ errors: string[] }` |
| `PASSWORD_REUSED`             | Only if `password.historyCount` is configured AND password reused                              | `undefined`            |

**SERVICE_UNAVAILABLE details**

This error indicates that `PasswordResetService` was not injected into `AuthService` during framework adapter initialization. This typically occurs when:

- The framework adapter (NestJS/Express/Fastify) was not properly configured with an email provider
- `AuthService` was manually instantiated without providing `passwordResetService`
- There is a framework adapter setup issue

**Note:** This is a framework adapter configuration issue, not a consumer application configuration. If you encounter this error, check your framework adapter setup and ensure email provider packages are installed and configured.

**WEAK_PASSWORD details**

When password validation fails, `details` includes an array of error strings:

```json
{
  "errors": [
    "Password must be at least 8 characters long",
    "Password must contain at least one uppercase letter",
    "Password must contain at least one number",
    "Password must contain at least one special character !@#$%^&*()_+=[{}|;:,.<>?-]"
  ]
}
```

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

Request a password reset code (account recovery). This method is **non-enumerating**—it always returns success even if the user doesn't exist, to prevent account enumeration attacks.

::::note Social accounts
This flow can also be used by social-only (social-first) accounts to **set a first password** after proving ownership via the reset code.
::::

```typescript
async forgotPassword(dto: ForgotPasswordDTO): Promise<ForgotPasswordResponseDTO>
```

**Parameters**

- `dto` - [`ForgotPasswordDTO`](../dto/forgot-password-dto)

**Returns**

- [`ForgotPasswordResponseDTO`](../dto/forgot-password-dto) - `{ success: boolean, destination?: string, deliveryMedium?: 'email' | 'sms', expiresIn?: number }`

**Response Behavior**

- Always returns `{ success: true }` when the request is accepted (non-enumerating)
- `destination`, `deliveryMedium`, and `expiresIn` are only included when a reset code is successfully sent
- Returns success without sending if:
  - `passwordResetService` is not configured
  - User not found
  - Identifier type doesn't match configuration
  - No verified delivery channel available (email/phone) based on `signup.verificationMethod`

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                        | When                                                                                                                      | Details                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `RATE_LIMIT_PASSWORD_RESET` | Only if `password.passwordReset.rateLimitMax` exceeded (default: 3 requests per `rateLimitWindow` seconds, default: 3600) | `{ retryAfter: number, maxAttempts: number }` |

**RATE_LIMIT_PASSWORD_RESET details**

When rate limit is exceeded, `details` includes:

```json
{
  "retryAfter": 3600,
  "maxAttempts": 3
}
```

- `retryAfter`: Seconds until the rate limit window resets
- `maxAttempts`: Maximum number of requests allowed per window

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

Retrieve user by email address. Returns `null` if user not found or if `requireEmailVerified` is `true` and email is not verified.

```typescript
async getUserByEmail(dto: GetUserByEmailDTO): Promise<UserResponseDto | null>
```

**Parameters**

- `dto` - [`GetUserByEmailDTO`](../dto/get-user-by-email-dto)

**Returns**

- [`UserResponseDto`](../dto/user-response-dto) or `null` if not found or email verification requirement not met

**Errors**

Errors: None. This method returns `null` instead of throwing when user is not found.

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

Retrieve user by unique identifier (sub). Returns `null` if user not found.

```typescript
async getUserById(dto: GetUserByIdDTO): Promise<UserResponseDto | null>
```

**Parameters**

- `dto` - [`GetUserByIdDTO`](../dto/get-user-by-id-dto)

**Returns**

- [`UserResponseDto`](../dto/user-response-dto) or `null` if not found

**Errors**

Errors: None. This method returns `null` instead of throwing when user is not found.

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

Get user for authentication context with sensitive fields removed. This method ensures consistent user object shape across platforms (core + NestJS) with sensitive fields removed and `hasPasswordHash` flag added.

```typescript
async getUserForAuthContext(sub: string): Promise<IUser>
```

**Parameters**

- `sub` - External user identifier (UUID v4)

**Returns**

- `IUser` - User object with `hasPasswordHash` flag, without sensitive fields (`passwordHash`, `totpSecret`, `backupCodes`, `passwordHistory`)

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code               | When             | Details     |
| ------------------ | ---------------- | ----------- |
| `NOT_FOUND`        | User not found   | `undefined` |
| `ACCOUNT_INACTIVE` | Account disabled | `undefined` |

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

### getUserSessions()

Get all active sessions for a user. Returns session details including device info, location, authentication method, and timestamps. Current session is marked with `isCurrent: true`.

```typescript
async getUserSessions(dto: GetUserSessionsDTO): Promise<GetUserSessionsResponseDTO>
```

**Parameters**

- `dto` - [`GetUserSessionsDTO`](../dto/get-user-sessions-dto) - Contains user `sub` identifier

**Returns**

- [`GetUserSessionsResponseDTO`](../dto/get-user-sessions-response-dto) - Array of sessions with device info, location, auth method, and `isCurrent` flag

**Behavior**

- Returns all active sessions for the specified user
- Current session (if called from authenticated context) is marked with `isCurrent: true`
- Includes device information (name, type, platform, browser) when available
- Includes location information (IP address, country, city) when available
- Includes authentication method (password, social, admin) and OAuth provider for social logins

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code        | When           | Details     |
| ----------- | -------------- | ----------- |
| `NOT_FOUND` | User not found | `undefined` |

:::warning Authentication Required
This method requires authentication. For user endpoints, extract `sub` from authenticated user context. For admin endpoints, protect with admin guards and accept `sub` from route parameter.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@UseGuards(AuthGuard)
@Get('sessions')
async getSessions(@CurrentUser() user: IUser) {
  return this.authService.getUserSessions({ sub: user.sub });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/sessions', nauth.helpers.requireAuth(), async (req, res) => {
  const user = nauth.helpers.getCurrentUser();
  const result = await nauth.authService.getUserSessions({ sub: user.sub });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/sessions',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async () => {
    const user = nauth.helpers.getCurrentUser();
    return nauth.authService.getUserSessions({ sub: user.sub });
  }),
);
```

</TabItem>
</Tabs>

---

### getUsers()

Get paginated list of users with advanced filtering. Supports pagination, boolean filters, exact match filters, date filters with operators (gt, gte, lt, lte, eq), and flexible sorting.

```typescript
async getUsers(dto: GetUsersDTO): Promise<GetUsersResponseDTO>
```

**Parameters**

- `dto` - [`GetUsersDTO`](../dto/get-users-dto)

**Returns**

- [`GetUsersResponseDTO`](../dto/get-users-response-dto) - Paginated user list with metadata

**Errors**

This method does not throw errors. Returns empty results if no users match filters.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
export class AdminService {
  constructor(private readonly authService: AuthService) {}

  async listUsers(page: number, limit: number) {
    const result = await this.authService.getUsers({
      page,
      limit,
      isEmailVerified: true,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });
    return result;
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/admin/users', async (req, res) => {
  const result = await nauth.authService.getUsers({
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    email: req.query.email,
    isEmailVerified: req.query.isEmailVerified === 'true',
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/admin/users',
  { preHandler: nauth.helpers.adminOnly() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.getUsers({
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      isEmailVerified: req.query.isEmailVerified,
      hasSocialAuth: req.query.hasSocialAuth,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'DESC',
    });
  }),
);
```

</TabItem>
</Tabs>

:::note Data Privacy
Returns sanitized user data (no `passwordHash`, secrets, or sensitive fields). All users have access to standard `UserResponseDto` fields only.
:::

:::warning Authorization
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

### isTrustedDevice()

Check whether the **current device** is trusted (eligible for trusted-device MFA bypass). Requires an authenticated session (sessionId must be present in request context).

```typescript
async isTrustedDevice(): Promise<IsTrustedDeviceResponseDTO>
```

**Returns**

- [`IsTrustedDeviceResponseDTO`](../dto/is-trusted-device-response-dto) - `{ trusted: boolean }`

**Behavior**

- Returns `{ trusted: false }` if `trustedDeviceService` is not configured
- Returns `{ trusted: false }` if no device token is present
- Returns `{ trusted: true }` if device token is valid and trust has not expired
- Requires authenticated session (sessionId from JWT token in request context)

**Device Token Delivery**

The device token is read from request context, which varies by token delivery mode:

- **Cookies mode**: Device token is automatically sent via `nauth_device_token` httpOnly cookie (no client action required)
- **JSON mode**: Client must send device token in `X-Device-Token` header (default header name, configurable via `deviceTrust.headerName`). The frontend SDK automatically handles this.

The method behavior is identical in both modes—the difference is only in how the device token is transmitted to the server.

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                | When                                                                    | Details     |
| ------------------- | ----------------------------------------------------------------------- | ----------- |
| `SESSION_NOT_FOUND` | Session ID not found in request context OR session not found or revoked | `undefined` |
| `NOT_FOUND`         | User not found                                                          | `undefined` |

**Example**

```typescript
const result = await authService.isTrustedDevice();
// result.trusted === true | false
```

---

### login()

Authenticate user with email, username, or phone. Returns tokens on success or challenge information when verification/MFA is required. Response body format varies by `tokenDelivery.method` configuration.

```typescript
async login(dto: LoginDTO): Promise<AuthResponseDTO>
```

**Parameters**

- `dto` - [`LoginDTO`](../dto/login-dto)

**Returns**

- [`AuthResponseDTO`](../dto/auth-response-dto) - Response format depends on outcome and `tokenDelivery.method`:
  - **Success (JSON mode)**: Contains `accessToken`, `refreshToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `user`, `authMethod`, `trusted`, `deviceToken` (if trusted)
  - **Success (Cookies mode)**: Contains `user`, `authMethod`, `trusted`, `deviceToken` (if trusted). Tokens are delivered via httpOnly cookies only.
  - **Challenge**: Contains `challengeName`, `session`, `challengeParameters`, `userSub` (same format regardless of tokenDelivery method)
  - **Blocked**: Throws exception (no response body)

**Response Variations by Token Delivery Mode**

| Mode                                            | Success Response Body                                                                                                  | Challenge Response Body                                    | Notes                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| **JSON** (`tokenDelivery.method: 'json'`)       | `{ accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt, user, authMethod, trusted?, deviceToken? }` | `{ challengeName, session, challengeParameters, userSub }` | Tokens present in response body; client must store securely                 |
| **Cookies** (`tokenDelivery.method: 'cookies'`) | `{ user, authMethod, trusted?, deviceToken? }` (tokens removed)                                                        | `{ challengeName, session, challengeParameters, userSub }` | Tokens NOT in body (httpOnly cookies only); client reads via secure context |
| **Hybrid** (`tokenDelivery.method: 'hybrid'`)   | Depends on `hybridPolicy`: web=cookies, mobile=json                                                                    | `{ challengeName, session, challengeParameters, userSub }` | Policy-driven: web clients get cookies, mobile/API gets JSON tokens         |

:::note Token Delivery
If client checks `result.accessToken`, behavior differs by `tokenDelivery.method`. In cookies mode, tokens are NOT in the response body—they're in httpOnly cookies set by framework adapters.
:::

**Possible Outcomes**

| Outcome                          | When                                                                                              | Response Body                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Success**                      | Credentials valid, no challenges required, risk assessment passes                                 | Tokens + user data (format depends on `tokenDelivery.method`)                       |
| **Email verification challenge** | Email not verified AND `emailVerification.required = true`                                        | `{ challengeName: 'VERIFY_EMAIL', session, challengeParameters, userSub }`          |
| **Phone verification challenge** | Phone not verified AND `phoneVerification.required = true`                                        | `{ challengeName: 'VERIFY_PHONE', session, challengeParameters, userSub }`          |
| **MFA setup challenge**          | MFA required AND user has no MFA device configured                                                | `{ challengeName: 'MFA_SETUP_REQUIRED', session, challengeParameters, userSub }`    |
| **MFA verification challenge**   | MFA required AND user has MFA device configured                                                   | `{ challengeName: 'MFA_REQUIRED', session, challengeParameters, userSub }`          |
| **Force password change**        | Password expired (>= `password.expiryDays` old) OR `mustChangePassword` flag set                  | `{ challengeName: 'FORCE_CHANGE_PASSWORD', session, challengeParameters, userSub }` |
| **Blocked (adaptive risk)**      | `mfa.adaptive.enabled = true` AND risk score exceeds threshold AND `blockedSignIn.enabled = true` | **Throws** `SIGNIN_BLOCKED_HIGH_RISK` (no body returned)                            |

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                       | When                                                                                           | Details                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `INVALID_CREDENTIALS`      | Invalid password/user not found OR identifier type mismatch (if `login.identifierType` is set) | `undefined` \| `{ suggestedProvider: string }` |
| `ACCOUNT_INACTIVE`         | User account `isActive = false`                                                                | `undefined`                                    |
| `RATE_LIMIT_LOGIN`         | Only if `lockout.enabled = true` AND IP has exceeded max failed attempts                       | `undefined`                                    |
| `SIGNIN_BLOCKED_HIGH_RISK` | Only if `mfa.adaptive.enabled = true` AND risk score exceeds threshold                         | `{ expiresAt?: Date }`                         |
| `INTERNAL_ERROR`           | State machine error (rare)                                                                     | `undefined`                                    |

**INVALID_CREDENTIALS details**

When the account exists but has no password (social-first account), `details` may include a suggested provider:

```json
{
  "suggestedProvider": "Google"
}
```

**SIGNIN_BLOCKED_HIGH_RISK details**

Only thrown if adaptive MFA is enabled (`mfa.adaptive.enabled = true`) AND risk evaluation determines the login is too risky. Includes optional expiry time:

```json
{
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Post('login')
async login(@Body() dto: LoginDTO) {
  return await this.authService.login(dto);
  // Framework adapter handles token delivery based on tokenDelivery.method config
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/login', async (req, res) => {
  const result = await nauth.authService.login(req.body);
  res.json(result);
  // Framework adapter handles token delivery based on tokenDelivery.method config
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/login',
  { preHandler: nauth.helpers.public() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.login(req.body);
    // Framework adapter handles token delivery based on tokenDelivery.method config
  }),
);
```

</TabItem>
</Tabs>

**Example Response (JSON mode)**

Success:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "accessTokenExpiresAt": 1730000000,
  "refreshTokenExpiresAt": 1732592000,
  "authMethod": "password",
  "trusted": true,
  "deviceToken": "a21b654c-2746-4168-acee-c175083a65cd",
  "user": {
    "sub": "b32c765d-3857-5279-bdff-d286194b76de",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

Challenge:

```json
{
  "challengeName": "MFA_REQUIRED",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "methods": ["totp", "sms"]
  },
  "userSub": "b32c765d-3857-5279-bdff-d286194b76de"
}
```

**Example Response (Cookies mode)**

Success (tokens in httpOnly cookies, not in body):

```json
{
  "authMethod": "password",
  "trusted": true,
  "deviceToken": "a21b654c-2746-4168-acee-c175083a65cd",
  "user": {
    "sub": "b32c765d-3857-5279-bdff-d286194b76de",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

Challenge (same format as JSON mode):

```json
{
  "challengeName": "MFA_REQUIRED",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "methods": ["totp", "sms"]
  },
  "userSub": "b32c765d-3857-5279-bdff-d286194b76de"
}
```

---

### logout()

Logout user from current session. Revokes the session and optionally removes trusted device if `forgetMe` is `true`.

```typescript
async logout(dto: LogoutDTO): Promise<LogoutResponseDTO>
```

**Parameters**

- `dto` - [`LogoutDTO`](../dto/logout-dto) - Contains optional `sub` (user identifier for validation) and optional `forgetMe` flag

**Returns**

- [`LogoutResponseDTO`](../dto/logout-response-dto) - `{ success: boolean }`

**Behavior**

- Revokes the current authenticated session
- If `forgetMe` is `true` and trusted device feature is enabled, also revokes the trusted device token
- Session ID is automatically extracted from JWT token in request context
- The `sub` field is optional and can be provided for additional validation

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                | When                                                                | Details     |
| ------------------- | ------------------------------------------------------------------- | ----------- |
| `SESSION_NOT_FOUND` | Session ID not found in request context (request not authenticated) | `undefined` |

:::warning Authentication Required
This method requires the user to be authenticated. The endpoint is protected and cannot be called publicly. The session ID is automatically extracted from the authenticated user's JWT token by framework adapters.
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

Logout user from all sessions across all devices (global signout). Optionally revokes all trusted devices if `forgetDevices` is `true`.

```typescript
async logoutAll(dto: LogoutAllDTO): Promise<LogoutAllResponseDTO>
```

**Parameters**

- `dto` - [`LogoutAllDTO`](../dto/logout-all-dto) - Contains `sub` (user identifier) and optional `forgetDevices` flag

**Returns**

- [`LogoutAllResponseDTO`](../dto/logout-all-response-dto) - `{ revokedCount: number }` - Number of sessions revoked

**Behavior**

- Revokes all sessions for the user across all devices
- If `forgetDevices` is `true` and trusted device feature is enabled, also revokes all trusted devices for the user
- Returns the count of revoked sessions
- Device revocation errors are non-blocking (logged but operation continues)

**Usage Patterns**

- **User-initiated**: User logs out from all their own sessions (protected endpoint, user provides their own sub)
- **Admin-initiated**: Admin force-logs out any user (admin-protected endpoint, admin provides target user's sub)

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code        | When           | Details     |
| ----------- | -------------- | ----------- |
| `NOT_FOUND` | User not found | `undefined` |

:::warning Authentication Required
This method requires authentication. For user endpoints, extract `sub` from authenticated user context. For admin endpoints, protect with admin guards and accept `sub` from route parameter.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
// User-initiated (user context)
@UseGuards(AuthGuard)
@Post('logout/all')
async logoutAll(@CurrentUser() user: IUser, @Body() body: { forgetDevices?: boolean }) {
  return this.authService.logoutAll({ sub: user.sub, forgetDevices: body.forgetDevices });
}

// Admin-initiated (admin manages any user)
@UseGuards(AuthGuard, AdminGuard)
@Post('admin/users/:sub/logout-all')
async adminLogoutAll(@Param('sub') sub: string, @Body() body: { forgetDevices?: boolean }) {
  return this.authService.logoutAll({ sub, forgetDevices: body.forgetDevices });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
// User-initiated
app.post('/logout/all', nauth.helpers.requireAuth(), async (req, res) => {
  const user = nauth.helpers.getCurrentUser();
  const result = await nauth.authService.logoutAll({
    sub: user.sub,
    forgetDevices: req.body.forgetDevices,
  });
  res.json(result);
});

// Admin-initiated
app.post('/admin/users/:sub/logout-all', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.authService.logoutAll({
    sub: req.params.sub,
    forgetDevices: req.body.forgetDevices,
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
// User-initiated
fastify.post(
  '/logout/all',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const user = nauth.helpers.getCurrentUser();
    return nauth.authService.logoutAll({
      sub: user.sub,
      forgetDevices: req.body.forgetDevices,
    });
  }),
);

// Admin-initiated
fastify.post(
  '/admin/users/:sub/logout-all',
  { preHandler: [nauth.helpers.requireAuth(), requireAdmin] },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.logoutAll({
      sub: req.params.sub,
      forgetDevices: req.body.forgetDevices,
    });
  }),
);
```

</TabItem>
</Tabs>

---

### logoutSession()

Logout from a specific session by session ID. Validates session ownership for security. Automatically clears cookies if logging out the current session.

```typescript
async logoutSession(dto: LogoutSessionDTO): Promise<LogoutSessionResponseDTO>
```

**Parameters**

- `dto` - [`LogoutSessionDTO`](../dto/logout-session-dto) - Contains `sessionId` and user `sub` identifier

**Returns**

- [`LogoutSessionResponseDTO`](../dto/logout-session-response-dto) - `{ success: boolean, wasCurrentSession: boolean }`

**Behavior**

- Revokes the specified session for the user
- Validates session belongs to user (prevents unauthorized session revocation)
- Automatically clears cookies if the revoked session was the current session
- Returns `wasCurrentSession: true` if the revoked session was the current session

**Usage Patterns**

- **User logging out own session**: User revokes specific session (protected endpoint, user provides their own sub)
- **Admin revoking any user's session**: Admin revokes specific session for any user (admin-protected endpoint, admin provides target user's sub)

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                | When                            | Details     |
| ------------------- | ------------------------------- | ----------- |
| `NOT_FOUND`         | User not found                  | `undefined` |
| `SESSION_NOT_FOUND` | Session not found               | `undefined` |
| `FORBIDDEN`         | Session does not belong to user | `undefined` |

:::warning Authentication Required
This method requires authentication. For user endpoints, extract `sub` from authenticated user context. For admin endpoints, protect with admin guards and accept `sub` from route parameter. Session ownership is validated automatically.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
// User logging out own session
@UseGuards(AuthGuard)
@Delete('sessions/:sessionId')
async logoutSession(@CurrentUser() user: IUser, @Param('sessionId') sessionId: string) {
  return this.authService.logoutSession({ sub: user.sub, sessionId });
}

// Admin revoking any user's session
@UseGuards(AuthGuard, AdminGuard)
@Delete('admin/users/:sub/sessions/:sessionId')
async adminRevokeSession(@Param('sub') sub: string, @Param('sessionId') sessionId: string) {
  return this.authService.logoutSession({ sub, sessionId });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
// User logging out own session
app.delete('/sessions/:sessionId', nauth.helpers.requireAuth(), async (req, res) => {
  const user = nauth.helpers.getCurrentUser();
  const result = await nauth.authService.logoutSession({
    sub: user.sub,
    sessionId: req.params.sessionId,
  });
  res.json(result);
});

// Admin revoking any user's session
app.delete('/admin/users/:sub/sessions/:sessionId', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.authService.logoutSession({
    sub: req.params.sub,
    sessionId: req.params.sessionId,
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
// User logging out own session
fastify.delete(
  '/sessions/:sessionId',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const user = nauth.helpers.getCurrentUser();
    return nauth.authService.logoutSession({
      sub: user.sub,
      sessionId: req.params.sessionId,
    });
  }),
);

// Admin revoking any user's session
fastify.delete(
  '/admin/users/:sub/sessions/:sessionId',
  { preHandler: [nauth.helpers.requireAuth(), requireAdmin] },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.logoutSession({
      sub: req.params.sub,
      sessionId: req.params.sessionId,
    });
  }),
);
```

</TabItem>
</Tabs>

---

### refreshToken()

Generate new access token using refresh token. Implements secure token rotation with distributed locking and reuse detection to prevent race conditions and replay attacks.

```typescript
async refreshToken(dto: RefreshTokenDTO): Promise<TokenResponse>
```

**Parameters**

- `dto` - [`RefreshTokenDTO`](../dto/refresh-token-dto)

**Returns**

- [`TokenResponse`](../dto/auth-response-dto) - `{ accessToken: string, refreshToken: string, accessTokenExpiresAt: number, refreshTokenExpiresAt: number }`

**Response Variations by Token Delivery Mode**

| Mode                                            | Response Body                                                                     | Notes                                                                                                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JSON** (`tokenDelivery.method: 'json'`)       | `{ accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt }`      | Tokens present in response body; client must store securely                                                                                                                                    |
| **Cookies** (`tokenDelivery.method: 'cookies'`) | `{}` (empty object - tokens removed)                                              | Tokens NOT in body (httpOnly cookies only); client reads via secure context                                                                                                                    |
| **Hybrid** (`tokenDelivery.method: 'hybrid'`)   | Depends on `hybridPolicy`: web=cookies (empty body), mobile=json (tokens in body) | Policy-driven: web clients get cookies, mobile/API gets JSON tokens. See [Token Delivery Modes](/docs/features/token-delivery) and [Token Management](/docs/concepts/token-management) guides. |

**Behavior**

- Uses distributed locking to prevent concurrent refresh attempts for the same session
- Implements token rotation (old tokens are invalidated when new ones are issued)
- Detects token reuse attempts and revokes affected sessions
- Returns current tokens if cookie race condition is detected (same session, legitimate duplicate request)

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                | When                                                                                       | Details                  |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------------ |
| `TOKEN_INVALID`     | Invalid/malformed token, expired token, or token already used (reuse detected)             | `undefined`              |
| `SESSION_NOT_FOUND` | Session not found/revoked                                                                  | `undefined`              |
| `RATE_LIMIT_LOGIN`  | Only if distributed lock cannot be acquired (refresh already in progress for same session) | `{ retryAfter: number }` |
| `NOT_FOUND`         | User not found (internal error)                                                            | `undefined`              |

**Example**

```typescript
const tokens = await authService.refreshToken({
  refreshToken: 'eyJhbGci...',
});
```

---

### resendCode()

Resend verification code via email or SMS for the current challenge session. Supports `VERIFY_EMAIL`, `VERIFY_PHONE`, and `MFA_REQUIRED` (SMS/Email methods only).

```typescript
async resendCode(dto: ResendCodeDTO): Promise<ResendCodeResponseDTO>
```

**Parameters**

- `dto` - [`ResendCodeDTO`](../dto/resend-code-dto)

**Returns**

- [`ResendCodeResponseDTO`](../dto/resend-code-response-dto) - `{ destination: string }` - Masked destination where code was sent (e.g., `u***r@example.com` or `+1***5678`)

**Behavior**

- Resends code for the challenge type specified in the session
- For `VERIFY_PHONE`: Requires phone number to be provided first (via `respondToChallenge` with `phone` field)
- For `MFA_REQUIRED`: Only supports SMS and Email methods (TOTP/Passkey methods don't support code resending)
- Enforces resend delay (default: 60 seconds) to prevent abuse
- Returns masked destination for privacy

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                | When                                                                                                                        | Details                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `CHALLENGE_INVALID` | Challenge session not found or invalid                                                                                      | `undefined`                                    |
| `CHALLENGE_EXPIRED` | Challenge session expired                                                                                                   | `undefined`                                    |
| `VALIDATION_FAILED` | Challenge session has no user, phone not provided (VERIFY_PHONE), method not specified (MFA), or unsupported challenge type | `undefined`                                    |
| `RATE_LIMIT_RESEND` | Only if resend delay not met (default: 60 seconds since last code sent)                                                     | `{ retryAfter: number, resendDelay?: number }` |
| `INTERNAL_ERROR`    | Framework adapter setup issue: phone verification service or MFA service not configured                                     | `undefined`                                    |

**RATE_LIMIT_RESEND details**

When resend delay is not met, `details` includes:

```json
{
  "retryAfter": 45,
  "resendDelay": 60
}
```

- `retryAfter`: Seconds until resend is allowed
- `resendDelay`: Configured resend delay in seconds (default: 60)

**Example**

```typescript
const result = await authService.resendCode({
  session: 'a21b654c-2746-4168-acee-c175083a65cd',
});
```

---

### respondToChallenge()

Respond to authentication challenge (MFA, email verification, phone verification, password change, MFA setup).

Supports multiple challenge types:

- `VERIFY_EMAIL`: Verify email address with code
- `VERIFY_PHONE`: Collect phone number or verify with code
- `MFA_REQUIRED`: Verify MFA code (SMS, Email, TOTP, Passkey, Backup)
- `FORCE_CHANGE_PASSWORD`: Change password when forced
- `MFA_SETUP_REQUIRED`: Complete MFA device setup

```typescript
async respondToChallenge(dto: RespondChallengeDTO): Promise<AuthResponseDTO>
```

**Parameters**

- `dto` - [`RespondChallengeDTO`](../dto/respond-challenge-dto)

**Returns**

- [`AuthResponseDTO`](../dto/auth-response-dto) - Response format depends on outcome and `tokenDelivery.method`:
  - **Success (JSON mode)**: Contains `accessToken`, `refreshToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `user`, `authMethod`, `trusted`, `deviceToken` (if trusted)
  - **Success (Cookies mode)**: Contains `user`, `authMethod`, `trusted`, `deviceToken` (if trusted). Tokens are delivered via httpOnly cookies only.
  - **Challenge**: Contains `challengeName`, `session`, `challengeParameters`, `userSub` (same format regardless of tokenDelivery method)

**Response Variations by Token Delivery Mode**

| Mode                                            | Success Response Body                                                                                                  | Challenge Response Body                                    | Notes                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| **JSON** (`tokenDelivery.method: 'json'`)       | `{ accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt, user, authMethod, trusted?, deviceToken? }` | `{ challengeName, session, challengeParameters, userSub }` | Tokens present in response body; client must store securely                 |
| **Cookies** (`tokenDelivery.method: 'cookies'`) | `{ user, authMethod, trusted?, deviceToken? }` (tokens removed)                                                        | `{ challengeName, session, challengeParameters, userSub }` | Tokens NOT in body (httpOnly cookies only); client reads via secure context |
| **Hybrid** (`tokenDelivery.method: 'hybrid'`)   | Depends on `hybridPolicy`: web=cookies, mobile=json                                                                    | `{ challengeName, session, challengeParameters, userSub }` | Policy-driven: web clients get cookies, mobile/API gets JSON tokens         |

**Phone Verification Notes:**

For `VERIFY_PHONE` challenges, the `phone` field can be used to:

- **Collect** a phone number when user has none (e.g., social signup)
- **Update** an existing phone number if user entered wrong number during signup

The backend accepts phone updates unconditionally during the challenge, regardless of whether the user already has a phone number. When a phone is provided, the backend:

1. Updates the user's phone number in the database
2. Sends a verification SMS to the new/updated phone number
3. Returns the same `VERIFY_PHONE` challenge for code verification

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                             | When                                                                                           | Details                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `VALIDATION_FAILED`              | Invalid format/missing fields, challenge type mismatch, or unknown challenge type              | `{ field?: string, fields?: string[] }`                             |
| `CHALLENGE_INVALID`              | Challenge session not found, user not found in session, or passkey challenge missing (MFA)     | `undefined`                                                         |
| `CHALLENGE_EXPIRED`              | Challenge session expired                                                                      | `undefined`                                                         |
| `CHALLENGE_ALREADY_COMPLETED`    | Challenge session already completed                                                            | `undefined`                                                         |
| `VERIFICATION_CODE_INVALID`      | Verification code incorrect (email, phone, or MFA)                                             | `undefined` (email/MFA) or `{ attemptsRemaining?: number }` (phone) |
| `VERIFICATION_CODE_EXPIRED`      | Verification code expired (from email/phone verification services)                             | `undefined`                                                         |
| `VERIFICATION_TOO_MANY_ATTEMPTS` | Too many failed verification attempts (phone verification only)                                | `{ maxAttempts: number, currentAttempts: number }`                  |
| `INVALID_PHONE_FORMAT`           | Phone number format invalid (E.164 format required)                                            | `undefined`                                                         |
| `PHONE_REQUIRED`                 | Phone number required but not provided (from phone verification service)                       | `undefined`                                                         |
| `NOT_FOUND`                      | User not found after verification/setup or during MFA verification                             | `undefined`                                                         |
| `WEAK_PASSWORD`                  | Password policy violation (FORCE_CHANGE_PASSWORD challenge only)                               | `{ errors: string[] }`                                              |
| `PASSWORD_REUSED`                | Password reused (FORCE_CHANGE_PASSWORD challenge only, conditional on `password.historyCount`) | `undefined`                                                         |
| `INTERNAL_ERROR`                 | Framework adapter setup issue: MFA service not configured                                      | `undefined`                                                         |

**VERIFICATION_CODE_INVALID details**

For phone verification, `details` includes `attemptsRemaining`:

```json
{
  "attemptsRemaining": 2
}
```

For email and MFA verification, `details` is `undefined`.

**VERIFICATION_TOO_MANY_ATTEMPTS details**

When max attempts exceeded for phone verification:

```json
{
  "maxAttempts": 3,
  "currentAttempts": 3
}
```

**WEAK_PASSWORD details**

When password policy validation fails:

```json
{
  "errors": ["Password must be at least 8 characters", "Password must contain at least one uppercase letter"]
}
```

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

Force user to change password on next login. Sets the `mustChangePassword` flag, which triggers a `FORCE_CHANGE_PASSWORD` challenge on the user's next login attempt.

**Note:** This operation is only available for users with password authentication. Social-only accounts (users without a password hash) cannot be forced to change password.

```typescript
async setMustChangePassword(dto: SetMustChangePasswordDTO): Promise<SetMustChangePasswordResponseDTO>
```

**Parameters**

- `dto` - [`SetMustChangePasswordDTO`](../dto/set-must-change-password-dto)

**Returns**

- [`SetMustChangePasswordResponseDTO`](../dto/set-must-change-password-response-dto) - Contains `{ success: boolean }`

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                          | When                                                         | Details     |
| ----------------------------- | ------------------------------------------------------------ | ----------- |
| `NOT_FOUND`                   | User not found (by `sub` identifier)                         | `undefined` |
| `PASSWORD_CHANGE_NOT_ALLOWED` | User has no password (social-only account, no password hash) | `undefined` |

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

- [`AuthResponseDTO`](../dto/auth-response-dto) - Response format depends on outcome and `tokenDelivery.method`:
  - **Success (JSON mode)**: Contains `accessToken`, `refreshToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `user`, `authMethod`, `trusted`, `deviceToken` (if trusted)
  - **Success (Cookies mode)**: Contains `user`, `authMethod`, `trusted`, `deviceToken` (if trusted). Tokens are delivered via httpOnly cookies only.
  - **Challenge**: Contains `challengeName`, `session`, `challengeParameters`, `userSub` (same format regardless of tokenDelivery method)

**Response Variations by Token Delivery Mode**

| Mode                                            | Success Response Body                                                                                                  | Challenge Response Body                                    | Notes                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| **JSON** (`tokenDelivery.method: 'json'`)       | `{ accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt, user, authMethod, trusted?, deviceToken? }` | `{ challengeName, session, challengeParameters, userSub }` | Tokens present in response body; client must store securely                 |
| **Cookies** (`tokenDelivery.method: 'cookies'`) | `{ user, authMethod, trusted?, deviceToken? }` (tokens removed)                                                        | `{ challengeName, session, challengeParameters, userSub }` | Tokens NOT in body (httpOnly cookies only); client reads via secure context |
| **Hybrid** (`tokenDelivery.method: 'hybrid'`)   | Depends on `hybridPolicy`: web=cookies, mobile=json                                                                    | `{ challengeName, session, challengeParameters, userSub }` | Policy-driven: web clients get cookies, mobile/API gets JSON tokens         |

**Errors**

| Code              | When                       | Details                                     |
| ----------------- | -------------------------- | ------------------------------------------- |
| `SIGNUP_DISABLED` | Signups disabled           | `undefined`                                 |
| `EMAIL_EXISTS`    | Email already registered   | `undefined`                                 |
| `USERNAME_EXISTS` | Username taken             | `undefined`                                 |
| `PHONE_EXISTS`    | Phone already registered   | `undefined`                                 |
| `WEAK_PASSWORD`   | Policy violation           | `{ errors: string[] }`                      |
| `PHONE_REQUIRED`  | Phone required but missing | `{ verificationMethod: 'phone' \| 'both' }` |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**WEAK_PASSWORD errors**

Example strings returned in `errors`:

```json
{
  "errors": [
    "Password must be at least 8 characters long",
    "Password must contain at least one uppercase letter",
    "Password must contain at least one number",
    "Password must contain at least one special character !@#$%^&*()_+=[{}|;:,.<>?-]"
  ]
}
```

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

Mark current device as trusted for MFA bypass. Only available when `mfa.rememberDevices` is set to `'user_opt_in'` mode. Requires an authenticated session.

If the device is already trusted, returns the existing device token without creating a new one.

```typescript
async trustDevice(): Promise<TrustDeviceResponseDTO>
```

**Returns**

- [`TrustDeviceResponseDTO`](../dto/trust-device-response-dto) - Contains `{ deviceToken: string }`

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                | When                                                                                              | Details     |
| ------------------- | ------------------------------------------------------------------------------------------------- | ----------- |
| `FORBIDDEN`         | Only if `mfa.rememberDevices` is not `'user_opt_in'` (feature only available in user opt-in mode) | `undefined` |
| `INTERNAL_ERROR`    | Framework adapter setup issue: trusted device service not configured                              | `undefined` |
| `SESSION_NOT_FOUND` | Session ID not found in request context, or session not found/revoked                             | `undefined` |
| `NOT_FOUND`         | User not found                                                                                    | `undefined` |

**Example**

```typescript
const result = await authService.trustDevice();
```

---

### updateUserAttributes()

Update user profile information (firstName, lastName, username, email, phone, metadata, preferredMfaMethod).

**Important behaviors:**

- When `email` changes: Email verification is reset (unless `retainVerification: true`), and all Email MFA devices are deleted
- When `phone` changes: Phone verification is reset (unless `retainVerification: true`), and all SMS MFA devices are deleted
- If deleted MFA devices were the only active methods, MFA is automatically disabled
- Metadata is merged with existing metadata (not replaced)

```typescript
async updateUserAttributes(dto: UpdateUserAttributesRequestDTO): Promise<UserResponseDTO>
```

**Parameters**

- `dto` - [`UpdateUserAttributesRequestDTO`](../dto/update-user-attributes-request-dto)

**Returns**

- [`UserResponseDTO`](../dto/user-response-dto) - Updated user object

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                | When                                                                             | Details                   |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| `NOT_FOUND`         | User not found (by `sub` identifier) or user not found after update              | `undefined`               |
| `VALIDATION_FAILED` | Uniqueness violation (email, phone, or username already exists for another user) | `{ conflicts: string[] }` |

**VALIDATION_FAILED details**

When uniqueness constraints are violated, `details` includes a `conflicts` array:

```json
{
  "conflicts": ["Email already exists", "Phone number already exists", "Username already exists"]
}
```

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

### updateVerifiedStatus()

Update email and/or phone verification status directly. Intended for admin use cases such as migration or offline validation.

**Important behaviors:**

- Cannot set `isEmailVerified: true` if user does not have an email address
- Cannot set `isPhoneVerified: true` if user does not have a phone number
- Can set verification to `false` even if email/phone doesn't exist (default state)
- Only updates provided fields (partial update)
- Records audit events with `performedBy` from authenticated admin context

```typescript
async updateVerifiedStatus(dto: UpdateVerifiedStatusRequestDTO): Promise<UserResponseDTO>
```

**Parameters**

- `dto` - [`UpdateVerifiedStatusRequestDTO`](../dto/update-verified-status-request-dto)

**Returns**

- [`UserResponseDTO`](../dto/user-response-dto) - Updated user object

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                | When                                                                                                            | Details     |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ----------- |
| `NOT_FOUND`         | User not found (by `sub` identifier) or user not found after update                                             | `undefined` |
| `VALIDATION_FAILED` | Trying to set `isEmailVerified: true` when user has no email, or `isPhoneVerified: true` when user has no phone | `undefined` |

**Example**

```typescript
// Update email verification only
const updatedUser = await authService.updateVerifiedStatus({
  sub: 'user-uuid',
  isEmailVerified: true,
});

// Update both email and phone verification
const updatedUser = await authService.updateVerifiedStatus({
  sub: 'user-uuid',
  isEmailVerified: true,
  isPhoneVerified: false,
});

// Set verification to false (allowed even if email/phone doesn't exist)
const updatedUser = await authService.updateVerifiedStatus({
  sub: 'user-uuid',
  isEmailVerified: false,
});
```

:::info Admin Use Case
This method is intended for administrative operations such as:

- Migrating users from external systems with pre-verified emails/phones
- Offline validation workflows
- Manual verification status corrections

The `performedBy` field in audit events is automatically populated from the authenticated admin's context.
:::

**Audit Events**

- `EMAIL_VERIFIED` - When `isEmailVerified` is updated
- `PHONE_VERIFIED` - When `isPhoneVerified` is updated

Both events include metadata:

- `previousStatus` - Previous verification status
- `newStatus` - New verification status
- `updateMethod: 'admin_direct'` - Indicates admin-initiated update

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
