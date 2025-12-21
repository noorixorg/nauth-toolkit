---
title: csrf
description: CSRF token validation middleware for Express
sidebar_position: 2
keywords: [express, middleware, csrf, security, cookie, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# csrf

**Type:** `RequestHandler`
**Access:** `nauth.middleware.csrf`

Express middleware that validates CSRF tokens for state-changing requests when using cookie-based token delivery.

## Signature

```typescript
nauth.middleware.csrf: RequestHandler
```

## Overview

The `csrf` middleware validates CSRF tokens to prevent Cross-Site Request Forgery attacks. It uses lazy validation - errors are stored in request attributes and only thrown when `requireAuth()` is called.

**Key Features:**

- Validates CSRF token from header matches cookie value
- Skips safe HTTP methods (GET, HEAD, OPTIONS)
- Skips routes marked with `public()` helper
- Deferred validation until `requireAuth()` is called
- Only enforces for cookie-based token delivery

## Usage

### Mount Order

CSRF middleware must be mounted after `clientInfo` and before `auth`:

```typescript
import express from 'express';
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const app = express();
const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(),
});

// Mount order matters!
app.use(nauth.middleware.clientInfo); // 1st - Initializes context
app.use(nauth.middleware.csrf); // 2nd - CSRF validation
app.use(nauth.middleware.auth); // 3rd - JWT validation
app.use(nauth.middleware.tokenDelivery); // 4th - Token delivery
```

### Configuration

CSRF middleware is automatically enabled when using cookie-based token delivery:

```typescript
const nauth = await NAuth.create({
  config: {
    tokenDelivery: {
      method: 'cookies', // CSRF middleware enabled
    },
    security: {
      csrf: {
        headerName: 'x-csrf-token',
        cookieName: 'nauth_csrf_token',
        excludedPaths: ['/webhook'],
      },
    },
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

## Behavior

- Validates `x-csrf-token` header against cookie value
- Skips GET, HEAD, OPTIONS requests (safe methods)
- Skips routes marked with `public()` helper
- Stores errors in `req.attributes.nauthCsrfError` (lazy validation)
- Only enforces for cookie-based token delivery

## Frontend Integration

Frontend must send CSRF token in headers:

```typescript
// Read CSRF token from cookie
const csrfToken = getCookie('nauth_csrf_token');

// Send in header for POST/PUT/DELETE/PATCH
fetch('/api/action', {
  method: 'POST',
  headers: {
    'x-csrf-token': csrfToken,
  },
  body: JSON.stringify({ data: 'value' }),
});
```

## Errors

CSRF errors are stored in request attributes and thrown by `requireAuth()`:

| Code | When | Details |
| ---- | ---- | ------- |
| `CSRF_TOKEN_MISSING` | Token missing in header or cookie | `undefined` |
| `CSRF_TOKEN_INVALID` | Token mismatch | `undefined` |

## Related APIs

- [public()](../helpers/public-route) - Bypass CSRF validation
- [requireAuth()](../helpers/require-auth) - Enforce CSRF validation
- [Auth Middleware](./auth-middleware) - JWT validation
- [CsrfService](/docs/api/core/services/csrf-service) - CSRF token generation
