---
title: Protected Routes
description: Protect React routes with authentication using nauth-toolkit
keywords: [react, routes, guard, protected, authentication]
image: /img/api-social-card.png
sidebar_position: 2
---

# Protected Routes

A wrapper component that redirects unauthenticated users to the login page.

## ProtectedRoute Component

```typescript title="src/components/ProtectedRoute.tsx"
import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-layout">
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

## Usage

Wrap any route that requires authentication:

```typescript title="src/App.tsx"
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/profile"
  element={
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  }
/>
```

## With Return URL

To redirect back to the protected page after login:

```typescript title="src/components/ProtectedRoute.tsx"
import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="spinner" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

Then in the login page, redirect back after successful authentication:

```typescript title="src/pages/LoginPage.tsx"
const location = useLocation();
const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';

// After successful login:
navigate(from, { replace: true });
```

## Related Documentation

- [Setup & Context](./setup) - Initialize the SDK in React
- [OAuth Callback](./oauth-callback) - Handle social login redirects
- [Challenge Handling](../guides/challenge-handling) - Verification flows
