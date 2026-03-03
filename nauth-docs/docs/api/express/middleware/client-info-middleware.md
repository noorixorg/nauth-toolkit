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
**MUST BE FIRST** - This middleware must be mounted before all other nauth-toolkit middleware as it initializes the context.
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

- Extracts IP address from `req.ip` (set by Express after applying trust proxy rules)
- Parses user agent string
- Extracts device token from request body or headers
- Optionally performs geolocation lookup
- Stores data in async local storage for transparent access

## Proxy Trust

The middleware reads the client IP from Express's `req.ip`. Express only populates `req.ip` from forwarding headers (`X-Forwarded-For`, etc.) when `trust proxy` is configured on the Express app. Without it, `req.ip` will be the IP of the last network hop (e.g. your load balancer), not the real client.

Configure trust proxy on your Express application before mounting nauth-toolkit middleware:

```typescript
import express from 'express';

const app = express();

// Trust the first proxy in front of the app (e.g. a single Nginx or AWS ALB)
app.set('trust proxy', 1);

// For multiple known proxy IPs or CIDR ranges:
// app.set('trust proxy', ['loopback', '10.0.0.0/8']);

app.use(nauth.middleware.clientInfo);
// ...
```

See the [Express behind proxies guide](https://expressjs.com/en/guide/behind-proxies.html) for all valid values.

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
