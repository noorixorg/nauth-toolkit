---
title: Authentication Events
description: Subscribe to authentication lifecycle events for reactive UI updates, analytics, and custom logic
sidebar_position: 4
keywords: [events, observables, reactive, lifecycle, analytics]
image: /img/api-social-card.png
---

# Authentication Events

The nauth-toolkit SDK emits events throughout the authentication lifecycle, allowing your application to react to auth state changes, track user behavior, and update the UI accordingly.

## Overview

Events are emitted for:
- **Authentication flows**: Login, signup, logout
- **Challenge flows**: MFA, email verification, password changes
- **OAuth flows**: Social login initiation, callbacks, completion
- **Token management**: Token refresh (via callbacks)
- **Errors**: Authentication failures, OAuth errors

## Available Events

| Event Type | When Emitted | Event Data |
|------------|--------------|------------|
| `auth:login` | Login initiated | `{ identifier: string }` |
| `auth:signup` | Signup initiated | `{ email: string }` |
| `auth:success` | User successfully authenticated | [`AuthResponse`](../api/types/auth-response) |
| `auth:challenge` | Challenge required (MFA, verification, etc.) | [`AuthResponse`](../api/types/auth-response) with `challengeName` |
| `auth:error` | Authentication failed | [`NAuthClientError`](../api/nauth-client-error) |
| `auth:logout` | User logged out | `{ forgetDevice: boolean, global: boolean }` |
| `auth:refresh` | Token refresh attempted | `{ success: boolean }` |
| `oauth:started` | Social login initiated | `{ provider: string }` |
| `oauth:callback` | OAuth callback detected | `{ provider: string }` |
| `oauth:completed` | OAuth flow completed | [`AuthResponse`](../api/types/auth-response) |
| `oauth:error` | OAuth flow failed | [`NAuthClientError`](../api/nauth-client-error) |

## Event Data Structure

All events are strongly typed using a discriminated union for type safety:

```typescript
type AuthEvent =
  | AuthLoginEvent
  | AuthSignupEvent
  | AuthSuccessEvent
  | AuthChallengeEvent
  | AuthErrorEvent
  | AuthLogoutEvent
  | AuthRefreshEvent
  | OAuthStartedEvent
  | OAuthCallbackEvent
  | OAuthCompletedEvent
  | OAuthErrorEvent;

// Example: Login event
interface AuthLoginEvent {
  type: 'auth:login';
  data: { identifier: string };
  timestamp: number;
}

// Example: Success event
interface AuthSuccessEvent {
  type: 'auth:success';
  data: AuthResponse;
  timestamp: number;
}

// Example: Error event
interface AuthErrorEvent {
  type: 'auth:error';
  data: NAuthClientError;
  timestamp: number;
}
```

Each event type has a specific payload structure, providing full type safety and autocomplete in TypeScript.

## Angular: Using AuthService Observables

The Angular `AuthService` exposes events as RxJS Observables, making it easy to integrate with Angular's reactive patterns.

### Available Observables

```typescript
import { AuthService } from '@nauth-toolkit/client/angular';

// All authentication events
authEvents$: Observable<AuthEvent>

// Filtered event streams
authSuccess$: Observable<AuthEvent>      // Only success events
authError$: Observable<AuthEvent>       // Only error events
```

