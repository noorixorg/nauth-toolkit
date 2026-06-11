---
title: SMSTemplateEngine Interface
description: Interface for SMS template engines that render SMS messages with variables
keywords: [sms, templates, engine, interface, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SMSTemplateEngine Interface

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Contract for template engines that can render SMS templates with variables.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SMSTemplateEngine } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SMSTemplateEngine } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SMSTemplateEngine } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `render(type, variables)` | `Promise<SMSTemplate>` | Render a template with the provided variables |
| `registerTemplate(type, template)` | `void` | Register a custom template from inline string |
| `registerTemplateFromSources(type, templateSource)` | `Promise<void>` | Register a custom template from mixed sources (strings or files) |

## render()

Render a template with the provided variables.

**Parameters:**

| Parameter  | Type                      | Required | Description                    |
| ---------- | ------------------------- | -------- | ------------------------------ |
| `type`     | `SMSTemplateType \| string` | Yes      | Type of template to render     |
| `variables` | `SMSTemplateVariables`    | Yes      | Variables to inject into template |

**Returns:** `Promise<SMSTemplate>`

**Throws:** `NAuthException` if template type is not found

**Example:**

```typescript
const result = await engine.render(
  SMSTemplateType.VERIFICATION,
  {
    appName: 'My App',
    code: '123456',
    expiryMinutes: 5,
  }
);
// result.content: "My App: Your verification code is: 123456. Valid for 5 minutes."
```

## registerTemplate()

Register a custom template from inline string.

**Parameters:**

| Parameter  | Type                      | Required | Description                    |
| ---------- | ------------------------- | -------- | ------------------------------ |
| `type`     | `SMSTemplateType \| string` | Yes      | Template type identifier       |
| `template` | `SMSTemplate`             | Yes      | Template definition with content |

**Example:**

```typescript
engine.registerTemplate(SMSTemplateType.VERIFICATION, {
  content: '{{appName}}: Your code is {{code}}. Expires in {{expiryMinutes}} min.',
});
```

## registerTemplateFromSources()

Register a custom template from mixed sources (strings or files).

**Parameters:**

| Parameter        | Type                      | Required | Description                    |
| ---------------- | ------------------------- | -------- | ------------------------------ |
| `type`           | `SMSTemplateType \| string` | Yes      | Template type identifier       |
| `templateSource` | `{ content: SMSTemplateSource }` | Yes | Template source (content or file path) |

**Throws:** `NAuthException` if file not found or invalid source

**Example:**

```typescript
// Inline content
await engine.registerTemplateFromSources(SMSTemplateType.VERIFICATION, {
  content: { content: '{{appName}}: Your code is {{code}}.' },
});

// File-based
await engine.registerTemplateFromSources(SMSTemplateType.MFA, {
  content: { filePath: './sms-templates/mfa.txt.hbs' },
});
```

## Implementation

The default implementation is `SMSTemplateEngineImpl`:

```typescript
import { SMSTemplateEngineImpl } from '@nauth-toolkit/core';

const engine = new SMSTemplateEngineImpl(process.cwd(), logger);
```

## Error Handling

All methods throw `NAuthException` with `AuthErrorCode.INTERNAL_ERROR` when:

- Template type is not found (render)
- Template file does not exist (registerTemplateFromSources)
- Invalid template source (registerTemplateFromSources)

## Related

- [SMS Templates Configuration](/docs/api/sms/templates)
- [SMS Templates Feature Guide](/docs/guides/sms-templates)
- [SMSTemplateType Enum](../enums/sms-template-type)

