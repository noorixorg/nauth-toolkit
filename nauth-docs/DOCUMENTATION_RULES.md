# Documentation Rules

Unified rules for all nauth-toolkit documentation pages. Every contributor (human or AI) must follow these rules when creating or editing docs.

---

## Core Principles

These principles override any other preference. When in doubt, apply them.

1. **Accuracy-first** — Every code sample, method signature, config option, and error code must be verified against the source before it's written. If you can't verify it, delete it — never leave accuracy disclaimers.
2. **Copy-paste ready** — Examples must compile and run against the current codebase. No pseudocode, no partial snippets missing required imports.
3. **Developer journey** — Structure pages around what a developer needs to DO, not what the code IS. Task-oriented over reference-oriented.
4. **Code-first** — Minimal prose, maximum working code. No filler text. No "Coming Soon" stubs — delete placeholder pages rather than publishing them.
5. **Minimal** — No redundancy, scannable tables. Don't repeat information that exists on another page.
6. **Linked** — Hyperlink related APIs, classes, and DTOs. One-liner description if needed, not full explanations.

---

## Page Types

### Quickstart

End-to-end setup guide. NestJS + Angular focus.

**Structure:**

```
# Quick Start

Prerequisites (versions, tools)
Step 1 — Install
Step 2 — Configure
Step 3 — Add routes
Step 4 — Frontend
Checkpoint — verify it works
What's Next
```

**Rules:**

