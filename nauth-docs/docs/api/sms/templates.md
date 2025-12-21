---
title: SMS Templates Configuration
description: Configure custom SMS templates for verification, MFA, and password reset codes
keywords: [sms, templates, configuration, handlebars, api]
image: /img/api-social-card.png
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SMS Templates Configuration

**Package:** `@nauth-toolkit/core`
**Type:** Configuration

Configure custom SMS templates and global variables for branding.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthModule } from '@nauth-toolkit/nestjs';

AuthModule.forRoot({
  sms: {
    templates: {
      globalVariables: {
        appName: 'My App',
        supportPhone: '+1-800-123-4567',
      },
      customTemplates: {
        verification: {
          content: '{{appName}}: Your code is {{code}}. Expires in {{expiryMinutes}} min.',
        },
      },
    },
  },
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { createNAuth } from '@nauth-toolkit/core';

const nauth = createNAuth({
  sms: {
    templates: {
      globalVariables: {
        appName: 'My App',
        supportPhone: '+1-800-123-4567',
      },
      customTemplates: {
        verification: {
          content: '{{appName}}: Your code is {{code}}. Expires in {{expiryMinutes}} min.',
        },
      },
    },
  },
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { createNAuth } from '@nauth-toolkit/core';

const nauth = createNAuth({
  sms: {
    templates: {
      globalVariables: {
        appName: 'My App',
        supportPhone: '+1-800-123-4567',
      },
      customTemplates: {
        verification: {
          content: '{{appName}}: Your code is {{code}}. Expires in {{expiryMinutes}} min.',
        },
      },
    },
  },
});
```

</TabItem>
</Tabs>

## Properties

| Property          | Type                                                      | Required | Description                                                      |
| ----------------- | --------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| `engine`          | `SMSTemplateEngine`                                       | No       | Custom template engine instance (default: `SMSTemplateEngineImpl`) |
| `globalVariables` | `Record<string, string \| number \| boolean \| undefined>` | No       | Global variables available to all templates                       |
| `customTemplates` | `Record<string, CustomSMSTemplateDefinition>`            | No       | Custom template definitions (override defaults)                   |

## Global Variables

Global variables are merged with template-specific variables at render time. Template-specific variables take precedence.

Common global variables:

- `appName` - Your application name
- `companyName` - Your company name
- `supportPhone` - Support contact phone number

## Custom Templates

Custom templates can be provided as inline content or file paths:

### Inline Content

```typescript
customTemplates: {
  verification: {
    content: '{{appName}}: Your verification code is {{code}}. Valid for {{expiryMinutes}} minutes.',
  },
}
```

### File Path

```typescript
customTemplates: {
  verification: {
    contentPath: './sms-templates/verification.txt.hbs',
  },
}
```

## Template Types

| Type           | Required Variables              | Description                    |
| -------------- | ------------------------------- | ------------------------------ |
| `verification` | `{{code}}`, `{{expiryMinutes}}` | Phone verification codes        |
| `mfa`          | `{{code}}`, `{{expiryMinutes}}` | Multi-factor authentication     |
| `passwordReset`| `{{code}}`, `{{expiryMinutes}}` | Password reset codes            |

## Examples

### Basic Configuration

```typescript
sms: {
  templates: {
    globalVariables: {
      appName: process.env.APP_NAME || 'My Application',
      companyName: 'My Company Inc.',
      supportPhone: '+1-800-123-4567',
    },
  },
}
```

### Custom Templates

```typescript
sms: {
  templates: {
    globalVariables: {
      appName: 'My App',
    },
    customTemplates: {
      verification: {
        content: '{{appName}}: Your code is {{code}}. Expires in {{expiryMinutes}} min.',
      },
      mfa: {
        contentPath: './sms-templates/mfa.txt.hbs',
      },
    },
  },
}
```

### Mixed Configuration

```typescript
sms: {
  templates: {
    globalVariables: {
      appName: 'My App',
      companyName: 'My Company',
    },
    customTemplates: {
      verification: {
        content: '{{appName}}: Code {{code}} expires in {{expiryMinutes}} min.',
      },
      passwordReset: {
        contentPath: './sms-templates/password-reset.txt.hbs',
      },
    },
  },
}
```

## Related

- [SMS Templates Feature Guide](/docs/features/sms-templates)
- [SMSTemplateEngine Interface](/docs/api/core/interfaces/sms-template-engine)
- [SMS Providers Overview](./overview)

