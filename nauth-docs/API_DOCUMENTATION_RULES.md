---
title: API Documentation Rules
---

# API Documentation Rules

**Purpose:** AI-ready prompt for generating consistent, Stripe-style API reference documentation.

---

## Core Principles

1. **Minimal** - No prose, no redundancy, scannable tables
2. **Consistent** - Same structure across all pages
3. **Practical** - Real examples, no theoretical code
4. **Linked** - Hyperlink related APIs, never explain them inline
5. **Framework-Aware** - Use tabs for NestJS/Express/Fastify (groupId="platform")

---

## DTO Documentation Pattern

````markdown
---
title: DTOName
description: Brief one-line description (50-160 chars for SEO)
sidebar_position: N
keywords: [dto, request, validation, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# DTOName

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Brief description (one sentence).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { DTOName } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { DTOName } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { DTOName } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description with validation inline |
| -------- | -------- | -------- | ---------------------------------- |
| `field1` | `string` | Yes      | Description. Min X, max Y chars.   |
| `field2` | `number` | No       | Description. Must be positive.     |

## Example

```json
{
  "field1": "value",
  "field2": 123
}
```

## Used By

- [ServiceName.methodName()](../services/service-name#method)
````

**Rules:**

- ALWAYS use `groupId="platform"` for tabs (syncs across pages)
- NO separate validation sections (put in table)
- NO response examples (belong in service docs)
- NO usage code examples (belong in service docs)
- NO multiple request variations (one complete example)
- Properties table includes ALL info: type, required, validation, description

---

## Service Documentation Pattern

````markdown
---
title: ServiceName
description: Brief description (50-160 chars for SEO)
sidebar_position: N
keywords: [service, authentication, api, methods]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ServiceName

**Package:** `@nauth-toolkit/core`
**Type:** Service

Brief description of what service does (1-2 sentences).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ServiceName } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ServiceName } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ServiceName } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>
````

## Overview

Brief overview with key features (2-3 sentences max).

:::note
Auto-injected by framework. No manual instantiation required.
:::

## Methods

### methodName()

Brief one-line description.

```typescript
async methodName(dto: InputDTO): Promise<OutputDTO>
```

**Parameters**

- `dto` - [`InputDTO`](../dto/input-dto)

**Returns**

- [`OutputDTO`](../dto/output-dto)

**Errors**

| Code         | When       | Details            |
| ------------ | ---------- | ------------------ |
| `ERROR_CODE` | Brief when | `{ field?: type }` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
export class MyService {
  constructor(private serviceName: ServiceName) {}

  async example() {
    const result = await this.serviceName.methodName({ field: 'value' });
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/endpoint', async (req, res) => {
  const result = await nauth.serviceName.methodName({ field: 'value' });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post('/endpoint', { preHandler: nauth.helpers.public() },
  withNAuthContext(async (req) => {
    return nauth.serviceName.methodName(req.body);
  }));
```

</TabItem>
</Tabs>

---

### nextMethod()

[Repeat pattern...]

---

## Error Handling

Brief error handling pattern with link to guide.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
try {
  await this.service.method(dto);
} catch (error) {
  if (error instanceof NAuthException) {
    console.log(error.code);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
try {
  await nauth.service.method(dto);
} catch (error) {
  if (error instanceof NAuthException) {
    res.status(error.statusCode).json(error.toJSON());
  }
}
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
try {
  await nauth.service.method(dto);
} catch (error) {
  if (error instanceof NAuthException) {
    reply.status(error.statusCode).send(error.toJSON());
  }
}
```

</TabItem>
</Tabs>

See [Error Handling Guide](/docs/concepts/error-handling).

---

## Related APIs

- [RelatedService](./related-service) - Brief
- [NAuthException](../exceptions/nauth-exception) - Error handling

````

**Rules:**
- ALWAYS use `groupId="platform"` for tabs (syncs across pages)
- NO "Signature:" header (just show code block)
- NO redundant linking (e.g., `[dto](link) - [DTO](link)`)
- NO "Promise<>" wrapper in Returns section
- NO full exception structure examples per method
- NO multiple examples per method
- NO verbose error explanations (table only)
- NO separate DTOs/Exceptions sections in Related APIs
- Methods and properties in alphabetical order

---

## Error Documentation

**Errors Table Format:**

```markdown
| Code | When | Details |
| ---- | ---- | ------- |
| `ERROR_CODE` | Brief description | `{ field?: type }` |
````

- Use backticks for code values
- "When" column: brief (3-5 words)
- "Details" column: TypeScript object or `undefined`
- NO error code links in table (redundant)
- NO exception structure examples per method

---

## SEO Optimization

**Front Matter (Required):**

```yaml
---
title: Exact page title (for search results)
description: 50-160 characters summarizing the page
keywords: [relevant, search, terms]
image: /img/api-social-card.png
sidebar_position: N
---
```

**Structured Data (for key pages):**

```typescript
<head>
  <script type="application/ld+json">
    {JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'TechArticle',
      headline: 'Page Title',
      description: 'Page description',
      keywords: 'api, authentication, dto',
    })}
  </script>
