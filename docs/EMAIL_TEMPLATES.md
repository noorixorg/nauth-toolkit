# Email Template Customization

## Template Variables & Personalization

### Greeting Name Fallback Chain

The engine uses a smart fallback for personalized greetings: **fullName → firstName → lastName → userName → "Hi,"**

**Variables (all optional):**
- `fullName` - Full name (e.g., "John Doe")
- `firstName` - First name (e.g., "John")
- `lastName` - Last name (e.g., "Doe")
- `userName` - Username (e.g., "johndoe")

**Example in templates:**
```handlebars
{{#if fullName}}Hi {{fullName}},{{else}}{{#if firstName}}Hi {{firstName}},{{else}}{{#if lastName}}Hi {{lastName}},{{else}}{{#if userName}}Hi {{userName}},{{else}}Hi,{{/if}}{{/if}}{{/if}}{{/if}}
```

**What renders:**
- If `fullName` provided: "Hi John Doe,"
- Else if `firstName`: "Hi John,"
- Else if `lastName`: "Hi Doe,"
- Else if `userName`: "Hi johndoe,"
- Else: "Hi,"

### Optional vs Required Variables

Templates use Handlebars `{{#if}}` to conditionally render content:

```handlebars
{{#if supportEmail}}
Contact us at {{supportEmail}}
{{/if}}
```

If `supportEmail` is undefined, the entire block won't render.

## Quick Start

### Option 1: Configuration-Based (Recommended)

Configure custom templates in `AuthModule.forRoot()` - validated at startup:

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
          // No required params
        },
      },
    },
  },
});
```

### Option 2: Programmatic Registration

```typescript
import { HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';

// Use built-in templates
const engine = new HandlebarsTemplateEngine();

// Or load your own
const engine = new HandlebarsTemplateEngine({
  baseDir: './my-templates',
  useDefaultTemplates: false,
});
await engine.registerTemplateFromFile(TemplateType.WELCOME, 'welcome.html');
```

## Template File Format

**Subject in frontmatter** (YAML at top):

```html
---
subject: Welcome to {{appName}}!
---

<!DOCTYPE html>
<html>
  <body>
    <h1>Hi {{userName}}!</h1>
  </body>
</html>
```

Optional text version (`welcome.txt`):

```
Welcome to {{appName}}!
Hi {{userName}}!
```

## Required Parameters by Template

Custom templates are **validated at startup** to ensure required parameters are present:

| Template Type     | Required Parameters                         | Optional Parameters                               |
| ----------------- | ------------------------------------------- | ------------------------------------------------- |
| `verification`    | `{{code}}`, `{{link}}`, `{{expiryMinutes}}` | user, branding                                    |
| `passwordReset`   | `{{link}}`, `{{expiryMinutes}}`             | user, branding                                    |
| `accountLockout`  | `{{reason}}`, `{{durationMinutes}}`         | user, branding                                    |
| `newDevice`       | `{{deviceName}}`, `{{timestamp}}`           | `{{deviceType}}`, `{{ipAddress}}`, `{{location}}` |
| `emailChanged`    | `{{userEmail}}`                             | user, branding                                    |
| `welcome`         | _none_                                      | user, branding                                    |
| `passwordChanged` | _none_                                      | user, branding                                    |
| `mfaEnabled`      | _none_                                      | user, branding                                    |

**If required parameters are missing, configuration will fail with a clear error message.**

## Available Variables

**User:** `userName`, `firstName`, `lastName`, `userEmail`, `greetingName`
**Auth:** `code`, `link`, `expiryMinutes`
**Security:** `deviceName`, `deviceType`, `ipAddress`, `location`, `timestamp`
**Branding:** `appName`, `companyName`, `brandColor`, `logoUrl`, `supportEmail`, `dashboardUrl`
**Auto:** `currentYear`

## Handlebars Syntax

```handlebars
{{userName}}

{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}

{{#each items}}<li>{{this.name}}</li>{{/each}}

{{#if (eq status 'active')}}Active{{/if}}
{{#if (and isVerified isPremium)}}Premium{{/if}}
{{uppercase appName}}
```

## Complete Example

**templates/welcome.html:**

```html
---
subject: Welcome to {{appName}} 🎉
---


<!DOCTYP html
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f5f5f5; }
      .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; }
      .header { background: {{brandColor}}; color: white; padding: 20px; text-align: center; }
      .button { background: {{brandColor}}; color: white; padding: 15px 30px;
                text-decoration: none; border-radius: 5px; display: inline-block; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        {{#if logoUrl}}<img src="{{logoUrl}}" style="max-width: 150px;" />{{/if}}
        <h1>Welcome!</h1>
      </div>
      <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>
      <p>Your account is ready!</p>
      <p style="text-align: center;">
        <a href="{{dashboardUrl}}" class="button">Get Started</a>
      </p>
      <p>Need help? <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
      <p><small>&copy; {{currentYear}} {{companyName}}</small></p>
    </div>
  </body>
</html>
```

## NestJS Setup

```typescript
import { HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';
import { NodemailerProvider } from '@nauth-toolkit/email-nodemailer';

const engine = new HandlebarsTemplateEngine({ baseDir: './templates' });
await engine.registerTemplateFromFile(TemplateType.WELCOME, 'welcome.html');

const emailProvider = new NodemailerProvider({
  transport: {
    host: process.env.SMTP_HOST,
    port: 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  },
  templateEngine: engine
});

@Module({
  imports: [
    AuthModule.forRoot({
      email: {
        provider: emailProvider,
        templates: {
          appName: 'My App',
          brandColor: '#4CAF50',
          supportEmail: 'support@example.com'
        }
      }
    })
  ]
})
```

## Custom Helpers

```typescript
const engine = new HandlebarsTemplateEngine({
  helpers: {
    uppercase: (str: string) => str.toUpperCase(),
    formatPrice: (n: number) => `$${n.toFixed(2)}`,
  },
});
```

Use in templates:

```handlebars
{{uppercase appName}}
{{formatPrice 99.99}}
```

## Built-in Templates

8 types: `VERIFICATION`, `PASSWORD_RESET`, `WELCOME`, `ACCOUNT_LOCKOUT`, `NEW_DEVICE`, `PASSWORD_CHANGED`, `EMAIL_CHANGED`, `MFA_ENABLED`

Location: `packages/email/nodemailer/src/templates/default/`

## FAQ

**`.hbs` vs `.html`?**
Both work. `.hbs` is just Handlebars convention. They're the same - HTML with `{{}}`.

**Why separate subject file?**
It's not! Subject is in frontmatter at top of HTML file.

**One file or three?**
Two files: `welcome.html` (HTML + subject) and optional `welcome.txt` (plain text).

**Inline styles required?**
Yes, for email clients. Use `<style>` tags and inline styles.

That's it! Replace built-in templates with your branded versions.
