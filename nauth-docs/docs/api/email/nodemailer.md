---
title: Nodemailer Provider
description: Nodemailer SMTP email provider
keywords: [email, nodemailer, smtp, api]
image: /img/api-social-card.png
sidebar_position: 1
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

### TransportOptions

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

### AWS SES

```typescript
new NodemailerEmailProvider({
  transport: { host: 'email-smtp.us-east-1.amazonaws.com', port: 587, auth: { user, pass } },
})
```

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

