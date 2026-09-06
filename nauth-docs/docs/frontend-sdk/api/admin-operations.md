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

### getUserByEmail()

Resolve a user by email address.

```typescript
async getUserByEmail(params: GetUserByEmailRequest): Promise<AuthUser>
```

**Parameters**

| Parameter                     | Type      | Description                                                      |
| ----------------------------- | --------- | ---------------------------------------------------------------- |
| `params.email`                | `string`  | Email address to look up                                          |
| `params.requireEmailVerified` | `boolean` | Optional. Only match accounts whose email is already verified     |

**Returns**

- [`AuthUser`](./types/auth-user) - User object

**Example**

```typescript
const user = await client.admin.getUserByEmail({ email: 'user@example.com' });
```

:::note
An account's email can change, and without `requireEmailVerified` an unverified address matches too. Prefer `sub` wherever you already hold one.
:::

---

### updateUser()

Update a user's profile attributes. Omitted fields are left unchanged.

```typescript
async updateUser(sub: string, attributes: UpdateProfileRequest): Promise<AuthUser>
```

**Parameters**

| Parameter    | Type                   | Description             |
| ------------ | ---------------------- | ----------------------- |
| `sub`        | `string`               | Target user UUID        |
| `attributes` | `UpdateProfileRequest` | Attributes to change    |

**Returns**

- [`AuthUser`](./types/auth-user) - Updated user

**Example**

```typescript
const user = await client.admin.updateUser(sub, { firstName: 'Ada', lastName: 'Lovelace' });
```

---

### updateVerifiedStatus()

Set a user's email/phone verified flags directly, without the user completing a verification challenge.

```typescript
async updateVerifiedStatus(sub: string, status: UpdateVerifiedStatusRequest): Promise<AuthUser>
```

**Parameters**

| Parameter                | Type      | Description                                        |
| ------------------------ | --------- | -------------------------------------------------- |
| `sub`                    | `string`  | Target user UUID                                    |
| `status.isEmailVerified` | `boolean` | Optional. Mark the email verified or unverified     |
| `status.isPhoneVerified` | `boolean` | Optional. Mark the phone verified or unverified     |

**Returns**

- [`AuthUser`](./types/auth-user) - Updated user

**Example**

