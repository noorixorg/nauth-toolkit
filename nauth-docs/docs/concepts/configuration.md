---
title: Configuration
description: Complete configuration guide for nauth-toolkit
sidebar_position: 6
---

# Configuration

This page provides a complete reference for configuring nauth-toolkit, including all available options and best practices.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Configuration File Approach

**Best Practice:** Store your configuration in a separate file, not in your `AppModule` or `main.ts`.

This keeps your configuration organized, testable, and easy to maintain across environments.

:::tip Configuration Sources
Load sensitive values (secrets, credentials) from your preferred configuration source:

- Environment variables (`process.env`)
- NestJS ConfigService
- AWS Secrets Manager / Azure Key Vault
- Configuration files (`.env`, `config.json`)

The toolkit is agnostic to how you manage configuration - use what works best for your infrastructure.
:::

<Tabs>
  <TabItem value="nestjs" label="NestJS" default>

**1. Create configuration file:**

```typescript title="src/config/auth.config.ts"
import { NAuthModuleConfig } from '@nauth-toolkit/nestjs';
import { createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
import { Logger } from '@nestjs/common';

export const authConfig: NAuthModuleConfig = {
  jwt: {
    algorithm: 'HS256',
    accessToken: {
      secret: 'your-secret-key', // Load from your config source
      expiresIn: '15m',
    },
    refreshToken: {
      secret: 'your-refresh-secret', // Load from your config source
      expiresIn: '7d',
    },
  },

  storageAdapter: createRedisStorageAdapter('redis://localhost:6379'),

  emailProvider: new NodemailerEmailProvider({
    transport: {
      host: 'smtp.example.com',
      port: 587,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-password',
      },
    },
    defaults: {
      from: 'My App <noreply@example.com>',
    },
  }),

  logger: new Logger('NAuth'),
};
```

**2. Import in AppModule:**

```typescript title="src/app.module.ts"
import { Module } from '@nestjs/common';
import { AuthModule } from '@nauth-toolkit/nestjs';
import { authConfig } from './config/auth.config';

@Module({
  imports: [AuthModule.forRoot(authConfig)],
})
export class AppModule {}
```

  </TabItem>
  <TabItem value="express" label="Express">

**1. Create configuration file:**

```typescript title="src/config/auth.config.ts"
import { NAuthConfig } from '@nauth-toolkit/express';
import { createRedisStorageAdapter } from '@nauth-toolkit/express';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

export const authConfig: NAuthConfig = {
  jwt: {
    algorithm: 'HS256',
    accessToken: {
      secret: 'your-secret-key', // Load from your config source
      expiresIn: '15m',
    },
    refreshToken: {
      secret: 'your-refresh-secret', // Load from your config source
      expiresIn: '7d',
    },
  },

  storageAdapter: createRedisStorageAdapter('redis://localhost:6379'),

  emailProvider: new NodemailerEmailProvider({
    transport: {
      host: 'smtp.example.com',
      port: 587,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-password',
      },
    },
    defaults: {
      from: 'My App <noreply@example.com>',
    },
  }),

  // Optional: Add logger for debugging
  // logger: {
  //   instance: yourLoggerInstance,  // Any logger implementing LoggerService interface
  //   enablePiiRedaction: true,
  // },
};
```

**2. Import in main:**

```typescript title="src/index.ts"
import { createNAuth } from '@nauth-toolkit/express';
import { authConfig } from './config/auth.config';

const nauth = await createNAuth(authConfig, dataSource);
app.use('/auth', nauth.routes);
```

  </TabItem>
</Tabs>

## Core Configuration

### JWT Configuration

Controls JWT token generation and validation. JWTs are used for stateless authentication - the access token authorizes API requests, while the refresh token allows obtaining new access tokens without re-authentication.

```typescript
jwt: {
  algorithm: 'HS256',  // HS256/HS384/HS512 (symmetric) or RS256/RS384/RS512 (asymmetric)
  issuer: 'com.myapp',
  audience: ['web', 'mobile'],

  accessToken: {
    secret: process.env.JWT_SECRET,      // Required for HS* algorithms
    // privateKey: process.env.PRIVATE_KEY,  // Required for RS* algorithms
    // publicKey: process.env.PUBLIC_KEY,    // Required for RS* algorithms
    expiresIn: '15m',  // 15 minutes
  },

  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d',      // 7 days
    rotation: true,       // Generate new refresh token on each use
    reuseDetection: true, // Detect and block token reuse attacks
  },
}
```

