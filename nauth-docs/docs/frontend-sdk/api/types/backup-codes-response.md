---
title: BackupCodesResponse
description: Response containing generated backup codes for MFA recovery
sidebar_position: 90
keywords: [mfa, backup, codes, recovery, response, api]
image: /img/api-social-card.png
---

# BackupCodesResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response containing generated backup codes for MFA recovery.

```typescript
import { BackupCodesResponse } from '@nauth-toolkit/client';
```

## Properties

| Property | Type       | Required | Description                            |
| -------- | ---------- | -------- | -------------------------------------- |
| `codes`  | `string[]` | Yes      | Array of backup codes (store securely) |

## Example

```json
{
  "codes": ["ABC123", "DEF456", "GHI789", "JKL012", "MNO345"]
}
```

## Used By

- [NAuthClient.generateBackupCodes()](../nauth-client#generatebackupcodes) - Returns [`BackupCodesResponse`](./backup-codes-response)

## Related Types

- [`MFAMethod`](./mfa-method) - MFA method types
- [`MFAStatus`](./mfa-status) - MFA configuration
