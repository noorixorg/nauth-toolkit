---
title: NAuthException
description: Framework-agnostic authentication exception class with structured error codes, messages, and metadata for error handling across any transport layer.
keywords: [exception, error, authentication, error-handling, api, nauthexception]
image: /img/api-social-card.png
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# NAuthException

**Package:** `@nauth-toolkit/core`
**Type:** Exception Class

Framework-agnostic exception class for all authentication and authorization errors in nauth-toolkit.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { NAuthException, AuthErrorCode } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuthException, AuthErrorCode } from '@nauth-toolkit/express';
```

</TabItem>
</Tabs>

## Overview

`NAuthException` is a structured exception class that extends the standard JavaScript `Error` class (not `HttpException`). All nauth-toolkit services throw this exception type when errors occur, providing consistent error handling across your application.

**Key Features:**
- Machine-readable error codes (`AuthErrorCode` enum)
- Human-readable error messages
- Structured metadata in `details` object
- ISO 8601 timestamps
- Framework-agnostic (works with any transport layer)

:::tip Comprehensive Error Handling Guide
For complete error handling patterns, HTTP mapping, WebSocket examples, and best practices, see the [Error Handling Guide](/docs/concepts/error-handling).
:::

## Exception Structure

When caught, `NAuthException` has the following structure:

```typescript
{
  code: AuthErrorCode;        // Machine-readable error code (enum)
  message: string;            // Human-readable error message
  details?: Record<string, unknown>; // Optional metadata
  timestamp: string;          // ISO 8601 timestamp
  name: "NAuthException";     // Exception class name
  stack?: string;             // Stack trace
}
```

### Properties

| Property    | Type                      | Required | Description                               |
| ----------- | ------------------------- | -------- | ----------------------------------------- |
| `code`      | `AuthErrorCode` | ✅ Yes   | Machine-readable error code for programmatic handling |
| `message`   | `string`                  | ✅ Yes   | Human-readable error message              |
| `details`   | `Record<string, unknown>` | ❌ No    | Optional metadata (retryAfter, field names, etc.) |
| `timestamp` | `string`                  | ✅ Yes   | ISO 8601 timestamp when error occurred    |
| `name`      | `string`                  | ✅ Yes   | Always `"NAuthException"`                 |
| `stack`     | `string`                  | ❌ No    | Stack trace (standard Error property)     |

### Details Object Structure

The `details` object varies by error code. Common patterns:

**Rate Limiting Errors:**
```typescript
{
  retryAfter: number;      // Seconds until retry allowed
  maxAttempts?: number;    // Maximum attempts allowed
  currentCount?: number;   // Current attempt count
}
```

**Validation Errors:**
```typescript
{
  field?: string;          // Field that failed validation
  expected?: string;       // Expected value/format
  provided?: string;       // Actual value provided
  errors?: string[];       // Array of validation error messages
}
```

**Account Lock Errors:**
```typescript
{
  lockoutUntil?: string;   // ISO 8601 timestamp when lock expires
  retryAfter?: number;     // Seconds until retry allowed
}
```

**Challenge Errors:**
```typescript
{
  sessionId?: string;      // Challenge session ID
  expected?: string;       // Expected challenge type
  provided?: string;       // Actual challenge type provided
  attemptsRemaining?: number; // Remaining verification attempts
}
```

**Not Found Errors:**
```typescript
{
  userId?: string;         // User ID that was not found
  resourceType?: string;   // Type of resource not found
}
```

## Methods

### getCode()

Returns the error code.

**Signature:**

```typescript
getCode(): AuthErrorCode
```

**Returns:**

- `AuthErrorCode` - The error code

**Example:**

```typescript
const errorCode = exception.getCode();
// AuthErrorCode.RATE_LIMIT_SMS
```

---

### getDetails()

Returns the error details/metadata.

**Signature:**

```typescript
getDetails(): Record<string, unknown> | undefined
```

**Returns:**

- `Record<string, unknown> | undefined` - Error details if provided, `undefined` otherwise

**Example:**

```typescript
const details = exception.getDetails();
// { retryAfter: 3600, currentCount: 4, maxAttempts: 3 }
```

---

### isCode()

Checks if the exception matches a specific error code.

**Signature:**

```typescript
isCode(code: AuthErrorCode): boolean
```

**Parameters:**

- `code` - Error code to check against

**Returns:**

- `boolean` - `true` if the exception's code matches the provided code

**Example:**

```typescript
try {
  await sendSMS();
} catch (error) {
  if (error instanceof NAuthException && error.isCode(AuthErrorCode.RATE_LIMIT_SMS)) {
    // Handle rate limit specifically
    console.log('SMS rate limit exceeded');
  }
}
```

---

### toJSON()

Serializes the exception to a plain object.

**Signature:**

```typescript
toJSON(): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
```

**Returns:**

- `object` - Plain object representation of the exception

**Example:**

```typescript
catch (error) {
  if (error instanceof NAuthException) {
    console.log(error.toJSON());
    // {
    //   code: 'RATE_LIMIT_SMS',
    //   message: 'Too many verification SMS sent',
    //   details: { retryAfter: 3600, currentCount: 4 },
    //   timestamp: '2025-11-28T03:45:12.123Z'
    // }
  }
}
```

## Usage Example

### Basic Error Handling

```typescript
import { NAuthException, AuthErrorCode } from '@nauth-toolkit/nestjs';