**Configuration Options:**

| Option                        | Description                                                                                                                                                                                                      | Default | Recommended                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------- |
| `algorithm`                   | Signing algorithm. HS256 uses symmetric key (same secret for sign/verify). RS256 uses asymmetric keys (private key signs, public key verifies) - better for microservices where multiple services verify tokens. | HS256   | HS256 for monoliths, RS256 for microservices |
| `issuer`                      | Identifies who issued the token. Used for validation - tokens from other issuers are rejected.                                                                                                                   | none    | Your app identifier (e.g., com.myapp)        |
| `audience`                    | Who the token is intended for. Can be a string or array. Tokens are rejected if audience doesn't match.                                                                                                          | none    | Array of client types (e.g., web, mobile)    |
| `accessToken.secret`          | **REQUIRED (HS\* algorithms).** Secret key for HS\* algorithms. Must be strong and kept secure. Minimum 32 characters (256 bits).                                                                                | N/A     | 256-bit random string from secure config     |
| `accessToken.privateKey`      | **REQUIRED (RS\* algorithms).** PEM-encoded private key for RS\* algorithms. Used to sign tokens.                                                                                                                | N/A     | RSA private key from secure config           |
| `accessToken.publicKey`       | **REQUIRED (RS\* algorithms).** PEM-encoded public key for RS\* algorithms. Used to verify tokens. Can be shared publicly.                                                                                       | N/A     | RSA public key from secure config            |
| `accessToken.expiresIn`       | **REQUIRED.** How long access tokens are valid. Short-lived for security (if stolen, limited damage). Format: 15m, 1h, or seconds.                                                                               | N/A     | 15m (15 minutes)                             |
| `refreshToken.secret`         | **REQUIRED.** Secret for signing refresh tokens. Should be different from access token secret. Minimum 32 characters (256 bits).                                                                                 | N/A     | 256-bit random string from secure config     |
| `refreshToken.expiresIn`      | **REQUIRED.** How long refresh tokens are valid. Longer-lived for better UX (users stay logged in). Format: 7d, 30d, or seconds.                                                                                 | N/A     | 7d to 30d                                    |
| `refreshToken.rotation`       | Generate new refresh token on each use. Old token becomes invalid. Prevents token theft - if attacker uses stolen token, legitimate user's next request fails and triggers security alert.                       | false   | true                                         |
| `refreshToken.reuseDetection` | Detect when an old refresh token is reused (sign of theft). When detected, invalidates entire token family and forces re-authentication.                                                                         | false   | true                                         |

**When to use RS256 vs HS256:**

- **HS256 (Symmetric)**: Single application, simpler setup, faster
- **RS256 (Asymmetric)**: Microservices, multiple services verify tokens, public key can be shared

**Key Points:**

- `algorithm`: Use `HS256` for simplicity, `RS256` for microservices
- `accessToken.expiresIn`: Short-lived (15m recommended)
- `refreshToken.expiresIn`: Long-lived (7d-30d)
- `rotation`: Recommended for production
- `reuseDetection`: Recommended for production

### Storage Adapter

Choose between Redis, Database, or Memory for transient storage.

```typescript
// Redis (Recommended for production)
import { createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
storageAdapter: createRedisStorageAdapter('redis://localhost:6379'),

// Database (No Redis needed)
import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';
storageAdapter: new DatabaseStorageAdapter(),

// Memory (Development only - NOT for production)
import { MemoryStorageAdapter } from '@nauth-toolkit/core';
storageAdapter: new MemoryStorageAdapter(),
```

See [Storage](/docs/concepts/storage) for detailed comparison.

### Email Provider

Configure email delivery for verification codes and notifications.

<Tabs>
  <TabItem value="nodemailer" label="Nodemailer (Production)" default>

