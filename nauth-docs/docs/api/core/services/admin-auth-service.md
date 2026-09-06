---
title: AdminAuthService
description: Administrative authentication service providing user management, password operations, session control, and user attribute updates for Node.js applications.
keywords: [admin, authentication, service, api, user management, password, session, admin auth]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminAuthService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Administrative authentication service that provides user management operations including user creation, password management, session control, and user attribute updates.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminAuthService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminAuthService } from '@nauth-toolkit/core';
// Access via nauth.adminAuthService after NAuth.create()
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminAuthService } from '@nauth-toolkit/core';
// Access via nauth.adminAuthService after NAuth.create()
```

</TabItem>
</Tabs>

## Overview

Administrative service for user management operations including user creation, password management, session control, and user attribute updates.

:::note
Automatically injected by your framework adapter. No manual instantiation required.
:::

## Methods

### confirmResetPassword()

Complete admin-initiated password reset with a verification code.

```typescript
async confirmResetPassword(dto: ConfirmAdminResetPasswordDTO): Promise<ConfirmAdminResetPasswordResponseDTO>
```

**Parameters**

- `dto` - [`ConfirmAdminResetPasswordDTO`](../dto/confirm-admin-reset-password-dto)

**Returns**

- [`ConfirmAdminResetPasswordResponseDTO`](../dto/confirm-admin-reset-password-dto)

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                          | When                                                              | Details                |
| ----------------------------- | ----------------------------------------------------------------- | ---------------------- |
| `NOT_FOUND`                   | User not found                                                    | `undefined`            |
| `PASSWORD_RESET_CODE_INVALID` | Code invalid                                                      | `undefined`            |
| `PASSWORD_RESET_CODE_EXPIRED` | Code expired                                                      | `undefined`            |
| `PASSWORD_RESET_MAX_ATTEMPTS` | Max attempts exceeded (code only)                                 | `undefined`            |
| `WEAK_PASSWORD`               | Policy violation                                                  | `{ errors: string[] }` |
| `PASSWORD_REUSED`             | Only if `password.historyCount` is configured AND password reused | `undefined`            |
| `SERVICE_UNAVAILABLE`         | Password reset service missing                                    | `undefined`            |

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

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Post('reset-password/confirm')
async confirmReset(@Body() dto: ConfirmAdminResetPasswordDTO) {
  return this.adminAuthService.confirmResetPassword(dto);
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/reset-password/confirm', async (req, res) => {
  const result = await nauth.adminAuthService.confirmResetPassword(req.body);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/reset-password/confirm',
  { preHandler: nauth.helpers.public() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.adminAuthService.confirmResetPassword(req.body);
  }),
);
```

