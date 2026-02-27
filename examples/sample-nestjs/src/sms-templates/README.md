# SMS Templates

This directory contains SMS template files for the sample NestJS backend.

## Template Files

- `password-reset.txt.hbs` - Password reset code template

## Usage

To use file-based templates, uncomment the `contentPath` option in `auth.config.ts`:

```typescript
sms: {
  templates: {
    customTemplates: {
      passwordReset: {
        contentPath: './sms-templates/password-reset.txt.hbs',
      },
    },
  },
}
```

## Template Syntax

Templates use Handlebars-like syntax:

- `{{variable}}` - Insert variable value
- `{{#if variable}}...{{/if}}` - Conditional rendering

## Available Variables

- `appName` - Application name (from globalVariables)
- `companyName` - Company name (from globalVariables)
- `supportPhone` - Support phone number (from globalVariables)
- `code` - Verification/MFA/reset code
- `expiryMinutes` - Code expiry time in minutes
- `firstName`, `lastName`, `username`, `userEmail`, `phone` - User information (when available)

## Required Variables

Each template type requires specific variables:

- `verification`: `{{code}}`, `{{expiryMinutes}}`
- `mfa`: `{{code}}`, `{{expiryMinutes}}`
- `passwordReset`: `{{code}}`, `{{expiryMinutes}}`

