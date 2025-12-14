---
title: SignupRequest
description: User registration request with email, password, and optional profile fields
sidebar_position: 230
keywords: [signup, registration, request, dto, api]
image: /img/api-social-card.png
---

# SignupRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Data transfer object for user registration requests.

```typescript
import { SignupRequest } from '@nauth-toolkit/client';
```

## Properties

| Property    | Type     | Required | Description                                             |
| ----------- | -------- | -------- | ------------------------------------------------------- |
| `email`     | `string` | Yes      | User email address. Must be valid email format.         |
| `password`  | `string` | Yes      | User password. Must meet backend password requirements. |
| `firstName` | `string` | No       | User first name                                         |
| `lastName`  | `string` | No       | User last name                                          |
| `phone`     | `string` | No       | Phone number in E.164 format (e.g., `+14155551234`)     |

## Example

```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+14155551234"
}
```

## Related Types

- [`AuthResponse`](./auth-response) - Response containing user/tokens or challenge
- [`AuthUser`](./auth-user) - Complete user profile
- [`AuthUserSummary`](./auth-user-summary) - Minimal user info in response

## Used By

- [NAuthClient.signup()](../nauth-client#signup) - Accepts [`SignupRequest`](./signup-request)
- [Angular AuthService.signup()](../../angular/auth-service#signup) - Observable wrapper
