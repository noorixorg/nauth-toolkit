---
title: auth Hook
description: Fastify onRequest hook for JWT authentication
keywords: [fastify, hook, auth, jwt, api]
image: /img/api-social-card.png
sidebar_position: 1
---

# auth Hook

**Type:** `onRequestHookHandler`
**Access:** `nauth.middleware.auth`

Validates JWT access token and stores authenticated user in context.

## Signature

```typescript
(request: FastifyRequest, reply: FastifyReply) => Promise<void>
```

## Registration

```typescript
fastify.addHook('onRequest', nauth.middleware.auth);
```

## Behavior

- Extracts token from `Authorization: Bearer <token>` header or cookies
- Validates token signature and expiration
- Stores user in AsyncLocalStorage context
- Does not reject unauthenticated requests (use `requireAuth()` helper)

## Related

- [requireAuth()](/docs/api/fastify/helpers/require-auth)
- [AuthService](/docs/api/core/services/auth-service)

