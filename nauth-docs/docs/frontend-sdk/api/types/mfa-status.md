---
title: MFAStatus
description: User's multi-factor authentication status and configuration
sidebar_position: 180
keywords: [mfa, status, two-factor, authentication, api]
image: /img/api-social-card.png
---

# MFAStatus

**Package:** `@nauth-toolkit/client`
**Type:** Response

User's multi-factor authentication status including enabled methods, preferred method, and exemption status.

```typescript
import { MFAStatus } from '@nauth-toolkit/client';
```

## Properties

| Property             | Type                                | Description                                                     |
| -------------------- | ----------------------------------- | --------------------------------------------------------------- |
| `enabled`            | `boolean`                           | Whether MFA is enabled for the user                             |
| `required`           | `boolean`                           | Whether MFA is required (enabled and has configured devices)    |
| `methods`            | [`MFADeviceMethod`](./mfa-method)[] | Configured MFA device methods (excludes `'backup'`)             |
| `availableMethods`   | [`MFAMethod`](./mfa-method)[]       | Available MFA methods including `'backup'` if enabled           |
| `hasBackupCodes`     | `boolean`                           | Whether user has backup codes available                         |
| `preferredMethod`    | [`MFADeviceMethod`](./mfa-method)?  | Preferred MFA method (device methods only, excludes `'backup'`) |
| `mfaExempt`          | `boolean`                           | Whether user is exempt from MFA requirements                    |
| `mfaExemptReason`    | `string \| null`                    | Reason for MFA exemption (if exempt)                            |
| `mfaExemptGrantedAt` | `Date \| string \| null`            | Timestamp when exemption was granted (if exempt)                |

## Example

```json
{
  "enabled": true,
  "required": true,
  "methods": ["totp", "sms"],
  "availableMethods": ["totp", "sms", "backup"],
  "hasBackupCodes": true,
  "preferredMethod": "totp",
  "mfaExempt": false,
  "mfaExemptReason": null,
  "mfaExemptGrantedAt": null
}
```

## Related Types

- [`MFAMethod`](./mfa-method) - All MFA methods (includes `'backup'`)
- [`MFADeviceMethod`](./mfa-method) - Device MFA methods only (excludes `'backup'`)
- [`MFADevice`](./mfa-device) - Individual MFA device information

## Used By

- [NAuthClient.getMfaStatus()](../nauth-client#getmfastatus) - Returns [`MFAStatus`](./mfa-status)
- [Angular AuthService.getMfaStatus()](../../angular/auth-service#getmfastatus) - Observable wrapper
- [MFA Setup Guide](../../guides/mfa-setup) - MFA configuration guide