</head>
```

**Image Optimization:**

```markdown
![Descriptive alt text](./image.png 'Optional tooltip title')
```

**Rules:**

- Description: 50-160 characters optimal for search snippets
- Keywords: 3-8 relevant terms
- Image: Social card for sharing (1200x630px recommended)
- Alt text: Describe image content for accessibility and SEO
- Use semantic HTML (headings, lists, tables)

---

## Formatting Rules

**Headers:**

- H1: Page title
- H2: Major sections (Properties, Methods, Related APIs)
- H3: Individual items (method names)
- Never skip levels

**Code Blocks:**

- Always specify language: `typescript`, `json`, `bash`
- Never indent triple backticks
- Always add newline before opening backticks

**Installation Instructions:**

Use `bash npm2yarn` as the language identifier for package installation - the npm2yarn plugin auto-generates tabs:

```markdown
```bash npm2yarn
npm install @nauth-toolkit/core
​```
```

This renders as npm/yarn/pnpm tabs. NEVER use `bash` alone, `npm`, or `yarn add` directly.

**Links:**

- Relative for API docs: `../dto/name`
- Absolute for guides: `/docs/concepts/name`
- Link text: meaningful, not "here" or "click here"

**Tables:**

- "Yes"/"No" for Required column
- Keep "When" column brief (3-5 words max)

**Admonitions:**

```markdown
:::note
Brief message.
:::
```

**Tabs:**

```markdown
<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">
Content
</TabItem>
<TabItem value="express" label="Express">
Content
</TabItem>
<TabItem value="fastify" label="Fastify">
Content
</TabItem>
</Tabs>
```

- ALWAYS use `groupId="platform"` for framework tabs
- ALWAYS include ALL THREE platforms: NestJS, Express, Fastify
- Tab selection persists across pages
- Use for imports and code examples
- Never combine platforms (e.g., "Express/Fastify") - each gets its own tab

---

## What NOT to Include

**DTOs:**

- Response examples
- Usage code
- Multiple request variations
- Validation rule sections (put in table)
- Business logic

**Services:**

- Constructor details
- Private methods
- Implementation details
- Configuration blocks
- Full exception examples per method
- Verbose "Throws" explanations
- Multiple examples per method

**Both:**

- Excessive prose
- "See Also" section with guides (one link in error section is enough)
- Separate platform sections (use tabs with groupId="platform")

---

## Quality Checklist

- [ ] Front matter complete (title, description, keywords, image)
- [ ] Description 50-160 chars
- [ ] Keywords relevant (3-8 terms)
- [ ] All info in tables (no repetition)
- [ ] Methods alphabetical
- [ ] One example per item
- [ ] Tabs for platform code with `groupId="platform"`
- [ ] Images have alt text
- [ ] Links work
- [ ] No "TODO"
- [ ] Builds without errors

---

## Example References

**Gold Standard:**

- DTO: `docs/api/core/dto/login-dto.md` (56 lines)
- Service: `docs/api/core/services/auth-service.md` (517 lines, 13 methods)
- Overview: `docs/api/overview.md` - Framework tabs for contextual navigation

**Style Inspiration:** Stripe, Twilio, AWS API docs (minimal, scannable, practical)
