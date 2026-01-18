---
title: AdminOperations
description: Admin operations service for user and system management
keywords: [admin, operations, user management, api, methods]
image: /img/api-social-card.png
---

# AdminOperations

**Package:** `@nauth-toolkit/client`
**Type:** Class

Admin operations service for user and system management. Provides admin-level operations including user CRUD, password management, session control, MFA management, and audit history.

```typescript
import { AdminOperations } from '@nauth-toolkit/client';
```

## Access

Admin operations are accessed via the `admin` property on [`NAuthClient`](./nauth-client):

```typescript
const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  admin: {
    pathPrefix: '/admin',
  },
});

// Access admin operations
const users = await client.admin.getUsers({ page: 1 });
```

---

## User Management

### createUser()

Create a new user (admin operation). Allows creating users with pre-verified email/phone, auto-generated passwords, and force password change flag.

```typescript
async createUser(request: AdminSignupRequest): Promise<AdminSignupResponse>
```

**Parameters**

- `request` - [`AdminSignupRequest`](./types/admin-signup-request)

**Returns**

- [`AdminSignupResponse`](./types/admin-signup-response) - Created user and optional generated password

**Example**

```typescript
const result = await client.admin.createUser({
  email: 'user@example.com',
  password: 'SecurePass123!',
  isEmailVerified: true,
});

// With auto-generated password
const result = await client.admin.createUser({
  email: 'user@example.com',
  generatePassword: true,
  mustChangePassword: true,
});
console.log('Generated password:', result.generatedPassword);
```

---

### importSocialUser()

Import social user (admin operation). Imports existing social users from external platforms (e.g., Cognito, Auth0) with social account linkage.

```typescript
async importSocialUser(request: AdminSignupSocialRequest): Promise<AdminSignupSocialResponse>
```

**Parameters**

- `request` - [`AdminSignupSocialRequest`](./types/admin-signup-social-request)

**Returns**

- [`AdminSignupSocialResponse`](./types/admin-signup-social-response) - Created user and social account info

**Example**

```typescript
const result = await client.admin.importSocialUser({
  email: 'user@example.com',
  provider: 'google',
  providerId: 'google_12345',
  providerEmail: 'user@gmail.com',
});
```

---

### getUsers()

Get users with filters and pagination.

```typescript
async getUsers(params?: GetUsersRequest): Promise<GetUsersResponse>
```

**Parameters**

- `params` - [`GetUsersRequest`](./types/get-users-request) - Filter and pagination params. Optional, defaults to `{}`.

**Returns**

- [`GetUsersResponse`](./types/get-users-response) - Paginated user list

**Example**

```typescript
const result = await client.admin.getUsers({
  page: 1,
  limit: 20,
  isEmailVerified: true,
  mfaEnabled: false,
  sortBy: 'createdAt',
  sortOrder: 'DESC',
});
```

---

### getUser()

Get user by sub (UUID).

```typescript
async getUser(sub: string): Promise<AuthUser>
```

**Parameters**

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `sub`     | `string` | User UUID   |

**Returns**

- [`AuthUser`](./types/auth-user) - User object

**Example**

```typescript
const user = await client.admin.getUser('a21b654c-2746-4168-acee-c175083a65cd');
```

---

### deleteUser()

Delete user with cascade cleanup.

```typescript
async deleteUser(sub: string): Promise<DeleteUserResponse>
```

**Parameters**

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `sub`     | `string` | User UUID   |

**Returns**

- [`DeleteUserResponse`](./types/delete-user-response) - Deletion confirmation with cascade counts

**Example**

```typescript
const result = await client.admin.deleteUser('user-uuid');
console.log('Deleted records:', result.deletedRecords);
```

---

### disableUser()

Disable user account (permanent lock).

```typescript
async disableUser(sub: string, reason?: string): Promise<DisableUserResponse>
```

**Parameters**

| Parameter | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| `sub`     | `string` | User UUID                      |
| `reason`  | `string` | Optional reason for disabling. |

**Returns**

- [`DisableUserResponse`](./types/disable-user-response) - Disable confirmation with revoked session count

**Example**

```typescript
const result = await client.admin.disableUser('user-uuid', 'Account compromised');
console.log('Revoked sessions:', result.revokedSessions);
```

---

### enableUser()

Enable (unlock) user account.

```typescript
async enableUser(sub: string): Promise<EnableUserResponse>
```

**Parameters**

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `sub`     | `string` | User UUID   |

**Returns**

- [`EnableUserResponse`](./types/enable-user-response) - Enable confirmation with updated user

**Example**

```typescript
const result = await client.admin.enableUser('user-uuid');
console.log('User enabled:', result.user);
```

---

## Password Management

### forcePasswordChange()

Force password change on next login.

```typescript
async forcePasswordChange(sub: string): Promise<{ success: boolean }>
```

**Parameters**

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `sub`     | `string` | User UUID   |

**Returns**

| Property  | Type      | Description          |
| --------- | --------- | -------------------- |
| `success` | `boolean` | Success confirmation |

**Example**

```typescript
await client.admin.forcePasswordChange('user-uuid');
```

---

### setPassword()

Set password for any user (admin operation).

```typescript
async setPassword(identifier: string, newPassword: string): Promise<{ success: boolean }>
```

**Parameters**

| Parameter     | Type     | Description                              |
| ------------- | -------- | ---------------------------------------- |
| `identifier`  | `string` | User email, username, or phone           |
| `newPassword` | `string` | New password                             |

**Returns**

| Property  | Type      | Description          |
| --------- | --------- | -------------------- |
| `success` | `boolean` | Success confirmation |

**Example**

