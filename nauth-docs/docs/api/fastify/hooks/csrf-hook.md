---
title: csrf Hook
description: Fastify onRequest hook for CSRF protection
keywords: [fastify, hook, csrf, security, api]
image: /img/api-social-card.png
sidebar_position: 3
---

# csrf Hook

**Type:** `onRequestHookHandler`
**Access:** `nauth.middleware.csrf`

Validates CSRF tokens for state-changing requests.

## Signature

```typescript
(request: FastifyRequest, reply: FastifyReply) => Promise<void>
```

## Registration

```typescript
fastify.addHook('onRequest', nauth.middleware.csrf);
```

## Behavior

- Validates `X-CSRF-Token` header against cookie
- Skips GET, HEAD, OPTIONS requests
- Skips routes marked with `public()`
- Deferred validation until `requireAuth()` is called

## Related

- [CsrfHandler](/docs/api/core/handlers/csrf-handler)

