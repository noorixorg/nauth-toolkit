---
title: MFAService
description: MFA provider registry and orchestration service for TOTP, SMS, Email, and Passkey authentication
keywords: [mfa, multi-factor, authentication, totp, sms, passkey, service, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MFAService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Central registry service for managing MFA (Multi-Factor Authentication) providers and coordinating MFA operations.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { MFAService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { MFAService } from '@nauth-toolkit/core';
// Access via nauth.mfaService after NAuth.create()
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { MFAService } from '@nauth-toolkit/core';
// Access via nauth.mfaService after NAuth.create()
```

</TabItem>
</Tabs>

## Overview

The `MFAService` acts as a registry and orchestrator for MFA provider services (TOTP, SMS, Email, Passkey). It routes MFA operations to the appropriate provider and manages user MFA devices.

:::note
Auto-injected by framework. No manual instantiation required.
:::

## Methods

### adminGetMfaStatus()

Get comprehensive MFA status for a target user (admin operation).

```typescript
async adminGetMfaStatus(dto: AdminGetMFAStatusDTO): Promise<GetMFAStatusResponseDTO>
```

**Parameters**

- `dto` - [`AdminGetMFAStatusDTO`](../dto/admin-get-mfa-status-dto)

**Returns**

- [`GetMFAStatusResponseDTO`](../dto/get-mfa-status-dto)

**Errors**

| Code                | When                 | Details                                          |
| ------------------- | -------------------- | ------------------------------------------------ |
| `VALIDATION_FAILED` | DTO validation fails | `{ validationErrors: Record<string, string[]> }` |
| `NOT_FOUND`         | User not found       | `undefined`                                      |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**Example (NestJS)**

```typescript
@Post('admin/mfa/status')
async adminGetStatus(@Body() dto: AdminGetMFAStatusDTO) {
  return await this.mfaService.adminGetMfaStatus(dto);
}
```

---

### adminGetUserDevices()

Get all active MFA devices for a specific user (admin operation).

```typescript
async adminGetUserDevices(dto: AdminGetUserDevicesDTO): Promise<GetUserDevicesResponseDTO>
```

**Parameters**

- `dto` - [`AdminGetUserDevicesDTO`](../dto/admin-get-user-devices-dto) - Contains `sub` (target user's UUID)

**Returns**

- [`GetUserDevicesResponseDTO`](../dto/get-user-devices-dto) - `{ devices: MFADeviceResponseDTO[] }`

**Errors**

| Code                | When                 | Details                                          |
| ------------------- | -------------------- | ------------------------------------------------ |
| `VALIDATION_FAILED` | DTO validation fails | `{ validationErrors: Record<string, string[]> }` |
| `USER_NOT_FOUND`    | User not found       | `{ sub: string }`                                |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Get('admin/users/:sub/mfa/devices')
@UseGuards(AdminAuthGuard)
async adminGetUserDevices(@Param() dto: AdminGetUserDevicesDTO): Promise<GetUserDevicesResponseDTO> {
  return await this.mfaService.adminGetUserDevices(dto);
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/admin/users/:sub/mfa/devices', requireAdminAuth(), async (req, res) => {
  const result = await nauth.mfaService.adminGetUserDevices({ sub: req.params.sub });
  res.json(result);
});
```

</TabItem>

<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/admin/users/:sub/mfa/devices',
  { preHandler: requireAdminAuth() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.mfaService.adminGetUserDevices({ sub: req.params.sub });
  }),
);
```

</TabItem>
</Tabs>

---

### adminRemoveDevice()

Remove a single MFA device by device ID (admin operation). Does not require user context.

```typescript
async adminRemoveDevice(dto: AdminRemoveDeviceDTO): Promise<RemoveDeviceResponseDTO>
```

**Parameters**

- `dto` - [`AdminRemoveDeviceDTO`](../dto/admin-remove-device-dto) - Contains `deviceId`

**Returns**

- [`RemoveDeviceResponseDTO`](../dto/remove-device-dto) - `{ removedDeviceId: number, removedMethod: string, mfaDisabled: boolean }`

**Errors**

| Code        | When              | Details            |
| ----------- | ----------------- | ------------------ |
| `NOT_FOUND` | Device not found  | `{ deviceId: number }` |

**Example (NestJS)**

```typescript
@Delete('admin/mfa/devices/:deviceId')
@UseGuards(AdminAuthGuard)
async adminRemoveDevice(@Param() dto: AdminRemoveDeviceDTO): Promise<RemoveDeviceResponseDTO> {
  return await this.mfaService.adminRemoveDevice(dto);
}
```

---

### adminSetPreferredDevice()

Set a specific device as preferred for a user (admin operation).

```typescript
async adminSetPreferredDevice(dto: AdminSetPreferredDeviceDTO): Promise<AdminSetPreferredDeviceResponseDTO>
```

**Parameters**

- `dto` - [`AdminSetPreferredDeviceDTO`](../dto/set-preferred-device-dto) - Contains `sub` and `deviceId`

**Returns**

- `AdminSetPreferredDeviceResponseDTO` - `{ message: string }`

**Errors**

| Code        | When                                      | Details                |
| ----------- | ----------------------------------------- | ---------------------- |
| `NOT_FOUND` | User or device not found                  | `{ sub?: string, deviceId?: number }` |

**Example (NestJS)**

```typescript
@Post('admin/users/:sub/mfa/devices/:deviceId/preferred')
@UseGuards(AdminAuthGuard)
async adminSetPreferredDevice(@Param() dto: AdminSetPreferredDeviceDTO): Promise<SetPreferredDeviceResponseDTO> {
  return await this.mfaService.adminSetPreferredDevice(dto);
}
```

---

### generateBackupCodes()

Issue a fresh set of single-use recovery codes for the current user, replacing any set they already held.

```typescript
async generateBackupCodes(): Promise<GenerateBackupCodesResponseDTO>
```

**Parameters**

None. The caller is resolved from the authenticated request context.

**Returns**

- [`GenerateBackupCodesResponseDTO`](../dto/generate-backup-codes-response-dto) - `{ codes: string[] }`

**Errors**

| Code                | When                                                         | Details |
| ------------------- | ------------------------------------------------------------ | ------- |
| `FORBIDDEN`         | No authenticated user in context                             | -       |
| `VALIDATION_FAILED` | Backup codes disabled, or no provider registered to supply them | -       |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

:::warning
The plaintext codes are returned once and stored only as hashes. Show them to the user immediately; they cannot be retrieved again.
:::

Requires `mfa.backup.enabled` in configuration and at least one registered MFA provider.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Post('mfa/backup-codes/generate')
async generateCodes() {
  return await this.mfaService.generateBackupCodes();
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/mfa/backup-codes/generate', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.generateBackupCodes();
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/mfa/backup-codes/generate',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async () => {
    return nauth.mfaService.generateBackupCodes();
  }),
);
```

