1. **Minimal** - No prose, no redundancy, scannable tables
2. **Consistent** - Same structure across all pages
3. **Practical** - Real examples, no theoretical code
4. **Linked** - Hyperlink related APIs, classes, DTO, only give one liner explainer if needed
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
- **ALPHABETICAL ORDER REQUIRED**: When creating new DTO files, `sidebar_position` MUST be set to maintain strict alphabetical order. Check existing files to determine correct position.

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

Throws [`NAuthException`](../exceptions/nauth-exception) with the codes listed above.

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
fastify.post(
  '/endpoint',
  { preHandler: nauth.helpers.public() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.serviceName.methodName(req.body);
  }),
);
```

</TabItem>
</Tabs>

---

### nextMethod()

[Repeat pattern...]

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
- **ALPHABETICAL ORDER REQUIRED**: Methods MUST be listed in strict alphabetical order. When adding new methods, place them in the correct alphabetical position.
- Properties in alphabetical order

**For Methods with Token Delivery Modes (login, signup, respondToChallenge, etc.):**

- Add a **"Response Variations by Token Delivery Mode"** table showing how response body changes based on `tokenDelivery.method`:
  - Document JSON mode (tokens in body)
  - Document Cookies mode (tokens removed from body, in httpOnly cookies)
  - Document Hybrid mode (policy-driven: web=cookies, mobile=json)
- Add a **"Possible Outcomes"** table listing all response scenarios (success, challenges, blocked)
- Include a note: "If client checks `result.accessToken`, behavior differs by `tokenDelivery.method`. In cookies mode, tokens are NOT in the response body."
- Show example responses for both JSON and Cookies modes

---

## Guide Documentation Pattern

Guides are sequential, code-focused implementation walkthroughs. They differ from API reference pages (which are minimal and scannable) — guides are **detailed, narrative, and DX-first**. A developer should be able to follow a guide start-to-finish and have a working feature.

**Source of truth for code:** All code samples MUST come from the actual example apps in `~/development/nauth-examples` (NestJS, Express, Fastify, React, Angular). Never write theoretical or invented code. If an example app doesn't have the code you need, check the actual source in `packages/` and adapt minimally.

**Gold standard:** `docs/guides/basic-auth.md`

### Page Structure

Every guide page follows this skeleton (sections are optional where noted):

````markdown
---
title: "Guide Title"
description: "Action-oriented summary, 50-160 chars for SEO"
sidebar_position: N
keywords: [relevant, search, terms]
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Guide Title

One-paragraph intro: what the guide covers and what the developer will have by the end.

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/auth/route` | POST | Public | Brief purpose |

:::tip Sample apps
Link to the relevant example apps so developers can clone and run if stuck.
:::

## Prerequisites

What the developer needs before starting (completed Quick Start, installed packages, config).
Show the **relevant config snippet** so readers know what settings this guide assumes.

## Conceptual Primer (if needed)

Brief explanation of the core pattern this guide relies on (e.g., challenge system, MFA flow).
Use a **Mermaid sequence diagram** to visualize the flow. Keep it to one diagram per guide.

## Route Section (H2 per route or logical group)

[Repeat for each route — see Route Section Pattern below]

## Error Handling

Global error handler setup with framework tabs. Show the error response JSON structure.
Link to the full error reference: [Error Handling](/docs/concepts/error-handling).

## Frontend Integration (if applicable)

Show how the frontend (React/Angular) consumes the API. Use simplified code from the
actual example apps. Group related operations (signup+challenge, login, resend with cooldown).

## Complete Controller (optional)

Wrap the full controller/routes file in a collapsible `<details>` block for quick reference.

## What's Next

Bullet list linking to the next guides in the sequence and related concept deep-dives.
````

### Route Section Pattern

Each route (or logical group of routes) gets an H2 section following this structure:

```markdown
## Route Name

1-2 sentence explanation of what this route does and when it's used.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/auth.controller.ts"
// Actual code from nauth-examples/nestjs
```

Framework-specific annotation (1 line) explaining the framework idiom used.

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/auth.routes.ts"
// Actual code from nauth-examples/express
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/routes/auth.routes.ts"
// Actual code from nauth-examples/fastify
```

</TabItem>
</Tabs>

**Request body** ([`DTOName`](/docs/api/core/dto/dto-name)):

```json
{ "field": "value" }
```

**Response** (or **Possible responses** table for multi-outcome endpoints):

```json
{ "field": "value" }
```

:::note/warning/tip
Caveats: security notes, rate limiting, config-dependent behavior, token delivery modes.
:::
```

### Rules

