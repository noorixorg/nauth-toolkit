---
title: public()
description: Fastify preHandler for public routes
keywords: [fastify, helper, public, api]
image: /img/api-social-card.png
sidebar_position: 2
---

# public()

**Type:** `preHandlerHookHandler`
**Access:** `nauth.helpers.public()`

Marks route as public, bypassing CSRF validation.

## Signature

```typescript
public(): preHandlerHookHandler
```

## Usage

```typescript
fastify.post('/auth/signup', {
  preHandler: nauth.helpers.public(),
  handler: nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.signup(req.body);
  }),
});

fastify.post('/auth/login', {
  preHandler: nauth.helpers.public(),
  handler: loginHandler,
});
```

## Behavior

- Skips CSRF token validation
- Does not require authentication
- Context still initialized by `clientInfo` hook

## Related

- [requireAuth()](/docs/api/fastify/helpers/require-auth)
- [optionalAuth()](/docs/api/fastify/helpers/optional-auth)