```typescript
// Migrating accounts whose email a previous system already verified
await client.admin.updateVerifiedStatus(sub, { isEmailVerified: true });
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

### revokeUserSession()

Revoke one specific session of a user, leaving their other sessions alone.

```typescript
async revokeUserSession(sub: string, sessionId: string): Promise<{ success: boolean }>
```

**Parameters**

| Parameter   | Type     | Description        |
| ----------- | -------- | ------------------ |
| `sub`       | `string` | Target user UUID   |
| `sessionId` | `string` | Session to revoke  |

**Returns**

- `{ success: boolean }`

**Example**

```typescript
const { sessions } = await client.admin.getUserSessions(sub);
await client.admin.revokeUserSession(sub, sessions[0].sessionId);
```

:::note
To end every session at once use [`logoutAllSessions()`](#logoutallsessions).
:::

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

## Trusted Device Management

Trusted devices are the devices allowed to skip MFA for a user. For the caller's own devices use [`client.listTrustedDevices()`](./nauth-client#listtrusteddevices).

### getUserTrustedDevices()

List a user's trusted devices. Expired devices are filtered out server-side.

```typescript
async getUserTrustedDevices(sub: string): Promise<ListTrustedDevicesResponse>
```

**Parameters**

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `sub`     | `string` | Target user UUID |

**Returns**

- `ListTrustedDevicesResponse` - `{ trustedDevices: TrustedDeviceInfo[] }`

**Example**

```typescript
const { trustedDevices } = await client.admin.getUserTrustedDevices(sub);
```

---

### revokeUserTrustedDevice()

Revoke one of a user's trusted devices, leaving their others alone.

```typescript
async revokeUserTrustedDevice(sub: string, deviceId: number): Promise<RevokeTrustedDeviceResponse>
```

**Parameters**

| Parameter  | Type     | Description                                                   |
| ---------- | -------- | ------------------------------------------------------------- |
| `sub`      | `string` | Target user UUID                                               |
| `deviceId` | `number` | Device record id, from [`getUserTrustedDevices()`](#getusertrusteddevices) |

**Returns**

- `RevokeTrustedDeviceResponse` - `{ success: boolean }`

**Example**

```typescript
await client.admin.revokeUserTrustedDevice(sub, 7);
```

---

### revokeAllUserTrustedDevices()

Revoke every trusted device belonging to a user.

```typescript
async revokeAllUserTrustedDevices(sub: string): Promise<RevokeAllTrustedDevicesResponse>
```

**Parameters**

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `sub`     | `string` | Target user UUID |

**Returns**

- `RevokeAllTrustedDevicesResponse` - `{ revokedCount: number }`

**Example**

```typescript
const { revokedCount } = await client.admin.revokeAllUserTrustedDevices(sub);
```

:::note
This removes MFA bypass only; it does not sign the user out. Use [`logoutAllSessions()`](#logoutallsessions) for that.
:::

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

### getMfaDevices()

Get all MFA devices for a user.

```typescript
async getMfaDevices(sub: string): Promise<GetMFADevicesResponse>
```

**Parameters**

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `sub`     | `string` | User UUID   |

**Returns**

| Property  | Type          | Description              |
| --------- | ------------- | ------------------------ |
| `devices` | `MFADevice[]` | Array of user's MFA devices |

Each device contains:

| Property      | Type      | Description                          |
| ------------- | --------- | ------------------------------------ |
| `id`          | `number`  | Device ID                            |
| `type`        | `string`  | Device type (totp, sms, email, passkey) |
| `name`        | `string`  | Device name                          |
| `isPreferred` | `boolean` | Whether this is the preferred device |
| `isActive`    | `boolean` | Whether the device is active         |
| `createdAt`   | `Date`    | Device creation timestamp            |

**Example**

```typescript
const result = await client.admin.getMfaDevices('user-uuid');
console.log('Devices:', result.devices);
// [{ id: 1, name: 'Google Authenticator', type: 'totp', isPreferred: true, ... }]
```

---

### removeMfaDeviceById()

Remove a single MFA device by device ID.

```typescript
async removeMfaDeviceById(deviceId: number): Promise<RemoveMFADeviceResponse>
```

**Parameters**

| Parameter  | Type     | Description   |
| ---------- | -------- | ------------- |
| `deviceId` | `number` | MFA device ID |

**Returns**

| Property          | Type      | Description                         |
| ----------------- | --------- | ----------------------------------- |
| `removedDeviceId` | `number`  | ID of the removed device            |
| `removedMethod`   | `string`  | Type of the removed device          |
| `mfaDisabled`     | `boolean` | Whether MFA was disabled (last device) |

**Example**

```typescript
const result = await client.admin.removeMfaDeviceById(123);
console.log('Removed:', result.removedDeviceId);
```

---

### setPreferredMfaDevice()

Set a specific device as the user's preferred MFA device.

```typescript
async setPreferredMfaDevice(
  sub: string,
  deviceId: number
): Promise<{ message: string }>
```

**Parameters**

| Parameter  | Type     | Description                        |
| ---------- | -------- | ---------------------------------- |
| `sub`      | `string` | User UUID                          |
| `deviceId` | `number` | Device ID to set as preferred      |

**Returns**

| Property  | Type     | Description     |
| --------- | -------- | --------------- |
| `message` | `string` | Success message |

**Example**

```typescript
// First get devices to find the ID
const devices = await client.admin.getMfaDevices('user-uuid');
const totpDevice = devices.devices.find(d => d.type === 'totp');

// Set as preferred
await client.admin.setPreferredMfaDevice('user-uuid', totpDevice.id);
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

### getEventsByType()

Fetch audit events of a single type, across all users.

```typescript
async getEventsByType(params: GetEventsByTypeRequest): Promise<AuditHistoryResponse>
```

**Parameters**

| Parameter           | Type               | Description                          |
| ------------------- | ------------------ | ------------------------------------ |
| `params.eventType`  | `string`           | Event type to filter on              |
| `params.page`       | `number`           | Optional. Page number (1-indexed)    |
| `params.limit`      | `number`           | Optional. Records per page           |
| `params.startDate`  | `string \| Date`   | Optional. Window start               |
| `params.endDate`    | `string \| Date`   | Optional. Window end                 |

**Returns**

- [`AuditHistoryResponse`](./types/audit-history-response) - Paginated events

**Example**

```typescript
const failures = await client.admin.getEventsByType({ eventType: 'LOGIN_FAILED', limit: 50 });
```

---

### getSuspiciousActivity()

Fetch events the risk engine flagged as suspicious.

```typescript
async getSuspiciousActivity(params?: GetSuspiciousActivityRequest): Promise<AuditHistoryResponse>
```

**Parameters**

| Parameter      | Type     | Description                                            |
| -------------- | -------- | ------------------------------------------------------ |
| `params.sub`   | `string` | Optional. Restrict to one user; omit to search all      |
| `params.limit` | `number` | Optional. Maximum events to return                      |

