# Documentation Rules

Unified rules for all nauth-toolkit documentation pages. Every contributor (human or AI) must follow these rules when creating or editing docs.

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

Task-oriented "how to do X". Complete implementation instructions.

**Structure:**

```
# Feature/Guide Name

Brief intro (1-2 sentences)
Prerequisites (if any)
Implementation steps with code
Configuration reference (table)
What's Next
```

**Rules:**

- Complete, compilable code with file path labels
- Framework tabs with `groupId="platform"` — NestJS first, then Express, then Fastify
- One example per concept — don't show multiple variations
- Use admonitions for warnings and tips (see Cross-Cutting Rules)

---

### API Reference

Strict template for service and DTO documentation. Carries over all rules from the former `API_DOCUMENTATION_RULES.md`.

**DTO pages:**

- Import tabs with `groupId="platform"`
- Properties table: Property | Type | Required | Description (with validation inline)
- Single JSON example
- "Used By" links to service methods
- Properties in alphabetical order
- `sidebar_position` must maintain alphabetical file order

**Service pages:**

- Import tabs with `groupId="platform"`
- Methods in strict alphabetical order
- Each method: signature, Parameters, Returns, Errors table, Example (tabbed)
- Errors table format: Code | When | Details
- No `INTERNAL_ERROR` codes — these are framework internals, not consumer-facing
- For token-delivery methods: include "Response Variations by Token Delivery Mode" and "Possible Outcomes" tables

**Error table rules:**

- "When" column: 3-5 words or explicit condition
- "Details" column: TypeScript type or `undefined`
- Include errors from delegated helpers (state machine, challenge) in the method's table
- Conditional errors must state the condition (e.g., "Only if `lockout.enabled = true`")

---

## Cross-Cutting Rules (All Page Types)

### Front Matter

Required on every page:

```yaml
---
title: Page Title
description: 50-160 characters for SEO
keywords: [relevant, search, terms]
image: /img/api-social-card.png
---
```

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

- DTO files: `sidebar_position` maintains alphabetical order
- Service methods: listed in strict alphabetical order
- DTO properties: alphabetical in tables

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
- [ ] Builds without errors (`yarn build`)
