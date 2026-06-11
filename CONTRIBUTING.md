# Contributing to nauth-toolkit

Thanks for your interest in contributing. This document covers the development workflow for the monorepo.

## Prerequisites

- Node.js >= 22 (see `.nvmrc`)
- pnpm (npm and yarn are blocked by a preinstall hook)
- PostgreSQL and Redis if you want to run the sample apps or E2E tests

## Setup

```bash
git clone https://github.com/noorixorg/nauth-toolkit.git
cd nauth
pnpm install
pnpm build:all
```

## Repository Layout

| Path | Contents |
|------|----------|
| `packages/core` | Platform-agnostic auth engine (services, handlers, DTOs, entities) |
| `packages/nestjs` | NestJS adapter (guards, decorators, interceptors) |
| `packages/client`, `packages/client-angular` | Frontend SDKs |
| `packages/{database,email,sms,social,mfa,storage}/*` | Pluggable provider packages |
| `examples/` | Runnable sample apps (NestJS, Express, Fastify, Angular, React) |
| `tests/e2e/` | Playwright E2E suites |
| `nauth-docs/` | Docusaurus documentation site (nauth.dev) |
| `docs/ARCHITECTURE.md` | Internal architecture reference |

## Common Commands

```bash
pnpm build                # build core only
pnpm build:all            # build entire monorepo in dependency order
pnpm test                 # core tests
pnpm test:all             # all package tests
pnpm test:e2e             # Playwright E2E (requires a running sample app)
pnpm lint                 # lint all workspaces
pnpm fix                  # lint:fix + format
pnpm --filter @nauth-toolkit/core run test -- --testPathPattern="auth.service"
```

Do not start dev servers as part of automated checks; run them manually when needed.

## Code Standards

- **TypeScript strict mode** — no `any` types (use `unknown` where necessary)
- **Explicit return types** on all functions
- **JSDoc** on every class, public method, interface, and enum
- **No `console.log()`** — use the project logger module (`console.warn`/`console.error` allowed)
- **No emojis** in code, comments, or documentation
- Unit tests are required for new services and methods (`*.spec.ts`, colocated)
- Core coverage thresholds: statements 75%, branches 57%, functions 70%, lines 75%

## Commits

Conventional commits are enforced via Husky + commitlint:

```
feat(core): add session revocation hook
fix(nestjs): respect @Public() in CsrfGuard
docs: update MFA configuration guide
```

Max header length 200 characters; max body line length 300.

## Documentation

Any change to a public API (method signature, DTO field, config option, error code, enum value) must be reflected in the docs site (`nauth-docs/`). Read `nauth-docs/DOCUMENTATION_RULES.md` before writing or editing doc pages, and grep `nauth-docs/docs/` for the changed symbol to find every reference.

## Pull Requests

1. Fork and create a feature branch
2. Make your changes with tests and JSDoc
3. Run `pnpm build:all`, `pnpm test:all`, and `pnpm lint` locally
4. Open a PR with a clear description of the change and its motivation

## Reporting Issues

- Bugs: https://github.com/noorixorg/nauth-toolkit/issues
- Questions and ideas: https://github.com/noorixorg/nauth-toolkit/discussions
- Security vulnerabilities: see [SECURITY.md](./SECURITY.md) — do not open public issues
