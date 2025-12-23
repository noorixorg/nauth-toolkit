---
title: MFAService
description: MFA provider registry and orchestration service for TOTP, SMS, Email, and Passkey authentication
sidebar_position: 6
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

**Request DTO:** [GetAvailableMethodsDTO](../dto/get-available-methods-dto)

| Property | Type     | Required | Description        |
| -------- | -------- | -------- | ------------------ |
| `sub`    | `string` | Yes      | User sub (UUID v4) |

**Errors**

| Code        | When           | Details               |
| ----------- | -------------- | --------------------- |
| `NOT_FOUND` | User not found | `{ userId?: string }` |

**Response DTO:** [GetAvailableMethodsResponseDTO](../dto/get-available-methods-dto)

| Property           | Type       | Description                     |
| ------------------ | ---------- | ------------------------------- |
| `availableMethods` | `string[]` | Array of available method names |

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

### getChallengeData()

Get MFA challenge data during MFA_REQUIRED challenge. Currently only used for passkey authentication to get WebAuthn options.

```typescript
async getChallengeData(dto: GetChallengeDataDTO): Promise<GetChallengeDataResponseDTO>
```

**Request DTO:** [GetChallengeDataDTO](../dto/get-challenge-data-dto)

| Property  | Type        | Required | Description                         |
| --------- | ----------- | -------- | ----------------------------------- |
| `session` | `string`    | Yes      | Challenge session token (UUID v4)   |
| `method`  | `'passkey'` | Yes      | MFA method (currently only passkey) |

**Response DTO:** [GetChallengeDataResponseDTO](../dto/get-challenge-data-response-dto)

| Property        | Type                      | Description                      |
| --------------- | ------------------------- | -------------------------------- |
| `challengeData` | `Record<string, unknown>` | Provider-specific challenge data |

**Errors**

| Code                        | When                             | Details |
| --------------------------- | -------------------------------- | ------- |
| `INVALID_CHALLENGE_SESSION` | Session token invalid or expired | `{}`    |
| `VALIDATION_FAILED`         | Expected MFA_REQUIRED challenge  | `{}`    |
| `INTERNAL_ERROR`            | Challenge service unavailable    | `{}`    |

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

**Request DTO:** [GetMFAStatusDTO](../dto/get-mfa-status-dto)

| Property | Type     | Required | Description        |
| -------- | -------- | -------- | ------------------ |
| `sub`    | `string` | Yes      | User sub (UUID v4) |

**Response DTO:** [GetMFAStatusResponseDTO](../dto/get-mfa-status-dto)

| Property             | Type                     | Description                            |
| -------------------- | ------------------------ | -------------------------------------- |
| `enabled`            | `boolean`                | Whether MFA is enabled                 |
| `required`           | `boolean`                | Whether MFA is required                |
| `configuredMethods`  | `Array<MFADeviceMethod>` | Array of configured device methods     |
| `availableMethods`   | `Array<string>`          | Array of available method names        |
| `hasBackupCodes`     | `boolean`                | Whether user has backup codes          |
| `preferredMethod`    | `MFADeviceMethod?`       | Preferred MFA method (if set)          |
| `mfaExempt`          | `boolean`                | Whether user is exempt from MFA        |
| `mfaExemptReason`    | `string \| null`         | Reason for exemption (if exempt)       |
| `mfaExemptGrantedAt` | `Date \| null`           | Date exemption was granted (if exempt) |

**Errors**

| Code        | When           | Details               |
| ----------- | -------------- | --------------------- |
| `NOT_FOUND` | User not found | `{ userId?: string }` |

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

**Request DTO:** [GetSetupDataDTO](../dto/get-setup-data-dto)

| Property    | Type                      | Required | Description                       |
| ----------- | ------------------------- | -------- | --------------------------------- |
| `session`   | `string`                  | Yes      | Challenge session token (UUID v4) |
| `method`    | `MFAMethod`               | Yes      | MFA method to set up              |
| `setupData` | `Record<string, unknown>` | No       | Optional setup data               |

**Response DTO:** [GetSetupDataResponseDTO](../dto/get-setup-data-response-dto)

| Property    | Type                      | Description                  |
| ----------- | ------------------------- | ---------------------------- |
| `setupData` | `Record<string, unknown>` | Provider-specific setup data |

**Errors**