</TabItem>
</Tabs>

---

### getAvailableMethods()

List the MFA methods this deployment permits. Returns every method registered as a provider and allowed by configuration, whether or not the caller has enrolled it.

```typescript
async getAvailableMethods(): Promise<GetAvailableMethodsResponseDTO>
```

**Parameters**

None. The caller is resolved from the authenticated request context.

**Returns**

- [`GetAvailableMethodsResponseDTO`](../dto/get-available-methods-response-dto) - `{ availableMethods: string[] }`

**Errors**

| Code        | When                             | Details |
| ----------- | -------------------------------- | ------- |
| `FORBIDDEN` | No authenticated user in context | -       |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

:::note
The result is derived from configuration, so it is the same for every user. Use [`getUserDevices()`](#getuserdevices) for what a particular user has actually enrolled.
:::

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Get('mfa/methods')
async getMethods() {
  return await this.mfaService.getAvailableMethods();
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/mfa/methods', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.getAvailableMethods();
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/mfa/methods',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async () => {
    return nauth.mfaService.getAvailableMethods();
  }),
);
```

</TabItem>
</Tabs>

---

### getChallengeData()

Get MFA challenge data during MFA_REQUIRED challenge. Currently only used for passkey authentication to get WebAuthn options. For passkey method, stores challenge in session metadata for verification.

```typescript
async getChallengeData(dto: GetChallengeDataDTO): Promise<GetChallengeDataResponseDTO>
```

**Parameters**

- `dto` - [`GetChallengeDataDTO`](../dto/get-challenge-data-dto)

**Returns**

- [`GetChallengeDataResponseDTO`](../dto/get-challenge-data-response-dto) - `{ challengeData: Record<string, unknown> }`

**Errors**

| Code                          | When                                                                                                                                    | Details                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `VALIDATION_FAILED`           | DTO validation fails, challenge not MFA_REQUIRED, no user in session, provider not registered, or method doesn't support challenge data | `{ validationErrors: Record<string, string[]> }` or `undefined` |
| `CHALLENGE_INVALID`           | Challenge session not found or invalid                                                                                                  | `undefined`                                                     |
| `CHALLENGE_EXPIRED`           | Challenge session expired                                                                                                               | `undefined`                                                     |
| `CHALLENGE_ALREADY_COMPLETED` | Challenge session already completed                                                                                                     | `undefined`                                                     |
| `CHALLENGE_MAX_ATTEMPTS`      | Maximum challenge attempts exceeded                                                                                                     | `undefined`                                                     |
| `NOT_FOUND`                   | No MFA device registered for method                                                                                                     | `{ deviceType: 'sms' \| 'email' \| 'passkey' }`                 |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**VALIDATION_FAILED details**

When DTO validation fails, `details` includes:

```json
{
  "validationErrors": {
    "session": ["Session token must be a valid UUID v4 format"],
    "method": ["Method must be: passkey"]
  }
}
```

When validation fails for other reasons (challenge type, user, provider not registered, method doesn't support challenge data), `details` is `undefined`.

**NOT_FOUND details**

When no device is registered for the method, `details` includes:

```json
{
  "deviceType": "passkey"
}
```

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Get('mfa/challenge')
async getChallenge(@Query('session') session: string) {
  return await this.mfaService.getChallengeData({ session, method: 'passkey' });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/mfa/challenge', async (req, res) => {
  const result = await nauth.mfaService.getChallengeData({
    session: req.query.session,
    method: 'passkey',
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/mfa/challenge',
  { preHandler: nauth.helpers.public() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const result = await nauth.mfaService.getChallengeData({
      session: req.query.session as string,
      method: 'passkey',
    });
    return result;
  }),
);
```

