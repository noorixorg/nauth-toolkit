---
title: 'Rate Limiting'
description: 'Configure brute-force protection, verification code limits, and password reset throttling in nauth-toolkit'
sidebar_position: 10
keywords: [rate limit, throttle, brute force, lockout, security, configuration]
image: /img/api-social-card.png
---

# Rate Limiting

Configure rate limiting to protect against brute-force attacks, verification code abuse, and password reset flooding. All rate limits work out of the box with sensible defaults --- this guide shows you how to tune them.

## Prerequisites

- A working auth setup ([Quick Start](/docs/quick-start/nestjs))
- A storage adapter configured (Redis recommended for production)

## Step 1: Configure IP-Based Lockout

Block IP addresses after too many failed login attempts:

```typescript title="config/auth.config.ts"
{
  lockout: {
    enabled: true,
    maxAttempts: 5,          // Block after 5 failed attempts
    attemptWindow: 3600,     // Count attempts within 1 hour
    duration: 900,           // Block IP for 15 minutes
    resetOnSuccess: true,    // Clear counter on successful login
  },
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Enable IP-based lockout |
| `maxAttempts` | `number` | `5` | Failed attempts before blocking |
| `attemptWindow` | `number` | `3600` | Window (seconds) for counting attempts |
| `duration` | `number` | `900` | How long (seconds) to block the IP |
| `resetOnSuccess` | `boolean` | `true` | Reset counter on successful login |

:::info[Why IP-based?]
Lockout tracks IP addresses, not user accounts. This prevents attackers from locking out legitimate users by guessing their email.
:::

## Step 2: Configure Verification Code Limits

Control how often users can request and attempt email/SMS verification codes:

```typescript title="config/auth.config.ts"
{
  signup: {
    emailVerification: {
      resendDelay: 60,           // 60s cooldown between resends
      rateLimitMax: 3,           // Max 3 codes per window
      rateLimitWindow: 3600,     // 1 hour window
      maxAttemptsPerUser: 10,    // Max 10 wrong-code attempts per user
      maxAttemptsPerIP: 20,      // Max 20 wrong-code attempts per IP
      attemptWindow: 3600,       // 1 hour attempt window
    },
    phoneVerification: {
      resendDelay: 60,
      rateLimitMax: 3,
      rateLimitWindow: 3600,
      maxAttemptsPerUser: 10,
      maxAttemptsPerIP: 20,
      attemptWindow: 3600,
    },
  },
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `resendDelay` | `number` | `60` | Minimum seconds between resend requests |
| `rateLimitMax` | `number` | `3` | Max codes per `rateLimitWindow` |
| `rateLimitWindow` | `number` | `3600` | Window (seconds) for code sending limit |
| `maxAttemptsPerUser` | `number` | `10` | Max wrong-code attempts per user |
| `maxAttemptsPerIP` | `number` | `20` | Max wrong-code attempts per IP |
| `attemptWindow` | `number` | `3600` | Window (seconds) for attempt limits |

:::tip[Resend delay vs rate limit]
`resendDelay` is a fixed cooldown between consecutive requests. `rateLimitMax` + `rateLimitWindow` is the total cap over a time period. Both work together.
:::

## Step 3: Configure Password Reset Limits

Prevent password reset flooding:

```typescript title="config/auth.config.ts"
{
  password: {
    passwordReset: {
      rateLimitMax: 3,        // Max 3 reset requests per window
      rateLimitWindow: 3600,  // 1 hour window
      maxAttempts: 3,         // Max 3 wrong-code attempts per code
      expiresIn: 900,         // Code expires in 15 minutes
    },
  },
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `rateLimitMax` | `number` | `3` | Max reset requests per `rateLimitWindow` |
| `rateLimitWindow` | `number` | `3600` | Window (seconds) for request limit |
| `maxAttempts` | `number` | `3` | Max wrong-code attempts per code |
| `expiresIn` | `number` | `900` | Code expiry (seconds) |

## Step 4: Handle Rate Limit Errors

Rate limit errors include `retryAfter` in the response details. Use this to show countdown timers in your frontend:

```json title="Example error response"
{
  "statusCode": 429,
  "code": "RATE_LIMIT_EMAIL",
  "message": "Too many verification code requests",
  "details": {
    "retryAfter": 3540,
    "resetAt": "2025-01-15T10:00:00.000Z"
  }
}
```

### Error Codes

| Error Code | HTTP Status | When |
|---|---|---|
| `AUTH_ACCOUNT_LOCKED` | 403 | IP blocked after too many failed logins |
| `RATE_LIMIT_LOGIN` | 429 | Login rate limit exceeded |
| `RATE_LIMIT_EMAIL` | 429 | Too many email verification code requests |
| `RATE_LIMIT_SMS` | 429 | Too many SMS verification code requests |
| `RATE_LIMIT_RESEND` | 429 | Resend delay not elapsed |
| `RATE_LIMIT_PASSWORD_RESET` | 429 | Too many password reset requests |

### Frontend Error Handling

```typescript title="Frontend example"
import { AuthErrorCode } from '@nauth-toolkit/client';

try {
  await authClient.resendVerificationCode();
} catch (error) {
  switch (error.code) {
    case AuthErrorCode.RATE_LIMIT_EMAIL:
    case AuthErrorCode.RATE_LIMIT_SMS:
      const seconds = error.details?.retryAfter ?? 60;
      showCountdownTimer(seconds);
      break;

    case AuthErrorCode.RATE_LIMIT_RESEND:
      showMessage('Please wait before requesting another code');
      break;

    case AuthErrorCode.ACCOUNT_LOCKED:
      const minutes = Math.ceil((error.details?.retryAfter ?? 900) / 60);
      showMessage(`Account locked. Try again in ${minutes} minutes.`);
      break;
  }
}
```

## Troubleshooting

**Users are getting locked out too quickly:**
1. Increase `lockout.maxAttempts` (e.g., 10 instead of 5)
2. Reduce `lockout.duration` (e.g., 300 instead of 900)
3. Ensure `resetOnSuccess: true` so successful logins clear the counter

**Verification codes exhausted too fast:**
1. Increase `rateLimitMax` (e.g., 5 instead of 3)
2. Reduce `resendDelay` (e.g., 30 instead of 60)
3. Check that `rateLimitWindow` matches your use case

**Rate limits not working in development:**
1. Verify a storage adapter is configured (in-memory storage works for dev)
2. Check that `lockout.enabled` is `true`
3. Rate limits require a consistent client IP --- behind a proxy, configure `trust proxy`

**Rate limits not shared across servers:**
1. Use Redis storage adapter for distributed deployments
2. Database storage also works but is slower
3. In-memory storage is per-process only --- **do not use in production**

## What's Next

- **[Storage](/docs/concepts/storage)** --- Redis vs database storage setup
- **[Error Handling](/docs/concepts/error-handling)** --- Exception handling patterns
- **[Configuration](/docs/concepts/configuration)** --- Full configuration reference
