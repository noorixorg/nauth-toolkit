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

## Proxy Trust

The hook reads the client IP from Fastify's `request.ip`. Fastify only populates `request.ip` from forwarding headers (`X-Forwarded-For`, etc.) when `trustProxy` is enabled in the Fastify server options. Without it, `request.ip` will be the IP of the last network hop (e.g. your load balancer), not the real client.

Enable `trustProxy` when creating the Fastify instance:

```typescript
import Fastify from 'fastify';

const fastify = Fastify({
  // Trust the first proxy in front of the app
  trustProxy: true,

  // Or trust specific IP addresses / CIDR ranges:
  // trustProxy: '10.0.0.0/8',
  // trustProxy: ['loopback', '10.0.0.0/8'],
});

fastify.addHook('onRequest', nauth.middleware.clientInfo);
// ...
```

See the [Fastify server options documentation](https://fastify.dev/docs/latest/Reference/Server/#trustproxy) for all valid values.

## Related

- [ClientInfoService](/docs/api/core/services/client-info-service)

