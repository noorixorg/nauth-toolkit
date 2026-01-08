---
title: AdminResetPasswordDTO
description: Admin-only password reset workflow DTOs for initiating code-based password resets with email/SMS delivery and optional link generation.
keywords: [admin, password, reset, workflow, dto, request, response, api, code, link]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminResetPasswordDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for admin-initiated password reset workflow. Sends verification code (and optional link) to user via email/SMS, allowing them to set their own password.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminResetPasswordDTO, AdminResetPasswordResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminResetPasswordDTO, AdminResetPasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminResetPasswordDTO, AdminResetPasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## AdminResetPasswordDTO (Request)

| Property         | Type               | Required | Description                                                                                       |
| ---------------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| `baseUrl`        | `string`           | No       | Base URL for building reset link. Valid URL with http:// or https://. Max 2048 chars.            |
| `codeExpiresIn`  | `number`           | No       | Code expiry in seconds. Min 300 (5 min), max 86400 (24 hours). Default: 3600 (1 hour).           |
| `deliveryMethod` | `'email' \| 'sms'` | No       | Delivery channel. Default: `'email'`.                                                            |
| `identifier`     | `string`           | Yes      | User identifier. Email, username, phone, or sub/UUID. 1-255 chars. Trimmed, lowercased if email. |
| `reason`         | `string`           | No       | Reason for admin-initiated reset (for audit trail). Max 500 chars. Trimmed.                      |
| `revokeSessions` | `boolean`          | No       | Revoke all active sessions immediately (before sending). Default: `false`.                       |

## AdminResetPasswordResponseDTO (Response)

| Property          | Type               | Description                                                      |
| ----------------- | ------------------ | ---------------------------------------------------------------- |
| `deliveryMedium`  | `'email' \| 'sms'` | Delivery medium used.                                            |
| `destination`     | `string`           | Masked destination where code was sent.                          |
| `expiresIn`       | `number`           | Code expiry in seconds.                                          |
| `sessionsRevoked` | `number`           | Number of sessions revoked (only if `revokeSessions` was `true`). |
| `success`         | `boolean`          | Always true on success.                                          |

## Example

```json
{
  "identifier": "user@example.com",
  "baseUrl": "https://myapp.com/reset-password",
  "deliveryMethod": "email",
  "revokeSessions": true,
  "reason": "User reported account compromise"
}
```

## Used By

- [AuthService.adminResetPassword()](../services/auth-service#adminresetpassword)

