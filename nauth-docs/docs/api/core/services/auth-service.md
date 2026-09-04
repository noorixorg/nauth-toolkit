---
title: AuthService
description: Core authentication service providing signup, login, password management, MFA, session handling, and token generation for Node.js applications.
keywords: [auth, authentication, service, api, login, signup, password, session, mfa, jwt]
image: /img/api-social-card.png
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

Change user's password. Requires current password verification. All user sessions are revoked on successful password change.

```typescript
async changePassword(dto: ChangePasswordDTO): Promise<ChangePasswordResponseDTO>
```

**Parameters**

- `dto` - [`ChangePasswordDTO`](../dto/change-password-dto) - **No `sub` field required** - user is automatically derived from authenticated context

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

:::info[Social-only users]
This method **requires an existing password**. Social-only users (users who signed up via OAuth and have no password) cannot use this method.

**For social-only users:**

- Users without a password (such as those registered via OAuth/social login) can **set their initial password** by using either the [`SocialAuthService.setPasswordForSocialUser()`](./social-auth-service) method or the [`forgotPassword()`](#forgotpassword) and [`confirmForgotPassword()`](#confirmforgotpassword) flow.
- Once a password has been set, the `changePassword()` method is available for future password changes.

An administrator can also assign a password using the [`AdminAuthService.setPassword()`](./admin-auth-service#setpassword) method.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
await authService.changePassword({
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

::::note[Social accounts]
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

### getUserAuthHistory()

Get paginated authentication audit history for the current authenticated user. Returns login attempts, password changes, MFA events, device trust events, and risk factors.

```typescript
async getUserAuthHistory(dto?: GetUserAuthHistoryDTO): Promise<GetUserAuthHistoryResponseDTO>
```

**Parameters**

- `dto` - [`GetUserAuthHistoryDTO`](../dto/get-user-auth-history-dto) (optional) - Filtering and pagination options. **No `sub` field required** - user is automatically derived from the authenticated user's context.

**Returns**

- [`GetUserAuthHistoryResponseDTO`](../dto/get-user-auth-history-response-dto) - Paginated audit events

**Behavior**

- Automatically uses the authenticated user's context (no `sub` needed in DTO)
- Supports filtering by event types, status, and date ranges
- Supports pagination with configurable page size (max 500)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = await authService.getUserAuthHistory({
  page: 1,
  limit: 50,
  eventTypes: [AuthAuditEventType.LOGIN_SUCCESS],
  startDate: new Date('2025-01-01'),
});
// result.data - IAuthAudit[]
// result.total - number
// result.page - number
// result.limit - number
// result.totalPages - number
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/auth/audit/history', nauth.helpers.requireAuth(), async (req, res) => {
  const result = await nauth.authService.getUserAuthHistory({
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 50,
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/auth/audit/history',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async () => {
    return nauth.authService.getUserAuthHistory({
      page: 1,
      limit: 50,
    });
  }),
);
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

:::note[Internal use]
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

Get all active sessions for the current authenticated user. Returns session details including device info, location, authentication method, and timestamps. Current session is marked with `isCurrent: true`.

```typescript
async getUserSessions(): Promise<GetUserSessionsResponseDTO>
```

**Parameters**

None - user is automatically derived from authenticated context

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

:::warning[Authentication Required]
This method requires authentication. For user endpoints, extract `sub` from authenticated user context. For admin endpoints, protect with admin guards and accept `sub` from route parameter.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@UseGuards(AuthGuard)
@Get('sessions')
async getSessions(@CurrentUser() user: IUser) {
  return this.authService.getUserSessions();
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/sessions', nauth.helpers.requireAuth(), async (req, res) => {
  const result = await nauth.authService.getUserSessions();
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
    return nauth.authService.getUserSessions();
  }),
);
```

</TabItem>
</Tabs>

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
  - **Challenge**: Contains `challengeName`, `session`, `challengeParameters`, `sub` (same format regardless of tokenDelivery method)
  - **Blocked**: Throws exception (no response body)

**Response Variations by Token Delivery Mode**

| Mode                                            | Success Response Body                                                                                                  | Challenge Response Body                                    | Notes                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |

| **JSON** (`tokenDelivery.method: 'json'`)       | `{ accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt, user, authMethod, trusted?, deviceToken? }` | `{ challengeName, session, challengeParameters, sub }` | Tokens present in response body; client must store securely                 |
| **Cookies** (`tokenDelivery.method: 'cookies'`) | `{ user, authMethod, trusted?, deviceToken? }` (tokens removed)                                                        | `{ challengeName, session, challengeParameters, sub }` | Tokens NOT in body (httpOnly cookies only); client reads via secure context |
| **Hybrid** (`tokenDelivery.method: 'hybrid'`)   | Depends on `hybridPolicy`: web=cookies, mobile=json                                                                    | `{ challengeName, session, challengeParameters, sub }` | Policy-driven: web clients get cookies, mobile/API gets JSON tokens         |

:::note[Token Delivery]
If client checks `result.accessToken`, behavior differs by `tokenDelivery.method`. In cookies mode, tokens are NOT in the response body—they're in httpOnly cookies set by framework adapters.
:::

:::note[Hybrid refresh TTL]
In hybrid mode, the issued refresh token's lifetime reflects `hybridPolicy.cookieRefreshExpiresIn` or `jsonRefreshExpiresIn` when set, selected by the request's resolved delivery mode. See [Per-Delivery Refresh TTL](/docs/concepts/token-management#per-delivery-refresh-ttl).
:::

**Possible Outcomes**

| Outcome                          | When                                                                                              | Response Body                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Success**                      | Credentials valid, no challenges required, risk assessment passes                                 | Tokens + user data (format depends on `tokenDelivery.method`)                       |
| **Email verification challenge** | Email not verified AND `emailVerification.required = true`                                        | `{ challengeName: 'VERIFY_EMAIL', session, challengeParameters, sub }`          |
| **Phone verification challenge** | Phone not verified AND `phoneVerification.required = true`                                        | `{ challengeName: 'VERIFY_PHONE', session, challengeParameters, sub }`          |
| **MFA setup challenge**          | MFA required AND user has no MFA device configured                                                | `{ challengeName: 'MFA_SETUP_REQUIRED', session, challengeParameters, sub }`    |
| **MFA verification challenge**   | MFA required AND user has MFA device configured                                                   | `{ challengeName: 'MFA_REQUIRED', session, challengeParameters, sub }`          |
| **Force password change**        | Password expired (>= `password.expiryDays` old) OR `mustChangePassword` flag set                  | `{ challengeName: 'FORCE_CHANGE_PASSWORD', session, challengeParameters, sub }` |
| **Blocked (adaptive risk)**      | `mfa.enforcement = 'ADAPTIVE'` AND adaptive risk evaluation resolves to `action = 'block_signin'` (via `mfa.adaptive.riskLevels`) | **Throws** `SIGNIN_BLOCKED_HIGH_RISK` (no body returned)                            |

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                       | When                                                                                           | Details                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `INVALID_CREDENTIALS`      | Invalid password/user not found OR identifier type mismatch (if `login.identifierType` is set) | `undefined` \| `{ suggestedProvider: string }` |
| `ACCOUNT_INACTIVE`         | User account `isActive = false`                                                                | `undefined`                                    |
| `RATE_LIMIT_LOGIN`         | Only if `lockout.enabled = true` AND IP has exceeded max failed attempts                       | `undefined`                                    |
| `SIGNIN_BLOCKED_HIGH_RISK` | Only if `mfa.adaptive.enabled = true` AND risk score exceeds threshold                         | `{ expiresAt?: Date }`                         |

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
  "sub": "b32c765d-3857-5279-bdff-d286194b76de"
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
  "sub": "b32c765d-3857-5279-bdff-d286194b76de"
}
```

---

### logout()

Logout user from current session. Revokes the session and optionally removes trusted device if `forgetMe` is `true`.

```typescript
async logout(dto: LogoutDTO): Promise<LogoutResponseDTO>
```

**Parameters**

- `dto` - [`LogoutDTO`](../dto/logout-dto) - **No `sub` field required** - user is automatically derived from authenticated context. Contains optional `forgetMe` flag

**Returns**

- [`LogoutResponseDTO`](../dto/logout-response-dto) - `{ success: boolean }`

**Behavior**

- Revokes the current authenticated session
- If `forgetMe` is `true` and trusted device feature is enabled, also revokes the trusted device token
- Session ID is automatically extracted from JWT token in request context

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                | When                                                                | Details     |
| ------------------- | ------------------------------------------------------------------- | ----------- |
| `SESSION_NOT_FOUND` | Session ID not found in request context (request not authenticated) | `undefined` |

:::warning[Authentication Required]
This method requires the user to be authenticated. The endpoint is protected and cannot be called publicly. The session ID is automatically extracted from the authenticated user's JWT token by framework adapters.
:::

**Example**

```typescript
// Normal logout (device remains trusted)
await authService.logout({
  forgetMe: false,
});

// Logout and forget device (device untrusted, MFA required on next login)
await authService.logout({
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

- `dto` - [`LogoutAllDTO`](../dto/logout-all-dto) - **No `sub` field required** - user is automatically derived from authenticated context. Contains optional `forgetDevices` flag

**Returns**

- [`LogoutAllResponseDTO`](../dto/logout-all-response-dto) - `{ revokedCount: number }` - Number of sessions revoked

**Behavior**

- Revokes all sessions for the user across all devices
- If `forgetDevices` is `true` and trusted device feature is enabled, also revokes all trusted devices for the user
- Returns the count of revoked sessions
- Device revocation errors are non-blocking (logged but operation continues)

**Usage Patterns**

- **User-initiated**: User logs out from all their own sessions (protected endpoint, user provides their own sub)
- **Admin-initiated**: Admin force-logs out any user (admin-protected endpoint, admin provides target user's sub) See logoutAll in AdminAuthService

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code        | When           | Details     |
| ----------- | -------------- | ----------- |
| `NOT_FOUND` | User not found | `undefined` |

:::warning[Authentication Required]
This method requires authentication. For user endpoints, extract `sub` from authenticated user context. For admin endpoints, protect with admin guards and accept `sub` from route parameter.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
// User-initiated (user context)
@UseGuards(AuthGuard)
@Post('logout/all')
async logoutAll(@Body() body: { forgetDevices?: boolean }) {
  return this.authService.logoutAll({ forgetDevices: body.forgetDevices });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
// User-initiated
app.post('/logout/all', nauth.helpers.requireAuth(), async (req, res) => {
  const result = await nauth.authService.logoutAll({
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
    return nauth.authService.logoutAll({
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

- `dto` - [`LogoutSessionDTO`](../dto/logout-session-dto) - **No `sub` field required** - user is automatically derived from authenticated context. Contains `sessionId`

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

:::warning[Authentication Required]
This method requires authentication. For user endpoints, extract `sub` from authenticated user context. For admin endpoints, protect with admin guards and accept `sub` from route parameter. Session ownership is validated automatically.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
// User logging out own session
@UseGuards(AuthGuard)
@Delete('sessions/:sessionId')
async logoutSession(@Param('sessionId') sessionId: string) {
  return this.authService.logoutSession({ sessionId });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
// User logging out own session
app.delete('/sessions/:sessionId', nauth.helpers.requireAuth(), async (req, res) => {
  const result = await nauth.authService.logoutSession({
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
    return nauth.authService.logoutSession({
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
| **Hybrid** (`tokenDelivery.method: 'hybrid'`)   | Depends on `hybridPolicy`: web=cookies (empty body), mobile=json (tokens in body) | Policy-driven: web clients get cookies, mobile/API gets JSON tokens. See [Token Delivery Modes](/docs/concepts/token-management) and [Token Management](/docs/concepts/token-management) guides. |

**Behavior**

- Uses distributed locking to prevent concurrent refresh attempts for the same session
- Implements token rotation (old tokens are invalidated when new ones are issued)
- Detects token reuse attempts and revokes affected sessions
- Returns current tokens if cookie race condition is detected (same session, legitimate duplicate request)
- In hybrid mode, applies `hybridPolicy.cookieRefreshExpiresIn` or `jsonRefreshExpiresIn` to the rotated refresh token when set, selected by the request's resolved delivery mode; the reuse-detection storage TTL and refresh cookie `maxAge` align with the same resolved value. See [Per-Delivery Refresh TTL](/docs/concepts/token-management#per-delivery-refresh-ttl).

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
  - **Challenge**: Contains `challengeName`, `session`, `challengeParameters`, `sub` (same format regardless of tokenDelivery method)

**Response Variations by Token Delivery Mode**

| Mode                                            | Success Response Body                                                                                                  | Challenge Response Body                                    | Notes                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| **JSON** (`tokenDelivery.method: 'json'`)       | `{ accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt, user, authMethod, trusted?, deviceToken? }` | `{ challengeName, session, challengeParameters, sub }` | Tokens present in response body; client must store securely                 |
| **Cookies** (`tokenDelivery.method: 'cookies'`) | `{ user, authMethod, trusted?, deviceToken? }` (tokens removed)                                                        | `{ challengeName, session, challengeParameters, sub }` | Tokens NOT in body (httpOnly cookies only); client reads via secure context |
| **Hybrid** (`tokenDelivery.method: 'hybrid'`)   | Depends on `hybridPolicy`: web=cookies, mobile=json                                                                    | `{ challengeName, session, challengeParameters, sub }` | Policy-driven: web clients get cookies, mobile/API gets JSON tokens         |

:::note[Hybrid refresh TTL]
When the challenge completes and tokens are issued, the refresh token's lifetime reflects `hybridPolicy.cookieRefreshExpiresIn` or `jsonRefreshExpiresIn` when set. See [Per-Delivery Refresh TTL](/docs/concepts/token-management#per-delivery-refresh-ttl).
:::

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
  - **Challenge**: Contains `challengeName`, `session`, `challengeParameters`, `sub` (same format regardless of tokenDelivery method)

**Response Variations by Token Delivery Mode**

| Mode                                            | Success Response Body                                                                                                  | Challenge Response Body                                    | Notes                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| **JSON** (`tokenDelivery.method: 'json'`)       | `{ accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt, user, authMethod, trusted?, deviceToken? }` | `{ challengeName, session, challengeParameters, sub }` | Tokens present in response body; client must store securely                 |
| **Cookies** (`tokenDelivery.method: 'cookies'`) | `{ user, authMethod, trusted?, deviceToken? }` (tokens removed)                                                        | `{ challengeName, session, challengeParameters, sub }` | Tokens NOT in body (httpOnly cookies only); client reads via secure context |
| **Hybrid** (`tokenDelivery.method: 'hybrid'`)   | Depends on `hybridPolicy`: web=cookies, mobile=json                                                                    | `{ challengeName, session, challengeParameters, sub }` | Policy-driven: web clients get cookies, mobile/API gets JSON tokens         |

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
- Metadata is merged with existing metadata (set key to `null` to delete)

```typescript
async updateUserAttributes(dto: UpdateUserAttributesDTO): Promise<UserResponseDTO>
```

**Parameters**

- `dto` - [`UpdateUserAttributesDTO`](../dto/update-user-attributes-dto) - **No `sub` field required** - user is automatically derived from authenticated context

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
// Update basic profile fields
const updatedUser = await authService.updateUserAttributes({
  username: 'newusername',
  firstName: 'John',
  lastName: 'Doe',
});

// Add or update metadata
await authService.updateUserAttributes({
  metadata: {
    department: 'Engineering',
    role: 'Senior Developer',
  },
});

// Delete metadata keys by setting to null
await authService.updateUserAttributes({
  metadata: {
    temporaryField: null,
    oldKey: null,
  },
});

// Mix profile updates with metadata operations
await authService.updateUserAttributes({
  firstName: 'Jane',
  metadata: {
    department: 'Product',
    oldDepartment: null,
  },
});
```

:::warning[MFA Device Deletion]
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

### validateAccessToken()

Validate JWT access token and decode payload. Returns validation result with decoded payload if valid, or error information if invalid.

```typescript
async validateAccessToken(dto: ValidateAccessTokenDTO): Promise<ValidateAccessTokenResponseDTO>
```

**Parameters**

- `dto` - [`ValidateAccessTokenDTO`](../dto/validate-access-token-dto)

**Returns**

- [`ValidateAccessTokenResponseDTO`](../dto/validate-access-token-response-dto) - Validation result with optional payload and error information

**Behavior**

- Verifies token signature using configured secret/public key
- Validates expiration timestamp
- Ensures token type is 'access' (not refresh)
- Checks issuer and audience claims
- Returns decoded payload if valid
- Returns error information if invalid

**Use Cases**

- Manual token validation in consumer applications
- Token introspection for debugging
- Custom authorization logic requiring token payload
- API gateway token validation
- Microservice authentication

**Errors**

This method does not throw errors. All validation failures are returned in the response DTO with `valid: false` and appropriate `error` and `errorType` fields.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
export class TokenService {
  constructor(private readonly authService: AuthService) {}

  async validateToken(token: string) {
    const result = await this.authService.validateAccessToken({
      accessToken: token,
    });

    if (result.valid) {
      console.log('User ID:', result.payload.sub);
      console.log('Session ID:', result.payload.sessionId);
      console.log('Expires at:', new Date(result.payload.exp * 1000));
      return result.payload;
    } else {
      console.error('Validation failed:', result.error);
      console.error('Error type:', result.errorType);
      return null;
    }
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/validate-token', async (req, res) => {
  const result = await nauth.authService.validateAccessToken({
    accessToken: req.body.token,
  });

  if (result.valid) {
    res.json({
      valid: true,
        sub: result.payload.sub,
      email: result.payload.email,
      sessionId: result.payload.sessionId,
    });
  } else {
    res.status(401).json({
      valid: false,
      error: result.error,
      errorType: result.errorType,
    });
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/validate-token',
  { preHandler: nauth.helpers.public() },
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    const result = await nauth.authService.validateAccessToken({
      accessToken: req.body.token,
    });

    if (result.valid) {
      return {
        valid: true,
        sub: result.payload.sub,
        email: result.payload.email,
        sessionId: result.payload.sessionId,
      };
    } else {
      reply.status(401);
      return {
        valid: false,
        error: result.error,
        errorType: result.errorType,
      };
    }
  }),
);
```

</TabItem>
</Tabs>

**Response Examples**

Valid token:

```json
{
  "valid": true,
  "payload": {
    "sub": "a21b654c-2746-4168-acee-c175083a65cd",
    "email": "user@example.com",
    "type": "access",
    "sessionId": "session-uuid-123",
    "iat": 1704067200,
    "exp": 1704070800,
    "iss": "nauth-toolkit",
    "aud": "my-app"
  }
}
```

Invalid token:

```json
{
  "valid": false,
  "error": "Token expired",
  "errorType": "expired"
}
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