| Code                        | When                                  | Details |
| --------------------------- | ------------------------------------- | ------- |
| `INVALID_CHALLENGE_SESSION` | Session token invalid or expired      | `{}`    |
| `VALIDATION_FAILED`         | Expected MFA_SETUP_REQUIRED challenge | `{}`    |
| `PHONE_REQUIRED`            | SMS method requires phone number      | `{}`    |
| `INTERNAL_ERROR`            | Challenge service unavailable         | `{}`    |

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

Get all MFA devices for a user.

```typescript
async getUserDevices(dto: GetUserDevicesDTO): Promise<GetUserDevicesResponseDTO>
```

**Request DTO:** [GetUserDevicesDTO](../dto/get-user-devices-dto)

| Property | Type     | Required | Description        |
| -------- | -------- | -------- | ------------------ |
| `sub`    | `string` | Yes      | User sub (UUID v4) |

**Errors**

| Code        | When           | Details               |
| ----------- | -------------- | --------------------- |
| `NOT_FOUND` | User not found | `{ userId?: string }` |

**Response DTO:** [GetUserDevicesResponseDTO](../dto/get-user-devices-dto)

| Property  | Type           | Description                 |
| --------- | -------------- | --------------------------- |
| `devices` | `IMFADevice[]` | Array of user's MFA devices |

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

**Request DTO:** [HasProviderDTO](../dto/has-provider-dto)

| Property     | Type     | Required | Description          |
| ------------ | -------- | -------- | -------------------- |
| `methodName` | `string` | Yes      | Provider method name |

**Response DTO:** [HasProviderResponseDTO](../dto/has-provider-dto)

| Property      | Type      | Description             |
| ------------- | --------- | ----------------------- |
| `hasProvider` | `boolean` | True if provider exists |

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

**Request DTO:** None

**Response DTO:** [ListProvidersResponseDTO](../dto/list-providers-response-dto)

| Property    | Type       | Description           |
| ----------- | ---------- | --------------------- |
| `providers` | `string[]` | Array of method names |

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

**Request DTO:** [RemoveDevicesDTO](../dto/remove-devices-dto)

| Property     | Type     | Required | Description               |
| ------------ | -------- | -------- | ------------------------- |
| `userSub`    | `string` | Yes      | User sub (UUID v4)        |
| `methodType` | `string` | Yes      | MFA method type to remove |

**Response DTO:** [RemoveDevicesResponseDTO](../dto/remove-devices-dto)

| Property       | Type      | Description               |
| -------------- | --------- | ------------------------- |
| `deletedCount` | `number`  | Number of devices deleted |
| `mfaDisabled`  | `boolean` | Whether MFA was disabled  |

**Errors**

