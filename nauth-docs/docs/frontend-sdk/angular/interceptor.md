---
title: Interceptor
description: Angular HTTP interceptor for authentication
sidebar_position: 3
keywords: [angular, interceptor, http, token, csrf, refresh]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# HTTP Interceptor

**Package:** `@nauth-toolkit/client-angular`

HTTP interceptor that handles authentication headers, CSRF tokens, and automatic token refresh.

## Setup

<Tabs groupId="angular-style">
<TabItem value="standalone" label="Standalone (Angular 17+)">

```typescript
// app.config.ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from '@nauth-toolkit/client-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

</TabItem>
<TabItem value="ngmodule" label="NgModule">

```typescript
// app.module.ts
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from '@nauth-toolkit/client-angular';

@NgModule({
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
})
export class AppModule {}
```

</TabItem>
</Tabs>

## Behavior

### By Token Delivery Mode

| Mode | Headers | Credentials | CSRF |
| ---- | ------- | ----------- | ---- |
| `cookies` | None | `withCredentials: true` | Auto-attached |
| `json` | `Authorization: Bearer <token>` | `false` | Not needed |

### CSRF Token Handling

For `cookies` mode, the interceptor automatically:

1. Reads the CSRF token from cookie (default: `csrf_token`)
2. Attaches it to mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`)
3. Uses configured header name (default: `x-csrf-token`)

```typescript
// Configure CSRF in client config
{
  provide: NAUTH_CLIENT_CONFIG,
  useValue: {
    baseUrl: 'https://api.example.com/auth',
    tokenDelivery: 'cookies',
    csrf: {
      cookieName: 'csrf_token',      // Default
      headerName: 'x-csrf-token',    // Default
    },
    onSessionExpired: () => {},
  },
}
```

### Automatic Token Refresh

On 401 response:

1. Interceptor queues the failed request
2. Calls `refreshTokens()` on the client
3. Retries the original request with new tokens
4. If refresh fails, calls `onSessionExpired` callback

```
Request → 401 → Refresh Tokens → Retry Request → Response
                     ↓ (fail)
               onSessionExpired()
```

### Concurrency Handling

Multiple simultaneous 401s trigger only ONE refresh:

```
Request A → 401 ─┐
Request B → 401 ──┼→ Single Refresh → Retry All
Request C → 401 ─┘
```

## Exports

| Export | Type | Description |
| ------ | ---- | ----------- |
| `authInterceptor` | `HttpInterceptorFn` | Functional interceptor (Angular 17+) |
| `AuthInterceptor` | `class` | Class-based interceptor (NgModule) |

## Customization

### Exclude Routes from Interception

The interceptor only adds auth to requests matching your `baseUrl`. External APIs are not affected.

For additional control, create a wrapper interceptor:

```typescript
export const customAuthInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip auth for specific paths
  if (req.url.includes('/public/')) {
    return next(req);
  }
  return authInterceptor(req, next);
};
```

### Custom Error Handling

Handle 401s differently:

```typescript
export const customAuthInterceptor: HttpInterceptorFn = (req, next) => {
  return authInterceptor(req, next).pipe(
    catchError((error) => {
      if (error.status === 401) {
        // Custom handling
        console.log('Authentication required');
      }
      return throwError(() => error);
    }),
  );
};
```

## Related APIs

- [AuthService](./auth-service) - Main service
- [Guards](./guards) - Route protection
- [Configuration](../api/nauth-client-config) - Config options

