---
title: Getting Started
description: Step-by-step guide to bootstrapping authentication with nauth-toolkit client SDK
keywords: [getting started, setup, bootstrap, installation]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Getting Started

Complete guide to setting up authentication in your frontend application with `@nauth-toolkit/client`.

:::tip Framework-Specific Guides
For dedicated setup guides with full working examples, see [Angular Standalone](../angular/standalone-setup), [Angular NgModule](../angular/ngmodule-setup), [React](../react/setup), or [Capacitor Mobile](../mobile/capacitor-setup). This page covers the generic SDK setup that works with any framework.
:::

## Prerequisites

- nauth-toolkit backend running and configured
- Node.js 22+
- Your framework of choice (Angular, React, Vue, etc.)

## Installation

```bash npm2yarn
npm install @nauth-toolkit/client
```

## Step 1: Determine Token Delivery Mode

Your frontend must match your backend's token delivery mode:

| Frontend Mode | Backend Endpoint                                       | Use Case               |
| ------------- | ------------------------------------------------------ | ---------------------- |
| `cookies`     | `/auth` (cookies mode)                                 | Web apps (recommended) |
| `json`        | `/auth` (JSON mode)                                    | Mobile/native apps     |

Check your backend's `nauth.config.ts`:

```typescript
// Backend configuration
NAuthModule.forRoot({
  tokenDelivery: {
    method: 'cookies', // Your mode
    // ...
  },
});
```

