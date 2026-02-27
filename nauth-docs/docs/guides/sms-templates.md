---
title: 'SMS Templates'
description: 'Override SMS templates for verification codes, MFA, and password resets in nauth-toolkit'
sidebar_position: 6
keywords: [sms, templates, handlebars, verification, mfa, password reset]
image: /img/api-social-card.png
---

# SMS Templates

Override the SMS messages nauth-toolkit sends to your users. There are 3 SMS template types --- verification, MFA, and password reset --- all using `{{variable}}` placeholders. The defaults work out of the box; override them when you need custom wording or branding.

:::note Want full control?
You can bypass the built-in SMS templates entirely and use [Lifecycle Hooks](/docs/guides/lifecycle-hooks) to send messages via any service. Hooks fire on the same auth events and give you complete control over delivery.
:::

## Prerequisites

- A working auth setup ([Quick Start](/docs/quick-start/nestjs))
- An SMS provider configured ([Email & SMS Providers](/docs/guides/email-sms-providers))

## Step 1: Configure Branding

Global variables are available to **every** SMS template:

```typescript title="config/auth.config.ts"
{
  sms: {
    templates: {
      globalVariables: {
        appName: 'My App',
        companyName: 'My Company Inc.',
        supportPhone: '+1-800-123-4567',
      },
    },
  },
}
```

## Step 2: Override Templates

Override any template via `sms.templates.customTemplates`. SMS templates are short, so inline is recommended:

```typescript title="config/auth.config.ts"
{
  sms: {
    templates: {
      globalVariables: {
        appName: 'My App',
      },
      customTemplates: {
        verification: {
          content: '{{appName}}: Your verification code is {{code}}. Valid for {{expiryMinutes}} minutes. Never share this code.',
        },
        mfa: {
          content: '{{appName}}: Your sign-in code is {{code}}. Valid for {{expiryMinutes}} minutes. Do not share this code.',
        },
        passwordReset: {
          content: '{{appName}}: Password reset code: {{code}}. Expires in {{expiryMinutes}} min.',
        },
      },
    },
  },
}
```

You can also use file-based templates:

```typescript title="config/auth.config.ts"
{
  sms: {
    templates: {
      customTemplates: {
        verification: {
          contentPath: './sms-templates/verification.txt.hbs',
        },
      },
    },
  },
}
```

```text title="sms-templates/verification.txt.hbs"
{{#if appName}}{{appName}}: {{/if}}Your verification code is {{code}}. Valid for {{expiryMinutes}} minutes.{{#if supportPhone}} Questions? Call {{supportPhone}}{{/if}}
```

### Validation rules

| Rule | Details |
|---|---|
| Must provide `contentPath` **or** `content` | Cannot provide both |
| Template must reference `code` and `expiryMinutes` | Validated at startup |

See [Notifications & Templates](/docs/concepts/notifications#sms-templates) for all template types, available variables, and syntax details.

## Step 3: Test Your Template

Render templates locally to preview them:

```typescript title="scripts/preview-sms.ts"
import { SMSTemplateEngineImpl, SMSTemplateType } from '@nauth-toolkit/core';

const engine = new SMSTemplateEngineImpl();

engine.registerTemplate(SMSTemplateType.VERIFICATION, {
  content: '{{appName}}: Code {{code}}. Valid {{expiryMinutes}} min. Do not share.',
});

const result = await engine.render(SMSTemplateType.VERIFICATION, {
  code: '654321',
  expiryMinutes: 5,
  appName: 'My App',
});

console.log('SMS:', result.content);
console.log('Length:', result.content.length);
// Output: "My App: Code 654321. Valid 5 min. Do not share."
// Length: 48
```

SMS messages are limited to **160 characters** per segment. Messages longer than 160 characters are split into multiple segments, which costs more and may arrive out of order.

```typescript
if (result.content.length > 160) {
  console.warn(`SMS is ${result.content.length} chars — will be split into multiple segments`);
}
```

## Best Practices

1. **Keep it short** --- Aim for under 160 characters to avoid multi-segment messages
2. **Lead with brand** --- Start with `{{appName}}` so users know the sender immediately
3. **Always show expiry** --- Include `{{expiryMinutes}}` so users know urgency
4. **Add security warning** --- For MFA codes, include "Never share this code" or "Do not share"
5. **No URLs in SMS** --- Links in SMS are often flagged as spam by carriers; use codes instead
6. **Include support** --- Add `{{supportPhone}}` for users who need help

**Good (62 chars):**
```text
MyApp: Code 123456. Valid 5 min. Never share this code.
```

**Bad (275 chars):**
```text
Hello! Thank you for using our platform. We're so excited to have you. Here is your code that you can use to verify: 123456. This code will expire in 5 minutes so please use it soon. If you have questions please contact our support team. Best regards, The MyApp Team.
```

## What's Next

- **[Notifications & Templates](/docs/concepts/notifications#sms-templates)** --- All template types, variables, and syntax reference
- **[Email Templates](/docs/guides/email-templates)** --- Customize email templates
- **[Email & SMS Providers](/docs/guides/email-sms-providers)** --- Configure AWS SNS, Twilio, or a custom provider
