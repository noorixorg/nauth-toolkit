---
title: UpdateUserAttributesRequestDTO
description: User profile update request DTO extending UserUpdateDTO with user sub. Includes all optional profile fields.
keywords: [user, update, attributes, dto, request, uuid, api]
image: /img/api-social-card.png
sidebar_position: 920
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# UpdateUserAttributesRequestDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for updating user profile attributes, extending UserUpdateDTO with user identifier.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { UpdateUserAttributesRequestDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { UpdateUserAttributesRequestDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { UpdateUserAttributesRequestDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property             | Type                      | Required | Description                                                                             |
| -------------------- | ------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `sub`                | `string`                  | Yes      | User identifier. UUID v4 format. Trimmed and lowercased.                                |
| `username`           | `string`                  | No       | Username. 3-255 characters. Alphanumeric, underscores, hyphens only. Trimmed.           |
| `firstName`          | `string`                  | No       | First name. 1-100 characters. Letters, spaces, hyphens, apostrophes only. Trimmed.      |
| `lastName`           | `string`                  | No       | Last name. 1-100 characters. Letters, spaces, hyphens, apostrophes only. Trimmed.       |
| `email`              | `string`                  | No       | Email address. Valid email format. Max 255 characters. Trimmed and lowercased.          |
| `phone`              | `string`                  | No       | Phone number. E.164 format (e.g., +14155552671). Max 20 characters. Whitespace removed. |
| `metadata`           | `Record<string, unknown>` | No       | Custom metadata fields. Validated in service layer.                                     |
| `preferredMfaMethod` | `MFADeviceMethod`         | No       | Preferred MFA method. Must be: totp, sms, email, passkey. Max 50 characters.            |
| `retainVerification` | `boolean`                 | No       | Retain verification status when updating email/phone. Default: false.                   |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "username": "johndoe",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

## Impact on MFA Devices

When updating `email` or `phone`, associated MFA devices are **automatically deleted** (permanently removed):

| Field Changed | MFA Impact                                  | Audit Event                                      |
| ------------- | ------------------------------------------- | ------------------------------------------------ |
| `email`       | All Email MFA devices deleted               | `MFA_DEVICE_REMOVED` with reason `email_changed` |
| `phone`       | All SMS MFA devices with old number deleted | `MFA_DEVICE_REMOVED` with reason `phone_changed` |

**Important Notes:**

- Devices are **deleted** (not deactivated) - they cannot be reactivated with the old email/phone
- Users must re-setup affected MFA methods after email/phone changes
- If all MFA devices are deleted, MFA is disabled (`mfaEnabled = false`)
- Users will be prompted to set up MFA again at next login if MFA is required
- Set `retainVerification: true` to keep verification status (email/phone still verified)
- Only **active** devices are returned by `getUserDevices()` API

## Used By

- [AuthService.updateUserAttributes()](../services/auth-service#updateuserattributes)