If your backend uses `tokenDelivery.method = 'hybrid'`, the same `/auth` endpoints can serve both web (cookies) and native/mobile (JSON) clients. The backend selects delivery based on request origin (see [Configuration](/docs/concepts/configuration#hybrid-policy-tokendeliverymethod--hybrid)).

See [NAuthClientConfig](../api/nauth-client-config) for all configuration options including custom storage adapters, CSRF settings, endpoint overrides, and callbacks.

## Step 2: Initialize the Client

Create and configure the `NAuthClient` instance. The client handles token storage, refresh, and API communication. Call `initialize()` on app startup to hydrate authentication state from storage.

### Token Storage

For JSON token delivery mode, tokens are stored using a storage adapter. The SDK provides built-in adapters and supports custom implementations:

| Storage Option                    | Use Case                                              | Default       |
| --------------------------------- | ----------------------------------------------------- | ------------- |
| `BrowserStorage` (localStorage)   | Web apps, persistent sessions                         | Yes (browser) |
| `BrowserStorage` (sessionStorage) | Web apps, session-only storage                        | No            |
| `InMemoryStorage`                 | SSR, testing, temporary                               | Yes (SSR)     |
| Custom adapter                    | Mobile apps (Capacitor, React Native), secure storage | No            |

**Note:** For `cookies` mode, tokens are managed by the browser and backend—no storage adapter needed.

<Tabs groupId="platform">
<TabItem value="vanilla" label="Vanilla JS/TS">

**Cookies mode (no storage needed):**

```typescript
// auth.ts
import { NAuthClient } from '@nauth-toolkit/client';

export const authClient = new NAuthClient({
  baseUrl: 'https://api.yourapp.com/auth',
  tokenDelivery: 'cookies', // Cookies mode - no storage needed
  onSessionExpired: () => {
    // Handle session expiration - use your router for navigation
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  },
  onAuthStateChange: (user) => {
    // React to auth changes
    // Use your application's logger/telemetry here
  },
});
```

**JSON mode with localStorage (default):**

```typescript
import { NAuthClient, BrowserStorage } from '@nauth-toolkit/client';

export const authClient = new NAuthClient({
  baseUrl: 'https://api.yourapp.com/auth',
  tokenDelivery: 'json', // JSON mode requires storage
  storage: new BrowserStorage(), // Default for web apps (uses localStorage)
  onSessionExpired: () => {
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  },
});
```

**JSON mode with custom storage (e.g., Capacitor):**

```typescript
import { NAuthClient, NAuthStorageAdapter } from '@nauth-toolkit/client';
import { Preferences } from '@capacitor/preferences';

class CapacitorStorage implements NAuthStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }
  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }
  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
  async clear(): Promise<void> {
    await Preferences.clear();
  }
}

export const authClient = new NAuthClient({
  baseUrl: 'https://api.yourapp.com/auth',
  tokenDelivery: 'json',
  storage: new CapacitorStorage(), // Custom mobile storage
  onSessionExpired: () => {
    // Handle session expiration
  },
});
```

See [`NAuthStorageAdapter`](../api/types/nauth-storage-adapter) for interface details and more examples.

See [NAuthClient API](../api/nauth-client) and [Configuration](../concepts/configuration) for details.

```typescript
// main.ts
import { initAuth, authClient } from './auth';

async function bootstrap(): Promise<void> {
  // Initialize auth before rendering
  await initAuth();

  // Check if already logged in
  if (authClient.isAuthenticatedSync()) {
    // Use your application's logger/telemetry here
  }

  // Render your app
  renderApp();
}

bootstrap();
```

</TabItem>
<TabItem value="angular" label="Angular">

```typescript
// app.config.ts
import { ApplicationConfig, inject } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { NAUTH_CLIENT_CONFIG, authInterceptor } from '@nauth-toolkit/client-angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    {
      provide: NAUTH_CLIENT_CONFIG,
      useFactory: () => {
        const router = inject(Router);
        return {
          baseUrl: 'https://api.yourapp.com/auth',
          tokenDelivery: 'cookies',
          onSessionExpired: () => router.navigate(['/login']),
        };
      },
    },
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig);
```

Storage configuration for Angular is covered in the [Angular Integration Guide](../angular/overview). The `NAUTH_CLIENT_CONFIG` provider accepts a `storage` property for custom adapters when using JSON token delivery mode.

</TabItem>
<TabItem value="react" label="React">

```typescript
// auth/client.ts
import { NAuthClient } from '@nauth-toolkit/client';

// Cookies mode (default - no storage needed)
export const authClient = new NAuthClient({
  baseUrl: 'https://api.yourapp.com/auth',
  tokenDelivery: 'cookies',
  onSessionExpired: () => {
    // Use React Router for navigation
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  },
});

// JSON mode (requires storage adapter)
// import { BrowserStorage } from '@nauth-toolkit/client';
// export const authClient = new NAuthClient({
//   baseUrl: 'https://api.yourapp.com/auth',
//   tokenDelivery: 'json',
//   storage: new BrowserStorage(),
//   onSessionExpired: () => { /* ... */ },
// });
```

```typescript
// auth/AuthProvider.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authClient } from './client';
import { AuthUser } from '@nauth-toolkit/client';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  client: typeof authClient;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authClient.initialize().then(() => {
      setUser(authClient.getCurrentUser());
      setIsLoading(false);
    });

    // Listen for auth changes
    const handleStorage = () => {
      setUser(authClient.getCurrentUser());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        client: authClient,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

```typescript
// App.tsx
import { AuthProvider } from './auth/AuthProvider';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
```

</TabItem>
</Tabs>

## Step 3: Implement Login

Handle user authentication with email/password. The `login()` method returns an [`AuthResponse`](../api/types/auth-response) that may contain a challenge (email verification, MFA, etc.) or successful authentication with tokens. Always check for `challengeName` to handle multi-step flows.

<Tabs groupId="platform">
<TabItem value="vanilla" label="Vanilla JS/TS">

```typescript
import { authClient } from './auth';

async function handleLogin(email: string, password: string): Promise<void> {
  try {
    const response = await authClient.login(email, password);

    if (response.challengeName) {
      // User needs to complete a challenge
      handleChallenge(response);
    } else {
      // Login successful - use your router
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
    }
  } catch (error) {
    console.error('Login failed:', error.message);
  }
}

function handleChallenge(response: AuthResponse): void {
  // Store session for challenge pages
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('challengeSession', JSON.stringify(response));

    // Use your router for navigation
    const routes: Record<string, string> = {
      VERIFY_EMAIL: '/verify-email',
      VERIFY_PHONE: '/verify-phone',
      MFA_REQUIRED: '/mfa',
      MFA_SETUP_REQUIRED: '/mfa-setup',
      FORCE_CHANGE_PASSWORD: '/change-password',
    };

    const route = routes[response.challengeName!];
    if (route) {
      window.location.href = route;
    }
  }
}
```

</TabItem>
<TabItem value="angular" label="Angular">

```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@nauth-toolkit/client-angular';

@Component({
  selector: 'app-login',
  template: `
    <form (ngSubmit)="login()">
      <input [(ngModel)]="email" name="email" placeholder="Email" required />
      <input [(ngModel)]="password" name="password" type="password" required />
      @if (error) {
        <div class="error">{{ error }}</div>
      }
      <button [disabled]="loading">{{ loading ? 'Loading...' : 'Login' }}</button>
    </form>
  `,
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  login(): void {
    this.loading = true;
    this.error = '';

    this.auth.login(this.email, this.password).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.challengeName) {
          this.router.navigate(['/challenge', response.challengeName.toLowerCase()]);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.message;
      },
    });
  }
}
```

</TabItem>
<TabItem value="react" label="React">

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';

function LoginPage() {
  const { client } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await client.login(email, password);

      if (response.challengeName) {
        navigate(`/challenge/${response.challengeName.toLowerCase()}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      {error && <div className="error">{error}</div>}
      <button disabled={loading}>{loading ? 'Loading...' : 'Login'}</button>
    </form>
  );
}
```

</TabItem>
</Tabs>

## Step 4: Protect Routes

Protect routes that require authentication. You can use the built-in [`authGuard`](../angular/guards) (Angular) or implement your own route protection logic.

<Tabs groupId="platform">
<TabItem value="vanilla" label="Vanilla JS/TS">

```typescript
// router.ts (example with vanilla router)
function checkAuth(): boolean {
  return authClient.isAuthenticatedSync();
}

