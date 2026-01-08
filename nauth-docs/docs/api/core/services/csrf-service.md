---
title: CsrfService
description: CSRF token generation and validation service for cookie-based authentication. Automatically handled by middleware.
keywords: [service, csrf, security, api, cookies]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# CsrfService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Generates and validates CSRF tokens for protection against cross-site request forgery attacks. Used automatically when `tokenDelivery.method` is `'cookies'` or `'hybrid'`.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { CsrfService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { CsrfService } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { CsrfService } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Overview

Provides CSRF protection for cookie-based authentication. Generates cryptographically secure tokens and validates them using constant-time comparison. Only active when `tokenDelivery.method` is `'cookies'` or `'hybrid'`.

:::note
Auto-injected by framework adapters. CSRF protection is handled automatically by middleware when using the framework's CSRF handler/interceptor.
:::

:::warning When CSRF Protection is Active
CSRF protection is **only enabled** when:

- `tokenDelivery.method` is `'cookies'` or `'hybrid'`
- Request method is NOT `GET`, `HEAD`, or `OPTIONS` (safe methods)
- Route is NOT marked as public (`@Public()` decorator or `nauthPublic` attribute)
- Path is NOT in `security.csrf.excludedPaths` configuration

For JSON token delivery, CSRF protection is not needed (tokens are not in cookies).
:::

## Methods

### generateToken()

Generate a new cryptographically secure CSRF token.

```typescript
generateToken(): string
```

**Returns**

- `string` - CSRF token (64-character hexadecimal string)

**Behavior**

- Uses `crypto.randomBytes(32)` for cryptographically secure randomness
- Token length is fixed at 64 characters (32 bytes as hex)

**Errors**

Errors: None. This method never throws errors.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
export class MyService {
  constructor(private csrfService: CsrfService) {}

