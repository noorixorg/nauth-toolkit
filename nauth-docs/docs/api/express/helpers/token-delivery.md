---
title: tokenDelivery()
description: Override token delivery mode for specific Express routes
keywords: [express, helper, token-delivery, cookies, json, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# tokenDelivery()

**Type:** `RequestHandler`
**Access:** `nauth.helpers.tokenDelivery()`

Express middleware that overrides the global token delivery mode for a specific route.

## Signature

```typescript
tokenDelivery(mode: 'cookies' | 'json'): RequestHandler
```

## Overview

The `tokenDelivery()` helper allows you to force a specific token delivery mode for an endpoint, regardless of the global configuration. This is useful when you need different delivery modes for different clients (web vs mobile).

**Key Features:**

- Override global token delivery mode per route
- Force cookie-based delivery for web endpoints
- Force JSON delivery for mobile/API endpoints
- Works with hybrid mode configuration

## Usage

### Force Cookie Delivery

Force cookie-based delivery for web endpoints:

```typescript
import express from 'express';
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const app = express();
const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(),
});

app.post('/auth/login/web',
  nauth.helpers.public(),
  nauth.helpers.tokenDelivery('cookies'),
  async (req, res) => {
    const result = await nauth.authService.login(req.body);
    res.json(result);
  }
);
```

### Force JSON Delivery

Force JSON delivery for mobile/API endpoints:

```typescript
app.post('/auth/login/mobile',
  nauth.helpers.public(),
  nauth.helpers.tokenDelivery('json'),
  async (req, res) => {
    const result = await nauth.authService.login(req.body);
    res.json(result);
  }
);
```

### Mixed Delivery Modes

Use different delivery modes for different endpoints:

```typescript
app.get('/api/web/data',
  nauth.helpers.requireAuth(),
  nauth.helpers.tokenDelivery('cookies'),
  async (req, res) => {
    const user = nauth.helpers.getCurrentUser();
    res.json({ data: 'web data', user });
  }
);

app.get('/api/mobile/data',
  nauth.helpers.requireAuth(),
  nauth.helpers.tokenDelivery('json'),
  async (req, res) => {
    const user = nauth.helpers.getCurrentUser();
    res.json({ data: 'mobile data', user });
  }
);
```

## Delivery Modes

### `'cookies'`

Forces cookie-based token delivery:

- Tokens set as httpOnly cookies
- Tokens stripped from response body
- CSRF protection required
- Suitable for web applications

### `'json'`

Forces JSON token delivery:

- Tokens returned in response body
- No cookies set
- CSRF protection not required
- Suitable for mobile/API clients

## Configuration Validation

The helper validates that the requested mode is allowed by global configuration:

```typescript
// Global config: tokenDelivery.method = 'json'
nauth.helpers.tokenDelivery('cookies') // Throws COOKIES_NOT_ALLOWED

// Global config: tokenDelivery.method = 'cookies'
nauth.helpers.tokenDelivery('json') // Throws BEARER_NOT_ALLOWED

// Global config: tokenDelivery.method = 'hybrid'
nauth.helpers.tokenDelivery('cookies') // Allowed
nauth.helpers.tokenDelivery('json') // Allowed
```

## Errors

| Code | When | Details |
| ---- | ---- | ------- |
| `COOKIES_NOT_ALLOWED` | Route requests cookies but global config is 'json' | `undefined` |
| `BEARER_NOT_ALLOWED` | Route requests JSON but global config is 'cookies' | `undefined` |

## Related APIs

- [public()](./public-route) - Mark routes as public
- [requireAuth()](./require-auth) - Require authentication
- [CSRF Middleware](../middleware/csrf-middleware) - CSRF protection (required for cookies)
- [Token Delivery](/docs/concepts/token-management) - Token delivery modes guide
