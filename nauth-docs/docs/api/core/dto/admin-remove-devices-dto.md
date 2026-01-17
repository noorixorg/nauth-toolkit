---
title: AdminRemoveDevicesDTO
description: Admin DTO for removing a user's MFA devices by method type
keywords: [admin, mfa, dto, remove-devices]
---

## Overview

`AdminRemoveDevicesDTO` is the **admin** variant of [`RemoveDevicesDTO`](./remove-devices-dto).

- **Admin**: must explicitly target the user via `sub`
- **User self-service**: uses authenticated context (no `sub` in the DTO)

## Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `sub` | `string` | Yes | Target user identifier (UUID v4) |
| `methodType` | `string` | Yes | MFA method to remove: `totp`, `sms`, `email`, `passkey` |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "methodType": "totp"
}
```

