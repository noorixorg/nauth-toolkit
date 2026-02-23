---
title: csrf Hook
description: Fastify onRequest hook for CSRF protection
keywords: [fastify, hook, csrf, security, api]
image: /img/api-social-card.png
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

- Validates `x-csrf-token` header (or `_csrf`/`csrfToken` body fields) against cookie
- Skips GET, HEAD, OPTIONS requests (safe methods)
- Skips routes marked with `public()`
- Skips paths listed in `security.csrf.excludedPaths`
- Deferred validation until `requireAuth()` is called
- Only enforces when `tokenDelivery.method` is `'cookies'` or `'hybrid'`

## Configuration

CSRF is configured under `security.csrf` in `NAuthConfig`:

```typescript
const nauth = await NAuth.create({
  config: {
    tokenDelivery: {
      method: 'cookies',
    },
    security: {
      csrf: {
        // Name of the CSRF header to check. Default: 'x-csrf-token'
        headerName: 'x-csrf-token',
        // Name of the CSRF cookie. Default: '<prefix>csrf_token'
        cookieName: 'nauth_csrf_token',
        // Length of CSRF token in bytes. Default: 32
        tokenLength: 32,
        // Paths that bypass CSRF validation entirely (prefix match)
        excludedPaths: ['/webhook', '/public-api'],
        // Cookie options for the CSRF token cookie
        cookieOptions: {
          secure: true,        // HTTPS only. Set false for localhost
          sameSite: 'strict',  // 'strict' | 'lax' | 'none'
          domain: undefined,   // e.g. '.example.com' for subdomain sharing
          path: '/',
          priority: 'high',    // 'low' | 'medium' | 'high'
        },
      },
    },
  },
  adapter: new FastifyAdapter(),
});
```

:::note
`excludedPaths` uses a prefix match (`String.prototype.startsWith`). A path of `/webhook` will match `/webhook`, `/webhook/stripe`, etc.
:::

## Related

- [public()](../helpers/public-route) - Bypass CSRF validation per route
- [requireAuth()](../helpers/require-auth) - Enforce CSRF validation
- [CsrfService](/docs/api/core/services/csrf-service)