try {
  await authService.login({
    identifier: 'user@example.com',
    password: 'SecurePass123!',
  });
} catch (error) {
  if (error instanceof NAuthException) {
    console.log('Error Code:', error.code);
    console.log('Message:', error.message);
    console.log('Details:', error.details);
    console.log('Timestamp:', error.timestamp);

    // Handle specific error codes
    switch (error.code) {
      case AuthErrorCode.RATE_LIMIT_LOGIN:
        const retryAfter = error.details?.retryAfter as number;
        console.log(`Too many attempts. Try again in ${retryAfter}s`);
        break;

      case AuthErrorCode.ACCOUNT_LOCKED:
        const lockoutUntil = error.details?.lockoutUntil as string;
        console.log(`Account locked until ${lockoutUntil}`);
        break;

      case AuthErrorCode.INVALID_CREDENTIALS:
        console.log('Invalid email or password');
        break;

      default:
        console.log('Authentication error occurred');
    }
  }
}
```

### Type-Safe Error Checking

```typescript
// Using isCode() method for cleaner checks
if (error instanceof NAuthException) {
  if (error.isCode(AuthErrorCode.RATE_LIMIT_SMS)) {
    // Handle SMS rate limit
    const retryAfter = error.details?.retryAfter as number;
    showRetryTimer(retryAfter);
  }
}
```

:::tip Complete Error Handling Patterns
For HTTP mapping, WebSocket handling, custom filters, and production-ready patterns, see the [Error Handling Guide](/docs/concepts/error-handling).
:::

## Related APIs

### Enums

- `AuthErrorCode` - All available error codes with descriptions (see TypeScript definitions)

### DTOs

- [ErrorResponseDTO](../dto/error-response-dto) - Standard error response format

### Services

All nauth-toolkit services throw `NAuthException`:
- [AuthService](../services/auth-service) - Core authentication operations
- [MFAService](../services/mfa-service) - Multi-factor authentication
- [EmailVerificationService](../services/email-verification-service) - Email verification
- [PhoneVerificationService](../services/phone-verification-service) - Phone verification
- [SocialAuthService](../services/social-auth-service) - Social authentication

## See Also

- [Error Handling Guide](/docs/concepts/error-handling) - Complete patterns, HTTP mapping, filters, and best practices
- `AuthErrorCode` - Full list of error codes (see TypeScript definitions)