</TabItem>
</Tabs>

---

### getMfaStatus()

Get comprehensive MFA status for the current authenticated user including enabled status, configured methods, available methods, backup codes, and exemption information.

```typescript
async getMfaStatus(): Promise<GetMFAStatusResponseDTO>
```

**Returns**

- [`GetMFAStatusResponseDTO`](../dto/get-mfa-status-dto)

**Errors**

| Code        | When                                 | Details     |
| ----------- | ------------------------------------ | ----------- |
| `FORBIDDEN` | Not authenticated (no user in context) | `undefined` |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Get('mfa/status')
async getStatus() {
  return await this.mfaService.getMfaStatus();
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/mfa/status', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.getMfaStatus();
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/mfa/status',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async () => {
    return nauth.mfaService.getMfaStatus();
  }),
);
```

</TabItem>
</Tabs>

---

### getSetupData()

Get MFA setup data during MFA_SETUP_REQUIRED challenge. Returns provider-specific setup data (QR code for TOTP, options for Passkey, etc.).

```typescript
async getSetupData(dto: GetSetupDataDTO): Promise<GetSetupDataResponseDTO>
```

**Parameters**

- `dto` - [`GetSetupDataDTO`](../dto/get-setup-data-dto)

**Returns**

- [`GetSetupDataResponseDTO`](../dto/get-setup-data-dto) - `{ setupData: Record<string, unknown> }`

**Errors**

| Code                          | When                                                                                                   | Details                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `VALIDATION_FAILED`           | DTO validation fails, challenge not MFA_SETUP_REQUIRED, no user in session, or provider not registered | `{ validationErrors: Record<string, string[]> }` or `undefined` |
| `CHALLENGE_INVALID`           | Challenge session not found                                                                            | `undefined`                                                     |
| `CHALLENGE_EXPIRED`           | Challenge session expired                                                                              | `undefined`                                                     |
| `CHALLENGE_ALREADY_COMPLETED` | Challenge session already completed                                                                    | `undefined`                                                     |
| `CHALLENGE_MAX_ATTEMPTS`      | Maximum challenge attempts exceeded                                                                    | `undefined`                                                     |
| `PHONE_REQUIRED`              | SMS method requires phone number                                                                       | `undefined`                                                     |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**VALIDATION_FAILED details**

When DTO validation fails, `details` includes:

```json
{
  "validationErrors": {
    "session": ["Session token must be a valid UUID v4 format"],
    "method": ["Method must be one of: sms, email, totp, passkey"]
  }
}
```

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Get('mfa/setup')
async getSetup(@Query('session') session: string, @Query('method') method: string) {
  return await this.mfaService.getSetupData({ session, method: method as MFAMethod });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/mfa/setup', async (req, res) => {
  const result = await nauth.mfaService.getSetupData({
    session: req.query.session,
    method: req.query.method,
    setupData: req.body.setupData,
  });
  res.json(result);
});
```

