# NAUTH Toolkit — Feature & Licensing Overview

A clean breakdown of which features belong to the **Community (Open Source)** edition vs **Pro (Commercial)** edition.

---

## Overview

**NAUTH Toolkit** is a platform‑agnostic authentication toolkit for Node.js applications.
The goal: offer a self‑hosted, extensible alternative to hosted auth services (Auth0, Cognito, etc.) while keeping developers in full control.

---

## Core Philosophy

- **Community Edition (MIT/Apache)** → Complete authentication for small/medium projects.
- **Pro Edition (Commercial)** → Advanced security, scaling, and compliance features for production‑scale or enterprise users.

---

## Feature Breakdown

| Category | **Community Edition (Free / OSS)** | **Pro Edition (Commercial)** |
|-----------|------------------------------------|-------------------------------|
| **Core Authentication** | Email/password login, JWT (HS/RS), session tracking, password policies, account lockout | — |
| **Verification** | Email + SMS verification, resend cooldowns, challenge flow | — |
| **Social Login** | Google, Apple, Facebook | — |
| **Multi‑Factor Authentication** | TOTP (Time‑based codes), SMS MFA | Adaptive MFA (risk‑based), WebAuthn/Passkeys, backup codes management |
| **Session Management** | Device/IP tracking, Max concurrent sessions, Remember device | Session notifications, advanced concurrency policies, geo‑alerts, analytics dashboard |
| **Security** | Argon2id hashing, CSRF protection, token reuse detection, basic per‑IP/user rate‑limiting | Adaptive/sliding‑window rate‑limiting, CSP/HSTS headers enforcement, advanced security config |
| **Storage Adapters** | Memory, Database, Redis (cluster basic) | High‑availability Redis adapter, distributed caching with monitoring |
| **Audit Logging** | Local DB audit log | Export to SIEM/JSON, structured event streaming |
| **Developer UX** | Hooks, config validation, type‑safe setup | CLI for user/session management, Web dashboard, analytics |
| **Compliance** | — | GDPR utilities, event retention policy, key rotation automation |

---

## Licensing Model

| Component | License | Notes |
|------------|----------|-------|
| `@nauth-toolkit/core` | **MIT** (or Apache‑2.0) | Open‑source foundation |
| `@nauth-toolkit/nestjs` | **MIT** | Framework adapter |
| `@nauth-toolkit/pro` | **Commercial License** | Requires valid Pro license key |
| `@nauth-toolkit/cli` | MIT | Shared developer tool |

---

## Example Pro License Header

```
Copyright (c) 2025 Noorix
Use of this software requires a valid NAUTH Pro license key.
You may not redistribute or sublicense without written permission.
```

In `package.json` for Pro packages:

```json
"license": "SEE LICENSE IN ../../LICENSE.pro"
```

---

## Release Timeline

| Phase | Status | Description |
|--------|---------|-------------|
| **0.x (Private Alpha)** | Locked | Security review, internal tests |
| **0.5 (Public Preview)** | Preview | GitHub open, marked experimental |
| **1.0 (Community Stable)** | Stable | Full OSS core released |
| **1.1+ (Pro Launch)** | Pro | Commercial extensions (adaptive MFA, analytics, etc.) |
| **2.x+ (Optional SaaS)** | Future | Hosted management console (future) |

---

## Positioning vs Auth.js

| Feature | Auth.js | NAUTH Community | NAUTH Pro |
|----------|----------|----------------|------------|
| Self‑hosted | No | Yes | Yes |
| Social login | Limited | Full | Full |
| Password auth | Plugin only | Built‑in | Built‑in |
| MFA | No | Basic (TOTP, SMS) | Adaptive, WebAuthn |
| Session control | Cookies only | DB sessions | Analytics, policies |
| Audit logs | No | Basic | Export/stream |
| CLI / Dashboard | No | No | Yes |
| Rate limiting | No | Basic | Adaptive |
| Licensing | OSS only | MIT/Apache | Commercial |

---

**Summary:**
- Keep **developer essentials** free to ensure adoption.
- Monetize **scale, compliance, and analytics** under Pro.
- Clearly mark Pro‑only modules in docs with "Available in NAUTH Pro".
- Transition to Pro tier once Community hits stable v1.0.
