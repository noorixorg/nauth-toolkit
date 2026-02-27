# Token Delivery Modes

This document explains how nauth-toolkit delivers JWT tokens to clients and how to choose the right mode for your deployment.

## Modes Overview

| Mode      | Use Case           | Token Storage                                      | Frontend Sends                 |
| --------- | ------------------ | -------------------------------------------------- | ------------------------------ |
| `cookies` | Web applications   | httpOnly cookies (server-managed)                  | `withCredentials: true`        |
| `json`    | Mobile/native apps | localStorage or secure storage                     | `Authorization: Bearer` header |
| `hybrid`  | Both web + mobile  | Backend supports both modes via separate endpoints | Depends on endpoint            |

## Understanding Hybrid Mode

**Hybrid is a backend deployment pattern, not a frontend mode.**

When your backend uses hybrid mode, you typically expose **two delivery paths** (recommended: explicit routes), so each client type calls endpoints that match its delivery mode:

```
Web (cookies):    /auth/login, /auth/refresh, etc.
Mobile (JSON):    /auth/login/mobile, /auth/refresh/mobile (or any dedicated prefix you choose)
```

Each frontend app (web or mobile) chooses ONE delivery mode and calls the appropriate endpoints:

- **Web app** → `tokenDelivery: 'cookies'`, `baseUrl: '/auth'`
- **Mobile app** → `tokenDelivery: 'json'`, `baseUrl: '/mobile/auth'`

The same request should never receive both cookie tokens and JSON tokens at the same time. In practice, keep delivery deterministic by using explicit routes (recommended) or by using `hybridPolicy` (Origin-based).

### Social login redirects in hybrid mode

Redirect-first social login follows the same rule: **delivery must be deterministic**.

- **Do not** make delivery a frontend concern for social redirects.
- Prefer **explicit routes** (recommended) or **route-level overrides** (NestJS: `@TokenDelivery('cookies' | 'json')`) so the backend can decide delivery at the **start** request and persist it server-side for the provider callback.

## Backend Configuration

### Web Only (Cookies)

```typescript
// nauth.config.ts
{
  tokenDelivery: { method: 'cookies' },
  security: {
    csrf: { enabled: true }
  }
}
```

### Mobile Only (JSON)

```typescript
// nauth.config.ts
{
  tokenDelivery: {
    method: 'json';
  }
}
```

### Hybrid (Web + Mobile)

Create two auth controllers with different decorators:

```typescript
// web-auth.controller.ts - Cookies mode
@Controller('auth')
export class WebAuthController {
  @Post('login')
  @TokenDelivery('cookies')
  login() {
    /* ... */
  }

  @Post('refresh')
  @TokenDelivery('cookies')
  refresh() {
    /* ... */
  }
}

// mobile-auth.controller.ts - JSON mode
@Controller('auth')
export class MobileAuthController {
  @Post('login/mobile')
  @TokenDelivery('json')
  login() {
    /* ... */
  }

  @Post('refresh/mobile')
  @TokenDelivery('json')
  refresh() {
    /* ... */
  }
}
```

## Frontend Configuration

### Web App (Angular)

```typescript
// app.config.ts
import { NAUTH_CLIENT_CONFIG, authInterceptor } from '@nauth-toolkit/client/angular';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

export const appConfig = {
  providers: [
    {
      provide: NAUTH_CLIENT_CONFIG,
      useFactory: () => ({
        baseUrl: 'https://api.example.com/auth',
        tokenDelivery: 'cookies', // Web uses cookies
        csrf: {
          cookieName: 'csrf_token',
          headerName: 'x-csrf-token',
        },
        onSessionExpired: () => inject(Router).navigate(['/login']),
      }),
    },
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

### Mobile App (Capacitor/Ionic)

```typescript
// app.config.ts
import { NAUTH_CLIENT_CONFIG, authInterceptor } from '@nauth-toolkit/client/angular';
import { Preferences } from '@capacitor/preferences';

// Custom secure storage for mobile
const capacitorStorage: NAuthStorageAdapter = {
  getItem: async (key) => (await Preferences.get({ key })).value,
  setItem: async (key, value) => Preferences.set({ key, value }),
  removeItem: async (key) => Preferences.remove({ key }),
};

