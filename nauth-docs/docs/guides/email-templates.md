---
title: 'Email Templates'
description: 'Override email templates and enable security notifications in nauth-toolkit'
sidebar_position: 5
keywords: [email, templates, handlebars, customization, verification, notifications]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Email Templates

Override the emails nauth-toolkit sends to your users and control which security notifications are enabled. `@nauth-toolkit/email-nodemailer` ships with production-ready HTML templates for all 18 email types --- you only need to override the ones you want to customize.

:::tip Sample apps
The [nauth example apps](https://github.com/noorixorg/nauth) include working email configuration with custom templates.
:::

:::note Want full control?
You can disable the built-in email system entirely (`emailNotifications.enabled: false`) and use [Lifecycle Hooks](/docs/guides/lifecycle-hooks) to send your own notifications via any service. Hooks fire on the same auth events (password changed, account locked, MFA enabled, etc.) and give you complete control over delivery.
:::

## Prerequisites

- A working auth setup ([Quick Start](/docs/quick-start/nestjs))
- An email provider configured ([Email & SMS Providers](/docs/guides/email-sms-providers))

## Step 1: Configure Branding

Global variables are available to **every** email template. Set them once and they appear in all emails automatically.

```typescript title="config/auth.config.ts"
{
  email: {
    globalVariables: {
      appName: 'My App',
      companyName: 'My Company Inc.',
      companyAddress: '123 Main St, City, Country',
      supportEmail: 'support@myapp.com',
      brandColor: '#4f46e5',
      logoUrl: 'https://myapp.com/logo.png',
      dashboardUrl: 'https://app.myapp.com',
    },
  },
}
```

:::tip
The template engine automatically injects `currentYear` (e.g. `2026`) into every render. Use it in footers: `© {{currentYear}} {{companyName}}`.
:::

## Step 2: Override a Template

Override any template via `email.templates.customTemplates`. This example overrides the verification email using a file-based template:

```typescript title="config/auth.config.ts"
{
  email: {
    globalVariables: { /* ... */ },
    templates: {
      customTemplates: {
        verification: {
          htmlPath: './email-templates/verification.html.hbs',
          textPath: './email-templates/verification.text.hbs',
        },
      },
    },
  },
}
```

HTML email templates use YAML frontmatter for the subject line:

```html title="email-templates/verification.html.hbs"
---
subject: Verify your email - {{appName}}
---

<!DOCTYPE html>
<html>
  <body>
    {{#if firstName}}
    <p>Hi {{firstName}},</p>
    {{else}} {{#if userName}}
    <p>Hi {{userName}},</p>
    {{/if}} {{/if}}

    <p>Your verification code: <strong>{{code}}</strong></p>

    {{#if link}}
    <p><a href="{{link}}">Verify Email Address</a></p>
    {{/if}} {{#if expiryMinutes}}
    <p>This code expires in {{expiryMinutes}} minutes.</p>
    {{/if}}
  </body>
</html>
```

Plain text templates are simple Handlebars text files (no frontmatter needed):

```text title="email-templates/verification.text.hbs"
Verify Your Email

{{#if firstName}}Hi {{firstName}},{{else}}{{#if userName}}Hi {{userName}},{{/if}}{{/if}}

Your verification code: {{code}}

{{#if link}}Or use this link: {{link}}{{/if}}

{{#if expiryMinutes}}This code expires in {{expiryMinutes}} minutes.{{/if}}
```

You can also define templates inline or use a mix of file-based HTML with inline text:

```typescript title="config/auth.config.ts"
{
  email: {
    templates: {
      customTemplates: {
        welcome: {
          subject: 'Welcome to {{appName}}!',
          html: '<h1>Welcome!</h1><p>Thanks for joining {{appName}}.</p>',
          text: 'Welcome to {{appName}}!',
        },
        verification: {
          subject: 'Verify your email - {{appName}}',
          htmlPath: './email-templates/verification.html.hbs',
          text: 'Your code: {{code}}. Expires in {{expiryMinutes}} minutes.',
        },
      },
    },
  },
}
```

### Validation rules

| Rule                                            | Details                                             |
| ----------------------------------------------- | --------------------------------------------------- |
| Must provide `htmlPath` **or** `html`           | Cannot provide both                                 |
| Can optionally provide `textPath` **or** `text` | Cannot provide both                                 |
| `subject` is optional                           | Extracted from HTML frontmatter if not provided     |
| Template must reference all required variables  | Validated at startup; app fails to start if missing |

:::note
**Text templates are optional.** If you don't provide a `text` template, the engine generates one by stripping HTML tags from the rendered HTML. Providing both improves deliverability and accessibility.
:::

See [Notifications & Templates](/docs/concepts/notifications) for the complete list of template types, required variables, and Handlebars syntax reference.

## Step 3: Enable Security Notifications

Security notification emails (password changed, account lockout, new device, etc.) are **suppressed by default**. Enable the ones you want:

```typescript title="config/auth.config.ts"
{
  emailNotifications: {
    enabled: true,
    suppress: {
      passwordChanged: false,     // Enable password changed alerts
      accountLockout: false,      // Enable lockout alerts
      newDevice: false,           // Enable new device alerts
      sessionsRevoked: false,     // Enable session revocation alerts
    },
  },
}
```

Set a suppress key to `false` to **enable** that notification. See [Notifications & Templates > Suppression](/docs/concepts/notifications#suppression-keys-vs-template-keys) for the full list of suppressible notification types and the mapping between suppress keys and template types.

## Step 4: Test Your Template

Render templates locally to preview them before deploying:

```typescript title="scripts/preview-email.ts"
import { HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';
import { TemplateType } from '@nauth-toolkit/core';
import * as fs from 'fs';

const engine = new HandlebarsTemplateEngine({ baseDir: './email-templates' });

await engine.registerTemplateFromFile(TemplateType.VERIFICATION, 'verification.html.hbs', 'verification.text.hbs');

const result = await engine.render(TemplateType.VERIFICATION, {
  code: '123456',
  link: 'https://myapp.com/verify?code=123456',
  expiryMinutes: 10,
  userName: 'testuser',
  firstName: 'John',
  appName: 'My App',
  supportEmail: 'support@myapp.com',
  companyName: 'My Company Inc.',
});

console.log('Subject:', result.subject);
fs.writeFileSync('preview.html', result.html);
```

For local development, use the console provider to log emails instead of sending them:

```typescript
import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';

{
  emailProvider: new ConsoleEmailProvider(),
}
```

## Advanced

<details>
<summary>Partials (shared header/footer)</summary>

Reuse header and footer blocks across all templates using Handlebars partials.

Create a partials directory:

```
email-templates/
  partials/
    header.hbs
    footer.hbs
  verification.html.hbs
  welcome.html.hbs
```

Write your partial:

```handlebars title="email-templates/partials/footer.hbs"
<hr />
<p>&copy; {{currentYear}} {{companyName}}. All rights reserved.</p>
{{#if supportEmail}}
  <p>Need help? <a href='mailto:{{supportEmail}}'>Contact support</a></p>
{{/if}}
```

Configure the engine to load them:

```typescript title="config/auth.config.ts"
import { NodemailerEmailProvider, HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';

const templateEngine = new HandlebarsTemplateEngine({
  baseDir: process.cwd(),
  partialsDir: './email-templates/partials',
});

{
  emailProvider: new NodemailerEmailProvider({
    transport: { /* ... */ },
    defaults: { from: '"My App" <noreply@example.com>' },
    templateEngine,
  }),
}
```

Use partials in any template:

```handlebars
{{> header}}
<h1>Verify your email</h1>
<p>Your code: {{code}}</p>
{{> footer}}
```

You can also register partials inline without files:

```typescript
const templateEngine = new HandlebarsTemplateEngine({
  partials: {
    footer: '<footer>&copy; {{currentYear}} {{companyName}}</footer>',
    header: '<header><img src="{{logoUrl}}" alt="{{appName}}" /></header>',
  },
});
```

</details>

<details>
<summary>Custom Handlebars helpers</summary>

Register custom helpers for advanced template logic:

```typescript
import { HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';

const templateEngine = new HandlebarsTemplateEngine({
  helpers: {
    uppercase: (str: string) => str.toUpperCase(),
    truncate: (str: string, length: number) => (str.length > length ? str.substring(0, length) + '...' : str),
  },
});
```

Use in templates:

```handlebars
<h1>{{uppercase appName}}</h1>
<p>{{truncate description 100}}</p>
```

Pass the engine to your email provider configuration:

```typescript title="config/auth.config.ts"
{
  emailProvider: new NodemailerEmailProvider({
    transport: { /* ... */ },
    defaults: { from: '"My App" <noreply@example.com>' },
    templateEngine,
  }),
}
```

</details>

## Troubleshooting

### Template validation fails at startup

```
Invalid template configuration for "verification":
Missing required parameters: link, expiryMinutes.
Template must include: {{code}}, {{link}}, {{expiryMinutes}}
```

**Fix:** Add the missing variables to your template. Use `{{#if variable}}` if you want conditional rendering --- the validator checks for presence, not unconditional usage.

### Variables render as `{{code}}` instead of actual values

1. Variable name typo in template
2. Template engine not configured (check `email.templates.engine`)
3. Variable not passed at render time

### Emails go to spam

1. Provide both `html` and `text` templates
2. Configure SPF, DKIM, DMARC on your domain
3. Use a reputable email provider (AWS SES, SendGrid)
4. Set a proper `from` address with domain matching

## What's Next

- **[Notifications & Templates](/docs/concepts/notifications)** --- All template types, variables, and Handlebars syntax reference
- **[SMS Templates](/docs/guides/sms-templates)** --- Customize SMS messages
- **[Email & SMS Providers](/docs/guides/email-sms-providers)** --- Configure email transport (SMTP, AWS SES, SendGrid)
- **[Configuration](/docs/concepts/configuration)** --- Full configuration reference
