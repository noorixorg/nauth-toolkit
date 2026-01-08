---
title: Email Providers
description: Email providers for authentication notifications
keywords: [email, providers, nodemailer, smtp, api]
image: /img/api-social-card.png
---
# Email Providers

Email providers for sending verification codes, password resets, and notifications.

## Available Providers

| Provider | Package | Description |
|----------|---------|-------------|
| [Nodemailer](./nodemailer) | `@nauth-toolkit/email-nodemailer` | Production SMTP/transport |
| [Console](./console) | `@nauth-toolkit/email-console` | Development (logs to console) |

## Provider Interface

All email providers implement `EmailProvider` (core interface):

- See [`EmailProvider`](/docs/api/core/interfaces/email-provider) for the up-to-date method list and signatures.

## Related

- [EmailVerificationService](/docs/api/core/services/email-verification-service)
