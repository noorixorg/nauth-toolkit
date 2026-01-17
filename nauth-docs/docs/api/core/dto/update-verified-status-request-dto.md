---
title: UpdateVerifiedStatusRequestDTO
description: Request DTO for updating email and/or phone verification status. Intended for admin use cases such as migration or offline validation.
keywords: [user, update, verification, verified, email, phone, dto, request, uuid, api, admin]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# UpdateVerifiedStatusRequestDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for updating email and/or phone verification status. Intended for admin use cases such as migration or offline validation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { UpdateVerifiedStatusRequestDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { UpdateVerifiedStatusRequestDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { UpdateVerifiedStatusRequestDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property           | Type      | Required | Description                                                                                                                                    |
| ------------------ | --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `sub`              | `string`  | Yes      | User identifier. UUID v4 format. Trimmed and lowercased.                                                                                      |
| `isEmailVerified`  | `boolean` | No       | Email verification status. If `true`, user must have an email address. If `false`, can be set even if email doesn't exist (default state).    |
| `isPhoneVerified`  | `boolean` | No       | Phone verification status. If `true`, user must have a phone number. If `false`, can be set even if phone doesn't exist (default state).        |

## Validation Rules

### Email Verification

- **Setting to `true`**: User **must** have an email address. Throws `VALIDATION_FAILED` if email is missing.
- **Setting to `false`**: Allowed even if user has no email address (default state).

### Phone Verification

- **Setting to `true`**: User **must** have a phone number. Throws `VALIDATION_FAILED` if phone is missing.
- **Setting to `false`**: Allowed even if user has no phone number (default state).

### Partial Updates

- Only provided fields are updated (partial update).
- If only `isEmailVerified` is provided, only email verification is updated.
- If only `isPhoneVerified` is provided, only phone verification is updated.
- If neither field is provided, no update occurs (returns current user).

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "isEmailVerified": true
}
```

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "isEmailVerified": true,
  "isPhoneVerified": false
}
```

## Use Cases

This DTO is intended for administrative operations:

- **Migration**: Importing users from external systems with pre-verified emails/phones
- **Offline Validation**: Manual verification status corrections
- **Bulk Updates**: Updating verification status for multiple users programmatically

## Audit Trail

All verification status updates are recorded in the audit log:

- **Event Type**: `EMAIL_VERIFIED` or `PHONE_VERIFIED`
- **Event Status**: `SUCCESS` (when set to `true`) or `INFO` (when set to `false`)
- **Reason**: `admin_verification_update`
- **Metadata**:
  - `previousStatus` - Previous verification status
  - `newStatus` - New verification status
  - `updateMethod: 'admin_direct'` - Indicates admin-initiated update
- **performedBy**: Automatically populated from authenticated admin context

## Errors

Throws [`NAuthException`](../exceptions/nauth-exception) with the following codes:

| Code                | When                                                                              | Details     |
| ------------------- | --------------------------------------------------------------------------------- | ----------- |
| `NOT_FOUND`         | User not found (by `sub` identifier) or user not found after update               | `undefined` |
| `VALIDATION_FAILED` | Trying to set `isEmailVerified: true` when user has no email, or `isPhoneVerified: true` when user has no phone | `undefined` |

## Used By

- [AuthService.updateVerifiedStatus()](../services/admin-auth-service#updateverifiedstatus)