export const appConfig = {
  providers: [
    {
      provide: NAUTH_CLIENT_CONFIG,
      useFactory: () => ({
        baseUrl: 'https://api.example.com/mobile/auth', // Different endpoint!
        tokenDelivery: 'json', // Mobile uses JSON tokens
        storage: capacitorStorage, // Secure storage for tokens
        onSessionExpired: () => inject(Router).navigate(['/login']),
      }),
    },
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

## Security Comparison

| Aspect          | Cookies Mode                   | JSON Mode                        |
| --------------- | ------------------------------ | -------------------------------- |
| XSS Protection  | httpOnly prevents JS access | Tokens accessible to JS (treat as sensitive) |
| CSRF Protection | Requires CSRF tokens | Not vulnerable (no auto-send) |
| Cross-origin    | Requires CORS configuration | Works anywhere |
| Mobile Native   | Cookie support varies by client | Full control |
| SSR Compatible  | Cookies not always available to server-side rendering | Tokens in headers |

## Cookie Security Defaults

When using `tokenDelivery: 'cookies'`:

```typescript
{
  cookieName: 'nauth_access_token',       // Access token cookie
  refreshCookieName: 'nauth_refresh_token', // Refresh token cookie
  httpOnly: true,                          // Not readable by JavaScript
  secure: true,                            // HTTPS only (disable for localhost)
  sameSite: 'strict',                      // CSRF protection
  path: '/',
}
```

## Token Refresh Flow

### Cookies Mode (Web)

1. Request fails with 401
2. Interceptor calls `/auth/refresh` with `withCredentials: true`
3. Backend reads refresh token from httpOnly cookie
4. Backend validates and sets new access token cookie
5. Original request retried automatically

```
Browser                    Backend
   |                          |
   |-- Request (401) -------->|
   |<---- 401 Unauthorized ---|
   |                          |
   |-- POST /auth/refresh --->|  (cookies sent automatically)
   |<---- 200 + new cookies --|
   |                          |
   |-- Retry original req --->|
   |<---- 200 OK -------------|
```

### JSON Mode (Mobile)

1. Request fails with 401
2. Interceptor calls `/mobile/auth/refresh` with refresh token in body
3. Backend validates and returns new tokens in response
4. Client stores new tokens securely
5. Original request retried with new access token

```
Mobile App                 Backend
   |                          |
   |-- Request (401) -------->|  Authorization: Bearer <expired>
   |<---- 401 Unauthorized ---|
   |                          |
   |-- POST /mobile/auth/refresh -->|  { refreshToken: "..." }
   |<---- 200 + tokens -------|  { accessToken, refreshToken }
   |                          |
   |-- Retry original req --->|  Authorization: Bearer <new>
   |<---- 200 OK -------------|
```

## CSRF Configuration

Required for cookies mode to prevent cross-site request forgery:

```typescript
// Backend
security: {
  csrf: {
    enabled: true,
    cookieName: 'csrf_token',    // Non-httpOnly cookie
    headerName: 'x-csrf-token',  // Header the client must send
  }
}

// Frontend reads csrf_token cookie and sends it as x-csrf-token header
```

The Angular interceptor handles this automatically in cookies mode.

## Remember Device Feature

Works across all modes:

- **Cookies mode**: Device token set as `nauth_device_id` httpOnly cookie
- **JSON mode**: Device token returned in response, client stores securely

See [REMEMBER_DEVICE_FEATURE.md](./REMEMBER_DEVICE_FEATURE.md) for details.

## Migration Guide

### From localStorage to Cookies (Web)

1. Update backend: `tokenDelivery.method = 'cookies'`
2. Enable CSRF: `security.csrf.enabled = true`
3. Update frontend: `tokenDelivery: 'cookies'`
4. Remove token storage code from frontend
5. Ensure `withCredentials: true` (interceptor handles this)

### Adding Mobile Support (Hybrid)

1. Create mobile auth controller with JSON delivery
2. Configure separate base URL for mobile endpoints
3. Mobile app uses `tokenDelivery: 'json'` with mobile endpoints
4. Web app continues using `tokenDelivery: 'cookies'` with web endpoints
