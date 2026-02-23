---
title: wrapRouteHandler()
description: Wrap Express route handlers with NAuth request/response interfaces, error handling, and auto-response serialization
keywords: [express, helper, route handler, error handling, api]
image: /img/api-social-card.png
---
# wrapRouteHandler()

**Type:** Method on `ExpressAdapter`
**Access:** `nauth.adapter.wrapRouteHandler(handler)`

Wraps a route handler with `NAuthRequest`/`NAuthResponse` interfaces, automatic error propagation, and optional response serialization. Unlike Fastify, Express middleware runs in a continuous call stack so `AsyncLocalStorage` context is preserved automatically --- this wrapper provides convenience, not context restoration.

## Signature

```typescript
wrapRouteHandler<T>(handler: NAuthRouteHandler<T>): ExpressMiddleware
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `handler` | `NAuthRouteHandler<T>` | `(req: NAuthRequest, res: NAuthResponse) => Promise<T \| void>` |

## Returns

Standard Express middleware (`(req, res, next) => void`).

## Usage

### Basic Route

```typescript
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(),
});

app.post('/auth/login',
  nauth.helpers.public(),
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await nauth.authService.login(req.body));
  }),
);
```

### Return Value Auto-Serialization

If your handler returns a value and the response hasn't been sent, the wrapper automatically calls `res.json()`:

```typescript
app.get('/auth/profile',
  nauth.helpers.requireAuth(),
  nauth.adapter.wrapRouteHandler(async () => {
    // Returned value is automatically sent as JSON
    return nauth.helpers.getCurrentUser();
  }),
);
```

### With Status Codes

```typescript
app.post('/auth/signup',
  nauth.helpers.public(),
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.status(201).json(await nauth.authService.signup(req.body));
  }),
);
```

## Behavior

1. Ensures request attributes are initialized
2. Wraps `express.Request` and `express.Response` into `NAuthRequest` and `NAuthResponse`
3. Executes your handler inside a `try`/`catch` block
4. If the handler returns a value and `res.headersSent` is `false`, sends the value as JSON
5. If the handler throws, passes the error to `next()` for Express error handling

## When to Use

`wrapRouteHandler()` is **optional** for Express (unlike Fastify where it's required). Use it when you want:

- `NAuthRequest`/`NAuthResponse` interfaces instead of raw Express types
- Automatic error forwarding to Express error handlers via `next(error)`
- Return-value auto-serialization

For simple routes, you can call nauth services directly without the wrapper:

```typescript
app.post('/auth/login', nauth.helpers.public(), async (req, res, next) => {
  try {
    res.json(await nauth.authService.login(req.body));
  } catch (err) { next(err); }
});
```

## Related APIs

- [public()](./public-route) - Mark routes as public
- [requireAuth()](./require-auth) - Require authentication
- [optionalAuth()](./optional-auth) - Optional authentication
- [Client Info Middleware](../middleware/client-info-middleware) - Context initialization
