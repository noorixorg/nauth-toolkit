# Authentication Event System Improvements

## Overview

Enhanced the authentication event system to use discriminated union types for full type safety and consistency, following professional SDK patterns.

## Changes Made

### 1. Type System Refactoring (`packages/client/src/core/events.ts`)

**Before:**
```typescript
interface AuthEvent<T = unknown> {
  type: AuthEventType;
  data?: T;
  timestamp: number;
}
```

**After:**
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

// Each event has strongly typed data
interface AuthLoginEvent {
  type: 'auth:login';
  data: { identifier: string };
  timestamp: number;
}
```

**Benefits:**
- Full TypeScript type safety
- Autocomplete support for event data
- No need for type assertions (`as`)
- Compile-time error detection

### 2. Event Emission Coverage (`packages/client/src/core/client.ts`)

Added event emissions for all authentication operations:

#### Login Flow
- `auth:login` - Emitted when login is initiated
- `auth:success` / `auth:challenge` - Emitted based on response
- `auth:error` - Emitted on failure

#### Signup Flow
- `auth:signup` - Emitted when signup is initiated
- `auth:success` / `auth:challenge` - Emitted based on response
- `auth:error` - Emitted on failure

#### Logout
- `auth:logout` - Emitted with `{ forgetDevice, global }` flags

#### Token Refresh
- `auth:refresh` - Emitted with `{ success: boolean }` result

#### OAuth Flow (already implemented)
- `oauth:started` - Provider name included
- `oauth:callback` - Provider name now included (was `null`)
- `oauth:completed` / `oauth:error` - As before

### 3. Sample App Event Logging (`examples/sample-angular/src/app/app.ts`)

Added global event listeners for debugging and monitoring:

```typescript
ngOnInit(): void {
  // Subscribe to all authentication events for logging
  this.subscriptions.add(
    this.auth.authEvents$.subscribe((event) => {
      console.group(`🔐 Auth Event: ${event.type}`);
      console.log('Timestamp:', new Date(event.timestamp).toISOString());
      console.log('Data:', event.data);
      console.groupEnd();
    }),
  );

  // Subscribe to success events
  this.subscriptions.add(
    this.auth.authSuccess$.subscribe((event) => {
      console.log('✅ Authentication successful', event.data);
    }),
  );

  // Subscribe to error events
  this.subscriptions.add(
    this.auth.authError$.subscribe((event) => {
      console.error('❌ Authentication error', event.data);
    }),
  );
}
```

### 4. Documentation Updates

Updated all authentication event documentation:

#### `nauth-docs/docs/frontend-sdk/guides/authentication-events.md`
- Added new event types (`auth:login`, `auth:signup`, `auth:refresh`)
- Updated event data table with strongly typed payloads
- Replaced generic example with discriminated union
- Updated event timing section

#### `nauth-docs/docs/frontend-sdk/api/types/auth-event.md`
- Replaced generic interface with discriminated union
- Updated all examples to showcase type safety
- Added more comprehensive examples with switch statements
- Updated event data table

## New Event Types

| Event Type | When Emitted | Data Type |
|------------|--------------|-----------|
| `auth:login` | Login initiated | `{ identifier: string }` |
| `auth:signup` | Signup initiated | `{ email: string }` |
| `auth:refresh` | Token refresh attempted | `{ success: boolean }` |

## Updated Event Data

| Event Type | Old Data | New Data |
|------------|----------|----------|
| `auth:logout` | `null` | `{ forgetDevice: boolean, global: boolean }` |
| `oauth:callback` | `null` | `{ provider: string }` |

## Type Safety Example

**Before (requires type assertions):**
```typescript
client.on('auth:success', (event) => {
  const response = event.data as AuthResponse; // Manual assertion needed
  console.log(response.user);
});
```

**After (fully type-safe):**
```typescript
client.on('auth:success', (event) => {
  // TypeScript knows event.data is AuthResponse
  console.log(event.data.user); // No assertion needed
});
```

## Testing

To test the event system:

1. Start the sample Angular app
2. Open browser console
3. Perform authentication actions (login, signup, logout)
4. Observe structured event logs with timestamps and data

Example console output:
```
🔐 Auth Event: auth:login
  Timestamp: 2025-12-07T22:30:00.000Z
  Data: { identifier: 'user@example.com' }

🔐 Auth Event: auth:success
  Timestamp: 2025-12-07T22:30:01.234Z
  Data: { user: {...}, tokens: {...} }
✅ Authentication successful {...}
```

## Build Status

- ✅ Client package builds successfully
- ✅ Angular sample app builds successfully
- ✅ All TypeScript types validated
- ✅ No linter errors

## Related Documentation

- [Authentication Events Guide](../nauth-docs/docs/frontend-sdk/guides/authentication-events.md)
- [AuthEvent Type Reference](../nauth-docs/docs/frontend-sdk/api/types/auth-event.md)
- [Angular AuthService Events](../nauth-docs/docs/frontend-sdk/angular/auth-service.md)

## Migration Guide

If you were using the old event system:

```typescript
// Old way (still works, but not recommended)
client.on('auth:success', (event) => {
  const response = event.data as AuthResponse;
});

// New way (fully type-safe)
client.on('auth:success', (event) => {
  // event.data is automatically typed as AuthResponse
  console.log(event.data.user);
});
```

No breaking changes - the API surface remains the same, but you now get full type safety.