```typescript
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

emailProvider: new NodemailerEmailProvider({
  transport: {
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,  // Use TLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  defaults: {
    from: 'My App <noreply@myapp.com>',
  },
}),

email: {
  appName: 'My App',
  companyName: 'My Company Inc.',
  supportEmail: 'support@myapp.com',
  logoUrl: 'https://myapp.com/logo.png',
  brandColor: '#4f46e5',
},
```

  </TabItem>
  <TabItem value="console" label="Console (Development)">

```typescript
import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';

emailProvider: new ConsoleEmailProvider(),

email: {
  appName: 'My App',
  supportEmail: 'support@myapp.com',
},
```

  </TabItem>
</Tabs>

### Logger

Configure logging with PII redaction.

<Tabs>
  <TabItem value="nestjs" label="NestJS" default>

```typescript
import { Logger } from '@nestjs/common';

logger: {
  instance: new Logger('NAuth'),
  enablePiiRedaction: true,  // Redact emails, IPs, tokens
  logLevel: 'debug',
},
```

  </TabItem>
  <TabItem value="express" label="Express">

```typescript
// Optional: Any logger implementing LoggerService interface
logger: {
  instance: yourLoggerInstance,  // console, Winston, Pino, etc.
  enablePiiRedaction: true,
  logLevel: 'debug',
},
```

  </TabItem>
</Tabs>

## Signup Configuration

Controls user registration behavior, verification requirements, and anti-abuse measures.

```typescript
signup: {
  enabled: true,
  verificationMethod: 'email',  // 'none' | 'email' | 'phone' | 'both'
  allowDuplicatePhones: false,

  emailVerification: {
    expiresIn: 3600,        // 1 hour
    resendDelay: 60,        // 60 seconds
    rateLimitMax: 3,        // 3 emails per window
    rateLimitWindow: 3600,  // 1 hour
    maxAttemptsPerUser: 10,
    maxAttemptsPerIP: 20,
    attemptWindow: 3600,
  },

  phoneVerification: {
    codeLength: 6,
    expiresIn: 300,         // 5 minutes
    maxAttempts: 3,
    resendDelay: 60,
    rateLimitMax: 3,
    rateLimitWindow: 3600,
    maxAttemptsPerUser: 10,
    maxAttemptsPerIP: 20,
    attemptWindow: 3600,
  },
},
```

**Verification Methods:**

| Method    | Description                                                                     | Use Case                                                  |
| --------- | ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `'none'`  | No verification required. Users can login immediately after signup.             | Internal tools, trusted environments, development         |
| `'email'` | Email verification required before login. User receives verification code/link. | Standard web apps, most common choice                     |
| `'phone'` | Phone verification required before login. User receives SMS code.               | Mobile-first apps, regions where phone is primary contact |
| `'both'`  | Both email AND phone verification required. Higher security but more friction.  | High-security apps, financial services                    |

**Email Verification Options:**

| Option               | Description                                                                    | Default | Recommended   |
| -------------------- | ------------------------------------------------------------------------------ | ------- | ------------- |
| `expiresIn`          | How long verification codes/links are valid (seconds). Balance security vs UX. | 3600    | 3600 (1 hour) |
| `resendDelay`        | Minimum time between resend requests (seconds). Prevents spam.                 | 60      | 60 (1 minute) |
| `rateLimitMax`       | Maximum verification emails per time window. Prevents email bombing.           | 3       | 3             |
| `rateLimitWindow`    | Time window for rate limiting (seconds).                                       | 3600    | 3600 (1 hour) |
| `maxAttemptsPerUser` | Max verification attempts per user per window. Prevents brute force.           | 10      | 10            |
| `maxAttemptsPerIP`   | Max verification attempts per IP per window. Prevents distributed attacks.     | 20      | 20            |
| `attemptWindow`      | Time window for attempt limits (seconds).                                      | 3600    | 3600 (1 hour) |

**Phone Verification Options:**

