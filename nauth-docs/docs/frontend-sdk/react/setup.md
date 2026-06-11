---
title: Setup & Context
description: Integrate nauth-toolkit into a React application with Context and hooks
keywords: [react, context, hooks, setup, authentication, provider]
image: /img/api-social-card.png
sidebar_position: 1
---

# React Setup & Context

Integrate `@nauth-toolkit/client` into a React application using Context and hooks. The SDK is framework-agnostic — no React-specific package needed.

:::note Sample Application
A complete working example is available at [github.com/noorixorg/nauth-toolkit/tree/main/examples/starter-react](https://github.com/noorixorg/nauth-toolkit/tree/main/examples/starter-react) — React + Vite with Auth context, protected routes, Google OAuth, and challenge handling.
:::

## Installation

```bash npm2yarn
npm install @nauth-toolkit/client
```

## Step 1: Configure the Client

Disable SDK-driven hard redirects so React Router controls all navigation:

```typescript title="src/config/auth.config.ts"
import type { NAuthClientConfig } from '@nauth-toolkit/client';

const authConfig: NAuthClientConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  authPathPrefix: '/auth',
  tokenDelivery: 'cookies',
  debug: import.meta.env.DEV,

  csrf: {
    cookieName: 'nauth_csrf_token',
    headerName: 'x-csrf-token',
  },

  // Disable SDK auto-navigation — let React Router handle all routing.
  // Without this, the SDK calls window.location.replace() after login/challenge,
  // which causes full page reloads and loses React state.
  onAuthResponse: () => {},
  redirects: {
    sessionExpired: '/login',
    oauthError: '/login',
  },
};

export default authConfig;
```

## Step 2: Create a Refreshing HTTP Adapter

The SDK's built-in `FetchAdapter` does not retry after 401. Wrap it to add automatic token refresh:

```typescript title="src/lib/authHttpAdapter.ts"
import {
  FetchAdapter,
  NAuthClientError,
  type HttpAdapter,
  type HttpRequest,
  type HttpResponse,
  type NAuthClient,
} from '@nauth-toolkit/client';

export class RefreshingFetchAdapter implements HttpAdapter {
  private readonly inner = new FetchAdapter();
  private client: NAuthClient | null = null;
  private refreshPromise: Promise<void> | null = null;

  /** Wire up the client after construction to avoid circular dependency. */
  setClient(client: NAuthClient): void {
    this.client = client;
  }

  async request<T>(config: HttpRequest): Promise<HttpResponse<T>> {
    try {
      return await this.inner.request<T>(config);
    } catch (err) {
      const is401 = err instanceof NAuthClientError && err.statusCode === 401;
      const isRefreshEndpoint = config.url.includes('/refresh');

      if (is401 && !isRefreshEndpoint && this.client) {
        await this.doRefresh();
        return this.inner.request<T>(config);
      }

      throw err;
    }
  }

  /** Ensures only one refresh request is in flight at a time. */
  private doRefresh(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.client!
        .refreshTokens()
        .then(() => undefined)
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }
}
```

## Step 3: Create AuthContext

The context creates the SDK client once and subscribes to its events to keep React state in sync:

```typescript title="src/context/AuthContext.tsx"
import {
  createContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  NAuthClient,
  type AuthUser,
  type AuthResponse,
  type ChallengeResponse,
  type SignupRequest,
  type GetSetupDataResponse,
} from '@nauth-toolkit/client';
import authConfig from '../config/auth.config';
import { RefreshingFetchAdapter } from '../lib/authHttpAdapter';

export interface AuthContextValue {
  user: AuthUser | null;
  challenge: AuthResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<AuthResponse>;
  signup: (data: SignupRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  respondToChallenge: (response: ChallengeResponse) => Promise<AuthResponse>;
  resendCode: (session: string) => Promise<{ destination: string }>;
  getSetupData: (session: string, method: string) => Promise<GetSetupDataResponse>;
  loginWithGoogle: () => Promise<void>;
  handleOAuthCallback: () => Promise<{
    user: AuthUser | null;
    needsChallenge: boolean;
  }>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [challenge, setChallenge] = useState<AuthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Create adapter and client once via refs to survive re-renders.
  const adapterRef = useRef<RefreshingFetchAdapter | null>(null);
  const clientRef = useRef<NAuthClient | null>(null);
  if (!adapterRef.current) {
    adapterRef.current = new RefreshingFetchAdapter();
  }
  const adapter = adapterRef.current;
  if (!clientRef.current) {
    clientRef.current = new NAuthClient({ ...authConfig, httpAdapter: adapter });
    adapter.setClient(clientRef.current);
  }
  const client = clientRef.current;

  useEffect(() => {
    let mounted = true;

    // Subscribe to SDK events so React state stays in sync.
    const unsubSuccess = client.on('auth:success', () => {
      if (!mounted) return;
      setChallenge(null);
      const currentUser = client.getCurrentUser();
      if (currentUser) setUser(currentUser);
      client.getProfile().then(
        (profile) => { if (mounted) setUser(profile); },
        () => { if (mounted) setUser(client.getCurrentUser()); },
      );
    });

    const unsubChallenge = client.on('auth:challenge', (event) => {
      if (!mounted) return;
      setChallenge((event.data as AuthResponse) ?? null);
    });

    const unsubLogout = client.on('auth:logout', () => {
      if (!mounted) return;
      setUser(null);
      setChallenge(null);
    });

    const unsubExpired = client.on('auth:session_expired', () => {
      if (!mounted) return;
      setUser(null);
      setChallenge(null);
    });

    // Hydrate from storage on startup.
    (async () => {
      await client.initialize();
      if (!mounted) return;
      const current = client.getCurrentUser();
      if (current) {
        try {
          const profile = await client.getProfile();
          if (mounted) setUser(profile);
        } catch {
          if (mounted) setUser(current);
        }
      }
      const storedChallenge = await client.getStoredChallenge();
      if (mounted) {
        setChallenge(storedChallenge);
        setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
      unsubSuccess();
      unsubChallenge();
      unsubLogout();
      unsubExpired();
    };
  }, []);

  const handleOAuthCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) return { user: null, needsChallenge: false };

    const exchangeToken = params.get('exchangeToken');
    if (exchangeToken) {
      const response = await client.exchangeSocialRedirect(exchangeToken);
      if (response.challengeName) {
        setChallenge(response);
        return { user: null, needsChallenge: true };
      }
      const profileUser = await client.getProfile();
      setUser(profileUser);
      return { user: profileUser, needsChallenge: false };
    } else {
      const profileUser = await client.getProfile();
      setUser(profileUser);
      return { user: profileUser, needsChallenge: false };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        challenge,
        isLoading,
        isAuthenticated: !!user,
        login: (email, password) => client.login(email, password),
        signup: (data) => client.signup(data),
        logout: () => client.logout(),
        respondToChallenge: (response) => client.respondToChallenge(response),
        resendCode: (session) => client.resendCode(session),
        getSetupData: (session, method) =>
          client.getSetupData(session, method as Parameters<typeof client.getSetupData>[1]),
        loginWithGoogle: () =>
          client.loginWithSocial('google', {
            returnTo: `${window.location.origin}/auth/callback`,
            oauthParams: { prompt: 'select_account' },
          }),
        handleOAuthCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
```

## Step 4: Create useAuth Hook

```typescript title="src/hooks/useAuth.ts"
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
```

## Step 5: Wire Up Routes

```typescript title="src/App.tsx"
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ChallengePage } from './pages/ChallengePage';
import { MfaSetupPage } from './pages/MfaSetupPage';
import { DashboardPage } from './pages/DashboardPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/challenge" element={<ChallengePage />} />
        <Route path="/auth/mfa-setup" element={<MfaSetupPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
```

## Key Patterns

### Why `onAuthResponse: () => {}`?

The SDK has a built-in `ChallengeRouter` that calls `window.location.replace()` after login or challenge responses. This conflicts with React Router — it causes full page reloads and loses route state. Setting `onAuthResponse` to a no-op hands navigation control to your React components.

### Why `useRef` for the Client?

React StrictMode and re-renders would create multiple `NAuthClient` instances. Using `useRef` ensures one client exists for the lifetime of the app.

### Event-Driven State

The SDK emits events (`auth:success`, `auth:challenge`, `auth:logout`, `auth:session_expired`). The context subscribes to these and updates React state, so `useAuth()` always reflects the current auth status.

## Related Documentation

- [Protected Routes](./protected-routes) - Route guard wrapper
- [OAuth Callback](./oauth-callback) - Handle social login redirects
- [Challenge Handling](../guides/challenge-handling) - Verification flows
- [Configuration](../concepts/configuration) - All configuration options