```typescript
await client.admin.setPassword('user@example.com', 'NewSecurePass123!');
```

---

### initiatePasswordReset()

Initiate password reset workflow (sends code/link to user).

```typescript
async initiatePasswordReset(request: AdminResetPasswordRequest): Promise<AdminResetPasswordResponse>
```

**Parameters**

- `request` - [`AdminResetPasswordRequest`](./types/admin-reset-password-request)

**Returns**

- [`AdminResetPasswordResponse`](./types/admin-reset-password-response) - Reset confirmation with delivery details

**Example**

```typescript
const result = await client.admin.initiatePasswordReset({
  sub: 'user-uuid',
  deliveryMethod: 'email',
  baseUrl: 'https://myapp.com/reset-password',
  reason: 'User requested password reset',
});
console.log('Code sent to:', result.destination);
```

---

## Session Management

### getUserSessions()

Get all sessions for a user.

```typescript
async getUserSessions(sub: string): Promise<GetUserSessionsResponse>
```

**Parameters**

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `sub`     | `string` | User UUID   |

**Returns**

- [`GetUserSessionsResponse`](./types/get-user-sessions-response) - User sessions

**Example**

```typescript
const result = await client.admin.getUserSessions('user-uuid');
console.log('Active sessions:', result.sessions);
```

---

### logoutAllSessions()

Logout all sessions for a user (admin-initiated).

```typescript
async logoutAllSessions(sub: string, forgetDevices?: boolean): Promise<{ revokedCount: number }>
```

**Parameters**

| Parameter       | Type      | Description                                                                 |
| --------------- | --------- | --------------------------------------------------------------------------- |
| `sub`           | `string`  | User UUID                                                                   |
| `forgetDevices` | `boolean` | If `true`, also revokes all trusted devices. Default: `false`.              |

**Returns**

| Property       | Type     | Description                |
| -------------- | -------- | -------------------------- |
| `revokedCount`| `number`  | Number of sessions revoked |

**Example**

```typescript
const result = await client.admin.logoutAllSessions('user-uuid', true);
console.log(`Revoked ${result.revokedCount} sessions`);
```

---

## MFA Management

### getMfaStatus()

Get MFA status for a user.

```typescript
async getMfaStatus(sub: string): Promise<MFAStatus>
```

**Parameters**

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `sub`     | `string` | User UUID   |

**Returns**

- [`MFAStatus`](./types/mfa-status) - MFA status

**Example**

```typescript
const status = await client.admin.getMfaStatus('user-uuid');
console.log('MFA enabled:', status.enabled);
```

---

### setPreferredMfaMethod()

Set preferred MFA method for a user.

```typescript
async setPreferredMfaMethod(
  sub: string,
  method: 'totp' | 'sms' | 'email' | 'passkey'
): Promise<{ message: string }>
```

**Parameters**

| Parameter | Type                                    | Description                    |
| --------- | --------------------------------------- | ------------------------------ |
| `sub`     | `string`                                | User UUID                      |
| `method`  | `'totp' \| 'sms' \| 'email' \| 'passkey'` | MFA method to set as preferred |

**Returns**

| Property  | Type     | Description      |
| --------- | -------- | ---------------- |
| `message` | `string` | Success message  |

**Example**

```typescript
await client.admin.setPreferredMfaMethod('user-uuid', 'totp');
```

---

### removeMfaDevices()

Remove MFA devices for a user.

```typescript
async removeMfaDevices(
  sub: string,
  method: 'totp' | 'sms' | 'email' | 'passkey'
): Promise<{ message: string }>
```

**Parameters**

| Parameter | Type                                    | Description                |
| --------- | --------------------------------------- | -------------------------- |
| `sub`     | `string`                                | User UUID                  |
| `method`  | `'totp' \| 'sms' \| 'email' \| 'passkey'` | MFA method to remove       |

**Returns**

| Property  | Type     | Description      |
| --------- | -------- | ---------------- |
| `message` | `string` | Success message  |

**Example**

```typescript
await client.admin.removeMfaDevices('user-uuid', 'sms');
```

---

### setMfaExemption()

Grant or revoke MFA exemption for a user.

```typescript
async setMfaExemption(
  sub: string,
  exempt: boolean,
  reason?: string
): Promise<{ message: string }>
```

**Parameters**

| Parameter | Type      | Description                                    |
| --------- | --------- | ---------------------------------------------- |
| `sub`     | `string`  | User UUID                                      |
| `exempt`  | `boolean` | `true` to exempt from MFA, `false` to require  |
| `reason`  | `string`  | Optional reason for exemption.                 |

**Returns**

| Property  | Type     | Description      |
| --------- | -------- | ---------------- |
| `message` | `string` | Success message  |

**Example**

```typescript
await client.admin.setMfaExemption('user-uuid', true, 'Service account');
```

---

## Audit

### getAuditHistory()

Get audit history for a user.

```typescript
async getAuditHistory(params: AdminAuditHistoryRequest): Promise<AuditHistoryResponse>
```

**Parameters**

- `params` - [`AdminAuditHistoryRequest`](./types/admin-audit-history-request) - Audit history request params

**Returns**

- [`AuditHistoryResponse`](./types/audit-history-response) - Paginated audit events

**Example**

```typescript
const history = await client.admin.getAuditHistory({
  sub: 'user-uuid',
  page: 1,
  limit: 50,
  eventType: 'LOGIN_SUCCESS',
});
```

---

## Related APIs

- [NAuthClient](./nauth-client) - Main client class
- [NAuthClientConfig](./nauth-client-config) - Configuration options
- [NAuthClientError](./nauth-client-error) - Error handling