</TabItem>

<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/mfa/setup',
  { preHandler: nauth.helpers.public() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const result = await nauth.mfaService.getSetupData({
      session: req.query.session as string,
      method: req.query.method as MFAMethod,
      setupData: req.body?.setupData,
    });
    return result;
  }),
);
```

</TabItem>
</Tabs>

---

### getUserDevices()

Get all active MFA devices for the current authenticated user. User is obtained from the authenticated context.

```typescript
async getUserDevices(dto?: GetUserDevicesDTO): Promise<GetUserDevicesResponseDTO>
```

**Parameters**

- `dto` - [`GetUserDevicesDTO`](../dto/get-user-devices-dto) (optional, empty DTO - user obtained from context)

**Returns**

- [`GetUserDevicesResponseDTO`](../dto/get-user-devices-dto) - `{ devices: MFADeviceResponseDTO[] }`

Each device contains:

| Property      | Type               | Description                              |
| ------------- | ------------------ | ---------------------------------------- |
| `id`          | `number`           | Device ID                                |
| `type`        | `MFADeviceMethod`  | Device type (totp, sms, email, passkey)  |
| `name`        | `string`           | Device name                              |
| `isPreferred` | `boolean`          | Whether this is the preferred device     |
| `isActive`    | `boolean`          | Whether the device is active             |
| `createdAt`   | `Date`             | Device creation timestamp                |

**Errors**

| Code        | When                                    | Details     |
| ----------- | --------------------------------------- | ----------- |
| `FORBIDDEN` | Not authenticated (no user in context)  | `undefined` |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Get('mfa/devices')
async getDevices(): Promise<GetUserDevicesResponseDTO> {
  return await this.mfaService.getUserDevices({});
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/mfa/devices', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.getUserDevices({});
  res.json(result);
});
```

</TabItem>

<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/mfa/devices',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async () => {
    return nauth.mfaService.getUserDevices({});
  }),
);
```

</TabItem>
</Tabs>

---

### hasProvider()

Check if an MFA provider is registered.

```typescript
hasProvider(dto: HasProviderDTO): HasProviderResponseDTO
```

**Parameters**

- `dto` - [`HasProviderDTO`](../dto/has-provider-dto)

**Returns**

- [`HasProviderResponseDTO`](../dto/has-provider-dto) - `{ hasProvider: boolean }`

**Errors**

| Code                | When                 | Details                                          |
| ------------------- | -------------------- | ------------------------------------------------ |
| `VALIDATION_FAILED` | DTO validation fails | `{ validationErrors: Record<string, string[]> }` |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**VALIDATION_FAILED details**

When DTO validation fails, `details` includes:

```json
{
  "validationErrors": {
    "methodName": ["Method name must be a string"]
  }
}
```

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = this.mfaService.hasProvider({ methodName: 'totp' });
if (result.hasProvider) {
  // TOTP provider is available
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = nauth.mfaService.hasProvider({ methodName: 'totp' });
if (result.hasProvider) {
  // TOTP provider is available
}
```

</TabItem>

<TabItem value="fastify" label="Fastify">

```typescript
const result = nauth.mfaService.hasProvider({ methodName: 'totp' });
if (result.hasProvider) {
  // TOTP provider is available
}
```

</TabItem>
</Tabs>

---

### listProviders()

Get all registered provider method names.

```typescript
listProviders(): ListProvidersResponseDTO
```

**Parameters**

None.

**Returns**

- [`ListProvidersResponseDTO`](../dto/list-providers-response-dto) - `{ providers: string[] }`

**Errors**