  example() {
    const token = this.csrfService.generateToken();
    // Returns: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456'
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/csrf-token', (req, res) => {
  const token = nauth.csrfService.generateToken();
  res.json({ csrfToken: token });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/csrf-token',
  nauth.adapter.wrapRouteHandler(async () => {
    const token = nauth.csrfService.generateToken();
    return { csrfToken: token };
  }),
);
```

</TabItem>
</Tabs>

---

### getCookieName()

Get the configured CSRF cookie name.

```typescript
getCookieName(): string
```

**Returns**

- `string` - Cookie name (default: `'nauth_csrf_token'`)

**Behavior**

- Returns the cookie name configured in `security.csrf.cookieName`
- Defaults to `'nauth_csrf_token'` if not configured

**Errors**

Errors: None. This method never throws errors.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const cookieName = this.csrfService.getCookieName();
// Returns: 'nauth_csrf_token' (or configured value)
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const cookieName = nauth.csrfService.getCookieName();
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const cookieName = nauth.csrfService.getCookieName();
```

</TabItem>
</Tabs>

---

### getCookieOptions()

Get the cookie options used when setting the CSRF cookie.

```typescript
getCookieOptions(): NAuthCookieOptions
```

**Returns**

- `NAuthCookieOptions` - Cookie options object with:
  - `httpOnly?: boolean` - Defaults to `false` (token must be readable by JavaScript)
  - `secure?: boolean` - Inherited from `tokenDelivery.cookieOptions.secure`
  - `sameSite?: 'strict' | 'lax' | 'none'` - Inherited from `tokenDelivery.cookieOptions.sameSite`
  - `domain?: string` - Inherited from `tokenDelivery.cookieOptions.domain`
  - `path?: string` - Always `'/'` for CSRF cookies
  - `maxAge?: number` - Optional expiration
  - `expires?: Date` - Optional expiration date

**Behavior**

- Returns merged options from `security.csrf.cookieOptions` and `tokenDelivery.cookieOptions`
- `httpOnly` defaults to `false` (unlike auth tokens) so JavaScript can read the token
- `path` is always `'/'` to ensure token is available across all routes

**Errors**

Errors: None. This method never throws errors.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const options = this.csrfService.getCookieOptions();
// Returns: { httpOnly: false, secure: true, sameSite: 'strict', path: '/' }
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const options = nauth.csrfService.getCookieOptions();
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const options = nauth.csrfService.getCookieOptions();
```

</TabItem>
</Tabs>

---

### getHeaderName()

Get the configured CSRF header name.

```typescript
getHeaderName(): string
```

**Returns**

- `string` - Header name (default: `'x-csrf-token'`)

**Behavior**

- Returns the header name configured in `security.csrf.headerName`
- Defaults to `'x-csrf-token'` if not configured
- Client should send token in this header or in body fields: `_csrf` or `csrfToken`

**Errors**

Errors: None. This method never throws errors.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const headerName = this.csrfService.getHeaderName();
// Returns: 'x-csrf-token' (or configured value)
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const headerName = nauth.csrfService.getHeaderName();
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const headerName = nauth.csrfService.getHeaderName();
```

</TabItem>
</Tabs>

---

### validateToken()

Validate CSRF token by comparing header token with cookie token. Uses constant-time comparison to prevent timing attacks.

```typescript
validateToken(headerToken: string, cookieToken: string): boolean
```

**Parameters**

- `headerToken` - Token from request header or body
- `cookieToken` - Token from cookie

**Returns**

- `boolean` - `true` if tokens match, `false` otherwise

**Behavior**

- Returns `false` if either token is missing or empty
- Uses `crypto.timingSafeEqual()` for constant-time comparison
- Prevents timing attacks that could reveal token values

**Errors**

Errors: None. This method never throws errors (returns `false` on validation failure).

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Post('/endpoint')
async createResource(@Req() req: Request) {
  const headerName = this.csrfService.getHeaderName();
  const cookieName = this.csrfService.getCookieName();

  const headerToken = req.headers[headerName] || req.body?._csrf;
  const cookieToken = req.cookies?.[cookieName];

  if (!this.csrfService.validateToken(String(headerToken || ''), cookieToken || '')) {
    throw new NAuthException(AuthErrorCode.CSRF_TOKEN_INVALID, 'CSRF token validation failed');
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.post('/endpoint', (req, res) => {
  const headerName = nauth.csrfService.getHeaderName();
  const cookieName = nauth.csrfService.getCookieName();

  const headerToken = req.headers[headerName] || req.body?._csrf;
  const cookieToken = req.cookies?.[cookieName];

  if (!nauth.csrfService.validateToken(String(headerToken || ''), cookieToken || '')) {
    return res.status(403).json({ error: 'CSRF token invalid' });
  }

  res.json({ success: true });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/endpoint',
  nauth.adapter.wrapRouteHandler(async (req) => {
    const headerName = nauth.csrfService.getHeaderName();
    const cookieName = nauth.csrfService.getCookieName();

    const headerToken = req.headers[headerName] || req.body?._csrf;
    const cookieToken = req.cookies?.[cookieName];

    if (!nauth.csrfService.validateToken(String(headerToken || ''), cookieToken || '')) {
      throw new NAuthException(AuthErrorCode.CSRF_TOKEN_INVALID, 'CSRF token validation failed');
    }

    return { success: true };
  }),
);
```

</TabItem>
</Tabs>

---

## Manual Usage

If you're not using the framework's CSRF middleware/interceptor, you can manually control CSRF protection:

**Token Generation (GET requests):**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Get('/csrf-token')
getCsrfToken(@Res() res: Response) {
  const token = this.csrfService.generateToken();
  const cookieName = this.csrfService.getCookieName();
  const cookieOptions = this.csrfService.getCookieOptions();

  res.cookie(cookieName, token, {
    ...cookieOptions,
    httpOnly: false,
    path: '/',
  });

  res.setHeader(this.csrfService.getHeaderName(), token);
  return { csrfToken: token };
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/csrf-token', (req, res) => {
  const token = nauth.csrfService.generateToken();
  const cookieName = nauth.csrfService.getCookieName();
  const cookieOptions = nauth.csrfService.getCookieOptions();

  res.cookie(cookieName, token, {
    ...cookieOptions,
    httpOnly: false,
    path: '/',
  });

  res.setHeader(nauth.csrfService.getHeaderName(), token);
  res.json({ csrfToken: token });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/csrf-token',
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    const token = nauth.csrfService.generateToken();
    const cookieName = nauth.csrfService.getCookieName();
    const cookieOptions = nauth.csrfService.getCookieOptions();

    res.setCookie(cookieName, token, {
      ...cookieOptions,
      httpOnly: false,
      path: '/',
    });

    res.header(nauth.csrfService.getHeaderName(), token);
    return { csrfToken: token };
  }),
);
```

</TabItem>
</Tabs>

**Token Validation (POST/PUT/DELETE/PATCH requests):**

See `validateToken()` example above.

---

## Related APIs

- [CsrfGuard](/docs/api/nestjs/guards/csrf-guard) - NestJS guard for CSRF protection
- [Token Delivery Modes](/docs/features/token-delivery) - When CSRF protection is active
- [Password & Security Configuration](/docs/concepts/configuration#password--security) - CSRF configuration options
