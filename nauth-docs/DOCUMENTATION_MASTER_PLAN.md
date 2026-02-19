# Documentation Master Plan

Persistent execution tracker for the nauth-toolkit documentation overhaul. Any context window can pick up where the last left off by reading this file.

Rules: See `DOCUMENTATION_RULES.md` in this directory.

---

## Phase 1 — Foundation

- [x] Create `DOCUMENTATION_RULES.md` (unified rules for all page types)
- [x] Delete `API_DOCUMENTATION_RULES.md` (superseded)
- [x] Restructure `sidebars.ts` (themed categories instead of flat list)
- [x] Add experimental note to `docs/intro.mdx` (Express/Fastify status)
- [x] Remove accuracy warning from `docs/features/routes.md`

## Phase 2 — Accuracy Audit: Core Pages

Audit each page using the Accuracy Validation Checklist from `DOCUMENTATION_RULES.md`. Priority order:

| # | Page | Status | Notes |
|---|------|--------|-------|
| 1 | `quick-start/` | **Done** | Restructured into category (NestJS+Angular, Express placeholder, Fastify placeholder). PostgreSQL default with MySQL inline comments. |
| 2 | `features/routes.md` | **Done** | Fixed LogoutDTO.sub bug, FastifyRequest import, MFA status fields, changePassword/resendCode return types, RequestHandler import |
| 3 | `concepts/challenge-system.md` | **Done** | Fixed RespondToChallengeDTO→RespondChallengeDTO, challengeType→type, fake package imports, added What's Next |
| 4 | `concepts/configuration.md` | **Done** | Fixed @nauth-toolkit/express and @nauth-toolkit/fastify imports→@nauth-toolkit/core, fixed createNAuth→NAuth.create, added keywords, fixed admonition syntax |
| 5 | `features/mfa.md` | **Done** | Fixed challengeType→type, updated footer to What's Next |
| 6 | `features/social-login.md` | **Done** | Updated footer to What's Next |
| 7 | `features/email-templates.md` | **Done** | Updated footer to What's Next |
| 8 | `features/token-delivery.md` + `concepts/token-management.md` | **Done** | Fixed CSRF config (removed fake `enabled` flag), fixed device cookie name (nauth_device_id→nauth_device_token), clarified JWT algorithm warning, fixed incomplete sentence, updated footers to What's Next |
| 9 | `concepts/storage.md` | **Done** | Fixed all createNAuth→NAuth.create, fixed fake package imports, added front matter and What's Next |
| 10 | `concepts/error-handling.md` | **Done** | Added front matter and What's Next |
| 11 | `concepts/rate-limiting.md` | **Done** | Updated footer to What's Next |
| 12 | `features/lifecycle-hooks.md` | **Done** | Fixed NAuth.create() signature in Express/Fastify examples (was missing object wrapper and adapter), updated footer to What's Next |
| 13 | `features/admin-operations.md` | **Done** | Added missing front matter and What's Next section |
| 14 | `features/geolocation.md` | **Done** | Updated footer from "Next Steps" to "What's Next" |
| 15 | `features/deployment.md` | **Skipped** | Placeholder page with "Coming Soon" only |
| 16 | `guides/openapi-dto-schemas.md` | **Done** | Added What's Next section |
| 17 | `guides/recaptcha.md` | **Done** | Updated footer from "Related" to "What's Next" |

## Phase 3 — API Reference Audit

- [ ] Audit each service doc against actual source files in `packages/core/src/services/`
- [ ] Audit DTO docs against actual class definitions in `packages/core/src/dto/`
- [ ] Verify error tables against actual throw sites in source

## Phase 4 — Polish

- [ ] Add `llms.txt` to `/static/`
- [ ] Production security checklist page
- [ ] Final consistency pass across all pages
