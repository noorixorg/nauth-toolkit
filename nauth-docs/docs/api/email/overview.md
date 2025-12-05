---
title: Email Providers
description: Email providers for authentication notifications
keywords: [email, providers, nodemailer, smtp, api]
image: /img/api-social-card.png
sidebar_position: 0
---

# Email Providers

Email providers for sending verification codes, password resets, and notifications.

## Available Providers

| Provider | Package | Description |
|----------|---------|-------------|
| [Nodemailer](./nodemailer) | `@nauth-toolkit/email-nodemailer` | Production SMTP/transport |
| [Console](./console) | `@nauth-toolkit/email-console` | Development (logs to console) |

## Provider Interface

All email providers implement `EmailProvider`:

```typescript
interface EmailProvider {
  sendVerificationEmail(to: string, code: string, link?: string): Promise<void>;
  sendPasswordResetEmail(to: string, link: string): Promise<void>;
  sendWelcomeEmail(to: string): Promise<void>;
  sendAccountLockoutEmail(to: string, reason: string, duration: number): Promise<void>;
  sendNewDeviceEmail(to: string, device: string, timestamp: Date): Promise<void>;
  sendPasswordChangedEmail(to: string): Promise<void>;
  sendEmailChangedEmail(to: string, newEmail: string): Promise<void>;
  sendMfaEnabledEmail(to: string): Promise<void>;
}
```

## Related

- [EmailVerificationService](/docs/api/core/services/email-verification-service)
