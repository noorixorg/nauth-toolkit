---
title: Token Delivery Modes
description: Choose how to send JWT tokens - JSON, cookies, or hybrid
sidebar_position: 3
---

# Token Delivery Modes

After authentication, your application needs to send JWT tokens to the client. nauth-toolkit supports three delivery methods: JSON response, secure cookies, or a hybrid approach.

For complete token delivery configuration options, see the [Configuration guide](/docs/concepts/configuration#token-delivery).

:::tip Quick Recommendation

- **Web app only?** Use `cookies` mode (most secure for browsers)
- **Mobile app only?** Use `json` mode (standard Bearer tokens)
- **Both web and mobile?** Use `hybrid` mode (backend supports both; use explicit routes per client)
  :::

## Delivery Methods

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="json" label="JSON (Default)" default>

Tokens are returned in the response body. Your frontend stores them and sends them in the `Authorization` header.

**Configuration:**

```typescript
{
  tokenDelivery: {
    method: 'json',
  }
}
```

**Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

**Frontend usage:**

```typescript
// Store tokens
localStorage.setItem('accessToken', response.accessToken);
localStorage.setItem('refreshToken', response.refreshToken);

// Send with requests
fetch('/api/protected', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

**Pros:**

- Works everywhere (web, mobile, desktop)
- Simple to implement
- Works with any HTTP client

**Cons:**

- Vulnerable to XSS if stored in `localStorage`
- Requires manual token management in frontend

:::warning Security Consideration
If using JSON mode for web apps, store tokens in memory or secure storage, not `localStorage`. Attackers can steal tokens via XSS attacks if stored in `localStorage`.
:::

  </TabItem>
  <TabItem value="cookies" label="Cookies (Most Secure for Web)">

Tokens are set as HTTP-only cookies. Your frontend doesn't handle tokens directly; the browser sends them automatically.

**Configuration:**

```typescript
{
  tokenDelivery: {
    method: 'cookies',
    cookieOptions: {
      httpOnly: true,       // Not accessible to JavaScript
      secure: true,         // HTTPS only (use false for localhost)
      sameSite: 'strict',   // CSRF protection
      domain: 'yourdomain.com', // Optional: share across subdomains
    },
  },
  security: {
    csrf: {
      cookieName: 'csrf-token',
      headerName: 'x-csrf-token',
    },
  },
}
```

**Response:**

```
Set-Cookie: nauth_access_token=eyJhbG...; HttpOnly; Secure; SameSite=Strict
Set-Cookie: nauth_refresh_token=eyJhbG...; HttpOnly; Secure; SameSite=Strict
Set-Cookie: csrf-token=abc123; Secure; SameSite=Strict
```

**Frontend usage:**

```typescript
// No token storage needed!
// Cookies are sent automatically

fetch('/api/protected', {
  credentials: 'include', // Send cookies
  headers: {
    'x-csrf-token': getCsrfTokenFromCookie(), // CSRF protection
  },
});
```

**Pros:**

- Immune to XSS attacks (tokens not accessible to JavaScript)
- No token management in frontend
- Automatic token sending

**Cons:**

- Web browsers only (won't work for mobile apps)
- Requires CSRF protection
- More complex CORS setup

:::tip Best for Web Apps
Cookie mode is the most secure option for web applications. Even if an attacker injects malicious JavaScript, they can't steal the tokens.
:::

  </TabItem>
  <TabItem value="hybrid" label="Hybrid (Web + Mobile)">

Hybrid is a backend pattern that supports both cookie delivery and JSON delivery. The recommended approach is to make delivery explicit per route (for example: `/auth/login` for cookies and `/auth/login/mobile` for JSON) so each client targets the correct endpoints.

**Configuration:**

```typescript
{
  tokenDelivery: {
    method: 'hybrid',
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    },
  },
  security: {
    csrf: {
      // Customize CSRF cookie/header names and excluded paths (no enable flag)
    },
  },
}
```

**How it works (recommended):**

- Web client calls cookie endpoints (for example: `/auth/login`, `/auth/refresh`)
- Mobile client calls JSON endpoints (for example: `/auth/login/mobile`, `/auth/refresh/mobile`)
- Use route-level delivery override (`@TokenDelivery()` in NestJS, `nauth.helpers.tokenDelivery()` in Express/Fastify)

**Frontend usage:**

Web:

```typescript
fetch('/api/protected', {
  credentials: 'include', // Cookies sent automatically
  headers: {
    'x-csrf-token': getCsrfToken(),
  },
});
```

Mobile:

```typescript
// Store tokens from JSON response
const { accessToken, refreshToken } = await login();
secureStorage.set('accessToken', accessToken);

