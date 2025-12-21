---
title: requireAuth()
description: Require authentication for Express routes
sidebar_position: 1
keywords: [express, helper, auth, protected, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# requireAuth()

**Type:** `RequestHandler`
**Access:** `nauth.helpers.requireAuth()`

Express middleware that protects routes by requiring valid authentication.

## Signature

```typescript
requireAuth(options?: RequireAuthOptions): RequestHandler
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `csrf` | `boolean` | `true` | Validate CSRF token |

## Overview

The `requireAuth()` helper enforces authentication for routes. It returns 401 if the user is not authenticated and validates CSRF tokens when using cookie-based token delivery.

**Key Features:**

- Returns 401 if not authenticated
- Validates CSRF token by default
- Can skip CSRF validation for specific routes
- Works with `auth` middleware

## Usage

### Basic Usage

Protect a route with authentication:

```typescript
import express from 'express';
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const app = express();
const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(),
});

app.get('/profile', nauth.helpers.requireAuth(), async (req, res) => {
  const user = nauth.helpers.getCurrentUser();
  res.json({ user });
});
```

### Skip CSRF Validation

Skip CSRF validation for specific routes (e.g., logout):

```typescript
// Logout uses GET to avoid CSRF issues
app.get('/auth/logout', nauth.helpers.requireAuth({ csrf: false }), async (req, res) => {
  await nauth.authService.logout({ session: req.session?.id });
  res.json({ success: true });
});
```

### Protected API Endpoints

```typescript
app.post('/api/posts', nauth.helpers.requireAuth(), async (req, res) => {
  const user = nauth.helpers.getCurrentUser();
  const post = await postsService.create(user.sub, req.body);
  res.json(post);
});

app.delete('/api/posts/:id', nauth.helpers.requireAuth(), async (req, res) => {
  const user = nauth.helpers.getCurrentUser();
  await postsService.delete(req.params.id, user.sub);
  res.json({ success: true });
});
```

## Errors

| Code | Status | When |
|------|--------|------|
| `UNAUTHORIZED` | 401 | No valid token |
| `CSRF_INVALID` | 403 | CSRF validation failed |

**Error Response Example:**

```json
{
  "statusCode": 401,
  "message": "Authentication required",
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED"
}
```

## Related APIs

- [public()](./public-route) - Mark routes as public
- [optionalAuth()](./optional-auth) - Optional authentication
- [Auth Middleware](../middleware/auth-middleware) - JWT validation
- [CSRF Middleware](../middleware/csrf-middleware) - CSRF validation
