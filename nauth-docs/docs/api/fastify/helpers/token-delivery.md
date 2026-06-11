---
title: tokenDelivery()
description: Override token delivery mode for route
keywords: [fastify, helper, token, delivery, api]
image: /img/api-social-card.png
---
# tokenDelivery()

**Type:** `preHandlerHookHandler`
**Access:** `nauth.helpers.tokenDelivery()`

Overrides token delivery mode for specific route.

## Signature

```typescript
tokenDelivery(mode: TokenDeliveryMode): preHandlerHookHandler
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `mode` | `'json' \| 'cookies'` | Delivery mode |

## Modes

| Mode | Description |
|------|-------------|
| `json` | Tokens in response body only |
| `cookies` | Tokens in HTTP-only cookies only |

## Usage

```typescript
// Force cookie delivery for web clients
fastify.post('/auth/login', {
  preHandler: [nauth.helpers.public(), nauth.helpers.tokenDelivery('cookies')],
  handler: loginHandler,
});

// Force JSON delivery for mobile clients
fastify.post('/api/auth/login', {
  preHandler: [nauth.helpers.public(), nauth.helpers.tokenDelivery('json')],
  handler: loginHandler,
});
```

## Related

- [tokenDelivery hook](/docs/api/fastify/hooks/token-delivery-hook)