- Every code block has a file path label (e.g., `` ```typescript title="src/auth.module.ts" `` )
- Code must be copy-paste-ready and compile against the current codebase
- Include checkpoint verification steps ("You should now see…", "Run `curl …` to verify")
- NestJS backend + Angular frontend only — no Express/Fastify setup code
- "What's Next" section at the bottom linking to Configuration, Routes, and Architecture

---

### Concept

Explains "how X works" — architecture, data flow, design decisions.

**Structure:**

```
# Concept Name

1-2 sentence overview
Mermaid diagram (encouraged)
How It Works (subsections)
Configuration Options (table, link to config guide)
What's Next (link to the corresponding Guide for implementation)
```

**Rules:**

- Minimal code — illustrative snippets only, not copy-paste implementations
- Mermaid diagrams encouraged for flows and state machines
- Always link to the corresponding Guide or Feature page for "how to do it"
- No framework tabs — concepts are framework-agnostic

---

### Guide / Feature

Task-oriented "how to do X". Complete implementation instructions. Guides are sequential, code-focused walkthroughs — a developer should follow start-to-finish and have a working feature.

**Source of truth for code:** All code samples MUST come from the actual example apps in `examples/` (e.g. `examples/demo-nestjs`, `examples/demo-angular`). Never write theoretical or invented code. If an example app doesn't have the code you need, check the actual source in `packages/` and adapt minimally.

**Gold standard:** `docs/guides/basic-auth.md`

**Structure:**

````markdown
---
title: "Guide Title"
description: "What this guide covers and what APIs/config it uses (see Description Rules)"
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

#### Route Section Pattern

Each route (or logical group of routes) gets an H2 section following this structure:

```markdown
## Route Name

1-2 sentence explanation of what this route does and when it's used.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/auth.controller.ts"
// Actual code from examples/demo-nestjs
```

Framework-specific annotation (1 line) explaining the framework idiom used.

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/auth.routes.ts"
// Actual Express code verified against packages/core adapters
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/routes/auth.routes.ts"
// Actual Fastify code verified against packages/core adapters
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

#### Guide Rules

**Structure:**
- H1: Guide title (matches `title` in front matter)
- H2: Major sections (Prerequisites, each route, Error Handling, Frontend, What's Next)
- H3: Sub-routes or variations within a section (e.g., Step 1/Step 2 of forgot password, challenge types)
- Never skip heading levels

**Code:**
- ALL code samples from `examples/` or `packages/` source — never invented
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

---

### API Reference

Strict template for service, DTO, and overview documentation. API pages are minimal and scannable — no narrative prose.

#### DTO Pages

````markdown
---
title: DTOName
description: "What this DTO represents and key fields (see Description Rules)"
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

**DTO Rules:**

- ALWAYS use `groupId="platform"` for tabs (syncs across pages)
- NO separate validation sections (put in table)
- NO response examples (belong in service docs)
- NO usage code examples (belong in service docs)
- NO multiple request variations (one complete example)
- Properties table includes ALL info: type, required, validation, description
- Properties in alphabetical order

#### Service Pages

````markdown
---
title: ServiceName
description: "What methods this service provides (see Description Rules)"
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
// NestJS example
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
// Express example
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
// Fastify example
```

</TabItem>
</Tabs>

---

## Related APIs

- [RelatedService](./related-service) - Brief
- [NAuthException](../exceptions/nauth-exception) - Error handling
````

**Service Rules:**

- ALWAYS use `groupId="platform"` for tabs (syncs across pages)
- NO "Signature:" header (just show code block)
- NO redundant linking (e.g., `[dto](link) - [DTO](link)`)
- NO "Promise<>" wrapper in Returns section
- NO full exception structure examples per method
- NO multiple examples per method
- NO verbose error explanations (table only)
- NO separate DTOs/Exceptions sections in Related APIs
- **Methods in strict alphabetical order**
- Properties in alphabetical order

**For Methods with Token Delivery Modes (login, signup, respondToChallenge, etc.):**

- Add a **"Response Variations by Token Delivery Mode"** table showing how response body changes based on `tokenDelivery.method`:
  - Document JSON mode (tokens in body)
  - Document Cookies mode (tokens removed from body, in httpOnly cookies)
  - Document Hybrid mode (policy-driven: web=cookies, mobile=json)
- Add a **"Possible Outcomes"** table listing all response scenarios (success, challenges, blocked)
- Include a note: "If client checks `result.accessToken`, behavior differs by `tokenDelivery.method`. In cookies mode, tokens are NOT in the response body."
- Show example responses for both JSON and Cookies modes

#### Error Documentation

**Errors Table Format:**

```markdown
| Code | When | Details |
| ---- | ---- | ------- |
| `ERROR_CODE` | Brief description | `{ field?: type }` |
```

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
- NO `INTERNAL_ERROR` codes — these are internal framework/database consistency errors that consumers cannot handle and should not be documented

---

## Cross-Cutting Rules (All Page Types)

### Visual Style

**Icons — FontAwesome only, never emojis.**

All icons use the duotone light variant:
```
fa-duotone fa-light fa-[icon-name]
```

Pass the class string to the `icon` prop of `<FeatureCard>`. Never use emoji characters anywhere in docs — not in headings, prose, tables, or admonitions.

**Components — use what's built, don't improvise.**

| Component | When to use |
|-----------|-------------|
| `<FeatureCard icon="..." heading="..." description="..." />` | Feature grids on overview/intro pages |
| `<Tooltip content="...">term</Tooltip>` | Inline glossary definitions |
| `<Tabs groupId="platform">` | Any framework-specific code (NestJS / Express / Fastify) |
| `:::warning` / `:::note` / `:::tip` | Callouts — see Admonitions section |
| Mermaid code blocks | Architecture diagrams, state machines, request flows |
| `<details><summary>` | Collapsible reference content (large config tables, optional context) |

Always prefer these over custom HTML or inline styles.

**Color — use CSS variables, never hardcoded values.**

The site uses a single blue-based palette (`--ifm-color-primary` and its variants). Don't introduce custom colors via inline `style` attributes or one-off class names.

### Front Matter

Required on every page:

```yaml
---
title: Page Title
description: LLM + SEO description (see Description Rules below)
keywords: [relevant, search, terms]
image: /img/api-social-card.png
---
```

### Description Rules

The `description` field in front matter serves **two purposes**:

1. **SEO** — Shown in search engine results (50-160 chars optimal)
2. **LLM navigation** — Displayed in `llms.txt` as the page summary. LLMs use this to decide whether to fetch the full page.

**Write descriptions for LLM navigation first, SEO second.** A description that helps an LLM navigate is also good for SEO. The reverse is not true — vague SEO copy ("Complete guide to configuration") is useless for LLM navigation.

**Good descriptions list specific content:**

| Page type | Pattern | Example |
|-----------|---------|---------|
| Service | List methods/capabilities | `"AuthService: signup, login, password management, MFA verification, session handling, token generation"` |
| DTO | State what it represents + key fields | `"Admin password reset request DTO with email/SMS delivery options and optional link generation"` |
| Overview/index | List what's inside | `"Service index: AuthService, MFAService, SocialAuthService, AdminAuthService, AuthAuditService, EmailVerificationService"` |
| Concept | State what concepts are explained | `"NAuthConfig reference: JWT settings, token delivery, session management, password policies, rate limiting, MFA enforcement"` |
| Guide | State what the guide teaches | `"Implement signup, login, email verification, token refresh, logout, and password reset with nauth-toolkit"` |
| Adapter | List what the adapter provides | `"Express adapter: NAuth.create() bootstrap, middleware pipeline (clientInfo, csrf, auth, tokenDelivery), and route helpers"` |

**Bad descriptions (never write these):**

- "Complete configuration guide for nauth-toolkit" — what configuration?
- "Platform-agnostic services for authentication, MFA, social auth, and more" — which services?
- "Base entity classes for database models" — which entities?
- "Express adapter with middleware and route helpers" — which middleware? which helpers?

**Rule of thumb:** If an LLM reading only the description can't tell whether this page has the information it needs, the description is too vague. Name the specific APIs, config options, or methods covered.

### LLM Documentation (llms.txt)

The docs site auto-generates LLM-friendly documentation via `docusaurus-plugin-llms` at build time:

| File | Content | Size |
|------|---------|------|
| `/llms.txt` | Page index with descriptions + links to section files | ~60K |
| `/llms-full.txt` | All docs concatenated (full content) | ~1.6M |
| `/llms-guides.txt` | Concepts, guides, quick starts | ~380K |
| `/llms-api-core.txt` | Core services, DTOs, enums, interfaces, hooks | ~550K |
| `/llms-api-adapters.txt` | NestJS, Express, Fastify adapters | ~116K |
| `/llms-api-providers.txt` | MFA, social, email, SMS, database, storage | ~76K |
| `/llms-frontend-sdk.txt` | Client SDK, Angular, React, mobile | ~430K |

**What this means for doc authors:**

- The `description` field is the ONLY thing LLMs see in `llms.txt` before deciding to load a page. Write it accordingly.
- Section files (`llms-guides.txt`, etc.) contain full page content. Raw MDX markup (`<Tabs>`, `<FeatureCard>`, `:::warning`) appears as-is since the plugin processes source markdown. Keep this in mind — critical information should also exist as plain text, not only inside JSX components.
- Page ordering in `llms.txt` follows the `includeOrder` config in `docusaurus.config.ts`, not alphabetical. The order is: intro → quick starts → concepts → guides → API core → API adapters → API providers → frontend SDK.

**Configuration:** See `docusaurus.config.ts` → `plugins` → `docusaurus-plugin-llms` for the full config including `includeOrder`, `customLLMFiles`, and `rootContent`.

### Code Blocks

- Every code block has a language identifier (`typescript`, `json`, `bash`, `yaml`)
- Add file path label where applicable: `` ```typescript title="src/path/to/file.ts" ``
- Never indent triple backticks
- Always add a newline before opening backticks

### Package Installation

Use `bash npm2yarn` for install commands (auto-generates npm/yarn/pnpm tabs):

````markdown
```bash npm2yarn
npm install @nauth-toolkit/core
```
````

Never use `bash` alone, `npm`, or `yarn add` directly for install instructions.

### Links

- Relative for API docs: `../dto/name`
- Absolute for guides: `/docs/concepts/name`
- Link text: meaningful, not "here" or "click here"

### Tables

- "Yes"/"No" for Required column
- Keep "When" column brief (3-5 words max)

### Accuracy

- Never include unverified code — no accuracy warnings, fix it or remove it
- Every service, method, DTO, config option, and error code must be verified against source
- If you can't verify it, don't document it

### Framework Tabs

- Use `groupId="platform"` on all `<Tabs>` (syncs selection across pages)
- Tab order: NestJS, Express, Fastify
- NestJS is the primary platform — always include it
- Express/Fastify are experimental — show in tabs but don't add disclaimers on every page (noted once on intro page)

### Client SDK

- The client SDK (`@nauth-toolkit/client`) is framework-agnostic — works with React, Vue, Svelte, etc.
- Examples use Angular because that's the tested integration
- Note framework-agnostic nature where relevant, but don't provide untested examples for other frameworks

### Terminology

Use these terms exactly — never substitute alternatives:

| Correct | Never use |
|---------|-----------|
| `Node.js` | `NodeJS`, `nodejs`, `Node.JS` |
| `framework-agnostic` | `platform-agnostic` (Node.js is the platform; Express/Fastify/NestJS are the frameworks) |
| `nauth-toolkit` | `nauth`, `NAuth`, `nAuth-toolkit` |

### Lean Docs

- Delete stub pages rather than publishing "Coming Soon" content
- Remove a page before adding an accuracy disclaimer to it
- Pages should be as short as possible while remaining complete — cut prose that doesn't help a developer take action

### Navigation

- "What's Next" section at the bottom of every page with 2-4 links to logical next steps
- Use meaningful link text, never "here" or "click here"
- Relative links for API docs (`../dto/name`), absolute for guides (`/docs/concepts/name`)

### Headings

- H1: Page title (one per page)
- H2: Major sections
- H3: Individual items (methods, properties)
- Never skip levels (no H1 → H3)

### Admonitions

```markdown
:::warning
Content for dangerous/breaking scenarios.
:::

:::note
Contextual information.
:::

:::tip
Best practices and recommendations.
:::
```

- `:::warning` for experimental status, breaking changes, security concerns
- `:::note` for contextual information, prerequisites
- `:::tip` for best practices, performance recommendations

### Alphabetical Ordering

**CRITICAL**: All API documentation MUST maintain strict alphabetical order:

1. **DTO Files**: `sidebar_position` in front matter maintains alphabetical order relative to existing files.
2. **Service Methods**: Listed in strict alphabetical order within the Methods section.
3. **DTO Properties**: Alphabetical in tables.

**Example**: If adding `getUserSessionsDTO`:
- Check existing files: `get-user-devices-dto.md` (position 520), `get-users-dto.md` (position 200)
- Alphabetically: `get-user-devices` < `get-user-sessions` < `get-users`
- Set `sidebar_position: 521` (between 520 and next position)

---

## Accuracy Validation Checklist

Run this checklist for every page during audit:

1. **Source verification** — Open the source file for every service/method/DTO referenced
2. **Signatures** — Verify function signatures (parameters, return types) match source
3. **Error codes** — Verify error codes exist in actual enums / throw sites
4. **Config options** — Verify config options exist in `config.interface.ts` / `auth-config.schema.ts`
5. **Code samples** — Trace each code sample against real imports and method calls
6. **File path labels** — Add file path label to every code block
7. **What's Next** — Add "What's Next" section if missing
8. **Heading hierarchy** — Verify H1 → H2 → H3, no skips

---

## Quality Checklist

Before committing any documentation change:

- [ ] Front matter complete (title, description, keywords, image)
- [ ] Description is LLM-navigable — lists specific APIs, methods, or content covered (not vague marketing copy)
- [ ] Description 50-160 chars for SEO
- [ ] All code blocks have language identifiers
- [ ] File path labels on implementation code blocks
- [ ] Methods in alphabetical order (API Reference)
- [ ] DTO properties in alphabetical order (API Reference)
- [ ] `sidebar_position` maintains alphabetical file order (API Reference)
- [ ] Framework tabs use `groupId="platform"`
- [ ] One example per method/concept
- [ ] "What's Next" section present
- [ ] No TODO markers
- [ ] No accuracy disclaimers — code is verified or removed
- [ ] Builds without errors (`pnpm build`)

---

## Example References

**Gold Standard:**

- DTO: `docs/api/core/dto/login-dto.md`
- Service: `docs/api/core/services/auth-service.md`
- Overview: `docs/api/overview.md` — Framework tabs for contextual navigation
- Guide: `docs/guides/basic-auth.md` — Sequential, code-focused implementation walkthrough

**Style Inspiration:** Stripe, Twilio, AWS API docs (minimal, scannable, practical)
