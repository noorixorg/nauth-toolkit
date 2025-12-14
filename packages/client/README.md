# @nauth-toolkit/client

Framework-agnostic frontend SDK for nauth-toolkit. Handles auth flows, token delivery (JSON/cookies/hybrid), challenges, MFA, social auth, device trust, and audit history.

## Installation

```bash
yarn add @nauth-toolkit/client
```

Angular apps (optional peers):

```bash
yarn add @angular/core @angular/common rxjs
```

## Quick Start (Vanilla)

```typescript
import { NAuthClient } from '@nauth-toolkit/client';

const auth = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'hybrid',
  onSessionExpired: () => window.location.replace('/login')
});

const result = await auth.login('user@example.com', 'password');
if (result.challengeName) {
  // Prompt user to complete challenge then call respondToChallenge()
}
```

## Quick Start (Angular)

```typescript
// app.config.ts (standalone)
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor, NAUTH_CLIENT_CONFIG } from '@nauth-toolkit/client/angular';

providers: [
  { provide: NAUTH_CLIENT_CONFIG, useValue: {
      baseUrl: 'https://api.example.com/auth',
      tokenDelivery: 'cookies',
      onSessionExpired: () => router.navigate(['/login'])
  }},
  provideHttpClient(withInterceptors([authInterceptor]))
]
```

## Configuration

- `baseUrl` (required): Auth API base (e.g., `https://api.example.com/auth`)
- `tokenDelivery`: `json` | `cookies` | `hybrid`
- `onSessionExpired` (required): Callback when refresh fails
- `storage`: Custom storage adapter for JSON/hybrid mobile (defaults to localStorage or in-memory)
- `csrf`: `{ cookieName, headerName }` (defaults: `nauth_csrf_token`, `x-csrf-token`)
- `deviceTrust`: `{ headerName, storageKey }` (defaults: `X-Device-Token`, `nauth_device_token`)
- `endpoints`: Override backend paths if different from defaults

## Token Delivery

- **json**: Stores tokens via storage adapter, sends Bearer header.
- **cookies**: Sends credentials; SDK never sends Bearer; CSRF header added automatically.
- **hybrid**: Browser path behaves like cookies; non-browser behaves like json.

## Storage Adapters

- `BrowserStorage` (localStorage/sessionStorage)
- `InMemoryStorage` (SSR/tests)
- Provide your own (e.g., Capacitor Preferences or React Native AsyncStorage).

## Error Handling

All errors are `NAuthClientError` with `code` from `NAuthErrorCode` enum and optional `details`.

## Scripts

```bash
yarn workspace @nauth-toolkit/client build
yarn workspace @nauth-toolkit/client lint
yarn workspace @nauth-toolkit/client test
```