| Option               | Description                                                                            | Default | Recommended     |
| -------------------- | -------------------------------------------------------------------------------------- | ------- | --------------- |
| `codeLength`         | Length of SMS verification code. Longer = more secure but harder to type.              | 6       | 6               |
| `expiresIn`          | How long SMS codes are valid (seconds). Shorter for security (SMS can be intercepted). | 300     | 300 (5 minutes) |
| `maxAttempts`        | Max attempts to verify a single code. Prevents brute force.                            | 3       | 3               |
| `resendDelay`        | Minimum time between SMS resends (seconds). Prevents SMS spam and cost abuse.          | 60      | 60 (1 minute)   |
| `rateLimitMax`       | Maximum SMS per time window. **Important:** SMS costs money, prevent abuse!            | 3       | 3               |
| `rateLimitWindow`    | Time window for SMS rate limiting (seconds).                                           | 3600    | 3600 (1 hour)   |
| `maxAttemptsPerUser` | Max verification attempts per user per window.                                         | 10      | 10              |
| `maxAttemptsPerIP`   | Max verification attempts per IP per window.                                           | 20      | 20              |
| `attemptWindow`      | Time window for attempt limits (seconds).                                              | 3600    | 3600 (1 hour)   |

**Other Options:**

| Option                 | Description                                  | Use Case                                                |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------- |
| `enabled`              | Enable/disable user signups globally.        | Set to `false` to close registration (invite-only apps) |
| `allowDuplicatePhones` | Allow multiple users with same phone number. | Family accounts, shared devices                         |

**Security Considerations:**

- **Rate Limiting**: Prevents attackers from sending thousands of verification emails/SMS
- **Attempt Limits**: Prevents brute-forcing verification codes
- **IP-based Limits**: Stops distributed attacks from multiple accounts
- **Expiration**: Short expiration windows reduce attack surface

## Password & Security

Configure password policies, account lockout, and CSRF protection.

```typescript
password: {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommon: true,       // Block common passwords
  preventUserInfo: true,     // Block passwords containing email/username
  historyCount: 5,           // Prevent reusing last 5 passwords
  expiryDays: 90,            // Force password change after 90 days (0 = disabled)
},

lockout: {
  enabled: true,
  maxAttempts: 5,            // Lock after 5 failed attempts
  duration: 900,             // 15 minutes lockout
  resetOnSuccess: true,      // Reset counter on successful login
},

security: {
  csrf: {
    cookieName: 'csrf-token',
    headerName: 'x-csrf-token',
    tokenLength: 32,
    excludedPaths: ['/webhook'],  // Paths that don't need CSRF
    cookieOptions: {
      secure: true,
      sameSite: 'strict',
      domain: '.myapp.com',  // Optional: share across subdomains
    },
  },
},
```

**Password Policy Options:**

