# Email Template System - What Changed

## The Problem

Before: Templates hard-coded in TypeScript, difficult to customize.

## The Solution

Now: **Handlebars templates in separate files**. Consumer apps can easily replace with their own branded templates.

## What You Get

### 1. File-Based Templates

One file per template (HTML + subject in frontmatter):

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

### 2. Full Handlebars Support

```handlebars
{{#if isPremium}}Premium features{{/if}}
{{#each items}}<li>{{this}}</li>{{/each}}
{{uppercase appName}}
```

### 3. Simple API

```typescript
import { HandlebarsTemplateEngine } from '@nauth-toolkit/email-nodemailer';

// Use built-in templates
const engine = new HandlebarsTemplateEngine();

// Or use your own
await engine.registerTemplateFromFile(TemplateType.WELCOME, 'my-welcome-template.html');
```

## Why This is Better

- - **Subject in file** - One file instead of three per template
- - **`.hbs` or `.html`** - Both work (`.hbs` is just a naming convention)
- - **Easy to customize** - Replace files, not code
- - **Full control** - Use any HTML/CSS
- - **Powerful** - Loops, conditionals, helpers

## Files Per Template

**Before:** 3 files

- `welcome.subject.hbs`
- `welcome.html.hbs`
- `welcome.text.hbs`

**After:** 2 files (subject in HTML file)

- `welcome.html.hbs` (includes subject in frontmatter)
- `welcome.text.hbs`

## Quick Example

**your-templates/welcome.html:**

```html
---
subject: Welcome to {{appName}} 
---


<!DOCTYP html
<html>
  <body style="background: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px;">
      <div style="background: {{brandColor}}; color: white; padding: 20px;">
        <h1>Welcome!</h1>
      </div>
      <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>
      <p>Your account is ready!</p>
      <a href="{{dashboardUrl}}" style="background: {{brandColor}}; color: white; padding: 15px; text-decoration: none;"
        >Get Started</a
      >
    </div>
  </body>
</html>
```

**Load it:**

```typescript
const engine = new HandlebarsTemplateEngine({
  baseDir: './your-templates',
});

await engine.registerTemplateFromFile(TemplateType.WELCOME, 'welcome.html');
```

## Documentation

See `docs/EMAIL_TEMPLATES.md` (under 200 lines) for complete guide.

## Backward Compatible

Old `HtmlTemplateEngine` still works - no breaking changes.
