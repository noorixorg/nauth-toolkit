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

### getAvailableMethods()

Get available MFA methods for a user. Returns all registered and allowed methods that can be set up.

```typescript
async getAvailableMethods(dto: GetAvailableMethodsDTO): Promise<GetAvailableMethodsResponseDTO>
```

**Parameters**

- `dto` - [`GetAvailableMethodsDTO`](../dto/get-available-methods-dto)

**Returns**

- [`GetAvailableMethodsResponseDTO`](../dto/get-available-methods-dto) - `{ availableMethods: string[] }`

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
    "sub": ["User sub must be a valid UUID v4 format"]
  }
}
```

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Get('mfa/methods')
async getMethods(@CurrentUser() user: IUser) {
  return await this.mfaService.getAvailableMethods({ sub: user.sub });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/mfa/methods', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.getAvailableMethods({ sub: req.user.sub });
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
    const user = nauth.helpers.getCurrentUser();
    return nauth.mfaService.getAvailableMethods({ sub: user.sub });
  }),
);
```

</TabItem>
</Tabs>

---

### adminRemoveDevices()

Admin-only helper to remove a user's MFA devices by method type.

```typescript
async adminRemoveDevices(dto: AdminRemoveDevicesDTO): Promise<RemoveDevicesResponseDTO>
```

**Parameters**

- `dto` - [`AdminRemoveDevicesDTO`](../dto/admin-remove-devices-dto)

**Returns**

- [`RemoveDevicesResponseDTO`](../dto/remove-devices-dto)

**Example (NestJS)**

```typescript
@Post('admin/mfa/remove-devices')
async adminRemoveDevices(@Body() dto: AdminRemoveDevicesDTO) {
  return await this.mfaService.adminRemoveDevices(dto);
}
```

---

### adminSetPreferredMethod()

Admin-only helper to set a user's preferred MFA method.

```typescript
async adminSetPreferredMethod(dto: AdminSetPreferredMethodDTO): Promise<SetPreferredMethodResponseDTO>
```

**Parameters**

- `dto` - [`AdminSetPreferredMethodDTO`](../dto/admin-set-preferred-method-dto)

**Returns**

- [`SetPreferredMethodResponseDTO`](../dto/set-preferred-method-dto)

**Example (NestJS)**

```typescript
@Post('admin/mfa/preferred-method')
async adminSetPreferred(@Body() dto: AdminSetPreferredMethodDTO) {
  return await this.mfaService.adminSetPreferredMethod(dto);
}
```

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

### getMFAStatus()

Get comprehensive MFA status for a user including enabled status, configured methods, available methods, backup codes, and exemption information.

```typescript
async getMFAStatus(dto: GetMFAStatusDTO): Promise<GetMFAStatusResponseDTO>
```

**Parameters**

- `dto` - [`GetMFAStatusDTO`](../dto/get-mfa-status-dto)

**Returns**

