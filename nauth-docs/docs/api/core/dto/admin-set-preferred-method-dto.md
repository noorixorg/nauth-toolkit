---
title: AdminSetPreferredMethodDTO
description: Admin DTO for setting a user's preferred MFA method
keywords: [admin, mfa, dto, preferred-method]
---

## Overview

`AdminSetPreferredMethodDTO` is the **admin** variant of [`SetPreferredMethodDTO`](./set-preferred-method-dto).

- **Admin**: must explicitly target the user via `sub`
- **User self-service**: uses authenticated context (no `sub` in the DTO)

## Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `sub` | `string` | Yes | Target user identifier (UUID v4) |
| `methodType` | `string` | Yes | Preferred MFA method: `totp`, `sms`, `email`, `passkey` |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "methodType": "sms"
}
```