| Code                | When                                    | Details               |
| ------------------- | --------------------------------------- | --------------------- |
| `VALIDATION_FAILED` | Invalid method type or no devices found | `{}`                  |
| `NOT_FOUND`         | User not found                          | `{ userId?: string }` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Delete('mfa/devices/:method')
async removeMethod(@CurrentUser() user: IUser, @Param('method') method: string) {
  return await this.mfaService.removeDevices({ userSub: user.sub, methodType: method });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.delete('/mfa/devices/:method', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.removeDevices({
    userSub: req.user.sub,
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
    const user = nauth.helpers.getCurrentUser();
    return nauth.mfaService.removeDevices({
      userSub: user.sub,
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

**Request DTO:** [SetMFAExemptionDTO](../dto/set-mfa-exemption-dto)

| Property    | Type             | Required | Description                              |
| ----------- | ---------------- | -------- | ---------------------------------------- |
| `userSub`   | `string`         | Yes      | User sub (UUID v4)                       |
| `exempt`    | `boolean`        | Yes      | Grant (true) or revoke (false) exemption |
| `reason`    | `string \| null` | No       | Reason for exemption change              |
| `grantedBy` | `string \| null` | No       | Admin identifier                         |

**Response DTO:** [SetMFAExemptionResponseDTO](../dto/set-mfa-exemption-dto)

| Property             | Type             | Description                |
| -------------------- | ---------------- | -------------------------- |
| `mfaExempt`          | `boolean`        | Whether user is exempt     |
| `mfaExemptReason`    | `string \| null` | Reason for exemption       |
| `mfaExemptGrantedAt` | `Date \| null`   | Date exemption was granted |

**Errors**

| Code        | When           | Details               |
| ----------- | -------------- | --------------------- |
| `NOT_FOUND` | User not found | `{ userId?: string }` |

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

**Request DTO:** [SetPreferredMethodDTO](../dto/set-preferred-method-dto)

| Property     | Type     | Required | Description                         |
| ------------ | -------- | -------- | ----------------------------------- |
| `userSub`    | `string` | Yes      | User sub (UUID v4)                  |
| `methodType` | `string` | Yes      | MFA method type to set as preferred |

**Response DTO:** [SetPreferredMethodResponseDTO](../dto/set-preferred-method-dto)

| Property  | Type     | Description     |
| --------- | -------- | --------------- |
| `message` | `string` | Success message |

**Errors**

| Code                | When                                         | Details               |
| ------------------- | -------------------------------------------- | --------------------- |
| `VALIDATION_FAILED` | Invalid method type or method not configured | `{}`                  |
| `NOT_FOUND`         | User not found                               | `{ userId?: string }` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Put('mfa/preferred')
async setPreferred(@CurrentUser() user: IUser, @Body() body: { method: string }) {
  return await this.mfaService.setPreferredMethod({
    userSub: user.sub,
    methodType: body.method
  });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.put('/mfa/preferred', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.setPreferredMethod({
    userSub: req.user.sub,
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
    const user = nauth.helpers.getCurrentUser();
    return nauth.mfaService.setPreferredMethod({
      userSub: user.sub,
      methodType: req.body.method,
    });
  }),
);
```

</TabItem>
</Tabs>

---

### setup()

Setup MFA device using appropriate provider.

```typescript
async setup(dto: SetupMFADTO): Promise<SetupMFAResponseDTO>
```

**Request DTO:** [SetupMFADTO](../dto/setup-mfa-dto)

| Property     | Type                      | Required | Description                           |
| ------------ | ------------------------- | -------- | ------------------------------------- |
| `sub`        | `string`                  | Yes      | User sub (UUID v4)                    |
| `methodName` | `string`                  | Yes      | MFA method name                       |
| `setupData`  | `Record<string, unknown>` | No       | Optional provider-specific setup data |

**Response DTO:** [SetupMFAResponseDTO](../dto/setup-mfa-dto)

| Property    | Type                      | Description                      |
| ----------- | ------------------------- | -------------------------------- |
| `setupData` | `Record<string, unknown>` | Provider-specific setup response |

**Errors**

| Code                | When                    | Details |
| ------------------- | ----------------------- | ------- |
| `VALIDATION_FAILED` | Provider not registered | `{}`    |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Post('mfa/setup')
async setupMFA(@CurrentUser() user: IUser, @Body() body: { method: string; setupData?: unknown }) {
  return await this.mfaService.setup({
    sub: user.sub,
    methodName: body.method,
    setupData: body.setupData
  });
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/mfa/setup', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.setup({
    sub: req.user.sub,
    methodName: req.body.method,
    setupData: req.body.setupData,
  });
  res.json(result);
});
```

</TabItem>

<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/mfa/setup',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    const user = nauth.helpers.getCurrentUser();
    return nauth.mfaService.setup({
      sub: user.sub,
      methodName: req.body.method,
      setupData: req.body.setupData,
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

**Request DTO:** [VerifyMFACodeDTO](../dto/verify-mfa-code-dto)

| Property     | Type                                | Required | Description                     |
| ------------ | ----------------------------------- | -------- | ------------------------------- |
| `sub`        | `string`                            | Yes      | User sub (UUID v4)              |
| `methodName` | `string`                            | Yes      | MFA method name                 |
| `code`       | `string \| Record<string, unknown>` | Yes      | Verification code or credential |
| `deviceId`   | `number`                            | No       | Optional device ID              |

**Response DTO:** [VerifyMFACodeResponseDTO](../dto/verify-mfa-code-dto)

| Property | Type      | Description                   |
| -------- | --------- | ----------------------------- |
| `valid`  | `boolean` | True if verification succeeds |

**Errors**

| Code                | When                                       | Details |
| ------------------- | ------------------------------------------ | ------- |
| `VALIDATION_FAILED` | Method not available or verification fails | `{}`    |

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
  await this.mfaService.setPreferredMethod({ userSub: user.sub, methodType: method });
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
  await nauth.mfaService.setPreferredMethod({ userSub: user.sub, methodType: method });
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
  await nauth.mfaService.setPreferredMethod({ userSub: user.sub, methodType: method });
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