None. This method does not throw errors.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = this.mfaService.listProviders();
// Returns: { providers: ['totp', 'sms', 'passkey'] }
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = nauth.mfaService.listProviders();
// Returns: { providers: ['totp', 'sms', 'passkey'] }
```

</TabItem>

<TabItem value="fastify" label="Fastify">

```typescript
const result = nauth.mfaService.listProviders();
// Returns: { providers: ['totp', 'sms', 'passkey'] }
```

</TabItem>
</Tabs>

---

### removeDevice()

Remove a single MFA device by `deviceId` (recommended when users can enroll multiple devices for the same method).

```typescript
async removeDevice(dto: RemoveDeviceDTO): Promise<RemoveDeviceResponseDTO>
```

**Parameters**

- `dto` - `RemoveDeviceDTO`

**Returns**

- `RemoveDeviceResponseDTO` - `{ removedDeviceId: number, removedMethod: string, mfaDisabled: boolean }`

**Errors**

| Code | When |
|------|------|
| `USER_NOT_FOUND` | Device not found or doesn't belong to authenticated user |

**Example (NestJS)**

```typescript
@Delete('mfa/devices/:deviceId')
async removeDevice(@Param('deviceId') deviceId: string) {
  return await this.mfaService.removeDevice({ deviceId: Number(deviceId) });
}
```

---

### setMFAExemption()

Grant or revoke a user's exemption from multi-factor authentication requirements. Admin-only operation.

```typescript
async setMFAExemption(dto: SetMFAExemptionDTO): Promise<SetMFAExemptionResponseDTO>
```

**Parameters**

- `dto` - [`SetMFAExemptionDTO`](../dto/set-mfa-exemption-dto)

**Returns**

- [`SetMFAExemptionResponseDTO`](../dto/set-mfa-exemption-dto) - `{ mfaExempt: boolean, mfaExemptReason: string | null, mfaExemptGrantedAt: Date | null }`

**Errors**

| Code                | When                 | Details                                          |
| ------------------- | -------------------- | ------------------------------------------------ |
| `VALIDATION_FAILED` | DTO validation fails | `{ validationErrors: Record<string, string[]> }` |
| `NOT_FOUND`         | User not found       | `undefined`                                      |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**VALIDATION_FAILED details**

When DTO validation fails, `details` includes:

```json
{
  "validationErrors": {
    "sub": ["User sub must be a valid UUID v4 format"],
    "exempt": ["Exempt must be a boolean"],
    "reason": ["Reason must not exceed 500 characters"],
    "grantedBy": ["Granted by must not exceed 255 characters"]
  }
}
```

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Post('mfa/exemption')
async setExemption(@Body() dto: SetMFAExemptionDTO) {
  return await this.mfaService.setMFAExemption(dto);
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/mfa/exemption', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.setMFAExemption(req.body);
  res.json(result);
});
```

</TabItem>