// Send as Bearer token
fetch('/api/protected', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

**Pros:**
- Single backend serves both web and mobile
- Best security for each platform
- No code duplication

**Cons:**
- Slightly more complex setup
- Clients must target the correct endpoints

</TabItem>
</Tabs>

## CSRF Protection

When using `cookies` or `hybrid` mode, you **must** enable CSRF protection to prevent cross-site request forgery attacks.

**How CSRF works:**

1. User logs into your app → receives cookies
2. User visits malicious site → malicious site makes request to your API
3. Browser automatically sends your cookies (because they're cookies!)
4. Without CSRF protection, the malicious site can perform actions as the user

**How nauth-toolkit prevents this:**

1. Server sets a CSRF token as a readable cookie
2. Frontend reads the CSRF token from cookie
3. Frontend sends CSRF token in a custom header (`x-csrf-token`)
4. Server validates that the cookie and header match

**Configuration:**

```typescript
{
  security: {
    csrf: {
      cookieName: 'csrf-token',
      headerName: 'x-csrf-token',
      excludePaths: ['/api/public/*'], // Don't require CSRF for public endpoints
    },
  },
}
```

**Frontend implementation:**

```typescript
function getCsrfToken(): string {
  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find((c) => c.trim().startsWith('csrf-token='));
  return csrfCookie ? csrfCookie.split('=')[1] : '';
}

fetch('/api/protected', {
  credentials: 'include',
  headers: {
    'x-csrf-token': getCsrfToken(),
  },
});
```

:::danger CSRF is Required for Cookies
Never use cookie-based authentication without CSRF protection. Your application will be vulnerable to CSRF attacks.
:::

## Cookie Configuration

Fine-tune cookie behavior for your deployment:

```typescript
{
  tokenDelivery: {
    method: 'cookies',
    cookieOptions: {
      httpOnly: true,           // Prevent JavaScript access (security)
      secure: true,             // HTTPS only (set to false for localhost dev)
      sameSite: 'strict',       // 'strict', 'lax', or 'none'
      domain: 'example.com',    // Share across subdomains (optional)
      path: '/',                // Cookie path (default: '/')
      maxAge: 900,              // Access token lifetime (seconds)
    },
    cookieNames: {
      accessToken: 'my_access_token',   // Custom cookie name
      refreshToken: 'my_refresh_token', // Custom cookie name
    },
  },
}
```

**SameSite options:**

- `strict` - Most secure, cookies only sent to same site
- `lax` - Allows cookies on top-level navigation (e.g., clicking a link)
- `none` - Cookies sent to all sites (requires `secure: true`)

:::note Localhost Development
For local development, set `secure: false` because localhost uses HTTP, not HTTPS:

```typescript
{
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  }
}
```

:::

## Guard Enforcement

nauth-toolkit enforces your chosen delivery method. This prevents security vulnerabilities where clients use the wrong method.

| Mode      | Bearer Token                       | Cookie Token                        |
| --------- | ---------------------------------- | ----------------------------------- |
| `json`    | Accepted                           | Rejected (`COOKIES_NOT_ALLOWED`)    |
| `cookies` | Rejected (`BEARER_NOT_ALLOWED`)    | Accepted                            |
| `hybrid`  | Accepted                           | Accepted (checks cookies first)     |

**Why enforce this?**

If you configure `cookies` mode for security, but a client sends a Bearer token from `localStorage`, the security benefit is lost. Enforcement ensures all clients use the secure method.

## Remember Device Feature

The "Remember Device" feature works with all delivery modes:

**Cookies mode:**

- Device token set as `nauth_device_id` HTTP-only cookie
- Automatically sent with every request
- Secure and transparent to frontend

**JSON mode:**

- Device token returned in response: `{ deviceToken: "..." }`
- Frontend must store it securely
- Frontend sends it in `x-device-token` header

**Hybrid mode:**

- Web: Cookie-based (automatic)
- Mobile: JSON-based (manual storage)

See [MFA documentation](/docs/features/mfa#remember-device-trusted-devices) for more details.

## Migration Guide

### From localStorage to Cookies

If you're currently using JSON mode with `localStorage`, migrating to cookies improves security:

**Step 1: Update backend**

```typescript
{
  tokenDelivery: { method: 'cookies' },
  security: { csrf: { enabled: true } },
}
```

**Step 2: Update frontend**

```typescript
// Before (JSON mode)
const { accessToken } = await login();
localStorage.setItem('accessToken', accessToken);

// After (Cookie mode)
await login();
// Cookies are set automatically, no storage needed
```

**Step 3: Update API calls**

```typescript
// Before
fetch('/api/protected', {
  headers: { Authorization: `Bearer ${accessToken}` },
});

// After
fetch('/api/protected', {
  credentials: 'include',
  headers: { 'x-csrf-token': getCsrfToken() },
});
```

**Step 4: Deploy and test**

- Test login flow
- Test protected routes
- Test token refresh
- Test logout (clears cookies)

## Next Steps

- [MFA](/docs/features/mfa) - Add two-factor authentication
- [Geolocation](/docs/features/geolocation) - Track user location for security
- [Core Services](/docs/api/core/services/overview) - Learn about all available services