### Basic Usage

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '@nauth-toolkit/client/angular';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  template: `...`,
})
export class AppComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    // Subscribe to all auth events
    this.subscriptions.add(
      this.auth.authEvents$.subscribe((event) => {
        console.log('Auth event:', event.type, event.data);

        switch (event.type) {
          case 'auth:success':
            this.handleAuthSuccess(event);
            break;
          case 'auth:challenge':
            this.handleChallenge(event);
            break;
          case 'auth:error':
          case 'oauth:error':
            this.handleError(event);
            break;
        }
      }),
    );

    // Or subscribe to specific event types
    this.subscriptions.add(
      this.auth.authSuccess$.subscribe((event) => {
        console.log('User authenticated:', event.data.user);
        this.analytics.track('login_success');
      }),
    );

    this.subscriptions.add(
      this.auth.authError$.subscribe((event) => {
        console.error('Auth error:', event.data.message);
        this.showErrorToast(event.data.message);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private handleAuthSuccess(event: AuthEvent): void {
    const response = event.data as AuthResponse;
    if (response.user) {
      this.router.navigate(['/dashboard']);
    }
  }

  private handleChallenge(event: AuthEvent): void {
    const response = event.data as AuthResponse;
    if (response.challengeName) {
      this.router.navigate(['/challenge', response.challengeName]);
    }
  }

  private handleError(event: AuthEvent): void {
    const error = event.data as NAuthClientError;
    this.toastr.error(error.message);
  }
}
```

### Challenge Detection

```typescript
@Component({ /* ... */ })
export class ChallengeRouterComponent implements OnInit {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Listen for challenge events
    this.auth.authEvents$
      .pipe(
        filter((e) => e.type === 'auth:challenge'),
        map((e) => e.data as AuthResponse),
      )
      .subscribe((response) => {
        switch (response.challengeName) {
          case 'VERIFY_EMAIL':
            this.router.navigate(['/verify-email']);
            break;
          case 'VERIFY_PHONE':
            this.router.navigate(['/verify-phone']);
            break;
          case 'MFA_REQUIRED':
            this.router.navigate(['/mfa']);
            break;
          case 'MFA_SETUP_REQUIRED':
            this.router.navigate(['/mfa-setup']);
            break;
          case 'FORCE_CHANGE_PASSWORD':
            this.router.navigate(['/change-password']);
            break;
        }
      });
  }
}
```

## Vanilla JS/TypeScript: Using NAuthClient

For vanilla JavaScript/TypeScript applications, use the `on()` method to subscribe to events.

### Basic Usage

```typescript
import { NAuthClient } from '@nauth-toolkit/client';

const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  // ... other config
});

// Subscribe to specific event
const unsubscribe = client.on('auth:success', (event) => {
  console.log('User logged in:', event.data.user);
  analytics.track('login_success', { method: 'password' });
});

// Subscribe to multiple events
client.on('auth:challenge', (event) => {
  const response = event.data as AuthResponse;
  if (response.challengeName === 'MFA_REQUIRED') {
    window.location.href = '/mfa';
  }
});

client.on('auth:error', (event) => {
  const error = event.data as NAuthClientError;
  showToast(error.message, 'error');
});

// Listen to all events
client.on('*', (event) => {
  console.log('Auth event:', event.type, event.timestamp);

  // Log to analytics
  analytics.track('auth_event', {
    type: event.type,
    timestamp: event.timestamp,
  });
});

// Unsubscribe when done
unsubscribe();
```

### OAuth Event Handling

```typescript
// Track OAuth flow
client.on('oauth:started', (event) => {
  console.log('OAuth started:', event.data.provider);
  analytics.track('oauth_started', { provider: event.data.provider });
});

client.on('oauth:callback', () => {
  console.log('OAuth callback received');
  showLoadingSpinner();
});

client.on('oauth:completed', (event) => {
  console.log('OAuth completed');
  hideLoadingSpinner();
  const response = event.data as AuthResponse;
  if (response.challengeName) {
    // Handle challenge
  } else {
    // Navigate to dashboard
    window.location.href = '/dashboard';
  }
});

client.on('oauth:error', (event) => {
  const error = event.data as NAuthClientError;
  console.error('OAuth failed:', error.message);
  showError(error.message);
});
```

## Common Use Cases

### 1. Analytics Tracking

```typescript
// Track all authentication events
client.on('*', (event) => {
  analytics.track('auth_event', {
    event_type: event.type,
    timestamp: event.timestamp,
    has_data: !!event.data,
  });
});

