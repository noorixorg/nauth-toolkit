---
title: requireAuth()
description: Fastify preHandler for requiring authentication
keywords: [fastify, helper, auth, protected, api]
image: /img/api-social-card.png
---
# requireAuth()

**Type:** `preHandlerHookHandler`
**Access:** `nauth.helpers.requireAuth()`

Protects routes by requiring valid authentication.

## Signature

```typescript
requireAuth(options?: RequireAuthOptions): preHandlerHookHandler
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `csrf` | `boolean` | `true` | Validate CSRF token |

## Usage

```typescript
fastify.get('/profile', {
  preHandler: nauth.helpers.requireAuth(),
  handler: nauth.adapter.wrapRouteHandler(async () => {
    return { user: nauth.helpers.getCurrentUser() };
  }),
});

// Skip CSRF validation (logout uses GET to avoid CSRF issues)
fastify.get('/logout', {
  preHandler: nauth.helpers.requireAuth({ csrf: false }),
  handler: logoutHandler,
});
```

## Errors

| Code | Status | When |
|------|--------|------|
| `UNAUTHORIZED` | 401 | No valid token |
| `CSRF_INVALID` | 403 | CSRF validation failed |

## Related

- [auth hook](/docs/api/fastify/hooks/auth-hook)
- [public()](/docs/api/fastify/helpers/public-route)

