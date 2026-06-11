---
title: Frontend SDK
description: Optional client SDK for simplified frontend integration with nauth-toolkit
keywords: [frontend, sdk, client, javascript, typescript, spa, authentication]
image: /img/api-social-card.png
---

# Frontend SDK

**Package:** `@nauth-toolkit/client`
**Type:** Optional Client Library

Optional convenience layer for integrating nauth-toolkit into JavaScript/TypeScript applications. Provides token management, challenge flows, and typed API calls without prescribing UI.

:::info
The SDK is optional. Advanced users can integrate directly with backend APIs for custom workflows.
:::

## Installation

```bash npm2yarn
npm install @nauth-toolkit/client
```

For Angular apps, also install the Angular adapter:

```bash npm2yarn
npm install @nauth-toolkit/client-angular
```

## Choose Your Framework

| Framework | Guide | What You Get |
| --------- | ----- | ------------ |
| **Angular (Standalone)** | [Standalone Setup](./angular/standalone-setup) | Functional interceptor, guards, DI providers |
| **Angular (NgModule)** | [NgModule Setup](./angular/ngmodule-setup) | `NAuthModule.forRoot()`, class-based guards |
| **React** | [Setup & Context](./react/setup) | AuthContext, useAuth hook, ProtectedRoute |
| **Mobile (Capacitor)** | [Capacitor Setup](./mobile/capacitor-setup) | Native storage, dual-mode config |
| **Other frameworks** | [Getting Started](./guides/getting-started) | Generic SDK setup for any JS/TS app |

## Features

| Feature                | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| **Standalone**         | No runtime dependency on `@nauth-toolkit/core`; all types bundled |
| **Token Delivery**     | JSON or cookies mode with automatic handling                      |
| **Challenge System**   | Unified `respondToChallenge()` for all verification flows         |
| **MFA Support**        | Setup, verify, and manage MFA devices                             |
| **Social Auth**        | OAuth flow initiation and callback handling                       |
| **Cross-Tab Sync**     | Token state synchronized across browser tabs (JSON mode)          |
| **SSR-Safe**           | Interceptor safely skips auth logic during server rendering       |
| **Framework Adapters** | Angular bindings included; React patterns documented              |

## Token Delivery Modes

| Mode      | Storage           | Use Case           |
| --------- | ----------------- | ------------------ |
| `cookies` | HTTP-only cookies | Web applications   |
| `json`    | Client storage    | Mobile/native apps |

See [Token Management](./concepts/token-management) for details on refresh, cross-tab sync, and security.

## Feature Guides

- **[Challenge Handling](./guides/challenge-handling)** - Email verification, MFA, password change flows
- **[MFA Setup](./guides/mfa-setup)** - Add TOTP, SMS, Email, Passkey, backup codes
- **[Social Authentication](./guides/social-auth)** - Web OAuth and native mobile login
- **[Error Handling](./guides/error-handling)** - Error codes, retry, rate limiting
- **[Authentication Events](./guides/authentication-events)** - Subscribe to auth lifecycle events
- **[Admin Operations](./api/admin-operations)** - User management from the frontend

## Concepts

- **[Configuration](./concepts/configuration)** - All SDK options, callbacks, endpoints
- **[Token Management](./concepts/token-management)** - Token storage, refresh, cross-tab sync

## API Reference

- **[NAuthClient](./api/nauth-client)** - Complete client API
- **[NAuthClientConfig](./api/nauth-client-config)** - Configuration interface
- **[NAuthClientError](./api/nauth-client-error)** - Error handling
- **[Challenge Helpers](./api/utilities/challenge-helpers)** - Utility functions
- **[Types](./api/types/auth-response)** - TypeScript type definitions

## Related Documentation

- [Backend API Reference](/docs/api/overview) - Direct backend integration
- [Challenge System](/docs/concepts/challenge-system) - Understanding challenge flows
- [Token Management](/docs/concepts/token-management) - Backend token configuration
