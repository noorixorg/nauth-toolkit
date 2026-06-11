---
title: Express Adapter
description: 'Express adapter: NAuth.create() bootstrap, middleware pipeline (clientInfo, csrf, auth, tokenDelivery), and route helpers (requireAuth, public, optionalAuth, tokenDelivery, getCurrentUser)'
keywords: [express, adapter, middleware, helpers, api]
image: /img/api-social-card.png
---
# Express Adapter

**Package:** `@nauth-toolkit/core`
**Type:** Framework Adapter

```typescript
import { ExpressAdapter } from '@nauth-toolkit/core';
```

## ExpressAdapter

### Constructor

```typescript
new ExpressAdapter();
```

No configuration required.

### Usage

```typescript
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({
  config: {
    /* ... */
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

## Middleware

Returned by `nauth.middleware`:

| Property        | Type             | Description                         |
| --------------- | ---------------- | ----------------------------------- |
| `clientInfo`    | `RequestHandler` | Initializes context, extracts IP/UA |
| `csrf`          | `RequestHandler` | CSRF token validation               |
| `auth`          | `RequestHandler` | JWT validation                      |
| `tokenDelivery` | `RequestHandler` | Cookie token delivery               |

**Mount Order**

```typescript
app.use(nauth.middleware.clientInfo); // 1st
app.use(nauth.middleware.csrf); // 2nd
app.use(nauth.middleware.auth); // 3rd
app.use(nauth.middleware.tokenDelivery); // 4th
```

## Helpers

Returned by `nauth.helpers`:

### requireAuth()

```typescript
requireAuth(options?: { csrf?: boolean }): RequestHandler
```

Returns 401 if not authenticated.

| Option | Type      | Default | Description         |
| ------ | --------- | ------- | ------------------- |
| `csrf` | `boolean` | `true`  | Validate CSRF token |

### public()

```typescript
public(): RequestHandler
```

Marks route as public, bypasses CSRF.

### optionalAuth()

```typescript
optionalAuth(): RequestHandler
```

Allows authenticated and anonymous access.

### getCurrentUser()

```typescript
getCurrentUser(): IUser | undefined
```

Returns authenticated user from context.

### tokenDelivery()

```typescript
tokenDelivery(mode: 'json' | 'cookies'): RequestHandler
```

Overrides token delivery mode for route.

### skipRecaptcha()

```typescript
skipRecaptcha(): RequestHandler
```

Bypasses reCAPTCHA validation for the route even when globally enabled. Useful for admin routes or internal endpoints.

### requireRecaptcha()

```typescript
requireRecaptcha(): RequestHandler
```

Enforces reCAPTCHA validation for the route even when not globally enabled. Use for high-risk operations like password reset or account deletion.

### getCurrentSession()

```typescript
getCurrentSession(): string | number | undefined
```

Returns the current session ID from AsyncLocalStorage context. Only available after `nauth.middleware.auth` has run.

### getClientInfo()

```typescript
getClientInfo(): ClientInfo | undefined
```

Returns the client info object from AsyncLocalStorage context (IP address, user agent, device token, etc.). Only available after `nauth.middleware.clientInfo` has run.

## Types

```typescript
import type { ExpressMiddlewareType } from '@nauth-toolkit/core';
```

| Type                    | Description                      |
| ----------------------- | -------------------------------- |
| `ExpressMiddlewareType` | Express middleware function type |
