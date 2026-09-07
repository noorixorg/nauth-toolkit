---
title: ForgotPasswordDTO
description: Account recovery DTOs for requesting and confirming password reset via code. Includes identifier validation and password reset confirmation.
keywords: [forgot password, password reset, dto, authentication, account recovery, code, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ForgotPasswordDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for account recovery: request a password reset code and confirm the reset with a code and new password.

::::note[Social-first accounts]
Social-only (social-first) accounts can use this flow to **set their first password**, enabling both password and social login afterward.
::::

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import {
  ForgotPasswordDTO,
  ForgotPasswordResponseDTO,
  ConfirmForgotPasswordDTO,
  ConfirmForgotPasswordResponseDTO,
} from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import {
  ForgotPasswordDTO,
  ForgotPasswordResponseDTO,
  ConfirmForgotPasswordDTO,
  ConfirmForgotPasswordResponseDTO,
} from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import {
  ForgotPasswordDTO,
  ForgotPasswordResponseDTO,
  ConfirmForgotPasswordDTO,
  ConfirmForgotPasswordResponseDTO,
} from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## ForgotPasswordDTO

Request a password reset code for an account. Optionally includes a base URL to generate a reset link.

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `identifier` | `string` | Yes | Account identifier (email/username/phone). 1-255 chars. Trimmed. Lowercased if email (contains `@`). |
| `baseUrl` | `string` | No | **Server-trusted; ignored on the public route.** The shipped `POST /auth/forgot-password` route builds the reset link from `password.passwordReset.baseUrl` and ignores any `baseUrl` in the request body (so it can't be pointed at an attacker host). This field is honoured only when a trusted server-side caller passes it to `AuthService.forgotPassword` directly (e.g. a custom controller computing a per-user link). Valid http/https URL, max 2048 chars. |

## ForgotPasswordResponseDTO

Response for a password reset request.

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `success` | `boolean` | Yes | Always `true` when request is accepted (non-enumerating). |
| `destination` | `string` | No | Masked delivery destination when available (e.g., `j***@example.com`). |
| `deliveryMedium` | `'email' \| 'sms'` | No | Delivery channel used. |
| `expiresIn` | `number` | No | Code expiry in seconds. |

## ConfirmForgotPasswordDTO

:::note
`ConfirmForgotPasswordDTO` is defined in a separate source file (`confirm-forgot-password.dto.ts`) but is exported alongside `ForgotPasswordDTO` for convenience.
:::

Confirm password reset using a delivered code and set a new password.

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `identifier` | `string` | Yes | Account identifier (email/username/phone). 1-255 chars. Trimmed. Lowercased if email (contains `@`). |
| `code` | `string` | Yes | Reset code. Digits only. Exactly 6 characters. Trimmed. |
| `newPassword` | `string` | Yes | New password. 8-128 chars. Not trimmed. |

## ConfirmForgotPasswordResponseDTO

Response for a confirmed password reset.

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `success` | `boolean` | Yes | `true` when reset is confirmed and password updated. |
| `mustChangePassword` | `boolean` | Yes | Whether user must change password on next sign-in (typically `false` for forgot-password flows). |

## Example

**Request Reset Code (code only):**

```json
{
  "identifier": "user@example.com"
}
```

**Request Reset Code with Link:**

```json
{
  "identifier": "user@example.com"
}
```

The reset link is built as `${baseUrl}?code=<code>`, where `baseUrl` comes from `password.passwordReset.baseUrl` (server config) for the shipped route — the request body cannot set it. The code is always sent; the link is included only when a base URL is configured (or passed by a trusted server-side caller).

**Confirm Reset:**

```json
{
  "identifier": "user@example.com",
  "code": "123456",
  "newPassword": "NewSecurePass123!"
}
```

## Used By

- [AuthService.forgotPassword()](../services/auth-service#forgotpassword)
- [AuthService.confirmForgotPassword()](../services/auth-service#confirmforgotpassword)




