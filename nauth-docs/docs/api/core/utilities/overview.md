---
title: Utilities
description: 'NAuthLogger class for structured logging with service-scoped context'
keywords: [utilities, logger, context, api]
image: /img/api-social-card.png
---
# Utilities

**Package:** `@nauth-toolkit/core`
**Type:** Utility Classes

## NAuthLogger

Custom logger implementation. Use for consistent logging.

```typescript
import { NAuthLogger } from '@nauth-toolkit/core';

const logger = new NAuthLogger('MyService');
logger.log('User logged in', { userId: '123' });
logger.error('Login failed', error.stack, { email: 'user@example.com' });
```

### Methods

| Method | Description |
|--------|-------------|
| `log(message, context?)` | Info level |
| `error(message, trace?, context?)` | Error level |
| `warn(message, context?)` | Warning level |
| `debug(message, context?)` | Debug level |
| `verbose(message, context?)` | Verbose level |

## ContextStorage

AsyncLocalStorage wrapper for request context.

```typescript
import { ContextStorage } from '@nauth-toolkit/core';

// Get current context (in request handler)
const store = ContextStorage.getStore();
const user = store?.user;
const clientInfo = store?.clientInfo;
```

### Methods

| Method | Description |
|--------|-------------|
| `getStore()` | Get current request store |
| `run(store, fn)` | Run function with store |
| `enterStore(store)` | Enter existing store |

## PiiRedactor

Redacts PII from log objects.

```typescript
import { PiiRedactor } from '@nauth-toolkit/core';

const redactor = new PiiRedactor();
const safe = redactor.redact({ email: 'user@example.com', password: 'secret' });
// { email: 'u***@example.com', password: '[REDACTED]' }
```

## getHttpStatusForErrorCode

Maps AuthErrorCode to HTTP status.

```typescript
import { getHttpStatusForErrorCode, AuthErrorCode } from '@nauth-toolkit/core';

const status = getHttpStatusForErrorCode(AuthErrorCode.INVALID_CREDENTIALS);
// 401
```

## extractClientIp

Extracts client IP from request.

```typescript
import { extractClientIp } from '@nauth-toolkit/core';

const ip = extractClientIp(req, {
  trustProxy: true,
  proxyHeaders: ['x-forwarded-for', 'x-real-ip'],
});
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `trustProxy` | `boolean` | Trust proxy headers |
| `proxyHeaders` | `string[]` | Headers to check |

## Cookie Utilities

```typescript
import {
  getAccessTokenCookieName,
  getRefreshTokenCookieName,
  getCsrfTokenCookieName,
  clearAuthCookies,
} from '@nauth-toolkit/core';

// Get cookie names (respects config prefix)
const accessCookie = getAccessTokenCookieName(config);
const refreshCookie = getRefreshTokenCookieName(config);

// Clear all auth cookies
clearAuthCookies(res, config);
```

## Related

- [NAuthException](/docs/api/core/exceptions/nauth-exception)
- [ClientInfoService](/docs/api/core/services/client-info-service)

