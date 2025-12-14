---
title: UpdateProfileRequest
description: User profile update request with optional fields
sidebar_position: 290
keywords: [profile, update, request, dto, api]
image: /img/api-social-card.png
---

# UpdateProfileRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Data transfer object for updating user profile information. All fields are optional; only provided fields will be updated.

```typescript
import { UpdateProfileRequest } from '@nauth-toolkit/client';
```

## Properties

| Property    | Type     | Required | Description                                         |
| ----------- | -------- | -------- | --------------------------------------------------- |
| `firstName` | `string` | No       | User first name                                     |
| `lastName`  | `string` | No       | User last name                                      |
| `email`     | `string` | No       | User email address (may trigger re-verification)    |
| `phone`     | `string` | No       | Phone number in E.164 format (e.g., `+14155551234`) |

## Example

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+14155559999"
}
```

## Used By

- [NAuthClient.updateProfile()](./../nauth-client#updateprofile)
- [AuthService.updateProfile()](./../../angular/auth-service#updateprofile)