</TabItem>
</Tabs>

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
  constructor(private readonly adminAuthService: AdminAuthService) {}

  async deleteUser(sub: string) {
    const result = await this.adminAuthService.deleteUser({ sub });
    console.log(`Deleted ${result.deletedRecords.sessions} sessions`);
    return result;
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.delete('/admin/users/:sub', async (req, res) => {
  const result = await nauth.adminAuthService.deleteUser({
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
    return nauth.adminAuthService.deleteUser({ sub: req.params.sub });
  }),
);
```

</TabItem>
</Tabs>

:::warning[Authorization]
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

:::danger[Irreversible Operation]
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
  constructor(private readonly adminAuthService: AdminAuthService) {}

  async disableUser(sub: string, reason: string) {
    const result = await this.adminAuthService.disableUser({ sub, reason });
    console.log(`Revoked ${result.revokedSessions} sessions`);
    return result;
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/users/:sub/disable', async (req, res) => {
  const result = await nauth.adminAuthService.disableUser({
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
    return nauth.adminAuthService.disableUser({
      sub: req.params.sub,
      reason: req.body.reason,
    });
  }),
);
```

</TabItem>
</Tabs>

:::note[Permanent vs Temporary Locks]
Rate limiting sets temporary locks with `lockedUntil` = future date. Admin `disableUser()` sets `lockedUntil = NULL` for permanent locks.
:::

:::warning[Authorization]
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
  constructor(private readonly adminAuthService: AdminAuthService) {}

  async enableUser(sub: string) {
    const result = await this.adminAuthService.enableUser({ sub });
    console.log(`User unlocked: ${result.user.email}`);
    return result;
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/users/:sub/enable', async (req, res) => {
  const result = await nauth.adminAuthService.enableUser({
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
    return nauth.adminAuthService.enableUser({
      sub: req.params.sub,
    });
  }),
);
```

</TabItem>
</Tabs>

:::note[Unlocking Accounts]
This method clears all lock fields including temporary rate-limit locks. Use this to unlock accounts that were locked by either `disableUser()` or automatic rate limiting.
:::

:::warning[Authorization]
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

### getUserByEmail()

Retrieve user by email address. Returns `null` if user not found or if `requireEmailVerified` is `true` and email is not verified.

```typescript
async getUserByEmail(dto: GetUserByEmailDTO): Promise<UserResponseDTO | null>
```

**Parameters**

- `dto` - [`GetUserByEmailDTO`](../dto/get-user-by-email-dto)

**Returns**

- [`UserResponseDTO`](../dto/user-response-dto) or `null` if not found or email verification requirement not met

**Errors**

Errors: None. This method returns `null` instead of throwing when user is not found.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const user = await adminAuthService.getUserByEmail({
  email: 'user@example.com',
  requireEmailVerified: true,
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const user = await nauth.adminAuthService.getUserByEmail({
  email: 'user@example.com',
  requireEmailVerified: true,
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const user = await nauth.adminAuthService.getUserByEmail({
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
async getUserById(dto: GetUserByIdDTO): Promise<UserResponseDTO | null>
```

**Parameters**

- `dto` - [`GetUserByIdDTO`](../dto/get-user-by-id-dto)

**Returns**

- [`UserResponseDTO`](../dto/user-response-dto) or `null` if not found

**Errors**

Errors: None. This method returns `null` instead of throwing when user is not found.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const user = await adminAuthService.getUserById({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const user = await nauth.adminAuthService.getUserById({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const user = await nauth.adminAuthService.getUserById({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
});
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

:::warning[Authorization]
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@UseGuards(AuthGuard, AdminGuard)
@Get('admin/users/:sub/sessions')
async getUserSessions(@Param('sub') sub: string) {
  return this.adminAuthService.getUserSessions({ sub });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/admin/users/:sub/sessions', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.adminAuthService.getUserSessions({ sub: req.params.sub });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/admin/users/:sub/sessions',
  { preHandler: [nauth.helpers.requireAuth(), requireAdmin] },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.adminAuthService.getUserSessions({ sub: req.params.sub });
  }),
);
```

</TabItem>
</Tabs>

---

### getUserTrustedDevices()

List a user's trusted devices — those allowed to skip MFA for that user.

```typescript
async getUserTrustedDevices(dto: AdminManageTrustedDevicesDTO): Promise<ListTrustedDevicesResponseDTO>
```

**Parameters**

- `dto` - [`AdminManageTrustedDevicesDTO`](../dto/trusted-device-dto)

**Returns**

- [`ListTrustedDevicesResponseDTO`](../dto/trusted-device-dto) - `{ trustedDevices: TrustedDeviceResponseDTO[] }`

**Authorization**

Requires `admin.trustedDevice.list`.

**Errors**

| Code        | When                     | Details |
| ----------- | ------------------------ | ------- |
| `NOT_FOUND` | Target user not found    | -       |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const { trustedDevices } = await this.adminAuthService.getUserTrustedDevices({ sub });
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const { trustedDevices } = await nauth.adminAuthService.getUserTrustedDevices({ sub });
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const { trustedDevices } = await nauth.adminAuthService.getUserTrustedDevices({ sub });
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
  constructor(private readonly adminAuthService: AdminAuthService) {}

  async listUsers(page: number, limit: number) {
    const result = await this.adminAuthService.getUsers({
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
  const result = await nauth.adminAuthService.getUsers({
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
    return nauth.adminAuthService.getUsers({
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

:::note[Data Privacy]
Returns sanitized user data (no `passwordHash`, secrets, or sensitive fields). All users have access to standard `UserResponseDTO` fields only.
:::

:::warning[Authorization]
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

### logoutAll()

Logout user from all sessions across all devices (global signout). Optionally revokes all trusted devices if `forgetDevices` is `true`.

```typescript
async logoutAll(dto: AdminLogoutAllDTO): Promise<LogoutAllResponseDTO>
```

**Parameters**

- `dto` - [`AdminLogoutAllDTO`](../dto/admin-logout-all-dto) - Contains `sub` (user identifier) and optional `forgetDevices` flag

**Returns**

- [`LogoutAllResponseDTO`](../dto/logout-all-response-dto) - `{ revokedCount: number }` - Number of sessions revoked

**Behavior**

- Revokes all sessions for the user across all devices
- If `forgetDevices` is `true` and trusted device feature is enabled, also revokes all trusted devices for the user
- Returns the count of revoked sessions
- Device revocation errors are non-blocking (logged but operation continues)

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code        | When           | Details     |
| ----------- | -------------- | ----------- |
| `NOT_FOUND` | User not found | `undefined` |

:::warning[Authorization]
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@UseGuards(AuthGuard, AdminGuard)
@Post('admin/users/:sub/logout-all')
async adminLogoutAll(@Param('sub') sub: string, @Body() body: { forgetDevices?: boolean }) {
  return this.adminAuthService.logoutAll({ sub, forgetDevices: body.forgetDevices });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/users/:sub/logout-all', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.adminAuthService.logoutAll({
    sub: req.params.sub,
    forgetDevices: req.body.forgetDevices,
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/admin/users/:sub/logout-all',
  { preHandler: [nauth.helpers.requireAuth(), requireAdmin] },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.adminAuthService.logoutAll({
      sub: req.params.sub,
      forgetDevices: req.body.forgetDevices,
    });
  }),
);
```

</TabItem>
</Tabs>

---

### resetPassword()

Admin-only: Initiate code-based password reset workflow with email/SMS delivery.

```typescript
async resetPassword(dto: AdminResetPasswordDTO): Promise<AdminResetPasswordResponseDTO>
```

**Parameters**

- `dto` - [`AdminResetPasswordDTO`](../dto/admin-reset-password-dto)

**Returns**

- [`AdminResetPasswordResponseDTO`](../dto/admin-reset-password-dto)

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                  | When                           | Details     |
| --------------------- | ------------------------------ | ----------- |
| `NOT_FOUND`           | User not found                 | `undefined` |
| `SERVICE_UNAVAILABLE` | Password reset service missing | `undefined` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private adminAuthService: AdminAuthService) {}

  @Post('reset-password/initiate')
  async initiateReset(@Body() dto: AdminResetPasswordDTO) {
    return this.adminAuthService.resetPassword(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/reset-password/initiate', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.adminAuthService.resetPassword(req.body);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/admin/reset-password/initiate',
  { preHandler: [nauth.helpers.requireAuth(), requireAdmin] },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.adminAuthService.resetPassword(req.body);
  }),
);
```

</TabItem>
</Tabs>

:::warning[Authorization]
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

### revokeAllUserTrustedDevices()

Revoke every trusted device belonging to a user. Each must then satisfy MFA again.

```typescript
async revokeAllUserTrustedDevices(dto: AdminManageTrustedDevicesDTO): Promise<RevokeAllTrustedDevicesResponseDTO>
```

**Parameters**

- `dto` - [`AdminManageTrustedDevicesDTO`](../dto/trusted-device-dto)

**Returns**

- [`RevokeAllTrustedDevicesResponseDTO`](../dto/trusted-device-dto) - `{ revokedCount: number }`

**Authorization**

Requires `admin.trustedDevice.revokeAll`.

**Errors**

| Code        | When                  | Details |
| ----------- | --------------------- | ------- |
| `NOT_FOUND` | Target user not found | -       |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

:::note
This removes MFA bypass only; it does not sign the user out. Use [`logoutAll()`](#logoutall) for that.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const { revokedCount } = await this.adminAuthService.revokeAllUserTrustedDevices({ sub });
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const { revokedCount } = await nauth.adminAuthService.revokeAllUserTrustedDevices({ sub });
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const { revokedCount } = await nauth.adminAuthService.revokeAllUserTrustedDevices({ sub });
```

</TabItem>
</Tabs>

---

### revokeUserSession()

Logout from a specific session by session ID. Validates session ownership for security. Automatically clears cookies if logging out the current session.

```typescript
async revokeUserSession(dto: AdminRevokeSessionDTO): Promise<LogoutSessionResponseDTO>
```

**Parameters**

- `dto` - [`AdminRevokeSessionDTO`](../dto/admin-revoke-session-dto) - Contains `sessionId` and user `sub` identifier

**Returns**

- [`LogoutSessionResponseDTO`](../dto/logout-session-response-dto) - `{ success: boolean, wasCurrentSession: boolean }`

**Behavior**

- Revokes the specified session for the user
- Validates session belongs to user (prevents unauthorized session revocation)
- Automatically clears cookies if the revoked session was the current session
- Returns `wasCurrentSession: true` if the revoked session was the current session

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed below.

| Code                | When                            | Details     |
| ------------------- | ------------------------------- | ----------- |
| `NOT_FOUND`         | User not found                  | `undefined` |
| `SESSION_NOT_FOUND` | Session not found               | `undefined` |
| `FORBIDDEN`         | Session does not belong to user | `undefined` |

:::warning[Authorization]
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@UseGuards(AuthGuard, AdminGuard)
@Delete('admin/users/:sub/sessions/:sessionId')
async adminRevokeSession(@Param('sub') sub: string, @Param('sessionId') sessionId: string) {
  return this.adminAuthService.revokeUserSession({ sub, sessionId });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.delete('/admin/users/:sub/sessions/:sessionId', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.adminAuthService.revokeUserSession({
    sub: req.params.sub,
    sessionId: req.params.sessionId,
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.delete(
  '/admin/users/:sub/sessions/:sessionId',
  { preHandler: [nauth.helpers.requireAuth(), requireAdmin] },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.adminAuthService.revokeUserSession({
      sub: req.params.sub,
      sessionId: req.params.sessionId,
    });
  }),
);
```

</TabItem>
</Tabs>

---

### revokeUserTrustedDevice()

Revoke one of a user's trusted devices, leaving their others alone.

```typescript
async revokeUserTrustedDevice(dto: AdminRevokeTrustedDeviceDTO): Promise<RevokeTrustedDeviceResponseDTO>
```

**Parameters**

- `dto` - [`AdminRevokeTrustedDeviceDTO`](../dto/trusted-device-dto)

The lookup is scoped to the named user, so a device id belonging to somebody else does not match.

**Returns**

- [`RevokeTrustedDeviceResponseDTO`](../dto/trusted-device-dto) - `{ success: boolean }`

**Authorization**

Requires `admin.trustedDevice.revoke`.

**Errors**

| Code        | When                                                 | Details |
| ----------- | ---------------------------------------------------- | ------- |
| `NOT_FOUND` | Target user not found, or device is not theirs       | -       |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
await this.adminAuthService.revokeUserTrustedDevice({ sub, deviceId: 7 });
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
await nauth.adminAuthService.revokeUserTrustedDevice({ sub, deviceId: 7 });
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
await nauth.adminAuthService.revokeUserTrustedDevice({ sub, deviceId: 7 });
```

</TabItem>
</Tabs>

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
await adminAuthService.setMustChangePassword({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
});
```

---

### setPassword()

Admin-only: Reset user password by `sub`.

```typescript
async setPassword(dto: AdminSetPasswordDTO): Promise<AdminSetPasswordResponseDTO>
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

:::info[Social accounts]
Admins can also use this method to **set the first password** for a social-only (social-first) account. This makes the account both password + social enabled.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private adminAuthService: AdminAuthService) {}

  @Post('reset-password')
  async resetPassword(@Body() dto: AdminSetPasswordDTO) {
    return this.adminAuthService.setPassword(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/reset-password', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.adminAuthService.setPassword(req.body);
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
    return nauth.adminAuthService.setPassword(req.body);
  }),
);
```

</TabItem>
</Tabs>

:::warning[Authorization]
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

### signup()

Admin-only: Create user account with override capabilities.

```typescript
async signup(dto: AdminSignupDTO): Promise<AdminSignupResponseDTO>
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

:::note[Admin capabilities]

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
  constructor(private adminAuthService: AdminAuthService) {}

  @Post('create-user')
  async createUser(@Body() dto: AdminSignupDTO) {
    return this.adminAuthService.signup(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/create-user', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.adminAuthService.signup(req.body);
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
    return nauth.adminAuthService.signup(req.body);
  }),
);
```

</TabItem>
</Tabs>

:::warning[Authorization]
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

### signupSocial()

Admin-only: Import social user from external platform with social account linkage.

```typescript
async signupSocial(dto: AdminSignupSocialDTO): Promise<AdminSignupSocialResponseDTO>
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

:::note[Admin capabilities]

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
  constructor(private adminAuthService: AdminAuthService) {}

  @Post('import-social-user')
  async importSocialUser(@Body() dto: AdminSignupSocialDTO) {
    return this.adminAuthService.signupSocial(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/admin/import-social-user', nauth.helpers.requireAuth(), requireAdmin, async (req, res) => {
  const result = await nauth.adminAuthService.signupSocial(req.body);
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
    return nauth.adminAuthService.signupSocial(req.body);
  }),
);
```

</TabItem>
</Tabs>

**Use Case: Cognito Migration**

```typescript
// Migrate Cognito user with Google social login
// Note: Email is automatically verified for social imports (like normal social signup)
const result = await adminAuthService.signupSocial({
  email: 'user@example.com',
  provider: 'google',
  providerId: cognitoUser.identities[0].userId,
  providerEmail: cognitoUser.identities[0].providerAttributes.email,
  socialMetadata: cognitoUser.identities[0].providerAttributes,
  firstName: cognitoUser.given_name,
  lastName: cognitoUser.family_name,
});
```

:::warning[Authorization]
Please ensure you implement Admin authorization as required. This method does not check admin status - protect routes with your own permission guards.
:::

---

### updateUserAttributes()

Update user profile information (firstName, lastName, username, email, phone, metadata, preferredMfaMethod).

**Important behaviors:**

- When `email` changes: Email verification is reset (unless `retainVerification: true`), and all Email MFA devices are deleted
- When `phone` changes: Phone verification is reset (unless `retainVerification: true`), and all SMS MFA devices are deleted
- If deleted MFA devices were the only active methods, MFA is automatically disabled
- Metadata is merged with existing metadata (set key to `null` to delete)

```typescript
async updateUserAttributes(dto: AdminUpdateUserAttributesDTO): Promise<UserResponseDTO>
```

**Parameters**

- `dto` - [`AdminUpdateUserAttributesDTO`](../dto/admin-update-user-attributes-dto)

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
const updatedUser = await adminAuthService.updateUserAttributes({
  sub: 'a21b654c-2746-4168-acee-c175083a65cd',
  username: 'newusername',
  firstName: 'John',
  lastName: 'Doe',
});

// Add or update metadata
await adminAuthService.updateUserAttributes({
  sub: 'user-uuid',
  metadata: {
    department: 'Engineering',
    role: 'Senior Developer',
  },
});

// Delete metadata keys by setting to null
await adminAuthService.updateUserAttributes({
  sub: 'user-uuid',
  metadata: {
    temporaryField: null,
    oldKey: null,
  },
});

// Mix profile updates with metadata operations
await adminAuthService.updateUserAttributes({
  sub: 'user-uuid',
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
const updatedUser = await adminAuthService.updateVerifiedStatus({
  sub: 'user-uuid',
  isEmailVerified: true,
});

// Update both email and phone verification
const updatedUser = await adminAuthService.updateVerifiedStatus({
  sub: 'user-uuid',
  isEmailVerified: true,
  isPhoneVerified: false,
});

// Set verification to false (allowed even if email/phone doesn't exist)
const updatedUser = await adminAuthService.updateVerifiedStatus({
  sub: 'user-uuid',
  isEmailVerified: false,
});
```

:::info[Admin Use Case]
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
