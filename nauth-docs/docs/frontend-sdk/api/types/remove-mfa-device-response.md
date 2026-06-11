---
title: RemoveMFADeviceResponse
description: Response returned when removing a single MFA device by id
keywords: [mfa, device, remove, response, api]
image: /img/api-social-card.png
---

# RemoveMFADeviceResponse

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Response returned by `removeMfaDeviceById()` after deleting a single MFA device.

## Properties

| Property           | Type                              | Description                                          |
| ------------------ | --------------------------------- | ---------------------------------------------------- |
| `removedDeviceId`  | `number`                          | The device ID that was removed                       |
| `removedMethod`    | [`MFADeviceMethod`](./mfa-method) | The MFA method of the removed device                 |
| `mfaDisabled`      | `boolean`                         | Whether MFA was disabled (removed device was the last) |

## Example

```json
{
  "removedDeviceId": 123,
  "removedMethod": "totp",
  "mfaDisabled": false
}
```

## Used By

- [NAuthClient.removeMfaDeviceById()](../nauth-client#removemfadevicebyid) - Returns `RemoveMFADeviceResponse`

