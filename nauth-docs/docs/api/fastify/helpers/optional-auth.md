---
title: optionalAuth()
description: Fastify preHandler for optional authentication
keywords: [fastify, helper, optional, auth, api]
image: /img/api-social-card.png
---
# optionalAuth()

**Type:** `preHandlerHookHandler`
**Access:** `nauth.helpers.optionalAuth()`

Allows both authenticated and anonymous access.

## Signature

```typescript
optionalAuth(): preHandlerHookHandler
```

## Usage

```typescript
fastify.get('/content', {
  preHandler: nauth.helpers.optionalAuth(),
  handler: nauth.adapter.wrapRouteHandler(async () => {
    const user = nauth.helpers.getCurrentUser();
    if (user) {
      return { content: 'personalized', user };
    }
    return { content: 'anonymous' };
  }),
});
```

## Behavior

- Does not reject unauthenticated requests
- User available via `getCurrentUser()` if authenticated
- Bypasses CSRF validation

## Related

- [requireAuth()](/docs/api/fastify/helpers/require-auth)
- [getCurrentUser()](/docs/api/fastify/helpers/get-current-user)

