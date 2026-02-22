---
title: EmailProvider
description: Interface for email providers used for verification, password reset, and onboarding emails
keywords: [email, provider, interface, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# EmailProvider

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Contract for sending email messages (verification, password reset, welcome, and optional security notifications).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { EmailProvider } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { EmailProvider } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { EmailProvider } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `sendVerificationEmail(to, code, link?, expiryMinutes?)` | `Promise<void>` | Send email verification code (and optional link) |
| `sendMFAEmailCode(to, code, expiryMinutes?)` | `Promise<void>` | Send MFA email code for two-factor authentication challenge |
| `sendPasswordResetEmail(to, token, code, link?, expiryMinutes?)` | `Promise<void>` | Send password reset email. `code` is always sent. `link` is optional (only when `baseUrl` is provided). |
| `sendAdminPasswordResetEmail(to, code, link?, expiryMinutes?)` | `Promise<void>` | Send admin-initiated password reset code/link |
| `sendWelcomeEmail(to, name)` | `Promise<void>` | Send welcome message |
| `sendLockoutEmail?(to, reason, duration)` | `Promise<void>` | (Optional) Account lockout notification |
| `sendNewDeviceEmail?(to, deviceInfo, location?)` | `Promise<void>` | (Optional) New device login notification |
| `sendPasswordChangedEmail?(to, context)` | `Promise<void>` | (Optional) Password changed security alert |
| `sendMFADeviceRemovedEmail?(to, context)` | `Promise<void>` | (Optional) MFA method/device removed security alert |
| `sendMFAFirstEnabledEmail?(to, context)` | `Promise<void>` | (Optional) MFA enabled confirmation (first device) |
| `sendMFAMethodAddedEmail?(to, context)` | `Promise<void>` | (Optional) MFA method added notification (additional method) |
| `sendAdaptiveMFARiskAlertEmail?(to, context)` | `Promise<void>` | (Optional) Adaptive MFA risk alert |
| `sendAccountDisabledEmail?(to, context)` | `Promise<void>` | (Optional) Account disabled notification |
| `sendAccountEnabledEmail?(to, context)` | `Promise<void>` | (Optional) Account enabled notification |
| `sendEmailChangedAlertEmail?(to, context)` | `Promise<void>` | (Optional) Email changed alert (to old email address) |
| `sendEmailChangedConfirmationEmail?(to, context)` | `Promise<void>` | (Optional) Email changed confirmation (to new email address) |
| `sendAccountLockedEmail?(to, context)` | `Promise<void>` | (Optional) Account locked notification |
| `sendSessionsRevokedEmail?(to, context)` | `Promise<void>` | (Optional) Sessions revoked security alert |
| `setConfig?(config)` | `void` | Inject config for provider-side suppression logic (e.g., `emailNotifications`) |

## Related APIs

- [Configuration](/docs/concepts/configuration) - `NAuthConfig` reference
- [Email Providers Overview](/docs/api/email/overview) - Provider implementations


