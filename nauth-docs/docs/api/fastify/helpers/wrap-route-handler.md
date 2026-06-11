---
title: wrapRouteHandler()
description: Wrap Fastify route handlers to restore AsyncLocalStorage context and use nauth-toolkit request/response interfaces
keywords: [fastify, helper, route handler, context, async local storage, api]
image: /img/api-social-card.png
---
# wrapRouteHandler()

**Type:** Method on `FastifyAdapter`
**Access:** `nauth.adapter.wrapRouteHandler(handler)`

Wraps a route handler to restore the `AsyncLocalStorage` context that nauth-toolkit relies on. **Required for all Fastify route handlers** that call nauth services.

## Signature

```typescript
wrapRouteHandler<T>(handler: NAuthRouteHandler<T>): FastifyRouteHandler
```

## Why It's Needed

Fastify hooks (`onRequest`, `preHandler`) run independently from route handlers, which means the `AsyncLocalStorage` context set up by `ClientInfoHandler` is lost by the time your route executes. `wrapRouteHandler()` retrieves the stored context from the request object and re-enters it before calling your handler.

Without it, calls to nauth services (e.g., `authService.login()`) will fail because they depend on request context (client info, CSRF state, token delivery mode).

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `handler` | `NAuthRouteHandler<T>` | `(req: NAuthRequest, res: NAuthResponse) => Promise<T \| void>` |

## Returns

A standard `FastifyRouteHandler` function compatible with Fastify's route registration.

## Usage

### Basic Route

```typescript
import { NAuth, FastifyAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new FastifyAdapter(),
});

fastify.post('/auth/login',
  { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await nauth.authService.login(req.body));
  }),
);
```

### Authenticated Route

```typescript
fastify.get('/auth/profile',
  { preHandler: [nauth.helpers.requireAuth()] },
  nauth.adapter.wrapRouteHandler(async (_req, res) => {
    res.json(nauth.helpers.getCurrentUser());
  }),
);
```

### With Status Codes

```typescript
fastify.post('/auth/signup',
  { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.status(201).json(await nauth.authService.signup(req.body));
  }),
);
```

## Behavior

1. Ensures request attributes are initialized
2. Wraps `FastifyRequest` and `FastifyReply` into `NAuthRequest` and `NAuthResponse`
3. Retrieves the `AsyncLocalStorage` context stored on the request by earlier hooks
4. Re-enters the context store, then executes your handler
5. If no context store exists (e.g., context hooks didn't run), executes the handler directly

## Related APIs

- [public()](./public-route) - Mark routes as public
- [requireAuth()](./require-auth) - Require authentication
- [optionalAuth()](./optional-auth) - Optional authentication
- [getCurrentUser()](./get-current-user) - Get authenticated user
- [Client Info Hook](../hooks/client-info-hook) - Context initialization
