---
title: OAuth Callback
description: Handle OAuth redirect callbacks in React with nauth-toolkit
keywords: [react, oauth, callback, social login, redirect]
image: /img/api-social-card.png
sidebar_position: 3
---

# OAuth Callback

Handle the redirect from OAuth providers (Google, Apple, Facebook) back to your React app.

## Callback Page

```typescript title="src/pages/OAuthCallbackPage.tsx"
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleOAuthCallback, challenge } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(searchParams.get('error_description') || 'OAuth login failed');
      return;
    }

    handleOAuthCallback()
      .then(({ user, needsChallenge }) => {
        if (needsChallenge) {
          navigate('/auth/challenge', { replace: true });
        } else if (user) {
          navigate('/dashboard', { replace: true });
        } else {
          setError('Authentication failed');
        }
      })
      .catch((err) => {
        setError(err.message);
      });
  }, []);

  if (error) {
    return (
      <div>
        <p>{error}</p>
        <button onClick={() => navigate('/login')}>Back to Login</button>
      </div>
    );
  }

  return <div className="spinner" />;
}
```

## How It Works

After the user authorizes with the OAuth provider, the backend redirects to your callback URL with query parameters:

- **Cookie mode**: Auth cookies are already set. The callback page calls `getProfile()` to hydrate state.
- **JSON/Hybrid mode**: The URL contains an `exchangeToken` parameter. The callback page calls `exchangeSocialRedirect(exchangeToken)` to complete authentication.

If MFA is required after social login, the response contains a `challengeName` and the callback navigates to the challenge page.

## Route Configuration

Register the callback route:

```typescript title="src/App.tsx"
<Route path="/auth/callback" element={<OAuthCallbackPage />} />
```

## Initiating Social Login

From your login page, call `loginWithGoogle` (or build similar methods for Apple/Facebook):

```typescript title="src/pages/LoginPage.tsx"
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { loginWithGoogle } = useAuth();

  return (
    <div>
      {/* Email/password form... */}
      <button onClick={loginWithGoogle}>Sign in with Google</button>
    </div>
  );
}
```

The `loginWithSocial` method in the context is configured with:

```typescript
client.loginWithSocial('google', {
  returnTo: `${window.location.origin}/auth/callback`,
  oauthParams: { prompt: 'select_account' },
});
```

:::note
The `returnTo` URL must match the redirect URI configured in your OAuth provider settings and backend configuration.
:::

## Related Documentation

- [Setup & Context](./setup) - AuthContext with `handleOAuthCallback`
- [Social Authentication](../guides/social-auth) - Full social auth guide
- [Challenge Handling](../guides/challenge-handling) - Handle MFA after social login
