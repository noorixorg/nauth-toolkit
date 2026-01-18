---
title: AuthEvent
description: Authentication lifecycle event data structure
keywords: [event, lifecycle, authentication, reactive]
image: /img/api-social-card.png
---

# AuthEvent

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Authentication lifecycle event emitted by the SDK throughout the authentication flow.

```typescript
import { AuthEvent } from '@nauth-toolkit/client';
```

## Structure

Authentication events use a discriminated union for type safety:

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

// Each event has a specific structure
interface AuthLoginEvent {
  type: 'auth:login';
  data: { identifier: string };
  timestamp: number;
}

interface AuthSuccessEvent {
  type: 'auth:success';
  data: AuthResponse;
  timestamp: number;
}

interface AuthErrorEvent {
  type: 'auth:error';
  data: NAuthClientError;
  timestamp: number;
}

// ... (other event types follow the same pattern)
```

## Properties

All events share these base properties:

| Property | Type | Description |
|----------|------|-------------|
| `type` | [`AuthEventType`](#autheventtype) | Event type identifier |
| `data` | Varies by event | Event-specific data (strongly typed per event) |
| `timestamp` | `number` | Event timestamp in milliseconds since epoch |

## AuthEventType

Event type enumeration:

```typescript
type AuthEventType =
  | 'auth:login'        // Login initiated
  | 'auth:signup'       // Signup initiated
  | 'auth:success'      // User successfully authenticated
  | 'auth:challenge'    // Challenge required (MFA, verification, etc.)
  | 'auth:error'        // Authentication failed
  | 'auth:logout'       // User logged out
  | 'auth:refresh'      // Token refresh attempted
  | 'oauth:started'     // Social login initiated
  | 'oauth:callback'    // OAuth callback detected
  | 'oauth:completed'   // OAuth flow completed
  | 'oauth:error';      // OAuth flow failed
```

## Event Data by Type

| Event Type | Data Type | Description |
|------------|-----------|-------------|
| `auth:login` | `{ identifier: string }` | Login initiated with identifier |
| `auth:signup` | `{ email: string }` | Signup initiated with email |
| `auth:success` | [`AuthResponse`](./auth-response) | Contains user and tokens |
| `auth:challenge` | [`AuthResponse`](./auth-response) | Contains `challengeName` and session |
| `auth:error` | [`NAuthClientError`](../nauth-client-error) | Error details |
| `auth:logout` | `{ forgetDevice: boolean, global: boolean }` | Logout flags |
| `auth:refresh` | `{ success: boolean }` | Token refresh result |
| `oauth:started` | `{ provider: string }` | OAuth provider name |
| `oauth:callback` | `{ provider: string }` | OAuth provider name |
| `oauth:completed` | [`AuthResponse`](./auth-response) | Authentication result |
| `oauth:error` | [`NAuthClientError`](../nauth-client-error) | Error details |

## Examples

### TypeScript

```typescript
import { AuthEvent } from '@nauth-toolkit/client';

// Event handler with full type safety
function handleAuthEvent(event: AuthEvent): void {
  switch (event.type) {
    case 'auth:login':
      // TypeScript knows data is { identifier: string }
      console.log('Login attempt:', event.data.identifier);
      break;

    case 'auth:success':
      // TypeScript knows data is AuthResponse
      console.log('User authenticated:', event.data.user);
      break;

    case 'auth:challenge':
      // TypeScript knows data is AuthResponse with challengeName
      console.log('Challenge required:', event.data.challengeName);
      break;

    case 'auth:error':
    case 'oauth:error':
      // TypeScript knows data is NAuthClientError
      console.error('Auth error:', event.data.message);
      break;

    case 'auth:logout':
      // TypeScript knows data is { forgetDevice: boolean, global: boolean }
      console.log('Logged out:', event.data.global ? 'globally' : 'session only');
      break;

    case 'auth:refresh':
      // TypeScript knows data is { success: boolean }
      console.log('Token refresh:', event.data.success ? 'success' : 'failed');
      break;
  }
}
```

### Angular

```typescript
import { Component, OnInit } from '@angular/core';
import { AuthService } from '@nauth-toolkit/client-angular';
import { AuthEvent } from '@nauth-toolkit/client';

@Component({ /* ... */ })
export class AppComponent implements OnInit {
  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.authEvents$.subscribe((event: AuthEvent) => {
      console.log('Event:', event.type, 'at', new Date(event.timestamp));

      // Type-safe event handling
      switch (event.type) {
        case 'auth:success':
          // TypeScript knows event.data is AuthResponse
          this.router.navigate(['/dashboard']);
          break;

        case 'auth:error':
          // TypeScript knows event.data is NAuthClientError
          this.toastr.error(event.data.message);
          break;

        case 'auth:refresh':
          // TypeScript knows event.data is { success: boolean }
          if (!event.data.success) {
            console.warn('Token refresh failed');
          }
          break;
      }
    });
  }
}
```

## Related Types

- [`AuthEventType`](#autheventtype) - Event type enumeration
- [`AuthResponse`](./auth-response) - Authentication response data
- [`NAuthClientError`](../nauth-client-error) - Error data
- [`AuthEventListener`](../nauth-client#event-methods) - Event listener callback type

## See Also

- [Authentication Events Guide](../../guides/authentication-events) - Complete event documentation
- [NAuthClient Events](../nauth-client#event-methods) - How to subscribe to events
- [AuthService Events](../../angular/auth-service#observables) - Angular Observable streams

