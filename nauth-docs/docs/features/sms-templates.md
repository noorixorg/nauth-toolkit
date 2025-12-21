---
title: SMS Templates
description: Customize SMS templates for verification codes, MFA, and password resets
sidebar_position: 4
---

# SMS Templates

Customize the SMS messages sent to your users. nauth-toolkit uses Handlebars-like syntax for flexible, logic-based templates.

## Quick Start

### Configuration-Based (Recommended)

Configure custom templates directly in `AuthModule.forRoot()`. This is validated at startup to ensure you haven't missed any required variables.

```typescript
AuthModule.forRoot({
  sms: {
    templates: {
      // Global variables (available to all templates)
      globalVariables: {
        appName: 'My App',
        companyName: 'My Company Inc.',
        supportPhone: '+1-800-123-4567',
      },
      // Custom templates (override defaults)
      customTemplates: {
        verification: {
          content: '{{appName}}: Your verification code is {{code}}. Expires in {{expiryMinutes}} min.',
          // Must include: {{code}}, {{expiryMinutes}}
        },
        mfa: {
          contentPath: './sms-templates/mfa.txt.hbs',
          // Must include: {{code}}, {{expiryMinutes}}
        },
      },
    },
  },
});
```

## Template File Format

SMS templates are plain text files with Handlebars-like syntax. SMS messages are limited to 160 characters per message (SMS standard), so keep templates concise.

**Example `verification.txt.hbs`:**

```handlebars
{{#if appName}}{{appName}}: {{/if}}Your verification code is {{code}}. Valid for {{expiryMinutes}} minutes.
```

**Example `mfa.txt.hbs`:**

```handlebars
{{#if appName}}{{appName}}: {{/if}}Your MFA code is {{code}}. Valid for {{expiryMinutes}} minutes.
```

## Available Variables

These variables are automatically injected into your templates:

| Category     | Variables                                                      |
| ------------ | -------------------------------------------------------------- |
| **User**     | `userName`, `firstName`, `lastName`, `userEmail`, `phone`     |
| **Auth**     | `code`, `expiryMinutes` (for verification/MFA/reset codes)     |
| **Branding** | `appName`, `companyName`, `supportPhone`                       |
| **Custom**   | Any additional variables you provide                           |

### Conditional Rendering

Use `{{#if variable}}...{{/if}}` to conditionally include content:

```handlebars
{{#if appName}}{{appName}}: {{/if}}Your code is {{code}}.
```

This will include the app name prefix only if `appName` is provided.

## Required Parameters

To prevent broken SMS messages, the system validates that your custom templates contain necessary variables:

| Template Type    | Required Variables              |
| ---------------- | ------------------------------- |
| `verification`   | `{{code}}`, `{{expiryMinutes}}` |
| `mfa`            | `{{code}}`, `{{expiryMinutes}}` |
| `passwordReset`  | `{{code}}`, `{{expiryMinutes}}` |

If a required variable is missing, your app will fail to start with a helpful error message.

## Advanced Usage

### Inline Templates

You can provide templates directly in your configuration:

```typescript
AuthModule.forRoot({
  sms: {
    templates: {
      customTemplates: {
        verification: {
          content: '{{appName}}: Code {{code}} expires in {{expiryMinutes}} min.',
        },
      },
    },
  },
});
```

### File-Based Templates

For better organization, use file paths:

```typescript
AuthModule.forRoot({
  sms: {
    templates: {
      customTemplates: {
        verification: {
          contentPath: './sms-templates/verification.txt.hbs',
        },
        mfa: {
          contentPath: './sms-templates/mfa.txt.hbs',
        },
      },
    },
  },
});
```

### Programmatic Registration

If you prefer to register templates manually:

```typescript
import { SMSTemplateEngineImpl } from '@nauth-toolkit/core';

const engine = new SMSTemplateEngineImpl('./sms-templates');
engine.registerTemplate('verification', {
  content: '{{appName}}: Your code is {{code}}.',
});
```

## Built-in Templates

nauth-toolkit comes with default templates for all SMS types. You only need to provide custom templates for the ones you want to override.

- `VERIFICATION` - Phone verification codes
- `MFA` - Multi-factor authentication codes
- `PASSWORD_RESET` - Password reset codes

## Best Practices

1. **Keep it short**: SMS messages are limited to 160 characters. Keep templates concise.
2. **Include expiry**: Always include `{{expiryMinutes}}` so users know when codes expire.
3. **Brand consistently**: Use `{{appName}}` for consistent branding across all messages.
4. **Test templates**: Verify your templates render correctly with all variable combinations.

## Example Templates

### Minimal Template

```handlebars
{{code}} is your verification code. Valid for {{expiryMinutes}} min.
```

### Branded Template

```handlebars
{{appName}}: Your code is {{code}}. Expires in {{expiryMinutes}} minutes. Need help? Call {{supportPhone}}.
```

### Multi-Language Support

You can create language-specific templates:

```typescript
AuthModule.forRoot({
  sms: {
    templates: {
      customTemplates: {
        'verification-en': {
          content: '{{appName}}: Your code is {{code}}. Valid for {{expiryMinutes}} min.',
        },
        'verification-es': {
          content: '{{appName}}: Su código es {{code}}. Válido por {{expiryMinutes}} min.',
        },
      },
    },
  },
});
```

## Related Documentation

- [SMS Provider Configuration](../api/sms/overview)
- [Phone Verification](../api/core/services/phone-verification-service)
- [MFA Setup](../features/mfa)

