---
title: NAuthErrorCode
description: Enum of standardized authentication error codes
sidebar_position: 250
keywords: [error, code, enum, api]
image: /img/api-social-card.png
---

# NAuthErrorCode

**Package:** `@nauth-toolkit/client`
**Type:** Enum

Enumeration of standardized error codes returned by the SDK. Mirrors backend error codes for consistent error handling.

```typescript
import { NAuthErrorCode } from '@nauth-toolkit/client';
```

## Categories

### Authentication Errors

| Code                        | Description              |
| --------------------------- | ------------------------ |
| `AUTH_INVALID_CREDENTIALS`  | Wrong email/password     |
| `AUTH_ACCOUNT_LOCKED`       | Account locked           |
| `AUTH_ACCOUNT_INACTIVE`     | Account deactivated      |
| `AUTH_TOKEN_EXPIRED`        | Access token expired     |
| `AUTH_TOKEN_INVALID`        | Token invalid/revoked    |
| `AUTH_BEARER_NOT_ALLOWED`   | Bearer token not allowed |
| `AUTH_COOKIES_NOT_ALLOWED`  | Cookies not allowed      |
| `AUTH_CSRF_TOKEN_INVALID`   | CSRF token invalid       |
| `AUTH_CSRF_TOKEN_MISSING`   | CSRF token missing       |
| `AUTH_TOKEN_REUSE_DETECTED` | Token reuse detected     |
| `AUTH_SESSION_NOT_FOUND`    | Session not found        |
| `AUTH_SESSION_EXPIRED`      | Session expired          |

### Signup Errors

| Code                     | Description                        |
| ------------------------ | ---------------------------------- |
| `SIGNUP_DISABLED`        | Signup disabled                    |
| `SIGNUP_EMAIL_EXISTS`    | Email already registered           |
| `SIGNUP_USERNAME_EXISTS` | Username already exists            |
| `SIGNUP_PHONE_EXISTS`    | Phone already registered           |
| `SIGNUP_WEAK_PASSWORD`   | Password doesn't meet requirements |
| `SIGNUP_PHONE_REQUIRED`  | Phone required                     |
| `SIGNUP_NOT_ALLOWED`     | Signup not allowed                 |

### Verification Errors

| Code                       | Description               |
| -------------------------- | ------------------------- |
| `VERIFY_CODE_INVALID`      | Verification code invalid |
| `VERIFY_CODE_EXPIRED`      | Verification code expired |
| `VERIFY_TOO_MANY_ATTEMPTS` | Too many attempts         |
| `VERIFY_ALREADY_VERIFIED`  | Already verified          |

### MFA Errors

| Code                      | Description                    |
| ------------------------- | ------------------------------ |
| `MFA_SETUP_REQUIRED`      | MFA setup required             |
| `MFA_INVALID_CODE`        | MFA code is incorrect          |
| `MFA_CODE_EXPIRED`        | MFA code has expired           |
| `MFA_DEVICE_NOT_FOUND`    | MFA device doesn't exist       |
| `MFA_SETUP_INVALID`       | MFA setup verification failed  |
| `VERIFICATION_CODE_INVALID` | TOTP verification code invalid |

### Rate Limit Errors

| Code                | Description         |
| ------------------- | ------------------- |
| `RATE_LIMIT_SMS`    | SMS rate limited    |
| `RATE_LIMIT_EMAIL`  | Email rate limited  |
| `RATE_LIMIT_LOGIN`  | Login rate limited  |
| `RATE_LIMIT_RESEND` | Resend rate limited |

### Social Auth Errors

| Code                       | Description            |
| -------------------------- | ---------------------- |
| `SOCIAL_TOKEN_INVALID`     | Social token invalid   |
| `SOCIAL_ACCOUNT_LINKED`    | Account already linked |
| `SOCIAL_CONFIG_MISSING`    | Social config missing  |
| `SOCIAL_EMAIL_REQUIRED`    | Email required         |
| `SOCIAL_ACCOUNT_NOT_FOUND` | Account not found      |

### Challenge Errors

| Code                          | Description             |
| ----------------------------- | ----------------------- |
| `CHALLENGE_EXPIRED`           | Challenge expired       |
| `CHALLENGE_INVALID`           | Challenge invalid       |
| `CHALLENGE_TYPE_MISMATCH`     | Challenge type mismatch |
| `CHALLENGE_MAX_ATTEMPTS`      | Max attempts reached    |
| `CHALLENGE_ALREADY_COMPLETED` | Challenge completed     |

### Validation Errors

| Code                          | Description          |
| ----------------------------- | -------------------- |
| `VALIDATION_FAILED`           | Validation failed    |
| `VALIDATION_INVALID_PHONE`    | Invalid phone format |
| `VALIDATION_INVALID_EMAIL`    | Invalid email format |
| `VALIDATION_INVALID_PASSWORD` | Invalid password     |

### Password Errors

| Code                          | Description                 |
| ----------------------------- | --------------------------- |
| `PASSWORD_INCORRECT`          | Password incorrect          |
| `PASSWORD_REUSED`             | Password reused             |
| `PASSWORD_CHANGE_NOT_ALLOWED` | Password change not allowed |

### Adaptive MFA

| Code                       | Description                 |
| -------------------------- | --------------------------- |
| `SIGNIN_BLOCKED_HIGH_RISK` | Sign-in blocked (high risk) |

### General Errors

| Code                  | Description         |
| --------------------- | ------------------- |
| `RESOURCE_NOT_FOUND`  | Resource not found  |
| `FORBIDDEN`           | Forbidden           |
| `INTERNAL_ERROR`      | Internal error      |
| `SERVICE_UNAVAILABLE` | Service unavailable |

## Example

```typescript
import { NAuthErrorCode } from '@nauth-toolkit/client';

try {
  await client.login('user@example.com', 'password');
} catch (error) {
  if (error instanceof NAuthClientError) {
    switch (error.code) {
      case NAuthErrorCode.AUTH_INVALID_CREDENTIALS:
        console.log('Wrong credentials');
        break;
      case NAuthErrorCode.RATE_LIMIT_LOGIN:
        const retryAfter = error.details?.retryAfter as number;
        console.log(`Rate limited. Retry in ${retryAfter}s`);
        break;
    }
  }
}
```

## Used By

- [NAuthClientError](../nauth-client-error) - Error class uses [`NAuthErrorCode`](./nauth-error-code) enum
- [NAuthError](./nauth-error) - Error interface includes [`NAuthErrorCode`](./nauth-error-code)

## Related Types

- [`NAuthError`](./nauth-error) - Error interface
- [`NAuthClientError`](../nauth-client-error) - Error class implementation
