---
title: Error Handling
description: Handle authentication errors in frontend applications using nauth-toolkit client SDK
keywords: [errors, error handling, NAuthClientError, error codes, retry, rate limiting]
image: /img/api-social-card.png
sidebar_position: 5
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Error Handling

All SDK methods throw `NAuthClientError` on failure. This page covers error patterns, common error codes, and retry strategies.

## NAuthClientError

Every error from the SDK is an instance of `NAuthClientError`:

```typescript
import { NAuthClientError } from '@nauth-toolkit/client';

try {
  await client.login(email, password);
} catch (err) {
  if (err instanceof NAuthClientError) {
    err.code;       // Error code string (e.g., 'AUTH_INVALID_CREDENTIALS')
    err.message;    // Human-readable message
    err.statusCode; // HTTP status (e.g., 401, 429)
    err.details;    // Additional context (optional)
  }
}
```

## Common Error Codes

### Authentication Errors

| Code | When | Status |
| ---- | ---- | ------ |
| `AUTH_INVALID_CREDENTIALS` | Wrong email or password | 401 |
| `AUTH_ACCOUNT_LOCKED` | Too many failed attempts | 423 |
| `AUTH_ACCOUNT_INACTIVE` | Account disabled by admin | 403 |
| `USER_NOT_FOUND` | Email not registered | 404 |
| `SIGNUP_EMAIL_EXISTS` | Signup with existing email | 409 |

### Challenge Errors

| Code | When | Status |
| ---- | ---- | ------ |
| `VERIFY_CODE_INVALID` | Wrong verification code | 400 |
| `VERIFY_CODE_EXPIRED` | Verification code expired | 400 |
| `CHALLENGE_EXPIRED` | Challenge session timed out | 401 |
| `CHALLENGE_MAX_ATTEMPTS` | Too many wrong codes | 429 |

### MFA Errors

| Code | When | Status |
| ---- | ---- | ------ |
| `MFA_SETUP_REQUIRED` | MFA setup required before login | 403 |

### Rate Limiting

| Code | When | Status |
| ---- | ---- | ------ |
| `RATE_LIMIT_LOGIN` | Login rate limit exceeded | 429 |

### Network Errors

| Code | When | Status |
| ---- | ---- | ------ |
| `NETWORK_ERROR` | Request failed (offline, timeout) | — |
| `REQUEST_TIMEOUT` | Request exceeded timeout | — |

## Error Handling Patterns

### Per-Action Error Handling

<Tabs groupId="platform">
<TabItem value="angular" label="Angular">

```typescript title="src/app/login/login.component.ts"
import { NAuthClientError } from '@nauth-toolkit/client';

async login(): Promise<void> {
  try {
    const response = await this.auth.login(this.email, this.password);
    if (response.challengeName) {
      this.router.navigate(['/auth/challenge']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  } catch (err) {
    if (err instanceof NAuthClientError) {
      switch (err.code) {
        case 'AUTH_INVALID_CREDENTIALS':
          this.error = 'Invalid email or password';
          break;
        case 'AUTH_ACCOUNT_LOCKED':
          this.error = 'Account locked. Try again later.';
          break;
        case 'RATE_LIMIT_LOGIN':
          this.error = 'Too many attempts. Please wait.';
          break;
        default:
          this.error = err.message;
      }
    }
  }
}
```

</TabItem>
<TabItem value="react" label="React">

```typescript title="src/pages/LoginPage.tsx"
import { NAuthClientError } from '@nauth-toolkit/client';

async function handleLogin(email: string, password: string) {
  try {
    const response = await login(email, password);
    if (response.challengeName) {
      navigate('/auth/challenge', { state: { challenge: response } });
    } else {
      navigate('/dashboard');
    }
  } catch (err) {
    if (err instanceof NAuthClientError) {
      switch (err.code) {
        case 'AUTH_INVALID_CREDENTIALS':
          setError('Invalid email or password');
          break;
        case 'AUTH_ACCOUNT_LOCKED':
          setError('Account locked. Try again later.');
          break;
        case 'RATE_LIMIT_LOGIN':
          setError('Too many attempts. Please wait.');
          break;
        default:
          setError(err.message);
      }
    }
  }
}
```

</TabItem>
</Tabs>

### Global Error Handler

Configure a global handler via the `onError` callback:

```typescript
const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  onError: (error) => {
    // Log to monitoring service
    if (error.code === 'NETWORK_ERROR') {
      showToast('Network error. Check your connection.');
    }
  },
});
```

### Rate Limiting

When you receive a rate limit error (HTTP 429), the response may include a `retryAfter` value in `details`:

```typescript
try {
  await client.resendCode(session);
} catch (err) {
  if (err instanceof NAuthClientError && err.statusCode === 429) {
    const retryAfter = (err.details as { retryAfter?: number })?.retryAfter ?? 60;
    setCountdown(retryAfter);
  }
}
```

## Checking Error Codes

Use the `isCode()` helper:

```typescript
try {
  await client.login(email, password);
} catch (err) {
  if (err instanceof NAuthClientError) {
    if (err.isCode('AUTH_INVALID_CREDENTIALS')) {
      // Handle invalid credentials
    }
  }
}
```

## Related Documentation

- [NAuthClientError API](../api/nauth-client-error) - Full error class reference
- [Challenge Handling](./challenge-handling) - Handle challenge-specific errors
- [Configuration](../concepts/configuration) - Global error callback
