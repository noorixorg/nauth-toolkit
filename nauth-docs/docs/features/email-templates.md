---
title: Email & SMS Templates
description: Customize email and SMS templates for verification, MFA codes, and security notifications
sidebar_position: 3
keywords: [email, sms, templates, handlebars, customization, verification, mfa]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Email & SMS Templates

Customize emails and SMS messages sent to your users. nauth-toolkit uses **Handlebars** for flexible, logic-based templates with validation to ensure required variables are present.

## Overview

nauth-toolkit provides:

- **Default templates** for all email and SMS types (ready to use out of the box)
- **Custom templates** via file paths or inline content
- **Handlebars syntax** for conditionals, loops, and variables
- **Startup validation** to catch missing required variables
- **Global variables** shared across all templates

## Quick start (recommended)

If you're reading this for the first time, this is the shortest path to success:

1. Configure your email/SMS provider(s) (see [Email provider configuration](#email-provider-configuration) and [SMS provider configuration](#sms-provider-configuration)).
2. Set `email.templates.globalVariables` / `sms.templates.globalVariables` (branding, support contact, URLs).
3. Override only the templates you need via `customTemplates` (start with `verification` and `passwordReset`).
4. Keep required variables in your templates (see [Required variables validation](#required-variables-validation)).
5. Preview locally before shipping (see [Testing templates](#testing-templates)).

**Jump to:**
- [Email templates](#email-templates)
- [SMS templates](#sms-templates)
- [Testing templates](#testing-templates)
- [Troubleshooting](#troubleshooting)

## Email templates

### Available email types

#### Core Authentication Emails

| Template Type | When Sent | Required Variables |
|--------------|-----------|-------------------|
| `verification` | Email address verification during signup | `code`, `link`, `expiryMinutes` |
| `passwordReset` | User requests password reset | `link`, `expiryMinutes` |
| `adminPasswordReset` | Admin initiates password reset | `code`, `link`, `expiryMinutes` |
| `welcome` | After successful signup or email verification | None |

#### Security Notifications

| Template Type | When Sent | Required Variables |
|--------------|-----------|-------------------|
| `passwordChanged` | Password successfully changed | None |
| `accountLockout` | Account locked due to failed login attempts | `reason`, `durationMinutes` |
| `newDevice` | New device detected (adaptive MFA) | `deviceName`, `timestamp` |
| `sessionsRevoked` | All sessions terminated | `revokedCount` |
| `adaptiveMfaRiskAlert` | High-risk signin detected | `riskLevel`, `riskFactors` |

#### Account Management

| Template Type | When Sent | Required Variables |
|--------------|-----------|-------------------|
| `accountDisabled` | Account disabled by admin | `reason` |
| `accountEnabled` | Account re-enabled by admin | None |
| `emailChanged` | Email changed (legacy single-email template) | `userEmail` |
| `emailChangedOld` | Email changed (sent to old address) | None |
| `emailChangedNew` | Email changed (sent to new address) | None |

#### MFA Notifications

| Template Type | When Sent | Required Variables |
|--------------|-----------|-------------------|
| `mfaEnabled` | First MFA device enabled | None |
| `mfaDeviceRemoved` | MFA device removed | None |

:::note
The default Nodemailer email templates are generated from MJML and stored in `@nauth-toolkit/email-nodemailer` under `src/templates/default/` (with sources in `src/templates/mjml/`).
When overriding templates, use the **template type key** (for example `passwordReset`, `sessionsRevoked`, `adaptiveMfaRiskAlert`) which matches `TemplateType` in `@nauth-toolkit/core`.
:::

### Configuration

<Tabs>
<TabItem value="file-based" label="File-Based (Recommended)" default>

Store templates as separate files for easier editing:

```typescript
import { AuthModule } from '@nauth-toolkit/nestjs';

AuthModule.forRoot({
  email: {
    templates: {
      // Global variables (available to all templates)
      globalVariables: {
        appName: 'My App',
        companyName: 'My Company Inc.',
        supportEmail: 'support@myapp.com',
        brandColor: '#4f46e5',
        logoUrl: 'https://myapp.com/logo.png',
      },

      // Custom templates
      customTemplates: {
        verification: {
          htmlPath: './email-templates/verification.html.hbs',
          textPath: './email-templates/verification.text.hbs',
          // Must include: {{code}}, {{link}}, {{expiryMinutes}}
        },
        welcome: {
          htmlPath: './email-templates/welcome.html.hbs',
          // No required variables
        },
        passwordReset: {
          htmlPath: './email-templates/password-reset.html.hbs',
          textPath: './email-templates/password-reset.text.hbs',
          // Must include: {{link}}, {{expiryMinutes}}
        },
      },
    },
  },
});
```

</TabItem>
<TabItem value="inline" label="Inline">

Define templates directly in configuration:

```typescript
AuthModule.forRoot({
  email: {
    templates: {
      globalVariables: {
        appName: 'My App',
        supportEmail: 'support@myapp.com',
      },

      customTemplates: {
        welcome: {
          subject: 'Welcome to {{appName}}!',
          html: `
            <!DOCTYPE html>
            <html>
            <body>
              <h1>Welcome {{#if firstName}}{{firstName}}{{else}}{{userName}}{{/if}}!</h1>
              <p>Thanks for joining {{appName}}.</p>
              <p>Questions? Email <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
            </body>
            </html>
          `,
          text: 'Welcome to {{appName}}! Questions? Email {{supportEmail}}',
        },
      },
    },
  },
});
```

</TabItem>
<TabItem value="mixed" label="Mixed">

Combine file-based and inline templates:

```typescript
AuthModule.forRoot({
  email: {
    templates: {
      globalVariables: {
        appName: 'My App',
      },

      customTemplates: {
        // File-based with explicit subject
        verification: {
          subject: 'Verify your email - {{appName}}',
          htmlPath: './email-templates/verification.html.hbs',
          text: 'Your code: {{code}}. Link: {{link}} (expires in {{expiryMinutes}} minutes)',
        },

        // Inline with frontmatter subject
        welcome: {
          html: `
            ---
            subject: Welcome to {{appName}}!
            ---
            <!DOCTYPE html>
            <html>
            <body>
              <h1>
                {{#if fullName}}Hello {{fullName}}!{{else}}{{#if firstName}}Hello {{firstName}}!{{else}}Hello!{{/if}}{{/if}}
              </h1>
            </body>
            </html>
          `,
        },
      },
    },
  },
});
```

</TabItem>
</Tabs>

### Global header/footer (partials)

If you want all your templates to share the same header/footer (branding, links, support, legal text), use **Handlebars partials**.
This lets you define `header` / `footer` once and reuse them across templates without copy/paste.

#### Option A: File-based partials (recommended)

1. Create a partials directory:

- `email-templates/partials/header.hbs`
- `email-templates/partials/footer.hbs`

Example `email-templates/partials/footer.hbs`:

```handlebars
<hr />
<p>&copy; {{currentYear}} {{companyName}}. All rights reserved.</p>
{{#if supportEmail}}
  <p>Need help? <a href="mailto:{{supportEmail}}">Contact support</a></p>
{{/if}}
```

2. Use partials inside any template:

```handlebars
{{> header }}
<h1>Password Changed</h1>
<p>If you didn’t do this, contact support.</p>
{{> footer }}
```

3. Tell the Nodemailer provider to load those partials:

```typescript
import { NodemailerEmailProvider, HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';

const templateEngine = new HandlebarsTemplateEngine({
  baseDir: process.cwd(),
  partialsDir: './email-templates/partials',
});

AuthModule.forRoot({
  email: {
    provider: new NodemailerEmailProvider({
      transport: { /* ... */ },
      defaults: { from: '"My App" <noreply@example.com>' },
      templateEngine,
    }),
    templates: {
      globalVariables: {
        companyName: 'My Company Inc.',
        supportEmail: 'support@myapp.com',
      },
      customTemplates: {
        passwordChanged: {
          htmlPath: './email-templates/password-changed.html.hbs',
          // textPath optional (fallback is generated from HTML)
        },
      },
    },
  },
});
```

#### Option B: Inline partials

If you don’t want files, you can register partials in code:

```typescript
import { HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';

const templateEngine = new HandlebarsTemplateEngine({
  partials: {
    footer: '<footer>&copy; {{currentYear}} {{companyName}}</footer>',
  },
});
```

### Template file format

Email templates use Handlebars syntax with optional YAML frontmatter for the subject line.

**Example: `email-templates/verification.html.hbs`**

```html
---
subject: Verify your email - {{appName}}
---
<h1>Verify your email</h1>
<p>
  {{#if fullName}}Hi {{fullName}},{{else}}{{#if firstName}}Hi {{firstName}},{{else}}{{#if userName}}Hi {{userName}},{{else}}Hi,{{/if}}{{/if}}{{/if}}
</p>
<p>Your verification code: <strong>{{code}}</strong></p>
<p><a href="{{link}}">Verify Email</a></p>
<p>This code expires in {{expiryMinutes}} minutes.</p>
```

**Example: `email-templates/verification.text.hbs` (plain text version)**

```text
Verify Your Email

{{#if fullName}}Hi {{fullName}},{{else}}{{#if firstName}}Hi {{firstName}},{{else}}{{#if userName}}Hi {{userName}},{{else}}Hi,{{/if}}{{/if}}{{/if}}

Thank you for signing up for {{appName}}! Please verify your email address to activate your account.

Your verification code: {{code}}

Or use this link: {{link}}

This code expires in {{expiryMinutes}} minutes.

{{#if supportEmail}}
If you didn't create an account, you can safely ignore this email or contact us at {{supportEmail}}.
{{else}}
If you didn't create an account, you can safely ignore this email.
{{/if}}

---
© {{currentYear}} {{companyName}}. All rights reserved.
```

### Available variables

All templates have access to these variables:

#### User information

| Variable | Description | Example |
|----------|-------------|---------|
| `fullName` | Full name | `John Doe` |
| `userName` | Username | `john_doe` |
| `userEmail` | Email address | `john@example.com` |
| `firstName` | First name | `John` |
| `lastName` | Last name | `Doe` |
| `greetingName` | Optional convenience name (compute and pass yourself) | `John` or `john_doe` |

#### Authentication & security

| Variable | Description | Templates |
|----------|-------------|-----------|
| `code` | Verification/reset code | `verification`, `passwordReset`, `adminPasswordReset` |
| `link` | Verification/reset link | `verification`, `passwordReset`, `adminPasswordReset` |
| `expiryMinutes` | Code/link expiration time | `verification`, `passwordReset`, `adminPasswordReset` |
| `reason` | Reason for action | `accountLockout`, `accountDisabled`, `accountEnabled`, `sessionsRevoked` |
| `durationMinutes` | Lockout duration | `accountLockout` |
| `deviceName` | Device identifier | `newDevice`, `mfaDeviceRemoved` |
| `deviceType` | Device type | `newDevice`, `mfaDeviceRemoved` |
| `ipAddress` | IP address | `newDevice` |
| `location` | Geographic location | `newDevice` |
| `timestamp` | Event timestamp | `newDevice` |
| `riskLevel` | Risk level (low/medium/high) | `adaptiveMfaRiskAlert` |
| `riskScore` | Numeric risk score (0-100) | `adaptiveMfaRiskAlert` |
| `riskFactors` | Detected risk factors (string or comma-separated list) | `adaptiveMfaRiskAlert` |
| `action` | Action taken | `adaptiveMfaRiskAlert` |
| `removedBy` | Who removed device | `mfaDeviceRemoved` |
| `remainingDeviceCount` | MFA devices remaining | `mfaDeviceRemoved` |
| `revokedCount` | Number of sessions revoked | `sessionsRevoked` |
| `triggerEvent` | What triggered the action | `sessionsRevoked` |
| `oldEmail` | Previous email address | `emailChangedOld`, `emailChangedNew` |
| `newEmail` | New email address | `emailChangedOld`, `emailChangedNew` |
| `deactivatedMFADevices` | Deactivated MFA device count | `emailChangedOld` |

#### Branding (from globalVariables)

| Variable | Description | Example |
|----------|-------------|---------|
| `appName` | Application name | `My App` |
| `companyName` | Company name | `My Company Inc.` |
| `supportEmail` | Support email | `support@myapp.com` |
| `brandColor` | Brand color (hex) | `#4f46e5` |
| `logoUrl` | Logo URL | `https://myapp.com/logo.png` |

#### Automatic

| Variable | Description | Value |
|----------|-------------|-------|
| `currentYear` | Current year | `2024` |
| `subject` | Email subject (available inside MJML-built HTML templates) | `Password Changed - My App` |
| `previewText` | Email preview text (defaults to `subject` unless provided) | `Your password has been successfully changed` |

### Greetings (recommended pattern)

The default Nodemailer templates implement a simple, explicit greeting fallback:

```handlebars
{{#if fullName}}Hi {{fullName}},{{/if}}
{{#if firstName}}Hi {{firstName}},{{/if}}
{{#if lastName}}Hi {{lastName}},{{/if}}
{{#if userName}}Hi {{userName}},{{/if}}
```

If you prefer a single variable like `{{greetingName}}`, compute it in your application and pass it as a template variable. (The core `HtmlTemplateEngine` also computes `greetingName` automatically when you use it directly.)

### Handlebars syntax reference

<Tabs>
<TabItem value="variables" label="Variables" default>

Insert variable values:

```handlebars
<p>Welcome to {{appName}}!</p>
<p>Your code is: {{code}}</p>
```

</TabItem>
<TabItem value="conditionals" label="Conditionals">

Show content conditionally:

```handlebars
{{#if firstName}}
  <p>Hello {{firstName}}!</p>
{{else}}
  <p>Hello!</p>
{{/if}}

{{#unless isVerified}}
  <p>Please verify your email.</p>
{{/unless}}
```

</TabItem>
<TabItem value="loops" label="Loops">

Iterate over arrays:

```handlebars
<ul>
{{#each devices}}
  <li>{{deviceName}} - {{lastUsed}}</li>
{{/each}}
</ul>
```

</TabItem>
<TabItem value="helpers" label="Built-in Helpers">

Use Handlebars built-in helpers:

```handlebars
{{! Comments (not rendered) }}

{{#with user}}
  <p>Name: {{firstName}} {{lastName}}</p>
{{/with}}

{{#if (eq status "active")}}
  <span>Active</span>
{{/if}}
```

</TabItem>
</Tabs>

### Required variables validation

To prevent broken emails, nauth-toolkit validates templates at startup:

| Template Type | Required Variables |
|--------------|-------------------|
| `verification` | `{{code}}`, `{{link}}`, `{{expiryMinutes}}` |
| `passwordReset` | `{{link}}`, `{{expiryMinutes}}` |
| `adminPasswordReset` | `{{code}}`, `{{link}}`, `{{expiryMinutes}}` |
| `accountLockout` | `{{reason}}`, `{{durationMinutes}}` |
| `newDevice` | `{{deviceName}}`, `{{timestamp}}` |
| `adaptiveMfaRiskAlert` | `{{riskLevel}}`, `{{riskFactors}}` |
| `accountDisabled` | `{{reason}}` |
| `emailChanged` | `{{userEmail}}` |
| `sessionsRevoked` | `{{revokedCount}}` |
| `welcome` | None |
| `passwordChanged` | None |
| `mfaEnabled` | None |
| `mfaDeviceRemoved` | None |
| `accountEnabled` | None |
| `emailChangedOld` | None |
| `emailChangedNew` | None |

**Error example:**

```
Template validation failed for 'verification':
Missing required variable: {{code}}
```

:::tip
The validator checks for the presence of `{{variableName}}` in your template. If validation fails, your application won't start, preventing broken emails in production.
:::

:::note
**Text templates are optional.** If you don’t provide a `text` template, the template engine will generate one by stripping HTML tags from the rendered HTML.
Even if you only provide HTML, the Nodemailer provider will still send a `text` body (generated), which improves deliverability and accessibility.
:::

### Email provider configuration

Configure your email provider to send emails:

<Tabs>
<TabItem value="nodemailer" label="Nodemailer" default>

```typescript
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

{
  email: {
    provider: new NodemailerEmailProvider({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      from: 'noreply@myapp.com',
    }),
    appName: 'My App',
    templates: {
      // ... template config
    },
  }
}
```

</TabItem>
<TabItem value="aws-ses-sdk" label="AWS SES (SDK with IAM)">

Uses AWS SDK v3 with automatic IAM role discovery. Perfect for EC2/ECS/containers.

```bash npm2yarn
npm install @aws-sdk/client-sesv2
```

```typescript
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

{
  email: {
    provider: new NodemailerEmailProvider({
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
        from: 'noreply@myapp.com',
      },
    }),
    appName: 'My App',
    templates: {
      // ... template config
    },
  }
}
```

:::tip
The AWS SES SDK transport automatically uses IAM roles when running on AWS infrastructure (EC2, ECS, Lambda), eliminating the need to manage credentials manually.
:::

</TabItem>
<TabItem value="custom" label="Custom">

Implement the `EmailProvider` interface:

```typescript
import { EmailProvider } from '@nauth-toolkit/core';

class MyCustomEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
    // Your email sending logic
    await myEmailService.send({
      to,
      subject,
      html,
      text,
    });
  }
}

{
  email: {
    provider: new MyCustomEmailProvider(),
    templates: {
      // ... template config
    },
  }
}
```

</TabItem>
</Tabs>

## SMS templates

### Available SMS types

| Template Type | When Sent | Required Variables |
|--------------|-----------|-------------------|
| `verification` | Phone verification during signup or update | `code`, `expiryMinutes` |
| `mfa` | MFA code for two-factor authentication | `code`, `expiryMinutes` |
| `passwordReset` | Password reset via SMS (if configured) | `code`, `expiryMinutes` |

:::info
SMS templates use **text-only** format (no HTML). Keep messages short and clear to avoid carrier truncation (160 characters is safe).
:::

### Configuration

<Tabs>
<TabItem value="sms-file" label="File-Based" default>

```typescript
{
  sms: {
    // SMS provider configuration
    provider: new TwilioSMSProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: '+1234567890',
    }),

    // SMS templates
    templates: {
      globalVariables: {
        appName: 'My App',
        supportPhone: '+1-800-123-4567',
      },

      customTemplates: {
        verification: {
          contentPath: './sms-templates/verification.txt.hbs',
          // Must include: {{code}}, {{expiryMinutes}}
        },
        mfa: {
          contentPath: './sms-templates/mfa.txt.hbs',
          // Must include: {{code}}, {{expiryMinutes}}
        },
      },
    },
  }
}
```

</TabItem>
<TabItem value="sms-inline" label="Inline">

```typescript
{
  sms: {
    provider: new TwilioSMSProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: '+1234567890',
    }),

    templates: {
      globalVariables: {
        appName: 'My App',
      },

      customTemplates: {
        verification: {
          content: '{{appName}}: Your verification code is {{code}}. Valid for {{expiryMinutes}} minutes.',
        },
        mfa: {
          content: '{{appName}}: Your MFA code is {{code}}. Valid for {{expiryMinutes}} minutes. Do not share this code.',
        },
        passwordReset: {
          content: '{{appName}}: Password reset code: {{code}}. Expires in {{expiryMinutes}} min.',
        },
      },
    },
  }
}
```

</TabItem>
</Tabs>

### SMS template file format

SMS templates are plain text files with Handlebars syntax.

**Example: `sms-templates/verification.txt.hbs`**

```text
{{#if appName}}{{appName}}: {{/if}}Your verification code is {{code}}. Valid for {{expiryMinutes}} minutes.{{#if supportPhone}} Questions? Call {{supportPhone}}{{/if}}
```

**Example: `sms-templates/mfa.txt.hbs`**

```text
{{#if appName}}{{appName}}: {{/if}}Your MFA code is {{code}}. Valid for {{expiryMinutes}} minutes. Never share this code with anyone.
```

### Available SMS variables

All SMS templates have access to:

| Variable | Description | Example |
|----------|-------------|---------|
| `code` | Verification/MFA code | `123456` |
| `expiryMinutes` | Code expiration time | `5` |
| `appName` | Application name (from globalVariables) | `My App` |
| `firstName` | User's first name | `John` |
| `lastName` | User's last name | `Doe` |
| `userName` | Username | `john_doe` |
| `userEmail` | Email address | `john@example.com` |
| `phone` | Phone number | `+1234567890` |
| `supportPhone` | Support phone (from globalVariables) | `+1-800-123-4567` |

### Required variables validation

SMS templates are validated at startup to ensure required variables are present:

| Template Type | Required Variables |
|--------------|-------------------|
| `verification` | `{{code}}`, `{{expiryMinutes}}` |
| `mfa` | `{{code}}`, `{{expiryMinutes}}` |
| `passwordReset` | `{{code}}`, `{{expiryMinutes}}` |

### Default SMS templates

If you don't provide custom templates, these defaults are used:

**Verification:**
```text
{{#if appName}}{{appName}}: {{/if}}Your verification code is: {{code}}. Valid for {{expiryMinutes}} minutes.
```

**MFA:**
```text
{{#if appName}}{{appName}}: {{/if}}Your MFA code is: {{code}}. Valid for {{expiryMinutes}} minutes.
```

**Password Reset:**
```text
{{#if appName}}{{appName}}: {{/if}}Your password reset code is: {{code}}. Valid for {{expiryMinutes}} minutes.
```

### SMS provider configuration

Configure your SMS provider to send messages:

<Tabs>
<TabItem value="twilio" label="Twilio" default>

```bash npm2yarn
npm install @nauth-toolkit/sms-twilio
```

```typescript
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

{
  sms: {
    provider: new TwilioSMSProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: '+1234567890', // Your Twilio phone number
    }),
    templates: {
      // ... template config
    },
  }
}
```

</TabItem>
<TabItem value="aws-sns" label="AWS SNS">

```bash npm2yarn
npm install @nauth-toolkit/sms-aws-sns
```

```typescript
import { AWSSMSProvider } from '@nauth-toolkit/sms-aws-sns';

{
  sms: {
    provider: new AWSSMSProvider({
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }),
    templates: {
      // ... template config
    },
  }
}
```

</TabItem>
<TabItem value="custom-sms" label="Custom">

Implement the `SMSProvider` interface:

```typescript
import { SMSProvider, SMSTemplateType, SMSTemplateVariables } from '@nauth-toolkit/core';

class MyCustomSMSProvider implements SMSProvider {
  async sendOTP(
    phone: string,
    code: string,
    templateType: SMSTemplateType,
    variables: SMSTemplateVariables,
  ): Promise<void> {
    // Your SMS sending logic
    await mySmsService.send({
      to: phone,
      message: `Your ${templateType} code is ${code}`,
    });
  }
}

{
  sms: {
    provider: new MyCustomSMSProvider(),
    templates: {
      // ... template config
    },
  }
}
```

</TabItem>
</Tabs>

### SMS best practices

1. **Keep it short:** Aim for under 160 characters to avoid multi-part messages
2. **Lead with brand:** Start with `{{appName}}:` so users know who sent it
3. **Include expiry:** Always show `{{expiryMinutes}}` so users act quickly
4. **Security warnings:** For MFA codes, add "Never share this code"
5. **Support contact:** Include `{{supportPhone}}` for questions
6. **No URLs:** SMS links are often flagged as spam; use codes instead

**Good example:**
```text
MyApp: Your verification code is {{code}}. Expires in {{expiryMinutes}} min. Never share this code.
```

**Bad example (too long, no context):**
```text
Hello! Thank you for signing up for our amazing platform. We're so excited to have you join our community. Here is your verification code that you can use to verify your email address: {{code}}. This code will expire in {{expiryMinutes}} minutes so please use it soon. If you have any questions please feel free to contact our support team.
```

## Advanced customization

### Custom Handlebars helpers

Register custom helpers for advanced template logic:

<Tabs>
<TabItem value="email-helpers" label="Email Helpers" default>

```typescript
import { HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';

const templateEngine = new HandlebarsTemplateEngine({
  helpers: {
    // Uppercase transform
    uppercase: (str: string) => str.toUpperCase(),

    // Format currency
    formatPrice: (n: number) => `$${n.toFixed(2)}`,

    // Format date
    formatDate: (date: Date) => {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    },

    // Conditional equality
    eq: (a: unknown, b: unknown) => a === b,

    // Truncate text
    truncate: (str: string, length: number) => {
      return str.length > length ? str.substring(0, length) + '...' : str;
    },
  },
});

// Optional: register reusable partials (header/footer blocks)
// Use in templates with: {{> footer }}
const engineWithPartials = new HandlebarsTemplateEngine({
  helpers: {
    // ... helpers ...
  },
  partials: {
    footer: '<footer>&copy; {{currentYear}} {{companyName}}. All rights reserved.</footer>',
  },
});

// Use in config
{
  email: {
    templates: {
      engine: templateEngine,
      customTemplates: {
        // ... templates can now use custom helpers
      },
    },
  }
}
```

**Usage in template:**

```handlebars
<h1>{{uppercase appName}}</h1>
<p>Price: {{formatPrice 29.99}}</p>
<p>Date: {{formatDate timestamp}}</p>

{{#if (eq status "active")}}
  <span>Account is active</span>
{{/if}}

<p>{{truncate description 100}}</p>
```

</TabItem>
<TabItem value="sms-helpers" label="SMS Helpers">

```typescript
import { SMSTemplateEngineImpl } from '@nauth-toolkit/core';

const smsTemplateEngine = new SMSTemplateEngineImpl({
  helpers: {
    // Uppercase transform
    uppercase: (str: string) => str.toUpperCase(),

    // Mask phone number
    maskPhone: (phone: string) => {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) {
        return `***-***-${digits.slice(-4)}`;
      }
      return phone;
    },
  },
});

// Use in config
{
  sms: {
    templates: {
      engine: smsTemplateEngine,
      customTemplates: {
        // ... templates can now use custom helpers
      },
    },
  }
}
```

**Usage in template:**

```text
{{uppercase appName}}: Code {{code}} sent to {{maskPhone phone}}. Expires in {{expiryMinutes}} min.
```

</TabItem>
</Tabs>

### Programmatic template registration

Register templates programmatically instead of via config:

<Tabs>
<TabItem value="email-programmatic" label="Email" default>

```typescript
import { HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';
import { TemplateType } from '@nauth-toolkit/core';

const engine = new HandlebarsTemplateEngine({ baseDir: './templates' });

// Register from file
await engine.registerTemplateFromFile(
  TemplateType.WELCOME,
  'welcome.html.hbs',
  { subject: 'Welcome to {{appName}}!' }
);

// Register inline
engine.registerTemplate(TemplateType.VERIFICATION, {
  subject: 'Verify your email',
  html: '<h1>Code: {{code}}</h1>',
  text: 'Code: {{code}}',
});

// Use in config
{
  email: {
    templates: {
      engine,
    },
  }
}
```

</TabItem>
<TabItem value="sms-programmatic" label="SMS">

```typescript
import { SMSTemplateEngineImpl, SMSTemplateType } from '@nauth-toolkit/core';

const engine = new SMSTemplateEngineImpl();

// Register from file
await engine.registerTemplate(
  SMSTemplateType.MFA,
  { contentPath: './sms-templates/mfa.txt.hbs' }
);

// Register inline
await engine.registerTemplate(
  SMSTemplateType.VERIFICATION,
  { content: '{{appName}}: Code {{code}}. Expires {{expiryMinutes}} min.' }
);

// Use in config
{
  sms: {
    templates: {
      engine,
    },
  }
}
```

</TabItem>
</Tabs>

### Dynamic variables per user

Inject custom variables at runtime based on user context:

```typescript
// In your authentication service
const userPreferences = await getUserPreferences(user.sub);

// Templates automatically receive user data
// You can extend globalVariables to include user-specific data
const emailVariables = {
  ...config.email.templates.globalVariables,
  preferredLanguage: userPreferences.language,
  dashboardUrl: `https://app.myapp.com/dashboard/${user.sub}`,
};

// The system automatically merges these with template variables
```

**Usage in template:**

```handlebars
{{#if (eq preferredLanguage "es")}}
  <p>¡Bienvenido!</p>
{{else}}
  <p>Welcome!</p>
{{/if}}

<a href="{{dashboardUrl}}">Go to Dashboard</a>
```

## Testing templates

### Preview templates locally

Test your templates before deploying:

<Tabs>
<TabItem value="test-email" label="Email" default>

```typescript
import { HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';
import { TemplateType } from '@nauth-toolkit/core';

const engine = new HandlebarsTemplateEngine({ baseDir: './templates' });

// Load your custom templates
await engine.registerTemplateFromFile(TemplateType.VERIFICATION, 'verification.html.hbs');

// Render with test data
const result = await engine.render(TemplateType.VERIFICATION, {
  code: '123456',
  link: 'https://myapp.com/verify?code=123456',
  expiryMinutes: 10,
  userName: 'testuser',
  firstName: 'John',
  appName: 'My App',
  supportEmail: 'support@myapp.com',
  currentYear: 2024,
});

console.log('Subject:', result.subject);
console.log('HTML:', result.html);
console.log('Text:', result.text);

// Save to file for browser preview
fs.writeFileSync('preview.html', result.html);
```

</TabItem>
<TabItem value="test-sms" label="SMS">

```typescript
import { SMSTemplateEngineImpl, SMSTemplateType } from '@nauth-toolkit/core';

const engine = new SMSTemplateEngineImpl();

// Load your custom template
await engine.registerTemplate(SMSTemplateType.MFA, {
  content: '{{appName}}: MFA code {{code}}. Valid {{expiryMinutes}} min.',
});

// Render with test data
const result = await engine.render(SMSTemplateType.MFA, {
  code: '654321',
  expiryMinutes: 5,
  appName: 'My App',
  firstName: 'John',
});

console.log('SMS:', result.content);
console.log('Length:', result.content.length); // Check if under 160
```

</TabItem>
</Tabs>

### Automated testing

Add template tests to your test suite:

```typescript
describe('Email Templates', () => {
  let engine: HandlebarsTemplateEngine;

  beforeAll(async () => {
    engine = new HandlebarsTemplateEngine({ baseDir: './templates' });
    await engine.registerTemplateFromFile(TemplateType.VERIFICATION, 'verification.html.hbs');
  });

  it('should include required variables', async () => {
    const result = await engine.render(TemplateType.VERIFICATION, {
      code: '123456',
      link: 'https://test.com/verify',
      expiryMinutes: 10,
      appName: 'Test App',
    });

    expect(result.html).toContain('123456');
    expect(result.html).toContain('https://test.com/verify');
    expect(result.html).toContain('10');
  });

  it('should handle missing optional variables', async () => {
    const result = await engine.render(TemplateType.VERIFICATION, {
      code: '123456',
      link: 'https://test.com/verify',
      expiryMinutes: 10,
      // No firstName/lastName
    });

    expect(result.html).toBeDefined();
    expect(result.html).not.toContain('undefined');
  });
});
```

## Troubleshooting

### Template validation errors at startup

**Error:**
```
Template validation failed for 'verification':
Missing required variable: {{link}}
```

**Solution:** Add the missing variable to your template:

```handlebars
<a href="{{link}}">Verify Email</a>
```

### Variables showing as placeholders

**Symptom:** Email shows `{{code}}` instead of actual code value.

**Causes:**
1. Variable name typo: `{{cod}}` instead of `{{code}}`
2. Template engine not configured
3. Variable not passed at render time

**Solution:** Check variable spelling and ensure it's in the required variables list.

### SMS messages truncated

**Symptom:** SMS message is cut off at 160 characters.

**Causes:**
1. Template too long
2. Multi-part SMS not supported by carrier

**Solution:** Keep SMS under 160 characters. Check rendered length:

```typescript
const result = await engine.render(SMSTemplateType.MFA, variables);
console.log('Length:', result.content.length); // Should be < 160
```

### Email appears in spam folder

**Causes:**
1. Missing text version (HTML-only emails flagged as spam)
2. No proper email headers
3. Sender reputation issues

**Solutions:**
1. Always provide both `html` and `text` templates
2. Use authenticated SMTP (DKIM, SPF, DMARC)
3. Use reputable email provider (AWS SES, SendGrid)

### Handlebars conditionals not working

**Bad:**
```handlebars
{{#if firstName != ""}}
  Hi {{firstName}}
{{/if}}
```

**Good:**
```handlebars
{{#if firstName}}
  Hi {{firstName}}
{{/if}}
```

Handlebars conditionals check for truthy/falsy values, not expressions. Use custom helpers for complex logic.

## Related documentation

- [Configuration Guide](/docs/concepts/configuration) - Email and SMS configuration reference
- [MFA Feature](/docs/features/mfa) - Multi-factor authentication with SMS codes
- [Error Handling](/docs/concepts/error-handling) - Handle template errors gracefully