**Structure:**
- H1: Guide title (matches `title` in front matter)
- H2: Major sections (Prerequisites, each route, Error Handling, Frontend, What's Next)
- H3: Sub-routes or variations within a section (e.g., Step 1/Step 2 of forgot password, challenge types)
- Never skip heading levels

**Code:**
- ALL code samples from `~/development/nauth-examples` or `packages/` source — never invented
- NestJS tab is always `default` (most common framework)
- Always include `title="src/path/file.ts"` on code blocks to show file location
- Framework-specific annotations after each tab explaining the idiom (e.g., `@Public()`, `nauth.helpers.public()`, `wrapRouteHandler()`)
- For "inside class" snippets, show the relevant imports above and add a comment like `// Inside AuthController class:`
- Complete controller/routes file goes in a collapsible `<details>` block at the end — not inline

**Request/Response:**
- Always link the DTO name to its API reference page
- Show one complete JSON example per request (not multiple variations)
- For endpoints with multiple possible outcomes (login can return tokens OR challenges), use a **Possible responses** table:
  ```markdown
  | Scenario | Response |
  | --- | --- |
  | Success | `{ accessToken, refreshToken, expiresIn }` |
  | Email not verified | `{ challengeName: 'VERIFY_EMAIL', session, challengeParameters }` |
  ```

**Caveats and cross-references:**
- Use `:::tip` for sample app links and helpful DX hints
- Use `:::note` for behavioral explanations (why GET for logout, email masking, etc.)
- Use `:::warning` for security concerns and rate limiting
- Link to config sections using anchors: `[Configuration > Section](/docs/concepts/configuration#anchor)`
- Link to concept deep-dives for topics explained elsewhere (challenge system, rate limiting, error handling)
- Mention config-dependent behavior inline (e.g., "If `password.historyCount` is configured...")

**Diagrams:**
- Use Mermaid `sequenceDiagram` for request flows (one per guide, in the conceptual primer)
- Keep diagrams focused — show the happy path with one `alt` branch for the most common alternative

**Frontend:**
- Simplified code showing the pattern, not the full component
- Include the challenge loop pattern (check `challengeName` → navigate to challenge UI → respond → check again)
- Show practical UX patterns (resend cooldown timer, error display)

**Navigation:**
- "What's Next" section at the bottom with 3-6 bullet links
- First bullets: next guides in the sequence
- Remaining bullets: related concept deep-dives
- Guides are sequential — each guide can assume the reader completed previous guides

### Guide Quality Checklist

- [ ] Front matter complete (title, description, keywords)
- [ ] Endpoint overview table at the top
- [ ] Sample app tip with links to example repos
- [ ] Prerequisites with relevant config snippet
- [ ] ALL code samples verified against actual example apps
- [ ] Framework tabs (NestJS default, Express, Fastify) with `groupId="platform"` on every route
- [ ] Every DTO name linked to its API reference page
- [ ] Possible responses table for multi-outcome endpoints
- [ ] Admonitions for security, rate limiting, and config-dependent behavior
- [ ] Mermaid diagram for the main flow (if applicable)
- [ ] Frontend integration section (if applicable)
- [ ] Complete controller in `<details>` block
- [ ] "What's Next" linking to next guides and concept deep-dives
- [ ] No "Coming Soon" stubs — either write the content or don't include the section
- [ ] Builds without errors (`yarn build` from `nauth-docs/`)

---

## Error Documentation

**Errors Table Format:**

```markdown
| Code | When | Details |
| ---- | ---- | ------- |
| `ERROR_CODE` | Brief description | `{ field?: type }` |
````

- Use backticks for code values
- "When" column: brief (3-5 words) OR explicit condition if error is conditional (e.g., "Only if `lockout.enabled = true` AND IP exceeded max attempts")
- "Details" column: TypeScript object or `undefined`
- Prefer method-level error clarity: include a single sentence like `Throws [NAuthException](../exceptions/nauth-exception) with the codes listed above.`
- If `Details` includes known unions (e.g., config-driven string unions), list the exact union values (e.g., `'phone' | 'both'`) instead of `string`
- If `Details` includes arrays (e.g., `{ errors: string[] }`), include a short example payload showing representative values (1–4 items) pulled from real code paths/tests
- If a method delegates to helpers (e.g., state machine / challenge helper), include error codes that can be thrown by those helpers in the method's `Errors` table (developers experience these as method errors)
- For conditional errors (only thrown if config flag is enabled), explicitly state the condition in the "When" column (e.g., "Only if `mfa.adaptive.enabled = true` AND risk exceeds threshold")
- NO error code links in table (redundant)
- NO exception structure examples per method
- NO `INTERNAL_ERROR` codes - these are internal framework/database consistency errors that consumers cannot handle and should not be documented

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

`````markdown
````bash npm2yarn
npm install @nauth-toolkit/core
​```
````
`````

````

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


**Services:**

- Constructor details
- Private methods
- Implementation details
- Configuration blocks
- Full exception examples per method
- Verbose "Throws" explanations
- Multiple examples per method

---

## Alphabetical Sorting Requirements

**CRITICAL**: All documentation MUST maintain strict alphabetical order:

1. **DTO Files**: When creating new DTO documentation files, the `sidebar_position` in front matter MUST be set to maintain alphabetical order relative to existing files. Check existing DTO files to determine the correct position.

2. **Service Methods**: All methods in service documentation MUST be listed in strict alphabetical order. When adding new methods, place them in the correct alphabetical position within the Methods section.

3. **DTO Properties**: Properties within DTO documentation tables MUST be listed in alphabetical order.

4. **Verification**: Before committing, verify alphabetical order by:
   - Checking file names are alphabetically sorted
   - Checking `sidebar_position` values reflect alphabetical order
   - Checking method order in service documentation

**Example**: If adding `getUserSessionsDTO`:
- Check existing files: `get-user-devices-dto.md` (position 520), `get-users-dto.md` (position 200)
- Alphabetically: `get-user-devices` < `get-user-sessions` < `get-users`
- Set `sidebar_position: 521` (between 520 and next position)

---

## Quality Checklist

- [ ] Front matter complete (title, description, keywords, image)
- [ ] Description 50-160 chars (SEO). Body intro 1-2 sentences (tight, non-redundant).
- [ ] Keywords relevant (3-8 terms)
- [ ] All info in tables (no repetition)
- [ ] **Methods in strict alphabetical order**
- [ ] **DTO files have correct `sidebar_position` for alphabetical order**
- [ ] **DTO properties in alphabetical order**
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
- Guide: `docs/guides/basic-auth.md` - Sequential, code-focused implementation walkthrough

**Style Inspiration:** Stripe, Twilio, AWS API docs (minimal, scannable, practical)
````
