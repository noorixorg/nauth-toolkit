---
title: clientInfo
description: Client information extraction middleware for Express
keywords: [express, middleware, client-info, ip, user-agent, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# clientInfo

**Type:** `RequestHandler`
**Access:** `nauth.middleware.clientInfo`

Express middleware that extracts client information (IP address, user agent, device info) and initializes async local storage context.

## Signature

```typescript
nauth.middleware.clientInfo: RequestHandler
```

## Overview

The `clientInfo` middleware automatically extracts client metadata from incoming requests and stores it in async local storage. This provides transparent access to client information throughout the request lifecycle.

**Key Features:**

- Automatic IP address extraction (handles proxies/load balancers)
- User agent parsing
- Device token extraction
- Optional geolocation data
- Initializes async local storage context

:::warning
**MUST BE FIRST** - This middleware must be mounted before all other NAuth middleware as it initializes the context.
:::

## Usage

### Mount Order

Client info middleware must be mounted first:

```typescript
import express from 'express';
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const app = express();
const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(),
});

// MUST BE FIRST - Initializes context
app.use(nauth.middleware.clientInfo);
app.use(nauth.middleware.csrf);
app.use(nauth.middleware.auth);
app.use(nauth.middleware.tokenDelivery);
```

### Access Client Info

Client information is automatically available via `nauth.helpers.getCurrentUser()` or context:

```typescript
app.get('/api/info', async (req, res) => {
  // Client info is automatically extracted
  const clientInfo = nauth.helpers.getCurrentUser(); // Or from context
  res.json({
    ipAddress: clientInfo?.ipAddress,
    userAgent: clientInfo?.userAgent,
  });
});
```

## Behavior

- Extracts IP address from headers (handles X-Forwarded-For, etc.)
- Parses user agent string
- Extracts device token from request body or headers
- Optionally performs geolocation lookup
- Stores data in async local storage for transparent access

## Configuration

Geolocation is optional and requires `GeoLocationService`:

```typescript
const nauth = await NAuth.create({
  config: {
    // Geolocation config (optional)
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

## Related APIs

- [Auth Middleware](./auth-middleware) - JWT validation
- [CSRF Middleware](./csrf-middleware) - CSRF validation
- [ClientInfoService](/docs/api/core/services/client-info-service) - Client info service
