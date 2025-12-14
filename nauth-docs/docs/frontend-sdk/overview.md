---
title: Frontend SDK
description: Optional client SDK for simplified frontend integration with nauth-toolkit
sidebar_position: 10
keywords: [frontend, sdk, client, javascript, typescript, spa, authentication]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

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

## Quick Start

<Tabs groupId="platform">
<TabItem value="vanilla" label="Vanilla JS/TS">

```typescript
import { NAuthClient } from '@nauth-toolkit/client';

const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  onSessionExpired: () => window.location.replace('/login'),
});

await client.initialize();
const response = await client.login('user@example.com', 'password');
```

See [NAuthClient API](./api/nauth-client) and [Configuration](./configuration) for details.

</TabItem>
<TabItem value="angular" label="Angular">

```typescript
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { NAUTH_CLIENT_CONFIG, authInterceptor } from '@nauth-toolkit/client/angular';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

export const appConfig = {
  providers: [
    {
      provide: NAUTH_CLIENT_CONFIG,
      useFactory: () => {
        const router = inject(Router);
        return {
          baseUrl: 'https://api.example.com/auth',
          tokenDelivery: 'cookies',
          onSessionExpired: () => router.navigate(['/login']),
        };
      },
    },
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

See [Angular Overview](./angular/overview) and [Configuration](./configuration) for details.

</TabItem>
</Tabs>

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
| **Framework Adapters** | Angular bindings included                                         |

## Token Delivery Modes

| Mode      | Storage           | Use Case           | Base URL Example |
| --------- | ----------------- | ------------------ | ---------------- |
| `cookies` | HTTP-only cookies | Web applications   | `/auth`          |
| `json`    | Client storage    | Mobile/native apps | `/mobile/auth`   |

:::info Hybrid Backend
"Hybrid" is a **backend deployment pattern**, not a frontend mode. When your backend supports
both web and mobile apps, it exposes separate endpoints for each delivery mode. The frontend
chooses ONE mode (`cookies` or `json`) based on the platform.
:::

## Package Structure

| Entry Point                     | Description                                         |
| ------------------------------- | --------------------------------------------------- |
| `@nauth-toolkit/client`         | Core SDK (NAuthClient, types, storage)              |
| `@nauth-toolkit/client/angular` | Angular bindings (AuthService, interceptor, guards) |

## Documentation

### Core SDK

- **[NAuthClient API](./api/nauth-client)** - Complete client API reference
- **[NAuthClientConfig](./api/nauth-client-config)** - Configuration interface
- **[NAuthClientError](./api/nauth-client-error)** - Error handling
- **[Configuration](./configuration)** - Configuration guide
- **[Types](./api/types/auth-audit-event)** - TypeScript type definitions (alphabetically sorted)

### Angular Integration

- **[Angular Overview](./angular/overview)** - Integration guide
- **[AuthService](./angular/auth-service)** - Service API
- **[Interceptor](./angular/interceptor)** - HTTP interceptor
- **[Guards](./angular/guards)** - Route protection

### Guides

- **[Getting Started](./guides/getting-started)** - Step-by-step setup
- **[Challenge Handling](./guides/challenge-handling)** - Verification flows
- **[Token Management](./token-management)** - Token storage and refresh
- **[Social Auth](./guides/social-auth)** - OAuth integration
- **[MFA Setup](./guides/mfa-setup)** - Multi-factor authentication

## Related Documentation

- [Backend API Reference](/docs/api/overview) - Direct backend integration
- [Challenge System](/docs/concepts/challenge-system) - Understanding challenge flows
- [Token Delivery](/docs/features/token-delivery) - Backend token configuration
