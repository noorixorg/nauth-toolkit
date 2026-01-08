---
title: UserUpdateDTO
description: User profile update DTO with optional fields for username, name, email, phone, metadata, and MFA preferences. Includes comprehensive validation.
keywords: [user, update, profile, dto, request, username, email, phone, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# UserUpdateDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for updating user profile attributes with optional fields and validation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { UserUpdateDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { UserUpdateDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { UserUpdateDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property             | Type                      | Required | Description                                                                             |
| -------------------- | ------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `username`           | `string`                  | No       | Username. 3-255 characters. Alphanumeric, underscores, hyphens only. Trimmed.           |
| `firstName`          | `string`                  | No       | First name. 1-100 characters. Letters, spaces, hyphens, apostrophes only. Trimmed.      |
| `lastName`           | `string`                  | No       | Last name. 1-100 characters. Letters, spaces, hyphens, apostrophes only. Trimmed.       |
| `email`              | `string`                  | No       | Email address. Valid email format. Max 255 characters. Trimmed and lowercased.          |
| `phone`              | `string`                  | No       | Phone number. E.164 format (e.g., +14155552671). Max 20 characters. Whitespace removed. |
| `metadata`           | `Record<string, unknown>` | No       | Custom metadata fields. Merged with existing metadata. Set key to `null` to delete.     |
| `preferredMfaMethod` | `MFADeviceMethod`         | No       | Preferred MFA method. Must be: totp, sms, email, passkey. Max 50 characters.            |
| `retainVerification` | `boolean`                 | No       | Retain verification status when updating email/phone. Default: false.                   |

## Metadata Behavior

The `metadata` field supports merge and delete operations:

- **Add/Update**: Provide key-value pairs to add or update
- **Delete**: Set a key to `null` to remove it from metadata
- **Merge**: Existing metadata is preserved unless explicitly updated or deleted

## Examples

### Basic Update

```json
{
  "username": "johndoe",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+14155552671",
  "preferredMfaMethod": "totp",
  "retainVerification": false
}
```

### Adding/Updating Metadata

```json
{
  "metadata": {
    "department": "Engineering",
    "role": "Senior Developer"
  }
}
```

### Deleting Metadata Keys

```json
{
  "metadata": {
    "temporaryField": null,
    "oldKey": null
  }
}
```

### Mixing Metadata Operations

```json
{
  "firstName": "Jane",
  "metadata": {
    "department": "Product",
    "role": "Product Manager",
    "oldDepartment": null
  }
}
```

## Used By

- [UpdateUserAttributesRequestDTO](./update-user-attributes-request-dto) - Extends this DTO
- [AuthService.updateUserAttributes()](../services/auth-service#updateuserattributes)
