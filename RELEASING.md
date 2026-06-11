# Releasing nauth-toolkit

## 1. Check current version

```bash
node -e "console.log(require('./packages/core/package.json').version)"
```

## 2. Write changelogs

**Both changelogs are for consumers of `@nauth-toolkit` packages, not for the people writing the code.** The audience is the developer integrating nauth into their app — they want to know what behavior changed, what config to flip, what method signature shifted. They do not want a tour of the implementation.

### Audience rules (apply to BOTH `CHANGELOG.md` and the Docusaurus entry)

**Never mention:**
- JavaScript/TypeScript operators or language constructs (`||`, `??`, `?.`, ternaries, generics, etc.) — describe the resulting behavior, not the syntax
- Internal classes, private helpers, file paths, or service-layer refactors that consumers can't import
- "Renamed X to Y internally," "extracted helper Z," "moved logic from A to B" — invisible to consumers
- Test coverage additions on their own (mention the feature being tested instead)
- Storage keys, internal cache TTLs, or wire-format details unless they actually break a consumer-observable contract

**Always frame around:**
- Public API: config fields, exported methods, DTOs, decorators, error codes, hook signatures
- Observable behavior: what changes in responses, stored data, redirects, cookies, error messages
- Migration impact: "if your code does X, change it to Y"

**Bad → Good examples:**

| Bad (implementation-leaking) | Good (consumer-facing) |
|---|---|
| "Switched name coercion from `\|\|` to `??`" | "Empty-string names from the provider are now preserved instead of treated as missing" |
| "Refactored `TokenDeliveryHandler` to extract `resolveDeliveryForRequest`" | "Hybrid mode now picks delivery per request based on the route override or origin" |
| "Added `?.` chain in `MfaService.findDevice`" | "Looking up an MFA device for a deleted user no longer throws" |
| "Extracted internal helper `buildAuthCookies`" | (drop the bullet — consumers don't see this) |

If you can't describe the change without naming an operator or an internal class, you probably shouldn't be putting it in the changelog at all.

### 2a. `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com/) format)

The technical record on GitHub. Same audience rules as above — consumer-facing, just denser and complete. Fine to include:

- New / changed / removed public API (config fields, methods, DTOs, error codes)
- Behavioral fixes with enough detail that an integrator can tell if they're affected
- Breaking changes with migration notes

Use `### Added`, `### Changed`, `### Removed`, `### Fixed`, `### Breaking Changes` as applicable.

```markdown
## [0.2.5] - 2026-04-17

### Added
- **Feature name** — what it does, how to use it, the config keys involved

### Fixed
- **Bug or behavior change** — why it matters, who's affected
```

### 2b. `nauth-docs/changelog/<YYYY-MM-DD>-v<version>.md` (public docs site)

Renders on nauth.dev as a **product release note**. Same consumer-only audience rules; the difference is **tone and scope**, not audience.

**Include:**
- What new capability consumers gained, framed in their language
- The config snippet or API call they'd copy-paste to use it
- Why they might want it (typical use case, one sentence)
- A short before/after table for behavior changes when it helps the reader self-diagnose impact

**Exclude (in addition to the universal audience rules above):**
- Method-level additions that aren't part of the normal integration surface (e.g. a new optional param on an internal helper)
- Fixes for bugs that weren't publicly visible (internal TTL alignment, logging tweaks, test-only changes)
- Anything a consumer couldn't use, wouldn't see, or wouldn't care about

If there's genuinely nothing consumer-visible in a release (pure internal refactor), skip the Docusaurus entry and note that in `CHANGELOG.md` only.

```markdown
---
title: v0.2.5
description: One-line pitch of what's new for consumers.
slug: v0.2.5
authors:
  - name: nauth-toolkit team
tags: [release]
---

## Added

- **Feature name** --- consumer-framed description with the use case baked in

<!-- truncate -->

```ts
// Copy-paste-ready config or API example
```
```

**Rule of thumb:** if a bullet names a JavaScript operator, an internal class, a private helper, or a storage detail, it belongs in neither changelog — rewrite it in terms of the consumer-visible behavior, or drop it.

## 3. Dry-run

```bash
node scripts/publish.js latest --dry-run
```

## 4. Publish (bumps versions, builds, publishes all ~20 packages)

```bash
node scripts/publish.js latest
```

## 5. Commit, tag, push

```bash
git add -A
git commit -m "chore: v<version>"
git tag v<version>
git push origin <branch> --tags
```

## 6. GitHub release

```bash
gh release create v<version> --title "v<version>" --notes "See CHANGELOG.md for details."
```

---

## Recovery (partial publish failed)

Re-run without bumping — skips already-published packages:

```bash
node scripts/publish.js latest --skip-version-bump
```