<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/mfa/exemption',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    const result = await nauth.mfaService.setMFAExemption(req.body);
    return result;
  }),
);
```

</TabItem>
</Tabs>

---

### setPreferredDevice()

Set a specific MFA device as preferred by `deviceId`. This updates both the device's preferred status and the user's preferred method.

```typescript
async setPreferredDevice(dto: SetPreferredDeviceDTO): Promise<SetPreferredDeviceResponseDTO>
```

**Parameters**

- `dto` - [`SetPreferredDeviceDTO`](../dto/set-preferred-device-dto) - Contains `deviceId`

**Returns**

- [`SetPreferredDeviceResponseDTO`](../dto/set-preferred-device-dto) - `{ message: string }`

**Example (NestJS)**

```typescript
@Post('mfa/devices/:deviceId/preferred')
async setPreferredDevice(@Param() dto: SetPreferredDeviceDTO) {
  return await this.mfaService.setPreferredDevice(dto);
}
```

---

### setup()

Setup MFA device using appropriate provider. Returns provider-specific setup data that varies by method type.

```typescript
async setup(dto: SetupMFADTO): Promise<SetupMFAResponseDTO>
```

**Parameters**

- `dto` - [`SetupMFADTO`](../dto/setup-mfa-dto)

**Returns**

- [`SetupMFAResponseDTO`](../dto/setup-mfa-dto) - `{ setupData: Record<string, unknown> }`

Response structure varies by method:

**TOTP Response:**

```typescript
{
  setupData: {
    secret: string; // Base32-encoded TOTP secret
    qrCode: string; // QR code as data URL (data:image/png;base64,...)
    manualEntryKey: string; // Formatted secret for manual entry (e.g., 'ABCD EFGH IJKL MNOP')
    issuer: string; // Issuer name from config
    accountName: string; // Account name (typically user's email)
  }
}
```

**SMS Response:**

```typescript
// If phone already verified (auto-completed):
{
  setupData: {
    deviceId: number;
    autoCompleted: true;
  }
}
// If phone not verified (code sent):
{
  setupData: {
    maskedPhone: string; // Masked phone number (e.g., '***-***-7890')
  }
}
```

**Email Response:**

```typescript
// If email already verified (auto-completed):
{
  setupData: {
    deviceId: number;
    autoCompleted: true;
  }
}
// If email not verified (code sent):
{
  setupData: {
    maskedEmail: string; // Masked email address (e.g., 'u***r@example.com')
  }
}
```

**Passkey Response:**

```typescript
{
  setupData: {
    options: {
      challenge: string;
      rp: { name: string; id: string };
      user: { id: string; name: string; displayName: string };
      pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
      timeout: number;
      attestation: 'none' | 'indirect' | 'direct';
      authenticatorSelection?: {
        authenticatorAttachment?: 'platform' | 'cross-platform';
        requireResidentKey?: boolean;
        userVerification?: 'required' | 'preferred' | 'discouraged';
      };
      excludeCredentials?: Array<{ id: string; type: 'public-key'; transports?: string[] }>;
    };
  }
}
```

**Setup Data by Method:**

- **TOTP**: No `setupData` required (or empty object `{}`)
- **SMS**: `{ phoneNumber: string, deviceName?: string }` - Phone number in E.164 format (e.g., `'+1234567890'`)
- **Email**: `{ email: string, deviceName?: string }` - Email address
- **Passkey**: No `setupData` required (or empty object `{}`)

**Errors**

| Code                | When                                                                                                      | Details                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `VALIDATION_FAILED` | DTO validation fails, provider not registered, method not enabled, service unavailable, or email required | `{ validationErrors: Record<string, string[]> }` or `undefined` |
| `NOT_FOUND`         | User not found                                                                                            | `undefined`                                                     |
| `PHONE_REQUIRED`    | SMS method requires phone number                                                                          | `undefined`                                                     |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**VALIDATION_FAILED details**

When DTO validation fails, `details` includes:

```json
{
  "validationErrors": {
    "sub": ["User sub must be a valid UUID v4 format"],
    "methodName": ["Method name must be one of: totp, sms, email, passkey"]
  }
}
```

When provider not registered, method not enabled, service unavailable, or email required, `details` is `undefined`.

**Example - TOTP Setup**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Post('mfa/setup/totp')
async setupTOTP(@CurrentUser() user: IUser) {
  const result = await this.mfaService.setup({
    methodName: 'totp',
    // setupData not required for TOTP
  });
  // result.setupData contains: { secret, qrCode, manualEntryKey, issuer, accountName }
  return result;
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/mfa/setup/totp', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.setup({
    methodName: 'totp',
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/mfa/setup/totp',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async () => {
    return nauth.mfaService.setup({
      methodName: 'totp',
    });
  }),
);
```

</TabItem>
</Tabs>

**Example - SMS Setup**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Post('mfa/setup/sms')
async setupSMS(@CurrentUser() user: IUser, @Body() body: { phoneNumber: string; deviceName?: string }) {
  const result = await this.mfaService.setup({
    methodName: 'sms',
    setupData: {
      phoneNumber: body.phoneNumber, // E.164 format: '+1234567890'
      deviceName: body.deviceName,   // Optional: 'My iPhone'
    },
  });
  // If phone verified: result.setupData = { deviceId, autoCompleted: true }
  // If phone not verified: result.setupData = { maskedPhone: '***-***-7890' }
  return result;
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/mfa/setup/sms', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.setup({
    methodName: 'sms',
    setupData: {
      phoneNumber: req.body.phoneNumber,
      deviceName: req.body.deviceName,
    },
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/mfa/setup/sms',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const user = nauth.helpers.getCurrentUser();
    return nauth.mfaService.setup({
      methodName: 'sms',
      setupData: {
        phoneNumber: req.body.phoneNumber,
        deviceName: req.body.deviceName,
      },
    });
  }),
);
```

</TabItem>
</Tabs>

**Example - Email Setup**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Post('mfa/setup/email')
async setupEmail(@CurrentUser() user: IUser, @Body() body: { email?: string; deviceName?: string }) {
  const result = await this.mfaService.setup({
    methodName: 'email',
    setupData: {
      email: body.email || user.email, // Optional if user.email exists
      deviceName: body.deviceName,     // Optional: 'My Email'
    },
  });
  // If email verified: result.setupData = { deviceId, autoCompleted: true }
  // If email not verified: result.setupData = { maskedEmail: 'u***r@example.com' }
  return result;
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/mfa/setup/email', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.setup({
    methodName: 'email',
    setupData: {
      email: req.body.email || req.user.email,
      deviceName: req.body.deviceName,
    },
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/mfa/setup/email',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const user = nauth.helpers.getCurrentUser();
    return nauth.mfaService.setup({
      methodName: 'email',
      setupData: {
        email: req.body.email || user.email,
        deviceName: req.body.deviceName,
      },
    });
  }),
);
```

