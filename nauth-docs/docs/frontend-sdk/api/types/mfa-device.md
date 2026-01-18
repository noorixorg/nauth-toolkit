---
title: MFADevice
description: MFA device information returned from device listing endpoints
keywords: [mfa, device, information, response, api]
image: /img/api-social-card.png
---

# MFADevice

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Information about a registered MFA device for the authenticated user.

```typescript
import { MFADevice } from '@nauth-toolkit/client';
```

## Properties

| Property    | Type                        | Required | Description                            |
| ----------- | --------------------------- | -------- | -------------------------------------- |
| `id`        | `number`                    | Yes      | Unique device identifier               |
| `type`      | [`MFAMethod`](./mfa-method) | Yes      | MFA method type                        |
| `name`      | `string`                    | Yes      | Device name (user-assigned)            |
| `isPrimary` | `boolean`                   | Yes      | Whether this is the primary MFA device |
| `isActive`  | `boolean`                   | Yes      | Whether device is active               |
| `createdAt` | `string \| Date`            | Yes      | Device registration timestamp          |

## Example

```json
{
  "id": 1,
  "type": "totp",
  "name": "My Phone",
  "isPrimary": true,
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

## Used By

- [NAuthClient.getMfaDevices()](../nauth-client#getmfadevices) - Returns `MFADevice[]`

## Related Types

- [`MFAMethod`](./mfa-method) - MFA method types
- [`MFAStatus`](./mfa-status) - MFA configuration and status
