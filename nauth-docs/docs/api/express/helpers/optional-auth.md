---
title: optionalAuth()
description: Optional authentication marker for Express routes
sidebar_position: 2
keywords: [express, helper, optional, auth, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# optionalAuth()

**Type:** `RequestHandler`
**Access:** `nauth.helpers.optionalAuth()`

Express middleware that marks routes for optional authentication (semantic marker).

## Signature

```typescript
optionalAuth(): RequestHandler
```

## Overview

The `optionalAuth()` helper is a semantic marker for routes that support both authenticated and anonymous access. The `auth` middleware already performs optional authentication by default, so this helper is primarily for documentation purposes.

**Key Features:**

- Allows authenticated and anonymous access
- User available via `nauth.helpers.getCurrentUser()` if authenticated
- No-op middleware (for documentation clarity)

## Usage

### Optional Authentication

Allow both authenticated and anonymous access:

```typescript
import express from 'express';
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const app = express();
const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(),
});

app.get('/posts', nauth.helpers.optionalAuth(), async (req, res) => {
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

### Public Content with Personalization

```typescript
app.get('/articles/:slug', nauth.helpers.optionalAuth(), async (req, res) => {
  const user = nauth.helpers.getCurrentUser();
  const article = await articlesService.getBySlug(req.params.slug);

  // Add personalized data if authenticated
  if (user) {
    article.bookmarked = await bookmarksService.isBookmarked(user.sub, article.id);
    article.readingProgress = await readingService.getProgress(user.sub, article.id);
  }

  res.json(article);
});
```

## Behavior

- Does not require authentication
- User available if authenticated
- Works with `auth` middleware (optional by default)
- Semantic marker for documentation

## Related APIs

- [public()](./public-route) - Mark routes as public
- [requireAuth()](./require-auth) - Require authentication
- [Auth Middleware](../middleware/auth-middleware) - JWT validation
