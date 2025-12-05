# Token Delivery Modes

This document explains how nauth-toolkit delivers JWT tokens to clients and how to choose the right mode for your deployment.

## Modes

- json (default): Tokens are returned in the response body. Works with any transport (HTTP, WS, GraphQL).
- cookies: Tokens are set as httpOnly cookies. Most secure for web browsers.
- hybrid: Cookies on web, Bearer tokens on mobile. Best when you support both.

## Security Defaults

- Cookie names: `nauth_access_token`, `nauth_refresh_token` (prefixed to avoid conflicts)
- httpOnly: true (not readable by JavaScript)
- secure: true (HTTPS only; configurable for localhost)
- sameSite: strict (CSRF protection; configurable)
- path: /

## Guard Enforcement

- json: rejects cookie tokens (COOKIES_NOT_ALLOWED)
- cookies: rejects Bearer tokens (BEARER_NOT_ALLOWED)
- hybrid: accepts cookies first, then Bearer header

## CSRF

When using cookies, enable CSRF in your config:

```ts
security: {
  csrf: {
    enabled: true,
    cookieName: 'csrf-token',
    headerName: 'x-csrf-token',
  }
}
```

## Backend Config

```ts
// Most web apps
tokenDelivery: { method: 'cookies' }

// Web + Mobile
tokenDelivery: {
  method: 'hybrid',
  cookieOptions: { secure: false } // localhost only
}
```

## Frontend Patterns (Angular)

- Web (cookies): use `withCredentials()` and do NOT add Authorization header
- Mobile (Bearer): store tokens in secure storage/localStorage and add Authorization header

```ts
// app.config.ts
provideHttpClient(
  withInterceptors([authInterceptor]),
  withCredentials(),
)
```

```ts
// auth.interceptor.ts
if (platformService.isWebPlatform()) {
  return next(request) // cookies flow
}
// mobile: attach Bearer token
```

## Remember Device Feature

The remember device feature works across all token delivery modes:

- **Cookies mode**: Device token automatically set as `nauth_device_id` httpOnly cookie
- **JSON mode**: Device token returned in response body (client must store securely)
- **Hybrid mode**: Cookies for web, JSON response for mobile

See [REMEMBER_DEVICE_FEATURE.md](./REMEMBER_DEVICE_FEATURE.md) for complete documentation.

## Migration from LocalStorage

- Switch to `tokenDelivery.method = 'cookies'`
- Ensure CSRF is enabled
- Remove token reads from localStorage in web builds
- Keep mobile logic (Bearer) intact


