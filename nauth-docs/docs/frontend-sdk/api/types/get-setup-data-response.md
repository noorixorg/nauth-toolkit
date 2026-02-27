---
title: GetSetupDataResponse
description: Response containing provider-specific MFA setup data
keywords: [mfa, setup, response, totp, qr, passkey, api]
image: /img/api-social-card.png
---

# GetSetupDataResponse

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Response containing method-specific MFA setup data returned by `getSetupData()`.

```typescript
import { GetSetupDataResponse } from '@nauth-toolkit/client';
```

## Properties

| Property    | Type                      | Required | Description                                               |
| ----------- | ------------------------- | -------- | --------------------------------------------------------- |
| `setupData` | `Record<string, unknown>` | Yes      | Provider-specific setup data. Structure varies by method. |

## Setup Data by Method

| Method  | Structure                                                                                                 | Description                               |
| ------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| TOTP    | `{ secret: string, qrCode: string, manualEntryKey: string, issuer: string, accountName: string }`     | QR code and secret for authenticator apps |
| SMS     | `{ maskedPhone: string }` or `{ deviceId: number, autoCompleted: true }`                                 | Masked phone number for verification      |
| Email   | `{ maskedEmail: string }` or `{ deviceId: number, autoCompleted: true }`                                  | Masked email for verification             |
| Passkey | WebAuthn registration options                                                                             | WebAuthn credential creation options      |

## Examples

**TOTP Setup:**

```typescript
const setupData = await client.getSetupData(session, 'totp');
// setupData.setupData contains:
// {
//   secret: 'JBSWY3DPEHPK3PXP',           // Base32-encoded secret
//   qrCode: 'data:image/png;base64,...',  // QR code data URL
//   manualEntryKey: 'JBSW Y3DP EHPK 3PXP', // Formatted secret for manual entry
//   issuer: 'MyApp',                      // Issuer name from config
//   accountName: 'user@example.com'       // User's email/identifier
// }

console.log(setupData.setupData.qrCode); // Display QR code
console.log(setupData.setupData.manualEntryKey); // Show manual entry option
```

**SMS Setup:**

```typescript
const setupData = await client.getSetupData(session, 'sms');
console.log(setupData.setupData.maskedPhone); // "***-***-7890"
```

**Angular:**

```typescript
this.authService.getSetupData(session, 'totp').subscribe((response) => {
  this.qrCode = response.setupData.qrCode;
  this.secret = response.setupData.secret;
});
```

## Related Types

- [`MFAMethod`](./mfa-method) - Available MFA methods
- [`MFAStatus`](./mfa-status) - MFA status and configuration
- [`ChallengeResponse`](./challenge-response) - Challenge response union

## Used By

- [NAuthClient.getSetupData()](../nauth-client#getsetupdata) - Returns [`GetSetupDataResponse`](./get-setup-data-response)
- [Angular AuthService.getSetupData()](../../angular/auth-service#getsetupdata) - Observable wrapper
- [MFA Setup Guide](../../guides/mfa-setup) - Complete MFA setup guide
