---
title: Nodemailer Provider
description: Nodemailer SMTP email provider
keywords: [email, nodemailer, smtp, api]
image: /img/api-social-card.png
---
# Nodemailer Provider

**Package:** `@nauth-toolkit/email-nodemailer`
**Type:** Email Provider

```bash npm2yarn
npm install @nauth-toolkit/email-nodemailer
```

## Exports

| Export | Type |
|--------|------|
| `NodemailerEmailProvider` | Class |

## Constructor

```typescript
new NodemailerEmailProvider(options: NodemailerOptions)
```

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `transport` | `TransportOptions` | Yes | Nodemailer transport config |
| `defaults` | `DefaultsOptions` | No | Default email options |
| `useTemplates` | `boolean` | No | Enable HTML template rendering. When `false`, sends plain text only. Default: `true` |
| `templateEngine` | `TemplateEngine` | No | Custom template engine. Defaults to built-in Handlebars engine |
| `preview` | `boolean` | No | Log preview URL for test messages (Ethereal/Nodemailer preview). Default: `false` |
| `skipVerification` | `boolean` | No | Skip SMTP transport verification on startup. Default: `false` |

### TransportOptions

The `transport` option accepts any valid Nodemailer transport configuration, including:

**SMTP Transport:**
| Option | Type | Description |
|--------|------|-------------|
| `host` | `string` | SMTP hostname |
| `port` | `number` | SMTP port (25, 465, 587) |
| `secure` | `boolean` | `true` for 465, `false` otherwise |
| `service` | `string` | Predefined service (gmail, etc.) |
| `auth.user` | `string` | SMTP username |
| `auth.pass` | `string` | SMTP password |
| `pool` | `boolean` | Use connection pooling |
| `maxConnections` | `number` | Max concurrent connections |

**AWS SES SDK Transport:**
| Option | Type | Description |
|--------|------|-------------|
| `SES.sesClient` | `SESv2Client` | AWS SDK v3 SES client instance |
| `SES.SendEmailCommand` | `SendEmailCommand` | AWS SDK v3 SendEmailCommand class |

The transport can also be a pre-configured `Transporter` instance or any raw Nodemailer transport configuration.

### DefaultsOptions

| Option | Type | Description |
|--------|------|-------------|
| `from` | `string` | Default sender |
| `replyTo` | `string` | Default reply-to |

## Presets

### Gmail

```typescript
new NodemailerEmailProvider({
  transport: { service: 'gmail', auth: { user: 'email', pass: 'app-password' } },
})
```

### SendGrid

```typescript
new NodemailerEmailProvider({
  transport: { host: 'smtp.sendgrid.net', port: 587, auth: { user: 'apikey', pass: API_KEY } },
})
```

### AWS SES (SMTP)

```typescript
new NodemailerEmailProvider({
  transport: {
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587,
    auth: {
      user: process.env.AWS_ACCESS_KEY_ID,
      pass: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
})
```

### AWS SES (SDK with IAM Roles) - Recommended

Uses AWS SDK v3 with automatic IAM role discovery. Perfect for EC2/ECS/containers.

```bash npm2yarn
npm install @aws-sdk/client-sesv2
```

```typescript
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

new NodemailerEmailProvider({
  transport: {
    SES: {
      sesClient: new SESv2Client({
        region: process.env.AWS_REGION || 'us-east-1',
        // Credentials automatically discovered from:
        // 1. IAM role (when running on EC2/ECS/containers) - RECOMMENDED
        // 2. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
        // 3. Shared credentials file (~/.aws/credentials)
      }),
      SendEmailCommand,
    },
  },
  defaults: {
    from: 'My App <noreply@myapp.com>',
  },
})
```

:::tip
The AWS SES SDK transport automatically uses IAM roles when running on AWS infrastructure (EC2, ECS, Lambda), eliminating the need to manage credentials manually.
:::

## Methods

### sendEmail()

```typescript
sendEmail(options: SendEmailOptions): Promise<void>
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `to` | `string` | Yes | Recipient email |
| `subject` | `string` | Yes | Email subject |
| `html` | `string` | Yes | HTML content |
| `text` | `string` | No | Plain text fallback |

## Related

- [Email Providers Overview](/docs/api/email/overview)

