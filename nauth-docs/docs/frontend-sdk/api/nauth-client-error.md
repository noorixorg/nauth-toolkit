---
title: NAuthClientError
description: Client-side error class for SDK operations with structured error codes and metadata
keywords: [error, exception, handling, client, sdk, api]
image: /img/api-social-card.png
---

# NAuthClientError

**Package:** `@nauth-toolkit/client`
**Type:** Error Class

Client-side error class for all SDK operations, mirroring the backend `NAuthException` structure.

```typescript
import { NAuthClientError, NAuthErrorCode } from '@nauth-toolkit/client';
```

## Overview

`NAuthClientError` extends the standard JavaScript `Error` class and provides structured error information including machine-readable error codes, human-readable messages, optional metadata, and timestamps. This ensures consistent error handling across your application.

**Key Features:**
- Machine-readable error codes (`NAuthErrorCode` enum)
- Human-readable error messages
- Structured metadata in `details` object
- ISO 8601 timestamps
- Helper methods for type-safe error checking

## Properties

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `code` | `NAuthErrorCode` | Yes | Machine-readable error code for programmatic handling |
| `message` | `string` | Yes | Human-readable error message |
| `details` | `Record<string, unknown>` | No | Optional metadata (retryAfter, field names, etc.) |
| `timestamp` | `string` | Yes | ISO 8601 timestamp when error occurred |
| `statusCode` | `number` | No | HTTP status code from API response |
| `isNetworkError` | `boolean` | Yes | Whether error is due to network failure |
| `name` | `string` | Yes | Always `"NAuthClientError"` |
| `stack` | `string` | No | Stack trace (standard Error property) |

## Methods

### isCode()

Check if error matches a specific error code.

```typescript
isCode(code: NAuthErrorCode): boolean
```

**Parameters:**
- `code` - Error code to check against

**Returns:**
- `boolean` - True if the error code matches

**Example:**

```typescript
try {
  await client.login({ identifier: 'user@example.com', password: 'wrong' });
} catch (error) {
  if (error instanceof NAuthClientError && error.isCode(NAuthErrorCode.RATE_LIMIT_LOGIN)) {
    const retryAfter = error.details?.retryAfter as number;
    console.log(`Rate limited. Retry in ${retryAfter} seconds`);
  }
}
```

---

### getDetails()

Get error details/metadata.

```typescript
getDetails(): Record<string, unknown> | undefined
```

**Returns:**
- `Record<string, unknown> | undefined` - Error details if provided, `undefined` otherwise

**Example:**

```typescript
const details = error.getDetails();
if (details?.retryAfter) {
  console.log(`Retry after ${details.retryAfter} seconds`);
}
```

---

### getCode()

Get the error code.

```typescript
getCode(): NAuthErrorCode
```

**Returns:**
- `NAuthErrorCode` - The error code enum value

**Example:**

```typescript
const errorCode = error.getCode();
console.log(`Error code: ${errorCode}`);
```

---

### toJSON()

Serialize error to a plain object.

```typescript
toJSON(): {
  code: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
  statusCode?: number;
}
```

**Returns:**
- Plain object representation of the error

**Example:**

```typescript
try {
  await client.login({ identifier: 'user@example.com', password: 'wrong' });
} catch (error) {
  if (error instanceof NAuthClientError) {
    console.log(JSON.stringify(error.toJSON(), null, 2));
    // {
    //   "code": "AUTH_INVALID_CREDENTIALS",
    //   "message": "Invalid credentials",
    //   "timestamp": "2025-12-06T...",
    //   "statusCode": 401
    // }
  }
}
```

## Details Object Structure

The `details` object varies by error code. Common patterns:

### Rate Limiting Errors

```typescript
{
  retryAfter: number;      // Seconds until retry allowed
  maxAttempts?: number;    // Maximum attempts allowed
  currentCount?: number;   // Current attempt count
}
```

### Validation Errors

```typescript
{
  field?: string;          // Field that failed validation
  expected?: string;       // Expected value/format
  provided?: string;       // Actual value provided
  errors?: string[];       // Array of validation error messages
}
```

### Account Lock Errors

```typescript
{
  lockoutUntil?: string;   // ISO 8601 timestamp when lock expires
  retryAfter?: number;     // Seconds until retry allowed
}
```

### Challenge Errors

```typescript
{
  sessionId?: string;      // Challenge session ID
  expected?: string;       // Expected challenge type
  provided?: string;       // Actual challenge type provided
  attemptsRemaining?: number; // Remaining verification attempts
}
```

## Usage Examples

### Basic Error Handling

