---
title: Express Adapter
description: Express adapter with middleware and route helpers
keywords: [express, adapter, middleware, helpers, api]
image: /img/api-social-card.png
sidebar_position: 0
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
tokenDelivery(mode: 'json' | 'cookies' | 'both'): RequestHandler
```

Overrides token delivery mode for route.

## Types

```typescript
import type { ExpressMiddlewareType, ExpressRouteHandlerType } from '@nauth-toolkit/core';
```

| Type                      | Description                      |
| ------------------------- | -------------------------------- |
| `ExpressMiddlewareType`   | Express middleware function type |
| `ExpressRouteHandlerType` | Express route handler type       |