function protectedRoute(path: string, component: Component): void {
  if (!checkAuth()) {
    // Use your router for navigation
    if (typeof window !== 'undefined') {
      window.location.replace(`/login?returnUrl=${encodeURIComponent(path)}`);
    }
    return;
  }
  renderComponent(component);
}
```

</TabItem>
<TabItem value="angular" label="Angular">

Use the built-in [`authGuard`](../angular/guards) for automatic route protection:

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from '@nauth-toolkit/client-angular';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard()],
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard()],
  },
];
```

Or implement a custom guard with additional logic:

```typescript
// custom-auth.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '@nauth-toolkit/client-angular';

export const customAuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Redirect to login with return URL
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};
```

</TabItem>
<TabItem value="react" label="React">

```typescript
// ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
```

</TabItem>
</Tabs>

## Token Refresh

The SDK automatically handles token refresh for you. When using the Angular [`authInterceptor`](../angular/interceptor), expired access tokens are automatically refreshed in the background before retrying failed requests. The interceptor:

- Attaches authentication headers (Bearer tokens for JSON mode, CSRF tokens for cookies mode)
- Detects 401 responses and triggers token refresh
- Queues concurrent requests during refresh to prevent race conditions
- Synchronizes tokens across browser tabs using `localStorage` events (JSON mode)

For detailed information on token refresh strategies, cross-tab synchronization, and SSR considerations, see [Token Management](../concepts/token-management).

## Step 5: Handle Logout

Clear authentication state and redirect to login. The `logout()` method invalidates the session on the backend and clears local tokens.

<Tabs groupId="platform">
<TabItem value="vanilla" label="Vanilla JS/TS">

```typescript
async function handleLogout(): Promise<void> {
  await authClient.logout();
  // Use your router for navigation
  if (typeof window !== 'undefined') {
    window.location.replace('/login');
  }
}
```

</TabItem>
<TabItem value="angular" label="Angular">

```typescript
logout(): void {
  this.auth.logout().subscribe(() => {
    this.router.navigate(['/login']);
  });
}
```

</TabItem>
<TabItem value="react" label="React">

```typescript
const { client } = useAuth();

async function handleLogout() {
  await client.logout();
  navigate('/login');
}
```

</TabItem>
</Tabs>

## Next Steps

- [Challenge Handling](./challenge-handling) - Handle verification flows
- [Token Management](../concepts/token-management) - Token refresh and storage
- [Social Authentication](./social-auth) - OAuth integration
- [MFA Setup](./mfa-setup) - Multi-factor authentication
