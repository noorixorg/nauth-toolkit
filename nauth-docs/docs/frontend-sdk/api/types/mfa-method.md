---
title: MFAMethod
description: Supported multi-factor authentication methods
sidebar_position: 170
keywords: [mfa, method, two-factor, authentication, api]
image: /img/api-social-card.png
---

# MFAMethod

**Package:** `@nauth-toolkit/client`
**Type:** Type Alias

Supported multi-factor authentication methods.

```typescript
import { MFAMethod, MFADeviceMethod } from '@nauth-toolkit/client';
```

## Types

### MFAMethod

All supported MFA methods, including backup codes:

| Value       | Description                                      |
| ----------- | ------------------------------------------------ |
| `'sms'`     | SMS verification code                            |
| `'email'`   | Email verification code                          |
| `'totp'`    | Time-based One-Time Password (authenticator app) |
| `'passkey'` | WebAuthn/FIDO2 passkey                           |
| `'backup'`  | Backup recovery codes (not a device method)      |

### MFADeviceMethod

Device MFA methods only (excludes `'backup'`). Used for:

- Preferred method selection
- Device setup
- Configured methods list

| Value       | Description                                      |
| ----------- | ------------------------------------------------ |
| `'sms'`     | SMS verification code                            |
| `'email'`   | Email verification code                          |
| `'totp'`    | Time-based One-Time Password (authenticator app) |
| `'passkey'` | WebAuthn/FIDO2 passkey                           |

## Example

```typescript
// Device method (for setup and preferred method)
const deviceMethod: MFADeviceMethod = 'totp';
await client.setupMfaDevice(deviceMethod);
await client.setPreferredMfaMethod(deviceMethod);

// All methods (includes backup for verification)
const allMethods: MFAMethod[] = ['totp', 'sms', 'backup'];
```

## Related Types

- [`MFAStatus`](./mfa-status) - Uses [`MFADeviceMethod`](./mfa-method) for `methods` and `preferredMethod`, [`MFAMethod`](./mfa-method) for `availableMethods`
- [`ChallengeResponse`](./challenge-response) - Uses [`MFAMethod`](./mfa-method) in `method` property
- [`GetSetupDataResponse`](./get-setup-data-response) - Setup data for [`MFADeviceMethod`](./mfa-method)
- [`GetChallengeDataResponse`](./get-challenge-data-response) - Challenge data for [`MFAMethod`](./mfa-method)

## Used By

- [MFAStatus](./mfa-status) - `methods` and `preferredMethod` use [`MFADeviceMethod`](./mfa-method), `availableMethods` uses [`MFAMethod`](./mfa-method)
- [ChallengeResponse](./challenge-response) - `method` property uses [`MFAMethod`](./mfa-method) values
- [NAuthClient.getSetupData()](../nauth-client#getsetupdata) - Accepts [`MFADeviceMethod`](./mfa-method) parameter
- [NAuthClient.getChallengeData()](../nauth-client#getchallengedata) - Accepts [`MFAMethod`](./mfa-method) parameter
- [NAuthClient.setupMfaDevice()](../nauth-client#setupmfadevice) - Accepts [`MFADeviceMethod`](./mfa-method) parameter
- [NAuthClient.setPreferredMfaMethod()](../nauth-client#setpreferredmfamethod) - Accepts [`MFADeviceMethod`](./mfa-method) parameter
- [MFA Setup Guide](../../guides/mfa-setup) - Complete MFA setup guide