```typescript
import { NAuthClientError, NAuthErrorCode } from '@nauth-toolkit/client';

try {
  await client.login({
    identifier: 'user@example.com',
    password: 'SecurePass123!',
  });
} catch (error) {
  if (error instanceof NAuthClientError) {
    console.log('Error Code:', error.code);
    console.log('Message:', error.message);
    console.log('Details:', error.details);
    console.log('Timestamp:', error.timestamp);

    // Handle specific error codes
    switch (error.code) {
      case NAuthErrorCode.RATE_LIMIT_LOGIN:
        const retryAfter = error.details?.retryAfter as number;
        showNotification(`Too many attempts. Try again in ${retryAfter}s`);
        break;

      case NAuthErrorCode.AUTH_ACCOUNT_LOCKED:
        const lockoutUntil = error.details?.lockoutUntil as string;
        showNotification(`Account locked until ${new Date(lockoutUntil).toLocaleString()}`);
        break;

      case NAuthErrorCode.AUTH_INVALID_CREDENTIALS:
        showNotification('Invalid email or password');
        break;

      default:
        showNotification('Authentication error occurred');
    }
  }
}
```

### Type-Safe Error Checking

```typescript
// Using isCode() method for cleaner checks
if (error instanceof NAuthClientError) {
  if (error.isCode(NAuthErrorCode.RATE_LIMIT_SMS)) {
    // Handle SMS rate limit
    const retryAfter = error.details?.retryAfter as number;
    showRetryTimer(retryAfter);
  }
}
```

### Angular Error Handling

```typescript
export class LoginComponent {
  errorMessage: string = '';
  isRateLimited: boolean = false;
  retryAfter: number = 0;

  async login(email: string, password: string) {
    try {
      const response = await this.authService.login(email, password).toPromise();
      this.router.navigate(['/dashboard']);
    } catch (error) {
      if (error instanceof NAuthClientError) {
        this.handleAuthError(error);
      } else {
        this.errorMessage = 'An unexpected error occurred';
      }
    }
  }

  private handleAuthError(error: NAuthClientError) {
    if (error.isCode(NAuthErrorCode.RATE_LIMIT_LOGIN)) {
      this.isRateLimited = true;
      this.retryAfter = error.details?.retryAfter as number;
      this.errorMessage = `Too many attempts. Please wait ${this.retryAfter} seconds.`;
      this.startRetryTimer();
    } else if (error.isCode(NAuthErrorCode.AUTH_INVALID_CREDENTIALS)) {
      this.errorMessage = 'Invalid email or password';
    } else if (error.isCode(NAuthErrorCode.AUTH_ACCOUNT_LOCKED)) {
      this.errorMessage = 'Your account has been locked. Please contact support.';
    } else {
      this.errorMessage = error.message;
    }
  }

  private startRetryTimer() {
    const interval = setInterval(() => {
      this.retryAfter--;
      if (this.retryAfter <= 0) {
        this.isRateLimited = false;
        clearInterval(interval);
      }
    }, 1000);
  }
}
```

### Global Error Handler

```typescript
// error-handler.service.ts
@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private notificationService: NotificationService,
    private logger: LoggerService
  ) {}

  handleError(error: Error) {
    if (error instanceof NAuthClientError) {
      // Log error details
      this.logger.error('Auth Error', {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: error.timestamp,
        statusCode: error.statusCode,
      });

      // Show user-friendly notification
      const userMessage = this.getUserFriendlyMessage(error);
      this.notificationService.error(userMessage);

      // Handle specific error scenarios
      if (error.isCode(NAuthErrorCode.AUTH_TOKEN_EXPIRED)) {
        // Redirect to login
        window.location.href = '/login';
      }
    } else {
      // Handle other errors
      this.logger.error('Unexpected Error', error);
      this.notificationService.error('An unexpected error occurred');
    }
  }

  private getUserFriendlyMessage(error: NAuthClientError): string {
    const messages: Partial<Record<NAuthErrorCode, string>> = {
      [NAuthErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
      [NAuthErrorCode.RATE_LIMIT_LOGIN]: 'Too many login attempts. Please try again later.',
      [NAuthErrorCode.AUTH_ACCOUNT_LOCKED]: 'Your account has been locked. Contact support.',
      [NAuthErrorCode.VERIFY_CODE_INVALID]: 'Invalid verification code',
      [NAuthErrorCode.VERIFY_CODE_EXPIRED]: 'Verification code has expired',
      // ... add more mappings
    };

    return messages[error.code] || error.message || 'An error occurred';
  }
}
```

## Related Types

- [`NAuthErrorCode`](./types/nauth-error-code) - Complete error code enum
- [`NAuthError`](./types/nauth-error) - Error interface implemented by [`NAuthClientError`](./nauth-client-error)

## Related APIs

- [NAuthClient](./nauth-client) - All SDK methods throw [`NAuthClientError`](./nauth-client-error)
- [Angular AuthService](../angular/auth-service) - Observable-based error handling

## See Also

- [Backend Error Handling](/docs/concepts/error-handling) - Backend NAuthException reference
- [`NAuthErrorCode`](./types/nauth-error-code) - Complete error code enum with all values

