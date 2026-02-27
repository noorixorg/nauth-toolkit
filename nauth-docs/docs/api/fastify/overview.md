---
title: Fastify Adapter
description: 'Fastify adapter: NAuth.create() bootstrap, onRequest/onSend hooks (clientInfo, csrf, auth, tokenDelivery), route helpers (requireAuth, public, optionalAuth, tokenDelivery), and wrapRouteHandler for AsyncLocalStorage context'
keywords: [fastify, adapter, hooks, helpers, api]
image: /img/api-social-card.png
---
# Fastify Adapter

**Package:** `@nauth-toolkit/core`
**Type:** Framework Adapter

```typescript
import { FastifyAdapter } from '@nauth-toolkit/core';
```

## FastifyAdapter

### Constructor

```typescript
new FastifyAdapter()
```

No configuration required.

### Usage

```typescript
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { NAuth, FastifyAdapter } from '@nauth-toolkit/core';

const fastify = Fastify();
await fastify.register(cookie);

const nauth = await NAuth.create({
  config: { /* ... */ },
  dataSource,
  adapter: new FastifyAdapter(),
});
```

## Hooks

Returned by `nauth.middleware`:

| Property | Type | Description |
|----------|------|-------------|
| `clientInfo` | `onRequestHookHandler` | Initializes context, extracts IP/UA |
| `csrf` | `onRequestHookHandler` | CSRF token validation |
| `auth` | `onRequestHookHandler` | JWT validation |
| `tokenDelivery` | `onSendHookHandler` | Cookie token delivery |

**Registration**

```typescript
fastify.addHook('onRequest', nauth.middleware.clientInfo);
fastify.addHook('onRequest', nauth.middleware.csrf);
fastify.addHook('onRequest', nauth.middleware.auth);
fastify.addHook('onSend', nauth.middleware.tokenDelivery);
```

## Helpers

Returned by `nauth.helpers`:

### requireAuth()

```typescript
requireAuth(options?: { csrf?: boolean }): preHandlerHookHandler
```

Returns 401 if not authenticated. Use as `preHandler`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `csrf` | `boolean` | `true` | Validate CSRF token |

### public()

```typescript
public(): preHandlerHookHandler
```

Marks route as public, bypasses CSRF.

### optionalAuth()

```typescript
optionalAuth(): preHandlerHookHandler
```

Allows authenticated and anonymous access.

### getCurrentUser()

```typescript
getCurrentUser(): IUser | undefined
```

Returns authenticated user from context.

### tokenDelivery()

```typescript
tokenDelivery(mode: 'json' | 'cookies'): preHandlerHookHandler
```

Overrides token delivery mode for route.

### skipRecaptcha()

```typescript
skipRecaptcha(): preHandlerHookHandler
```

Bypasses reCAPTCHA validation for the route even when globally enabled. Useful for admin routes or internal endpoints.

### requireRecaptcha()

```typescript
requireRecaptcha(): preHandlerHookHandler
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

## Route Handler Wrapper

### wrapRouteHandler()

```typescript
nauth.adapter.wrapRouteHandler<T>(
  handler: (req: NAuthRequest, res: NAuthResponse) => Promise<T>
): RouteHandlerMethod
```

Wraps route handler to ensure AsyncLocalStorage context propagation.

**Example**

```typescript
fastify.post('/signup', {
  preHandler: nauth.helpers.public(),
  handler: nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.signup(req.body);
  }),
});
```


