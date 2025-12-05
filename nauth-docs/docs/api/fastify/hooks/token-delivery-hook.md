---
title: tokenDelivery Hook
description: Fastify onSend hook for token cookie delivery
keywords: [fastify, hook, token, cookies, api]
image: /img/api-social-card.png
sidebar_position: 4
---

# tokenDelivery Hook

**Type:** `onSendHookHandler`
**Access:** `nauth.middleware.tokenDelivery`

Intercepts responses to set authentication cookies.

## Signature

```typescript
(request: FastifyRequest, reply: FastifyReply, payload: unknown) => Promise<unknown>
```

## Registration

```typescript
fastify.addHook('onSend', nauth.middleware.tokenDelivery);
```

## Behavior

- Detects `AuthResponseDTO` in response body
- Sets `accessToken` and `refreshToken` cookies based on delivery mode
- Removes tokens from JSON body when using cookie delivery
- Sets CSRF token cookie

## Cookie Options

Configured via `config.cookies`:

| Option | Type | Description |
|--------|------|-------------|
| `secure` | `boolean` | HTTPS only |
| `httpOnly` | `boolean` | No JS access |
| `sameSite` | `string` | CSRF protection |
| `domain` | `string` | Cookie domain |

## Related

- [tokenDelivery() helper](/docs/api/fastify/helpers/token-delivery)