</TabItem>
</Tabs>

**Example - Passkey Setup**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Post('mfa/setup/passkey')
async setupPasskey(@CurrentUser() user: IUser) {
  const result = await this.mfaService.setup({
    methodName: 'passkey',
    // setupData not required for Passkey
  });
  // result.setupData.options contains WebAuthn registration options
  // Pass to navigator.credentials.create({ publicKey: result.setupData.options })
  return result;
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/mfa/setup/passkey', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.setup({
    methodName: 'passkey',
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/mfa/setup/passkey',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async () => {
    const user = nauth.helpers.getCurrentUser();
    return nauth.mfaService.setup({
      methodName: 'passkey',
    });
  }),
);
```

</TabItem>
</Tabs>

---

### verifyCode()

Verify MFA code using appropriate provider. Routes verification to the correct provider based on method name.

```typescript
async verifyCode(dto: VerifyMFACodeDTO): Promise<VerifyMFACodeResponseDTO>
```

**Parameters**

| Property     | Type                                | Required | Description                                                                                                                                      |
| ------------ | ----------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sub`        | `string`                            | Yes      | User sub (UUID v4)                                                                                                                               |
| `methodName` | `string`                            | Yes      | MFA method name. Must be one of: `totp`, `sms`, `email`, `passkey`, `backup`                                                                     |
| `code`       | `string \| Record<string, unknown>` | Yes      | Verification code or credential. For `totp`/`sms`/`email`/`backup`: string code. For `passkey`: object with `credential` and `expectedChallenge` |
| `deviceId`   | `number`                            | No       | Optional device ID to verify against specific device                                                                                             |

**Returns**

| Property | Type      | Description                   |
| -------- | --------- | ----------------------------- |
| `valid`  | `boolean` | True if verification succeeds |

**Errors**

| Code                             | When                                                                                   | Details                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `VALIDATION_FAILED`              | DTO validation fails, provider not registered, or backup code verification unavailable | `{ validationErrors: Record<string, string[]> }` or `undefined`   |
| `NOT_FOUND`                      | User not found                                                                         | `undefined`                                                       |
| `VERIFICATION_CODE_INVALID`      | Invalid verification code (SMS/Email methods)                                          | `{ attemptsRemaining: number }` or `undefined`                    |
| `VERIFICATION_CODE_EXPIRED`      | Verification code has expired (SMS/Email methods)                                      | `undefined`                                                       |
| `VERIFICATION_TOO_MANY_ATTEMPTS` | Too many verification attempts (SMS/Email methods)                                     | `{ maxAttempts: number, currentAttempts: number }` or `undefined` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Post('mfa/verify')
async verify(@CurrentUser() user: IUser, @Body() body: { method: string; code: string }) {
  return await this.mfaService.verifyCode({
    sub: user.sub,
    methodName: body.method,
    code: body.code
  });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/mfa/verify', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.verifyCode({
    sub: req.user.sub,
    methodName: req.body.method,
    code: req.body.code,
    deviceId: req.body.deviceId,
  });
  res.json(result);
});
```

</TabItem>

<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/mfa/verify',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const user = nauth.helpers.getCurrentUser();
    return nauth.mfaService.verifyCode({
      sub: user.sub,
      methodName: req.body.method,
      code: req.body.code,
      deviceId: req.body.deviceId,
    });
  }),
);
```

</TabItem>
</Tabs>

---

## Error Handling

- [MFA Packages](/docs/api/mfa/overview) - MFA provider packages
- [Challenge System](/docs/concepts/challenge-system) - MFA challenge flows
- [NAuthException](../exceptions/nauth-exception) - Error handling
- [DTOs Overview](../dto/overview) - All available DTOs
