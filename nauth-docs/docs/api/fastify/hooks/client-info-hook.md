---
title: clientInfo Hook
description: Fastify onRequest hook for client info extraction
keywords: [fastify, hook, client-info, api]
image: /img/api-social-card.png
---
# clientInfo Hook

**Type:** `onRequestHookHandler`
**Access:** `nauth.middleware.clientInfo`

Initializes AsyncLocalStorage context and extracts client information (IP, User-Agent).

## Signature

```typescript
(request: FastifyRequest, reply: FastifyReply) => Promise<void>
```

## Registration

```typescript
fastify.addHook('onRequest', nauth.middleware.clientInfo);
```

## Context Data

| Property | Type | Description |
|----------|------|-------------|
| `ip` | `string` | Client IP address |
| `userAgent` | `string` | Raw User-Agent header |
| `deviceName` | `string` | Parsed device name |
| `deviceType` | `string` | `mobile` \| `desktop` \| `tablet` |
| `platform` | `string` | OS platform |
| `browser` | `string` | Browser name |

## Related

- [ClientInfoService](/docs/api/core/services/client-info-service)