// Track specific events
client.on('auth:success', (event) => {
  const response = event.data as AuthResponse;
  analytics.track('user_login', {
    method: 'password', // or 'oauth'
    user_id: response.user?.sub,
  });
});
```

### 2. UI Updates

```typescript
// Show/hide loading states
client.on('oauth:started', () => {
  showLoadingOverlay('Redirecting to login provider...');
});

client.on('oauth:callback', () => {
  showLoadingOverlay('Completing authentication...');
});

client.on('oauth:completed', () => {
  hideLoadingOverlay();
});

client.on('oauth:error', () => {
  hideLoadingOverlay();
  showErrorDialog('Authentication failed. Please try again.');
});
```

### 3. Challenge Navigation

```typescript
// Auto-navigate based on challenge type
client.on('auth:challenge', (event) => {
  const response = event.data as AuthResponse;
  const challengeRoutes: Record<string, string> = {
    VERIFY_EMAIL: '/verify-email',
    VERIFY_PHONE: '/verify-phone',
    MFA_REQUIRED: '/mfa',
    MFA_SETUP_REQUIRED: '/mfa-setup',
    FORCE_CHANGE_PASSWORD: '/change-password',
  };

  const route = challengeRoutes[response.challengeName];
  if (route) {
    router.navigate([route]);
  }
});
```

### 4. Error Handling

```typescript
// Centralized error handling
client.on('auth:error', (event) => {
  const error = event.data as NAuthClientError;

  // Log error
  logger.error('Auth error', {
    code: error.code,
    message: error.message,
    timestamp: event.timestamp,
  });

  // Show user-friendly message
  const userMessage = getUserFriendlyMessage(error);
  toast.error(userMessage);

  // Track error
  analytics.track('auth_error', {
    error_code: error.code,
    error_message: error.message,
  });
});
```

## Event Timing

Events are emitted synchronously during the authentication flow:

1. **Login Flow**:
   - `auth:login` → Login initiated
   - `auth:success` or `auth:challenge` → Based on response
   - `auth:error` → On failure

2. **Signup Flow**:
   - `auth:signup` → Signup initiated
   - `auth:success` or `auth:challenge` → Based on response
   - `auth:error` → On failure

3. **OAuth Flow**:
   - `oauth:started` → User clicks social login
   - `oauth:callback` → OAuth provider redirects back
   - `auth:challenge` or `auth:success` → Based on response
   - `oauth:completed` → Flow completed
   - `oauth:error` → On any OAuth error

4. **Logout**:
   - `auth:logout` → Session cleared (data includes `forgetDevice` and `global` flags)

5. **Token Refresh**:
   - `auth:refresh` → Token refresh attempted (data includes `success` flag)

## Best Practices

### 1. Unsubscribe to Prevent Memory Leaks

```typescript
// Angular
ngOnDestroy(): void {
  this.subscriptions.unsubscribe();
}

// Vanilla JS
const unsubscribe = client.on('*', handler);
// Later...
unsubscribe();
```

### 2. Use Type Guards

```typescript
client.on('auth:success', (event) => {
  if (event.data && 'user' in event.data) {
    const response = event.data as AuthResponse;
    console.log('User:', response.user);
  }
});
```

### 3. Handle Errors Gracefully

```typescript
client.on('*', (event) => {
  try {
    // Your event handling logic
  } catch (error) {
    console.error('Error handling auth event:', error);
    // Don't let event handler errors break the app
  }
});
```

### 4. Debounce Rapid Events

```typescript
import { debounceTime } from 'rxjs/operators';

// Angular: Debounce rapid events
this.auth.authEvents$
  .pipe(debounceTime(100))
  .subscribe((event) => {
    // Handle event
  });
```

## Related Documentation

- [AuthService (Angular)](../angular/auth-service#observables) - Angular-specific event observables
- [NAuthClient](../api/nauth-client#event-methods) - Core client event methods
- [Social Auth Guide](./social-auth#event-driven-architecture) - OAuth event examples
- [Challenge Handling](./challenge-handling) - Challenge flow navigation

