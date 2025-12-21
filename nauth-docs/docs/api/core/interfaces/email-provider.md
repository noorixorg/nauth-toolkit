---
title: EmailProvider
description: Interface for email providers used for verification, password reset, and onboarding emails
keywords: [email, provider, interface, api]
image: /img/api-social-card.png
sidebar_position: 2
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
| `sendVerificationEmail(to, code, link?)` | `Promise<void>` | Send email verification code (and optional link) |
| `sendPasswordResetEmail(to, token, link)` | `Promise<void>` | Send password reset message |
| `sendWelcomeEmail(to, name)` | `Promise<void>` | Send welcome message |
| `sendLockoutEmail?(to, reason, duration)` | `Promise<void>` | (Optional) Account lockout notification |
| `sendNewDeviceEmail?(to, deviceInfo, location?)` | `Promise<void>` | (Optional) New device login notification |

## Related APIs

- [Configuration](/docs/concepts/configuration) - `NAuthConfig` reference
- [Email Providers Overview](/docs/api/email/overview) - Provider implementations