**Returns**

- [`AuditHistoryResponse`](./types/audit-history-response) - Flagged events

**Example**

```typescript
const flagged = await client.admin.getSuspiciousActivity({ limit: 100 });
```

---

### getRiskAssessmentHistory()

Fetch a user's risk assessment history.

```typescript
async getRiskAssessmentHistory(params: GetRiskAssessmentHistoryRequest): Promise<AuditHistoryResponse>
```

**Parameters**

| Parameter      | Type     | Description                        |
| -------------- | -------- | ---------------------------------- |
| `params.sub`   | `string` | Target user UUID                   |
| `params.limit` | `number` | Optional. Maximum results          |

**Returns**

- [`AuditHistoryResponse`](./types/audit-history-response) - Recorded assessments

**Example**

```typescript
const history = await client.admin.getRiskAssessmentHistory({ sub, limit: 20 });
```

---

## API Key Management

Administrative key operations act on a target user identified by `sub`. For the caller's own keys use [`client.apiKeys`](./nauth-client#apikeys).

### createApiKey()

Create an API key on behalf of a user. Bypasses the server's `allowUserCreation` setting, but still enforces per-user limits, expiry rules, and IP restrictions.

```typescript
async createApiKey(request: AdminCreateApiKeyRequest): Promise<CreateApiKeyResult>
```

**Parameters**

| Parameter               | Type               | Description                                            |
| ----------------------- | ------------------ | ------------------------------------------------------ |
| `request.sub`           | `string`           | Target user UUID                                        |
| `request.expiresInDays` | `number \| null`   | Expiry in days, or `null` for never (when permitted)    |
| `request.name`          | `string`           | Optional. Label                                         |
| `request.allowedIps`    | `string[]`         | Optional. IP / CIDR allowlist                           |

**Returns**

- `CreateApiKeyResult` - `{ key: string; apiKey: ApiKeyInfo }`

**Example**

```typescript
const { key } = await client.admin.createApiKey({ sub, expiresInDays: 90 });
// `key` is plaintext and shown only once
```

:::warning
The plaintext key is returned exactly once. The server stores only a hash, so a key not captured here cannot be recovered.
:::

---

### listApiKeys()

List a user's API keys.

```typescript
async listApiKeys(sub: string): Promise<ListApiKeysResponse>
```

**Parameters**

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `sub`     | `string` | Target user UUID |

**Returns**

- `ListApiKeysResponse` - `{ apiKeys: ApiKeyInfo[] }`, never containing plaintext

**Example**

```typescript
const { apiKeys } = await client.admin.listApiKeys(sub);
```

---

### updateApiKey()

Update the label and/or IP allowlist of a user's key. The secret and expiry are immutable.

```typescript
async updateApiKey(sub: string, keyId: string, updates: UpdateApiKeyRequest): Promise<ApiKeyInfo>
```

**Parameters**

| Parameter            | Type       | Description                                  |
| -------------------- | ---------- | -------------------------------------------- |
| `sub`                | `string`   | Target user UUID                              |
| `keyId`              | `string`   | Key to update                                 |
| `updates.name`       | `string`   | Optional. New label                           |
| `updates.allowedIps` | `string[]` | Optional. Replacement allowlist (empty clears) |

**Returns**

- `ApiKeyInfo` - Updated key metadata

**Example**

```typescript
await client.admin.updateApiKey(sub, keyId, { allowedIps: ['203.0.113.5'] });
```

---

### revokeApiKey()

Revoke a user's key, leaving it in place but unusable.

```typescript
async revokeApiKey(sub: string, keyId: string): Promise<RevokeApiKeyResponse>
```

**Parameters**

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `sub`     | `string` | Target user UUID |
| `keyId`   | `string` | Key to revoke    |

**Returns**

- `RevokeApiKeyResponse` - `{ success: boolean }`

**Example**

```typescript
await client.admin.revokeApiKey(sub, keyId);
```

---

### deleteApiKey()

Permanently delete a user's key.

```typescript
async deleteApiKey(sub: string, keyId: string): Promise<DeleteApiKeyResponse>
```

**Parameters**

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `sub`     | `string` | Target user UUID |
| `keyId`   | `string` | Key to delete    |

**Returns**

- `DeleteApiKeyResponse` - `{ success: boolean }`

**Example**

```typescript
await client.admin.deleteApiKey(sub, keyId);
```

---

## Related APIs

- [NAuthClient](./nauth-client) - Main client class
- [NAuthClientConfig](./nauth-client-config) - Configuration options
- [NAuthClientError](./nauth-client-error) - Error handling
