---
title: Interfaces
description: TypeScript interfaces for configuration and custom adapters
keywords: [interfaces, types, config, adapter, api]
image: /img/api-social-card.png
sidebar_position: 0
---

# Interfaces

**Package:** `@nauth-toolkit/core`
**Type:** TypeScript Interfaces

## Configuration

### NAuthConfig

Main configuration interface.

```typescript
import { NAuthConfig } from '@nauth-toolkit/core';

const config: NAuthConfig = {
  jwt: { /* ... */ },
  mfa: { /* ... */ },
  cookies: { /* ... */ },
  // ...
};
```

See [Configuration](/docs/concepts/configuration) for full options.

## User & Session

### IUser

Authenticated user interface.

```typescript
import { IUser } from '@nauth-toolkit/core';
```

| Property | Type | Description |
|----------|------|-------------|
| `sub` | `string` | User ID |
| `email` | `string` | Email address |
| `emailVerified` | `boolean` | Email verified |
| `username` | `string?` | Username |
| `phone` | `string?` | Phone number |
| `phoneVerified` | `boolean` | Phone verified |
| `mfaEnabled` | `boolean` | MFA enabled |

### ISession

Session interface.

| Property | Type | Description |
|----------|------|-------------|
| `sessionId` | `string` | Session ID |
| `userSub` | `string` | User ID |
| `expiresAt` | `Date` | Expiration |
| `ipAddress` | `string?` | Client IP |
| `userAgent` | `string?` | User agent |

## Platform Abstraction

For building custom adapters.

### NAuthAdapter

Interface for framework adapters.

```typescript
import { NAuthAdapter } from '@nauth-toolkit/core';

class MyAdapter implements NAuthAdapter {
  createRequestWrapper(req: unknown): NAuthRequest { /* ... */ }
  createResponseWrapper(res: unknown): NAuthResponse { /* ... */ }
  registerMiddleware(handler, req, res, next): Promise<void> { /* ... */ }
  registerResponseInterceptor(handler, req, res, next): Promise<void> { /* ... */ }
  wrapRouteHandler<T>(handler): (req, res) => Promise<T> { /* ... */ }
}
```

### NAuthRequest

Generic request interface.

| Property | Type | Description |
|----------|------|-------------|
| `headers` | `Record<string, string>` | Request headers |
| `cookies` | `Record<string, string>` | Request cookies |
| `body` | `unknown` | Request body |
| `query` | `Record<string, string>` | Query params |
| `ip` | `string` | Client IP |
| `method` | `string` | HTTP method |
| `path` | `string` | Request path |
| `url` | `string` | Full URL |
| `raw` | `unknown` | Raw framework request |
| `attributes` | `Record<string, unknown>` | Custom attributes |

### NAuthResponse

Generic response interface.

| Method | Description |
|--------|-------------|
| `status(code)` | Set status code |
| `json(data)` | Send JSON response |
| `header(name, value)` | Set header |
| `setCookie(name, value, options)` | Set cookie |
| `clearCookie(name, options)` | Clear cookie |
| `redirect(url)` | Redirect |

## Provider Interfaces

### StorageAdapter

Session storage interface. See [Session Storage](/docs/api/storage/overview).

### IEmailProvider

Email provider interface. See [Email](/docs/api/email/overview).

### ISMSProvider

SMS provider interface. See [SMS](/docs/api/sms/overview).

### ISocialAuthProvider

Social auth provider interface. See [Social Auth](/docs/api/social/overview).

### IMFAProvider

MFA provider interface. See [MFA](/docs/api/mfa/overview).

## Related

- [Configuration](/docs/concepts/configuration)
- [Custom Adapters](/docs/concepts/architecture#custom-adapters)

