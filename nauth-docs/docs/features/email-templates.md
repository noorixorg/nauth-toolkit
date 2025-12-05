---
title: Email Templates
description: Customize email templates for welcome messages, verification, and more
sidebar_position: 3
---

# Email Templates

Customize the emails sent to your users. nauth-toolkit uses Handlebars for flexible, logic-based templates.

## Quick Start

### Configuration-Based (Recommended)

Configure custom templates directly in `AuthModule.forRoot()`. This is validated at startup to ensure you haven't missed any required variables.

```typescript
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
      // Custom templates (override defaults)
      customTemplates: {
        verification: {
          htmlPath: './email-templates/verification.html.hbs',
          textPath: './email-templates/verification.text.hbs',
          // Must include: {{code}}, {{link}}, {{expiryMinutes}}
        },
        welcome: {
          htmlPath: './email-templates/welcome.html.hbs',
        },
      },
    },
  },
});
```

## Template File Format

Templates are HTML files with Handlebars syntax. You can define the email subject in the frontmatter (YAML at the top).

**Example `welcome.html.hbs`:**

```html
---
subject: Welcome to {{appName}}!
---

<!DOCTYPE html>
<html>
  <head>
    <style>
      /* Use inline styles for best email client compatibility */
      body { font-family: sans-serif; }
      .button { background: {{brandColor}}; color: white; padding: 10px 20px; text-decoration: none; }
    </style>
  </head>
  <body>
    <h1>Hi {{userName}}!</h1>
    <p>Welcome to {{appName}}. We're glad to have you.</p>

    <p>
      <a href="{{dashboardUrl}}" class="button">Go to Dashboard</a>
    </p>

    <p>Need help? Contact <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
  </body>
</html>
```

## Available Variables

These variables are automatically injected into your templates:

| Category     | Variables                                                                         |
| ------------ | --------------------------------------------------------------------------------- |
| **User**     | `userName`, `firstName`, `lastName`, `userEmail`, `greetingName` (smart fallback) |
| **Auth**     | `code`, `link`, `expiryMinutes` (for verification/reset emails)                   |
| **Security** | `deviceName`, `deviceType`, `ipAddress`, `location`, `timestamp`                  |
| **Branding** | `appName`, `companyName`, `brandColor`, `logoUrl`, `supportEmail`                 |
| **Auto**     | `currentYear`                                                                     |

### Smart Greeting

The `greetingName` variable automatically picks the best name to use:
`fullName` → `firstName` → `lastName` → `userName` → "Hi,"

```handlebars
{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}
```

## Required Parameters

To prevent broken emails, the system validates that your custom templates contain necessary variables:

| Template Type    | Required Variables                          |
| ---------------- | ------------------------------------------- |
| `verification`   | `{{code}}`, `{{link}}`, `{{expiryMinutes}}` |
| `passwordReset`  | `{{link}}`, `{{expiryMinutes}}`             |
| `accountLockout` | `{{reason}}`, `{{durationMinutes}}`         |
| `newDevice`      | `{{deviceName}}`, `{{timestamp}}`           |
| `emailChanged`   | `{{userEmail}}`                             |

If a required variable is missing, your app will fail to start with a helpful error message.

## Advanced Usage

### Custom Helpers

You can register custom Handlebars helpers for complex logic:

```typescript
const engine = new HandlebarsTemplateEngine({
  helpers: {
    uppercase: (str: string) => str.toUpperCase(),
    formatPrice: (n: number) => `$${n.toFixed(2)}`,
  },
});
```

Usage:

```handlebars
{{uppercase appName}}
```

### Programmatic Registration

If you prefer to register templates manually instead of via config:

```typescript
import { HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';

const engine = new HandlebarsTemplateEngine({ baseDir: './templates' });
await engine.registerTemplateFromFile('welcome', 'welcome.html');
```

## Built-in Templates

nauth-toolkit comes with default templates for all events. You only need to provide custom templates for the ones you want to override.

- `VERIFICATION`
- `PASSWORD_RESET`
- `WELCOME`
- `ACCOUNT_LOCKOUT`
- `NEW_DEVICE`
- `PASSWORD_CHANGED`
- `EMAIL_CHANGED`
- `MFA_ENABLED`