- [`GetMFAStatusResponseDTO`](../dto/get-mfa-status-dto) - `{ enabled: boolean, required: boolean, configuredMethods: MFADeviceMethod[], availableMethods: string[], hasBackupCodes: boolean, preferredMethod?: MFADeviceMethod, mfaExempt: boolean, mfaExemptReason: string | null, mfaExemptGrantedAt: Date | null }`

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
    "sub": ["User sub must be a valid UUID v4 format"]
  }
}
```

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Get('mfa/status')
async getStatus(@CurrentUser() user: IUser) {
  return await this.mfaService.getMFAStatus({ sub: user.sub });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/mfa/status', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.getMFAStatus({ sub: req.user.sub });
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
    const user = nauth.helpers.getCurrentUser();
    return nauth.mfaService.getMFAStatus({ sub: user.sub });
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

Get all active MFA devices for a user.

```typescript
async getUserDevices(dto: GetUserDevicesDTO): Promise<GetUserDevicesResponseDTO>
```

**Parameters**

- `dto` - [`GetUserDevicesDTO`](../dto/get-user-devices-dto)

**Returns**

- [`GetUserDevicesResponseDTO`](../dto/get-user-devices-dto) - `{ devices: IMFADevice[] }`

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
    "sub": ["User sub must be a valid UUID v4 format"]
  }
}
```

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Get('mfa/devices')
async getDevices(@CurrentUser() user: IUser) {
  return await this.mfaService.getUserDevices({ sub: user.sub });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/mfa/devices', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.getUserDevices({ sub: req.user.sub });
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
    const user = nauth.helpers.getCurrentUser();
    return nauth.mfaService.getUserDevices({ sub: user.sub });
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

### removeDevices()

Remove all MFA devices of a specific method type for a user. Automatically disables MFA if this was the last device and updates preferred method if needed.

```typescript
async removeDevices(dto: RemoveDevicesDTO): Promise<RemoveDevicesResponseDTO>
```

**Parameters**

- `dto` - [`RemoveDevicesDTO`](../dto/remove-devices-dto)

**Returns**

- [`RemoveDevicesResponseDTO`](../dto/remove-devices-dto) - `{ deletedCount: number, mfaDisabled: boolean }`

**Errors**

| Code                | When                                                           | Details                                                         |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| `VALIDATION_FAILED` | DTO validation fails, invalid method type, or no devices found | `{ validationErrors: Record<string, string[]> }` or `undefined` |
| `NOT_FOUND`         | User not found                                                 | `undefined`                                                     |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**VALIDATION_FAILED details**

When DTO validation fails, `details` includes:

```json
{
  "validationErrors": {
    "methodType": ["Method type must be one of: totp, sms, email, passkey"]
  }
}
```

When invalid method type or no devices found, `details` is `undefined`.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Delete('mfa/devices/:method')
async removeMethod(@Param('method') method: string) {
  return await this.mfaService.removeDevices({ methodType: method });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.delete('/mfa/devices/:method', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.removeDevices({
    methodType: req.params.method,
  });
  res.json(result);
});
```

</TabItem>

<TabItem value="fastify" label="Fastify">

```typescript
fastify.delete(
  '/mfa/devices/:method',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    return nauth.mfaService.removeDevices({
      methodType: req.params.method,
    });
  }),
);
```

</TabItem>
</Tabs>

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

### setPreferredMethod()

Set preferred MFA method for a user. Updates the user's preferred method and device primary flags.

```typescript
async setPreferredMethod(dto: SetPreferredMethodDTO): Promise<SetPreferredMethodResponseDTO>
```

**Parameters**

- `dto` - [`SetPreferredMethodDTO`](../dto/set-preferred-method-dto)

**Returns**

- [`SetPreferredMethodResponseDTO`](../dto/set-preferred-method-dto) - `{ message: string }`

**Errors**

| Code                | When                                                                | Details                                                         |
| ------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `VALIDATION_FAILED` | DTO validation fails, invalid method type, or method not configured | `{ validationErrors: Record<string, string[]> }` or `undefined` |
| `NOT_FOUND`         | User not found                                                      | `undefined`                                                     |

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

**VALIDATION_FAILED details**

When DTO validation fails, `details` includes:

```json
{
  "validationErrors": {
    "methodType": ["Method type must be one of: totp, sms, email, passkey"]
  }
}
```

When invalid method type or method not configured, `details` is `undefined`.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Put('mfa/preferred')
async setPreferred(@Body() body: { method: string }) {
  return await this.mfaService.setPreferredMethod({
    methodType: body.method
  });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.put('/mfa/preferred', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.setPreferredMethod({
    methodType: req.body.method,
  });
  res.json(result);
});
```

</TabItem>

<TabItem value="fastify" label="Fastify">

```typescript
fastify.put(
  '/mfa/preferred',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    return nauth.mfaService.setPreferredMethod({
      methodType: req.body.method,
    });
  }),
);
```

</TabItem>
</Tabs>

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
    sub: user.sub,
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
    sub: req.user.sub,
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
      sub: user.sub,
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
    sub: user.sub,
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
    sub: req.user.sub,
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
      sub: user.sub,
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
    sub: user.sub,
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
    sub: req.user.sub,
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
      sub: user.sub,
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

All methods throw `NAuthException` on errors. Handle errors consistently across your application.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
try {
  await this.mfaService.setPreferredMethod({ methodType: method });
} catch (error) {
  if (error instanceof NAuthException) {
    console.log(error.code);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
try {
  await nauth.mfaService.setPreferredMethod({ methodType: method });
} catch (error) {
  if (error instanceof NAuthException) {
    res.status(error.statusCode).json(error.toJSON());
  }
}
```

</TabItem>

<TabItem value="fastify" label="Fastify">

```typescript
try {
  await nauth.mfaService.setPreferredMethod({ methodType: method });
} catch (error) {
  if (error instanceof NAuthException) {
    res.status(error.statusCode).json(error.toJSON());
  }
}
```

</TabItem>
</Tabs>

See [Error Handling Guide](/docs/concepts/error-handling).

---

## Related APIs

- [MFA Packages](/docs/api/mfa/overview) - MFA provider packages
- [Challenge System](/docs/concepts/challenge-system) - MFA challenge flows
- [NAuthException](../exceptions/nauth-exception) - Error handling
- [DTOs Overview](../dto/overview) - All available DTOs
