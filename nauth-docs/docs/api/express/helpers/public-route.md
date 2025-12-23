---
title: public()
description: Mark routes as public to bypass CSRF validation in Express
sidebar_position: 2
keywords: [express, helper, public, csrf, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# public()

**Type:** `RequestHandler`
**Access:** `nauth.helpers.public()`

Express middleware that marks a route as public, bypassing CSRF validation.

## Signature

```typescript
public(): RequestHandler
```

## Overview

The `public()` helper marks routes as public, allowing them to bypass CSRF token validation. This is useful for authentication endpoints (login, signup) and other public routes.

**Key Features:**

- Bypasses CSRF validation
- Does not require authentication
- Context still initialized by `clientInfo` middleware
- Works with cookie-based token delivery

## Usage

### Authentication Endpoints

Mark login and signup as public:

```typescript
import express from 'express';
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const app = express();
const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(),
});

app.post('/auth/login', nauth.helpers.public(), async (req, res) => {
  const result = await nauth.authService.login(req.body);
  res.json(result);
});

app.post('/auth/signup', nauth.helpers.public(), async (req, res) => {
  const result = await nauth.authService.signup(req.body);
  res.json(result);
});
```

### Health Check Endpoints

```typescript
app.get('/health', nauth.helpers.public(), (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### Public API Endpoints

```typescript
app.get('/api/public/posts', nauth.helpers.public(), async (req, res) => {
  const posts = await postsService.getPublicPosts();
  res.json(posts);
});
```

## Behavior

- Skips CSRF token validation
- Does not require authentication
- Context still initialized by `clientInfo` middleware
- Works with all HTTP methods

## Related APIs

- [requireAuth()](./require-auth) - Require authentication
- [optionalAuth()](./optional-auth) - Optional authentication
- [CSRF Middleware](../middleware/csrf-middleware) - CSRF validation
- [Auth Middleware](../middleware/auth-middleware) - JWT validation