| Option                | Description                                                                                                   | Default | Recommended                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------- |
| `minLength`           | Minimum password length. NIST recommends at least 8 characters.                                               | 8       | 8 or higher                        |
| `maxLength`           | Maximum password length. Prevents DoS attacks from bcrypt hashing very long strings.                          | 128     | 128                                |
| `requireUppercase`    | Require at least one uppercase letter (A-Z).                                                                  | false   | true for moderate security         |
| `requireLowercase`    | Require at least one lowercase letter (a-z).                                                                  | false   | true for moderate security         |
| `requireNumbers`      | Require at least one number (0-9).                                                                            | false   | true for moderate security         |
| `requireSpecialChars` | Require at least one special character (!@#$%^&\*).                                                           | false   | true for high security             |
| `preventCommon`       | Block common passwords (e.g., password123, qwerty). Uses built-in list of 10,000+ common passwords.           | false   | true (strongly recommended)        |
| `preventUserInfo`     | Block passwords containing user's email or username. Prevents john@example.com using john123.                 | false   | true                               |
| `historyCount`        | Number of previous passwords to remember. Prevents password reuse. 0 = disabled.                              | 0       | 5 for compliance, 0 for simplicity |
| `expiryDays`          | Force password change after N days. 0 = never expires. **Note:** NIST no longer recommends forced expiration. | 0       | 0 (disabled) or 90 for compliance  |

**Account Lockout Options:**

| Option           | Description                                                                                    | Default | Recommended      |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------- | ---------------- |
| `enabled`        | Enable IP-based account lockout after failed login attempts.                                   | false   | true             |
| `maxAttempts`    | Number of failed login attempts before lockout. Too low = UX issues, too high = security risk. | 5       | 5                |
| `duration`       | Lockout duration in seconds. After this time, attempts reset.                                  | 900     | 900 (15 minutes) |
| `resetOnSuccess` | Reset failed attempt counter on successful login. Recommended for better UX.                   | true    | true             |

**Why IP-based lockout?**
Uses IP addresses instead of user identifiers. This prevents attackers from locking out legitimate users by repeatedly trying their email/username.

**CSRF Protection Options:**

| Option                   | Description                                                                         | Default          | Recommended                     |
| ------------------------ | ----------------------------------------------------------------------------------- | ---------------- | ------------------------------- |
| `cookieName`             | Name of the CSRF token cookie.                                                      | nauth_csrf_token | nauth_csrf_token                |
| `headerName`             | HTTP header name where frontend sends CSRF token.                                   | x-csrf-token     | x-csrf-token                    |
| `tokenLength`            | Length of CSRF token in bytes. Longer = more secure.                                | 32               | 32 (256 bits)                   |
| `excludedPaths`          | Paths that don't require CSRF tokens (e.g., webhooks, public APIs).                 | empty array      | /webhook, /api/public as needed |
| `cookieOptions.secure`   | Require HTTPS for CSRF cookie. Set to false for localhost development.              | true             | true (false for localhost)      |
| `cookieOptions.sameSite` | SameSite cookie attribute. strict = most secure, lax = allows top-level navigation. | strict           | strict                          |
| `cookieOptions.domain`   | Cookie domain for subdomain sharing.                                                | none             | .myapp.com for subdomains       |

**When is CSRF protection needed?**

- **Required** when using `tokenDelivery.method = 'cookies'` or `'hybrid'`
- **Not needed** when using `tokenDelivery.method = 'json'` (Bearer tokens are CSRF-safe)

## Token Delivery

Control how tokens are delivered to clients.

```typescript
tokenDelivery: {
  method: 'cookies',  // 'json' | 'cookies' | 'hybrid'
  cookieNamePrefix: 'nauth_',

  cookieOptions: {
    secure: true,       // HTTPS only (set to false for localhost)
    sameSite: 'strict', // 'strict' | 'lax' | 'none'
    domain: '.myapp.com',  // Optional: for subdomain sharing
    path: '/',
  },
},
```

**Delivery Methods:**

| Method      | Description                                                                                                             | Best For                                   | CSRF Required? |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------- |
| `'json'`    | Tokens returned in response body only. Frontend stores in memory/localStorage. Sent via `Authorization: Bearer` header. | Mobile apps, SPAs, API-first apps          | No             |
| `'cookies'` | Tokens set as httpOnly cookies. Browser automatically sends with requests. More secure (XSS-resistant).                 | Traditional web apps, server-rendered apps | Yes            |
| `'hybrid'`  | Cookies for web origins, JSON for mobile origins. Best of both worlds.                                                  | Apps with both web and mobile clients      | Yes (for web)  |

**Cookie Options:**

| Option             | Description                                                                                                                              | Default | Recommended                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------- |
| `cookieNamePrefix` | Prefix for all auth cookies. Prevents conflicts with other cookies.                                                                      | nauth\_ | nauth\_                          |
| `secure`           | Require HTTPS. Cookies won't be sent over HTTP. Set to false for localhost development.                                                  | true    | true (false for localhost)       |
| `sameSite`         | Controls when cookies are sent. strict = same-site only, lax = allows top-level navigation, none = all requests (requires secure: true). | strict  | strict (or lax for better UX)    |
| `domain`           | Cookie domain. Set to .myapp.com to share cookies across app.myapp.com and api.myapp.com.                                                | none    | .myapp.com for subdomain sharing |
| `path`             | Cookie path. Usually / for all routes.                                                                                                   | /       | /                                |

**Security Comparison:**

| Aspect                | JSON (localStorage)                                                                                                  | Cookies (httpOnly)                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **XSS Protection**    | <i className="fa-duotone fa-light fa-circle-xmark" style={{color: '#ef4444'}}></i> Vulnerable - XSS can steal tokens | <i className="fa-duotone fa-light fa-circle-check" style={{color: '#22c55e'}}></i> Protected - httpOnly prevents JS access |
| **CSRF Protection**   | <i className="fa-duotone fa-light fa-circle-check" style={{color: '#22c55e'}}></i> Not vulnerable                    | <i className="fa-duotone fa-light fa-circle-xmark" style={{color: '#ef4444'}}></i> Requires CSRF tokens                    |
| **Mobile Support**    | <i className="fa-duotone fa-light fa-circle-check" style={{color: '#22c55e'}}></i> Easy                              | <i className="fa-duotone fa-light fa-triangle-exclamation" style={{color: '#f59e0b'}}></i> Requires cookie handling        |
| **Subdomain Sharing** | <i className="fa-duotone fa-light fa-triangle-exclamation" style={{color: '#f59e0b'}}></i> Manual implementation     | <i className="fa-duotone fa-light fa-circle-check" style={{color: '#22c55e'}}></i> Built-in via domain option              |
| **Auto-send**         | <i className="fa-duotone fa-light fa-circle-xmark" style={{color: '#ef4444'}}></i> Must add header manually          | <i className="fa-duotone fa-light fa-circle-check" style={{color: '#22c55e'}}></i> Browser sends automatically             |

**Recommendation:**

- **Web apps**: Use `'cookies'` for better security
- **Mobile apps**: Use `'json'` for simplicity
- **Both**: Use `'hybrid'` mode

## Session Configuration

Manage user sessions and concurrency.

```typescript
session: {
  maxConcurrent: 5,                  // Max active sessions per user
  disallowMultipleSessions: false,   // If true, only 1 session allowed
  maxLifetime: '30d',                // Hard limit: force re-auth after 30 days
},
```

## Social Login

Configure OAuth providers.

```typescript
social: {
  google: {
    enabled: true,
    clientId: 'your-google-client-id',
    // Or array for multi-platform: [webClientId, iosClientId, androidClientId]
    clientSecret: 'your-google-client-secret',
    callbackUrl: 'https://myapp.com/auth/google/callback',
    scopes: ['openid', 'email', 'profile'],
    autoLink: true,      // Auto-link to existing users by email
    allowSignup: true,   // Allow new user creation
  },

  apple: {
    enabled: true,
    clientId: 'com.myapp.services',
    clientSecret: 'your-apple-client-secret',
    callbackUrl: 'https://myapp.com/auth/apple/callback',
    scopes: ['name', 'email'],
    autoLink: true,
    allowSignup: true,
  },

  facebook: {
    enabled: true,
    clientId: 'your-facebook-client-id',
    clientSecret: 'your-facebook-client-secret',
    callbackUrl: 'https://myapp.com/auth/facebook/callback',
    scopes: ['email', 'public_profile'],
    autoLink: true,
    allowSignup: true,
  },
},
```

## Multi-Factor Authentication (MFA)

Configure MFA methods and enforcement.

```typescript
import { MFAMethod } from '@nauth-toolkit/core';

mfa: {
  enabled: true,
  enforcement: 'OPTIONAL',  // 'OPTIONAL' | 'REQUIRED' | 'ADAPTIVE'
  gracePeriod: 7,           // Days before REQUIRED enforcement kicks in
  requireForSocialLogin: false,

  allowedMethods: [
    MFAMethod.TOTP,     // Authenticator apps
    MFAMethod.SMS,      // SMS codes
    MFAMethod.EMAIL,    // Email codes
    MFAMethod.PASSKEY,  // WebAuthn/biometric
  ],

  issuer: 'My App',

  totp: {
    window: 1,          // Time steps to check (±1)
    stepSeconds: 30,    // Standard TOTP interval
    digits: 6,
    algorithm: 'sha1',
  },

  passkey: {
    rpName: 'My App',
    rpId: 'myapp.com',
    origin: ['https://myapp.com', 'https://app.myapp.com'],
    timeout: 60000,
    userVerification: 'preferred',
  },

  adaptive: {
    triggers: ['new_device', 'new_ip', 'new_country', 'impossible_travel'],
    riskLevels: {
      low: { maxScore: 20, action: 'allow', notifyUser: false },
      medium: { maxScore: 50, action: 'require_mfa', notifyUser: true },
      high: { maxScore: 100, action: 'require_mfa', notifyUser: true },
    },
  },

  rememberDevices: 'user_opt_in',  // 'never' | 'always' | 'user_opt_in'
  rememberDeviceDays: 30,
  bypassMFAForTrustedDevices: true,

  backup: {
    enabled: true,
    codeCount: 10,
    codeLength: 8,
  },
},
```

## Geolocation

Configure IP geolocation for adaptive MFA.

```typescript
geoLocation: {
  maxMind: {
    licenseKey: process.env.MAXMIND_LICENSE_KEY,
    accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0'),
    dbPath: '/app/data/maxmind',  // Optional: defaults to system temp
    autoDownloadOnStartup: false,  // Download on first run
    editions: ['GeoLite2-City', 'GeoLite2-Country'],
    skipDownloads: false,  // Set true if managing files externally
  },
},
```

## Lifecycle Hooks

React to authentication events.

```typescript
hooks: {
  afterSignup: async (user, metadata) => {
    console.log(`New user: ${user.email}`);
    await sendWelcomeEmail(user);
  },

  afterLogin: async (user, session) => {
    console.log(`Login: ${user.email}`);
  },

  afterLoginFailed: async (identifier, reason) => {
    console.log(`Failed login: ${identifier}`);
  },

  onAdaptiveMFATriggered: async (payload) => {
    if (payload.riskLevel === 'high') {
      await sendSecurityAlert(payload.user.email, payload);
    }
  },

  onSignInBlocked: async (payload) => {
    await notifyAdmins('High-risk sign-in blocked', payload);
  },
},
```

## Audit Logs

Configure audit trail.

```typescript
auditLogs: {
  enabled: true,
  fireAndForget: false,  // Set true for performance (no await)
},
```

## Complete Example

Here's a production-ready configuration:

```typescript title="src/config/auth.config.ts"
import { NAuthModuleConfig, MFAMethod, createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
import { Logger } from '@nestjs/common';

export const authConfig: NAuthModuleConfig = {
  tablePrefix: 'nauth_',

  storageAdapter: createRedisStorageAdapter('redis://localhost:6379'),

  jwt: {
    algorithm: 'HS256',
    issuer: 'com.myapp',
    audience: ['web', 'mobile'],
    accessToken: { secret: 'your-jwt-secret', expiresIn: '15m' },
    refreshToken: {
      secret: 'your-refresh-secret',
      expiresIn: '7d',
      rotation: true,
      reuseDetection: true,
    },
  },

  logger: {
    instance: new Logger('NAuth'),
    enablePiiRedaction: true,
    logLevel: 'info',
  },

  signup: {
    enabled: true,
    verificationMethod: 'email',
    emailVerification: {
      expiresIn: 3600,
      resendDelay: 60,
      rateLimitMax: 3,
      rateLimitWindow: 3600,
    },
  },

  password: {
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommon: true,
  },

  lockout: {
    enabled: true,
    maxAttempts: 5,
    duration: 900,
  },

  tokenDelivery: {
    method: 'cookies',
    cookieOptions: {
      secure: true,
      sameSite: 'strict',
    },
  },

  security: {
    csrf: {
      cookieName: 'csrf-token',
      headerName: 'x-csrf-token',
    },
  },

  emailProvider: new NodemailerEmailProvider({
    transport: {
      host: 'smtp.example.com',
      port: 587,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-password',
      },
    },
    defaults: {
      from: 'My App <noreply@myapp.com>',
    },
  }),

  email: {
    appName: 'My App',
    companyName: 'My Company Inc.',
    supportEmail: 'support@myapp.com',
    logoUrl: 'https://myapp.com/logo.png',
    brandColor: '#4f46e5',
  },

  social: {
    google: {
      enabled: true,
      clientId: 'your-google-client-id',
      clientSecret: 'your-google-client-secret',
      callbackUrl: 'https://myapp.com/auth/google/callback',
      autoLink: true,
      allowSignup: true,
    },
  },

  mfa: {
    enabled: true,
    enforcement: 'OPTIONAL',
    allowedMethods: [MFAMethod.TOTP, MFAMethod.EMAIL],
    issuer: 'My App',
  },

  session: {
    maxConcurrent: 5,
    maxLifetime: '30d',
  },

  auditLogs: { enabled: true },
};
```

## Next Steps

- **[Challenge System](/docs/concepts/challenge-system)** - Understanding verification flows
- **[Storage](/docs/concepts/storage)** - Database and transient storage
- **[Error Handling](/docs/concepts/error-handling)** - Exception handling patterns
