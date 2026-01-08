---
title: tokenDelivery
description: Token delivery middleware for Express (cookie-based token delivery)
keywords: [express, middleware, token-delivery, cookies, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# tokenDelivery

**Type:** `RequestHandler`
**Access:** `nauth.middleware.tokenDelivery`

Express middleware that sets JWT tokens as httpOnly cookies and strips them from response body when using cookie-based token delivery.

## Signature

```typescript
nauth.middleware.tokenDelivery: RequestHandler
```

## Overview

The `tokenDelivery` middleware automatically handles token delivery based on the configured mode. For cookie-based delivery, it sets tokens as httpOnly cookies and removes them from response bodies. For JSON delivery, it does nothing (tokens remain in response body).

**Key Features:**

- Sets tokens as httpOnly cookies (cookie mode)
- Strips tokens from response body (cookie mode)
- Generates CSRF tokens (cookie mode)
- No-op in JSON mode
- Works with hybrid mode

## Usage

### Mount Order

Token delivery middleware must be mounted last:

```typescript
import express from 'express';
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const app = express();
const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(),
});

app.use(nauth.middleware.clientInfo); // 1st
app.use(nauth.middleware.csrf); // 2nd
app.use(nauth.middleware.auth); // 3rd
app.use(nauth.middleware.tokenDelivery); // 4th - LAST
```

### Cookie Mode

When `tokenDelivery.method === 'cookies'`:

```typescript
app.post('/auth/login', nauth.helpers.public(), async (req, res) => {
  const result = await nauth.authService.login(req.body);
  // Tokens automatically set as cookies
  // Tokens stripped from response body
  res.json(result); // No tokens in response
});
```

### JSON Mode

When `tokenDelivery.method === 'json'`:

```typescript
app.post('/auth/login', nauth.helpers.public(), async (req, res) => {
  const result = await nauth.authService.login(req.body);
  // Tokens remain in response body
  res.json(result); // Contains accessToken, refreshToken
});
```

## Behavior

### Cookie Mode

- Sets `nauth_access_token` and `nauth_refresh_token` as httpOnly cookies
- Strips tokens from response body
- Generates and sets CSRF token cookie
- Sets device token cookie (if present)

### JSON Mode

- No-op (tokens remain in response body)
- No cookies set

### Hybrid Mode

- Determines delivery based on request origin
- Applies cookie or JSON behavior accordingly

## Cookie Configuration

Cookies are configured via `tokenDelivery.cookieOptions`:

```typescript
const nauth = await NAuth.create({
  config: {
    tokenDelivery: {
      method: 'cookies',
      cookieOptions: {
        secure: true,
        sameSite: 'strict',
        httpOnly: true,
        path: '/',
      },
    },
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

## Related APIs

- [tokenDelivery() Helper](../helpers/token-delivery) - Override delivery mode per route
- [CSRF Middleware](./csrf-middleware) - CSRF validation
- [Auth Middleware](./auth-middleware) - JWT validation
- [Token Delivery](/docs/features/token-delivery) - Token delivery modes guide
