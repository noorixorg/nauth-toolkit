---
title: auth
description: JWT authentication middleware for Express
keywords: [express, middleware, auth, jwt, protected, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# auth

**Type:** `RequestHandler`
**Access:** `nauth.middleware.auth`

Express middleware that validates JWT tokens and performs optional authentication.

## Signature

```typescript
nauth.middleware.auth: RequestHandler
```

## Overview

The `auth` middleware validates JWT access tokens from requests and attaches user information to the request object. It performs optional authentication by default - routes are accessible without tokens, but user data is available if a valid token is provided.

**Key Features:**

- JWT token validation
- Session-based revocation checking
- Automatic session activity updates
- Optional authentication (does not require tokens)
- Support for both Authorization header and cookies
- User data attachment to request

## Usage

### Mount Order

Auth middleware must be mounted after `clientInfo` and `csrf`:

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
app.use(nauth.middleware.auth); // 3rd - JWT validation
app.use(nauth.middleware.tokenDelivery); // 4th
```

### Optional Authentication

By default, auth middleware allows both authenticated and anonymous access:

```typescript
app.get('/posts', async (req, res) => {
  const user = nauth.helpers.getCurrentUser();

  if (user) {
    // Authenticated - show personalized content
    const posts = await postsService.getPersonalized(user.sub);
    res.json(posts);
  } else {
    // Anonymous - show public content
    const posts = await postsService.getPublic();
    res.json(posts);
  }
});
```

### Require Authentication

Use `requireAuth()` helper to enforce authentication:

```typescript
app.get('/profile', nauth.helpers.requireAuth(), async (req, res) => {
  const user = nauth.helpers.getCurrentUser();
  res.json({ user });
});
```

## Token Extraction

The middleware extracts tokens based on the configured token delivery mode:

### JSON Mode (Authorization Header)

```http
GET /api/protected HTTP/1.1
Host: example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Cookie Mode

```http
GET /api/protected HTTP/1.1
Host: example.com
Cookie: nauth_access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Hybrid Mode

Supports both Authorization header and cookies.

## Behavior

- Validates JWT signature and expiration
- Checks session exists and not revoked
- Loads user data from database
- Updates session activity timestamp
- Attaches user to request (available via `nauth.helpers.getCurrentUser()`)
- Does not throw errors for missing/invalid tokens (optional auth)

## Errors

Auth errors are stored in request attributes and thrown by `requireAuth()`:

| Code | When | Details |
| ---- | ---- | ------- |
| `TOKEN_INVALID` | No token provided or invalid format | `undefined` |
| `TOKEN_EXPIRED` | Token has expired | `undefined` |
| `SESSION_NOT_FOUND` | Session doesn't exist | `undefined` |
| `SESSION_EXPIRED` | Session has expired | `undefined` |
| `USER_NOT_FOUND` | User no longer exists | `undefined` |
| `ACCOUNT_DISABLED` | User account disabled | `undefined` |

## Related APIs

- [requireAuth()](../helpers/require-auth) - Enforce authentication
- [public()](../helpers/public-route) - Mark routes as public
- [optionalAuth()](../helpers/optional-auth) - Optional authentication marker
- [CSRF Middleware](./csrf-middleware) - CSRF validation
- [AuthService](/docs/api/core/services/auth-service) - Main authentication service
