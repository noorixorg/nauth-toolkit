---
title: CsrfService
description: CSRF token generation and validation service
keywords: [service, csrf, security, api]
image: /img/api-social-card.png
sidebar_position: 8
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# CsrfService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Generates and validates CSRF tokens for protection against cross-site request forgery.

::::note
Auto-injected by framework adapters. No manual instantiation required.
::::

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { CsrfService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { CsrfService } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { CsrfService } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Methods

### generateToken()

```typescript
generateToken(): string
```

Generates a new CSRF token.

**Returns**
- `string` - CSRF token

### getCookieName()

```typescript
getCookieName(): string
```

Get the configured CSRF cookie name (default: `nauth_csrf_token`).

### getCookieOptions()

```typescript
getCookieOptions(): Record<string, unknown>
```

Get the cookie options used when setting the CSRF cookie.

### getHeaderName()

```typescript
getHeaderName(): string
```

Get the configured header name expected for CSRF validation (default: `x-csrf-token`).

### validateToken()

```typescript
validateToken(token: string, cookieToken: string): boolean
```

Validates CSRF token against cookie.

**Parameters**
- `token` - Token from header (`X-CSRF-Token`)
- `cookieToken` - Token from cookie

**Returns**
- `boolean` - Validation result

## Related

- [CsrfGuard](/docs/api/nestjs/guards/csrf-guard)

