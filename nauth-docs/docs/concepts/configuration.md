---
title: Configuration
description: 'NAuthConfig reference: JWT settings, token delivery (cookies vs JSON), session management, password policies, rate limiting, MFA enforcement, social auth providers, email/SMS providers, storage adapters, reCAPTCHA, and geolocation'
sidebar_position: 6
keywords: [configuration, config, options, settings, setup, environment, security]
image: /img/api-social-card.png
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

<Tabs groupId="platform">
  <TabItem value="nestjs" label="NestJS" default>

**1. Create configuration file:**

```typescript title="src/config/auth.config.ts"
import { NAuthModuleConfig, createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
import { Logger } from '@nestjs/common';

export const authConfig: NAuthModuleConfig = {
  jwt: {
    algorithm: 'HS256',
    accessToken: {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
      reuseDetection: true,
    },
  },

  storageAdapter: createRedisStorageAdapter(process.env.REDIS_URL || 'redis://localhost:6379'),

  emailProvider: new NodemailerEmailProvider({
    transport: {
      host: process.env.SMTP_HOST,
      port: 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    defaults: {
      from: `My App <${process.env.EMAIL_FROM || 'noreply@example.com'}>`,
    },
  }),

  email: {
    globalVariables: {
      appName: 'My App',
      supportEmail: process.env.SUPPORT_EMAIL,
    },
  },

  logger: {
    instance: new Logger('NAuth'),
    enablePiiRedaction: true,
  },
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
  <TabItem value="express" label="Express / Fastify">

**1. Create configuration file:**

```typescript title="src/config/auth.config.ts"
import { NAuthConfig } from '@nauth-toolkit/core';
import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
await redisClient.connect();

export const authConfig: NAuthConfig = {
  jwt: {
    algorithm: 'HS256',
    accessToken: {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
      reuseDetection: true,
    },
  },

  storageAdapter: new RedisStorageAdapter(redisClient),

  emailProvider: new NodemailerEmailProvider({
    transport: {
      host: process.env.SMTP_HOST,
      port: 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    defaults: {
      from: `My App <${process.env.EMAIL_FROM || 'noreply@example.com'}>`,
    },
  }),

  email: {
    globalVariables: {
      appName: 'My App',
      supportEmail: process.env.SUPPORT_EMAIL,
    },
  },

  logger: {
    instance: console,  // Any logger implementing LoggerService (log/error/warn/debug)
    enablePiiRedaction: true,
  },
};
```

**2. Register in main:**

```typescript title="src/index.ts"
import { NAuth } from '@nauth-toolkit/core';
import { ExpressAdapter } from '@nauth-toolkit/core'; // or FastifyAdapter
import { authConfig } from './config/auth.config';

const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(), // or new FastifyAdapter()
});
```

  </TabItem>
</Tabs>

## Core Configuration

### Top-level options (NAuthConfig)

These are the top-level keys you can provide in `NAuthConfig` / `NAuthModuleConfig`. Each links to its detailed section below.

| Option          | Required | Description                                                                        |
| --------------- | -------- | ---------------------------------------------------------------------------------- |
| `tablePrefix`   | No       | Database table prefix. Default: `nauth_`. Example: `'myapp_'` → tables become `myapp_users`, `myapp_sessions`. |
| [`migrations`](#migrations) | No | Whether nauth applies its own schema migrations at startup. Safe for parallel container starts by default. |
| [`jwt`](#jwt-configuration) | **Yes** | JWT signing algorithm, secrets, and token lifetimes. |
| [`storageAdapter`](#storage-adapter) | No* | Transient storage for sessions, rate limits, and token reuse detection. Auto-detected if omitted and DB storage entities are registered. |
| [`signup`](#signup-configuration) | No | Signup toggle, verification method (email/phone/both/none), and rate limits. |
| [`login`](#login-configuration) | No | Login identifier policy: `email`, `username`, `phone`, or `email_or_username`. |
| [`password`](#password-security) | No | Password policy (length, complexity, history, expiry) and password reset flow. |
| [`lockout`](#password-security) | No | IP-based failed-login lockout. |
| [`security`](#password-security) | No | CSRF protection and sensitive data masking in challenge responses. |
| [`tokenDelivery`](#token-delivery) | No | How tokens reach clients: `json` (response body), `cookies` (httpOnly), or `hybrid`. Default: `json`. |
| [`session`](#session-configuration) | No | Session concurrency limits and hard maximum lifetime. |
| [`emailProvider`](#email-provider) | No* | Email provider instance. Required when email verification or MFA email is enabled. |
| [`email`](#email-provider) | No | Email branding (`globalVariables`) and custom HTML/text templates. |
| [`emailNotifications`](#email-notifications-optional) | No | Per-event suppression controls. Optional lifecycle emails are disabled by default. |
| [`smsProvider`](#sms-provider) | No* | SMS provider instance. Required when phone verification or MFA SMS is enabled. |
| [`sms`](#sms-templates) | No | SMS template branding and custom message content. |
| [`social`](#social-authentication) | No | Social OAuth providers (Google, Apple, Facebook) and post-OAuth redirect config. |
| [`mfa`](#multi-factor-authentication) | No | MFA methods, enforcement mode (OPTIONAL/REQUIRED/ADAPTIVE), and device trust. |
| [`geoLocation`](#geolocation) | No | MaxMind IP geolocation database. Required for adaptive MFA. |
| [`auditLogs`](#audit-logs) | No | Audit trail for authentication and security events. Default: enabled. |
| [`recaptcha`](#recaptcha) | No | Google reCAPTCHA bot protection (v2, v3, Enterprise). |
| [`challenge`](#challenge) | No | Max verification attempts before a challenge session is invalidated. Default: 3. |
| [`logger`](#logger) | No | Logger instance and PII redaction controls. Silent by default. |

### JWT Configuration {#jwt-configuration}

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
| `refreshToken.rotation`       | **Deprecated.** Token rotation is always enabled and cannot be disabled. A new refresh token is issued on every use regardless of this flag. Accepted for backward compatibility but ignored at runtime.         | N/A     | Omit (always on)                             |
| `refreshToken.reuseDetection` | Detect when an old refresh token is reused (sign of theft). When detected, invalidates entire token family and forces re-authentication.                                                                         | false   | true                                         |

**When to use RS256 vs HS256:**

- **HS256 (Symmetric)**: Single application, simpler setup, faster
- **RS256 (Asymmetric)**: Microservices, multiple services verify tokens, public key can be shared

**Key Points:**

- `algorithm`: Use `HS256` for simplicity, `RS256` for microservices
- `accessToken.expiresIn`: Short-lived (15m recommended)
- `refreshToken.expiresIn`: Long-lived (7d-30d)
- `reuseDetection`: Recommended for production

### Migrations {#migrations}

nauth-toolkit applies its own schema migrations at startup. **Parallel container starts are safe with no configuration** — each run is serialized behind a database-level lock (a PostgreSQL advisory lock, or a MySQL named lock), so ECS tasks or Kubernetes pods that boot together cannot race to create the same tables. Instances that lose the race wait for the winner and then find nothing to do.

The lock is held on a dedicated connection and released by the database if an instance dies, so a crashed task can never block a deploy.

```typescript
// Apply migrations from a one-off release task instead of at boot
migrations: {
  autoRun: false,  // default: true
},
```

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `autoRun` | `boolean` | `true` | Apply pending nauth migrations during startup. Set to `false` when a release task or Kubernetes Job runs them first. |

Locking is always on and has no settings.

See [TypeORM PostgreSQL](/docs/api/database/typeorm-postgres#migrations) or [TypeORM MySQL](/docs/api/database/typeorm-mysql#migrations) for details.

### Storage Adapter {#storage-adapter}

**Storage adapter is REQUIRED.** Choose between Redis or Database for transient storage.

```typescript
// Redis (Recommended for production, multi-server)
import { createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
storageAdapter: createRedisStorageAdapter('redis://localhost:6379'),

// Database (No Redis needed) - NestJS
import { createDatabaseStorageAdapter } from '@nauth-toolkit/nestjs';
storageAdapter: createDatabaseStorageAdapter(),

// Database (No Redis needed) - Express/Fastify
// import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';
// storageAdapter: new DatabaseStorageAdapter(),
```

:::tip
If you don't provide a `storageAdapter` explicitly, `DatabaseStorageAdapter` will be auto-created if storage entities (`getNAuthTransientStorageEntities()`) are included in your TypeORM configuration.
:::

See [Storage](/docs/concepts/storage) for detailed comparison and auto-detection behavior.

### Login Configuration {#login-configuration}

Controls which identifier types are accepted during login.

| `identifierType` | Accepts |
| ---------------- | ------- |
| `undefined` (default) | All types: email, username, phone |
| `'email'` | Email addresses only |
| `'username'` | Usernames only |
| `'phone'` | Phone numbers only |
| `'email_or_username'` | Email or username (phone excluded) |

```typescript
login: {
  identifierType: 'email_or_username',
},
```

### Email Provider {#email-provider}

Configure email delivery for verification codes and notifications.

<Tabs>
  <TabItem value="nodemailer" label="Nodemailer (SMTP)" default>

```typescript
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

emailProvider: new NodemailerEmailProvider({
  transport: {
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,  // false = STARTTLS on port 587; true = direct TLS on port 465
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
  globalVariables: {
    appName: 'My App',
    companyName: 'My Company Inc.',
    supportEmail: 'support@myapp.com',
    logoUrl: 'https://myapp.com/logo.png',
    brandColor: '#4f46e5',
  },
},
```

  </TabItem>
  <TabItem value="aws-ses-sdk" label="AWS SES (SDK with IAM)">

Uses AWS SDK v3 with automatic IAM role discovery. Perfect for EC2/ECS/containers.

```bash npm2yarn
npm install @aws-sdk/client-sesv2
```

```typescript
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

emailProvider: new NodemailerEmailProvider({
  transport: {
    SES: {
      sesClient: new SESv2Client({
        region: process.env.AWS_REGION || 'us-east-1',
        // Credentials automatically discovered from:
        // 1. IAM role (when running on EC2/ECS/containers) - RECOMMENDED
        // 2. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
        // 3. Shared credentials file (~/.aws/credentials)
      }),
      SendEmailCommand,
    },
  },
  defaults: {
    from: 'My App <noreply@myapp.com>',
  },
}),

email: {
  globalVariables: {
    appName: 'My App',
    companyName: 'My Company Inc.',
    supportEmail: 'support@myapp.com',
    logoUrl: 'https://myapp.com/logo.png',
    brandColor: '#4f46e5',
  },
},
```

:::tip
The AWS SES SDK transport automatically uses IAM roles when running on AWS infrastructure (EC2, ECS, Lambda), eliminating the need to manage credentials manually.
:::

  </TabItem>
  <TabItem value="console" label="Console (Development)">

```typescript
import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';

emailProvider: new ConsoleEmailProvider(),

email: {
  globalVariables: {
    appName: 'My App',
    supportEmail: 'support@myapp.com',
  },
},
```

  </TabItem>
</Tabs>

### Email Notifications (Optional) {#email-notifications-optional}

Optional notification emails are **opt-in** and controlled via `emailNotifications.suppress`.
This is separate from template customization (see [Email Templates](/docs/guides/email-templates)).

```typescript
emailNotifications: {
  enabled: true,
  suppress: {
    // Optional notifications — default: true (suppressed/disabled). Set false to enable.
    welcome: false,
    passwordChanged: false,
    mfaDeviceRemoved: false,
    mfaFirstEnabled: false,       // Uses the mfaEnabled email template
    mfaMethodAdded: false,
    adaptiveMfaRiskDetected: false, // Uses the adaptiveMfaRiskAlert template
    sessionsRevoked: false,
    accountLockout: false,
    accountDisabled: false,
    accountEnabled: false,
    emailChangedOld: false,       // Alert sent to the old email address
    emailChangedNew: false,       // Confirmation sent to the new email address
    // Note: Code emails (emailVerification, passwordReset, adminPasswordReset)
    // cannot be suppressed and are always sent when enabled: true
  },
},
```

::::note Naming tip
Some notification keys map to a differently-named template type:

- `mfaFirstEnabled` notification uses the `mfaEnabled` email template (`TemplateType.MFA_ENABLED`)
- `adaptiveMfaRiskDetected` notification uses the `adaptiveMfaRiskAlert` email template (`TemplateType.ADAPTIVE_MFA_RISK_ALERT`)
::::

### SMS Provider {#sms-provider}

Configure SMS delivery for phone verification, MFA, and password reset.

<Tabs>
  <TabItem value="twilio" label="Twilio (Production)" default>

```typescript
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

smsProvider: new TwilioSMSProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  fromNumber: process.env.TWILIO_FROM_NUMBER!, // E.164 format, e.g. '+15551234567'
  // Or use a Messaging Service instead:
  // messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
}),
```

  </TabItem>
  <TabItem value="aws-sns" label="AWS SNS">

```typescript
import { AWSSMSProvider } from '@nauth-toolkit/sms-aws-sns';

smsProvider: new AWSSMSProvider({
  region: process.env.AWS_REGION as string,
  originationNumber: process.env.AWS_SMS_ORIGINATION as string, // e.g. '+12345678901' or 'MyApp'
  accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  // apiMode: 'end-user-messaging-sms', // optional; use for configuration sets
  // configurationSetName: 'default',
}),
```

  </TabItem>
  <TabItem value="console" label="Console (Development)">

```typescript
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';

smsProvider: new ConsoleSMSProvider(),
```

  </TabItem>
</Tabs>

### SMS Templates {#sms-templates}

Customize SMS message content globally (branding + custom templates).

```typescript
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';

smsProvider: new ConsoleSMSProvider(),

sms: {
  templates: {
    globalVariables: {
      appName: 'My App',
      supportPhone: '+1-800-123-4567',
    },
    customTemplates: {
      verification: {
        content:
          '{{#if appName}}{{appName}}: {{/if}}Your verification code is {{code}}. Valid for {{expiryMinutes}} minutes. Need help? {{supportPhone}}',
      },
      mfa: {
        content: '{{#if appName}}{{appName}}: {{/if}}Your MFA code is {{code}}. Valid for {{expiryMinutes}} minutes.',
      },
      passwordReset: {
        content:
          '{{#if appName}}{{appName}}: {{/if}}Your password reset code is {{code}}. Valid for {{expiryMinutes}} minutes.',
      },
    },
  },
},
```

See [SMS Templates Feature Guide](/docs/guides/sms-templates) and [SMS Templates Configuration](/docs/api/sms/templates).

### Logger {#logger}

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

## Signup Configuration {#signup-configuration}

Controls user registration behavior, verification requirements, and anti-abuse measures.

```typescript
signup: {
  enabled: true,
  verificationMethod: 'email',  // 'none' | 'email' | 'phone' | 'both'
  allowDuplicatePhones: false,

  emailVerification: {
    expiresIn: 3600,        // 1 hour
    maxAttempts: 3,         // Max attempts per code
    resendDelay: 60,        // 60 seconds
    rateLimitMax: 3,        // 3 emails per window
    rateLimitWindow: 3600,  // 1 hour
    maxAttemptsPerUser: 10,
    maxAttemptsPerIP: 20,
    attemptWindow: 3600,
    baseUrl: 'https://myapp.com',  // Optional: include verification link in emails
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
| `maxAttempts`        | Max attempts to verify a single code. Prevents brute force.                    | 3       | 3             |
| `resendDelay`        | Minimum time between resend requests (seconds). Prevents spam.                 | 60      | 60 (1 minute) |
| `rateLimitMax`       | Maximum verification emails per time window. Prevents email bombing.           | 3       | 3             |
| `rateLimitWindow`    | Time window for rate limiting (seconds).                                       | 3600    | 3600 (1 hour) |
| `maxAttemptsPerUser` | Max verification attempts per user per window. Prevents brute force.           | 10      | 10            |
| `maxAttemptsPerIP`   | Max verification attempts per IP per window. Prevents distributed attacks.     | 20      | 20            |
| `attemptWindow`      | Time window for attempt limits (seconds).                                      | 3600    | 3600 (1 hour) |
| `baseUrl`            | Base URL for verification links. If provided, emails include clickable link with code. Format: `${baseUrl}?code=${code}`. The consumer app handles routing. Supports localhost (e.g., `http://localhost:4200`). | none | `https://myapp.com` or `http://localhost:4200` for development |

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

## Password & Security {#password-security}

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
  maskSensitiveData: true,   // Mask email/phone in challenge responses
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

**maskSensitiveData:**

When enabled (default), email addresses and phone numbers in challenge responses are masked for security:
- Email: `john.doe@example.com` → `j***@example.com`
- Phone: `+1234567890` → `***-***-7890`

Set to `false` to return full email/phone in challenge responses. Useful for development or internal apps where security is less critical.

```typescript
security: {
  maskSensitiveData: false,  // Return full email/phone
},
```

**Password Policy Options:**

| Option                | Description                                                                                                   | Default | Recommended                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------- |
| `minLength`           | Minimum password length. NIST recommends at least 8 characters.                                               | 8       | 8 or higher                        |
| `maxLength`           | Maximum password length. Prevents DoS attacks from Argon2 hashing very long strings.                          | 128     | 128                                |
| `requireUppercase`    | Require at least one uppercase letter (A-Z).                                                                  | false   | true for moderate security         |
| `requireLowercase`    | Require at least one lowercase letter (a-z).                                                                  | false   | true for moderate security         |
| `requireNumbers`      | Require at least one number (0-9).                                                                            | false   | true for moderate security         |
| `requireSpecialChars` | Require at least one special character. Defaults to `!@#$%^&*` if `specialChars` is not set.                 | false   | true for high security             |
| `specialChars`        | Custom set of characters that satisfy `requireSpecialChars`. Overrides the default `!@#$%^&*` set.            | none    | `'$#!@'` or domain-appropriate set |
| `preventCommon`       | Block common passwords (e.g., password123, qwerty). Uses built-in list of 10,000+ common passwords.           | false   | true (strongly recommended)        |
| `preventUserInfo`     | Block passwords containing user's email or username. Prevents john@example.com using john123.                 | false   | true                               |
| `historyCount`        | Number of previous passwords to remember. Prevents password reuse. 0 = disabled.                              | 0       | 5 for compliance, 0 for simplicity |
| `expiryDays`          | Force password change after N days. 0 = never expires. **Note:** NIST no longer recommends forced expiration. | 0       | 0 (disabled) or 90 for compliance  |

### Password Reset Options

Controls the forgot-password flow (code delivery is handled by your configured email/SMS provider).

| Option          | Description                                                    | Default |
| --------------- | -------------------------------------------------------------- | ------- |
| `codeLength`    | Verification code length sent to the user.                     | 6       |
| `expiresIn`     | Code expiry in seconds.                                        | 900 (15 minutes) |
| `rateLimitMax`  | Maximum reset requests per time window. Prevents abuse.        | 3       |
| `rateLimitWindow` | Time window for rate limiting (seconds).                     | 3600 (1 hour) |
| `maxAttempts`   | Maximum code verification attempts per code. Prevents brute force. | 3  |

```typescript
password: {
  // ... policy options ...
  passwordReset: {
    codeLength: 6,
    expiresIn: 900,       // 15 minutes
    rateLimitMax: 3,
    rateLimitWindow: 3600,
    maxAttempts: 3,
  },
},
```

### Admin Password Reset Options

Controls admin-initiated password resets. Longer expiry by default; no rate limiting (admin-initiated).

| Option       | Description                                                        | Default           |
| ------------ | ------------------------------------------------------------------ | ----------------- |
| `codeLength` | Verification code length.                                          | 6                 |
| `expiresIn`  | Code expiry in seconds. Longer than user-initiated (admin context). | 3600 (1 hour)    |
| `maxAttempts`| Maximum code verification attempts per code.                       | 3                 |

**Account Lockout Options:**

| Option           | Description                                                                                    | Default | Recommended      |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------- | ---------------- |
| `enabled`        | Enable IP-based account lockout after failed login attempts.                                   | false   | true             |
| `maxAttempts`    | Number of failed login attempts before lockout. Too low = UX issues, too high = security risk. | 5       | 5                |
| `attemptWindow`  | Time window in seconds over which `maxAttempts` is counted. Prevents indefinite accumulation.  | 3600    | 3600 (1 hour)    |
| `duration`       | Lockout duration in seconds. After this time, the lockout lifts.                               | 900     | 900 (15 minutes) |
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

## Token Delivery {#token-delivery}

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

### Hybrid policy (tokenDelivery.method = 'hybrid')

In hybrid mode, nauth-toolkit chooses between cookies vs JSON delivery for each request. Delivery is resolved in this order:

1. **Route-level override** — `@TokenDelivery('json' | 'cookies')` (NestJS) or `nauth.helpers.tokenDelivery(...)` (Express/Fastify). Typically used for dedicated `/mobile` endpoints.
2. **Origin-based classification** — `webOrigins` → cookies, `nativeOrigins` → json.

```typescript
tokenDelivery: {
  method: 'hybrid',
  hybridPolicy: {
    webOrigins: ['https://app.myapp.com'],
    nativeOrigins: ['capacitor://localhost', 'ionic://localhost'],

    // Optional: per-delivery refresh token TTLs
    // When set, the resolved delivery mode selects which TTL is used.
    // Fall back to jwt.refreshToken.expiresIn when unset.
    cookieRefreshExpiresIn: '7d',   // Shorter lifetime for browsers (cookies)
    jsonRefreshExpiresIn:   '90d',  // Longer lifetime for mobile / workers (json)
  },
},
```

| Property | Type | Purpose |
| --- | --- | --- |
| `webOrigins` | `string[]` | Origins that resolve to cookies delivery when no route-level override is set. |
| `nativeOrigins` | `string[]` | Origins that resolve to json delivery when no route-level override is set. |
| `cookieRefreshExpiresIn` | `string \| number` | Refresh token TTL applied when a request resolves to cookies delivery. Falls back to `jwt.refreshToken.expiresIn`. |
| `jsonRefreshExpiresIn` | `string \| number` | Refresh token TTL applied when a request resolves to json delivery. Falls back to `jwt.refreshToken.expiresIn`. |

:::note Hybrid-only
`cookieRefreshExpiresIn` and `jsonRefreshExpiresIn` are read only when `tokenDelivery.method === 'hybrid'`. They're ignored in `'json'` or `'cookies'` mode.
:::

:::tip Common pairing
Short cookie TTL (`7d`) for web and long json TTL (`90d`) for mobile gives browsers tight blast-radius while letting native apps stay signed in for months without re-authentication.
:::

## Session Configuration {#session-configuration}

Manage user sessions and concurrency.

```typescript
session: {
  maxConcurrent: 5,                  // Max active sessions per user
  disallowMultipleSessions: false,   // If true, only 1 session allowed
  maxLifetime: '30d',                // Hard limit: force re-auth after 30 days
},
```

## Social Login {#social-authentication}

Configure OAuth providers.

```typescript
social: {
  // social.redirect is required when any provider is enabled — see Social Redirect below
  redirect: {
    frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'https://app.myapp.com',
  },

  google: {
    enabled: !!process.env.GOOGLE_CLIENT_ID,
    clientId: process.env.GOOGLE_CLIENT_ID,
    // Or array for multi-platform: [webClientId, iosClientId, androidClientId]
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: `${process.env.API_BASE_URL}/auth/social/google/callback`,
    scopes: ['openid', 'email', 'profile'],
    autoLink: true,      // Auto-link to existing account by email match
    allowSignup: true,   // Create new account if no match found
  },

  apple: {
    enabled: !!process.env.APPLE_CLIENT_ID,
    clientId: process.env.APPLE_CLIENT_ID,  // Apple Services ID (e.g., com.myapp.services)
    // Apple requires a JWT client secret for web OAuth. The toolkit generates and refreshes
    // it automatically from your Apple Developer credentials (stored in DB, refreshed ~30 days before expiry).
    teamId: process.env.APPLE_TEAM_ID,      // Apple Developer Team ID
    keyId: process.env.APPLE_KEY_ID,        // Key ID (kid) from your .p8 key file
    privateKeyPem: process.env.APPLE_PRIVATE_KEY_PEM,  // Contents of your .p8 file as PEM string
    callbackUrl: `${process.env.API_BASE_URL}/auth/social/apple/callback`,
    scopes: ['name', 'email'],
    autoLink: true,
    allowSignup: true,
  },

  facebook: {
    enabled: !!process.env.FACEBOOK_CLIENT_ID,
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackUrl: `${process.env.API_BASE_URL}/auth/social/facebook/callback`,
    scopes: ['email', 'public_profile'],
    autoLink: true,
    allowSignup: true,
  },
},
```

### Social Redirect (`social.redirect`)

:::warning Required when social login is enabled
`social.redirect.frontendBaseUrl` is **required** whenever any social provider is enabled. The Zod schema will throw a validation error at startup if it is missing.
:::

After OAuth completes, the backend redirects the user back to your frontend. Configure where that redirect lands:

```typescript
social: {
  redirect: {
    frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'https://app.myapp.com',
    // Allow returnTo query param to specify a post-login destination URL.
    // false = relative paths only (safest); true = absolute URLs allowed (requires allowedReturnToOrigins)
    allowAbsoluteReturnTo: false,
    // Required when allowAbsoluteReturnTo is true — prevents open-redirect attacks
    allowedReturnToOrigins: ['https://app.myapp.com', 'https://admin.myapp.com'],
  },
  google: { enabled: true, ... },
},
```

| Option | Description | Default |
| ------ | ----------- | ------- |
| `frontendBaseUrl` | **Required.** Base URL of your frontend app. Used to resolve relative `returnTo` redirect paths after OAuth. | — |
| `allowAbsoluteReturnTo` | Allow absolute URLs in `returnTo` query param. Enable only for multi-frontend setups. | false |
| `allowedReturnToOrigins` | Origin allowlist enforced when `allowAbsoluteReturnTo` is true. Prevents open redirects. | — |

## Multi-Factor Authentication (MFA) {#multi-factor-authentication}

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
    triggers: ['new_device', 'new_ip', 'new_country', 'impossible_travel', 'suspicious_activity', 'recent_password_reset'],
    riskLevels: {
      low: { maxScore: 20, action: 'allow', notifyUser: false },
      medium: { maxScore: 50, action: 'require_mfa', notifyUser: true },
      high: { maxScore: 100, action: 'require_mfa', notifyUser: true },
    },
    blockedSignIn: {
      // Block scope controls the blast radius of `block_signin`.
      // - 'ip': block the suspicious IP
      // - 'device': block the device token
      // - 'user': block the whole user (strongest, highest DoS risk)
      scope: 'ip',
      blockDuration: 15, // minutes
      message: 'Sign-in blocked due to suspicious activity. Please try again shortly or contact support.',
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

## Geolocation {#geolocation}

Configure IP geolocation for adaptive MFA.

```typescript
geoLocation: {
  maxMind: {
    licenseKey: process.env.MAXMIND_LICENSE_KEY,
    accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0'),
    dbPath: '/app/data/maxmind',   // Optional: defaults to system temp directory
    autoDownloadOnStartup: true,   // true = download DB files on startup (requires licenseKey + accountId)
    editions: ['GeoLite2-City', 'GeoLite2-Country'],
    skipDownloads: false,          // true = manage DB files externally (CI/CD pre-download pattern)
  },
},
```

## Audit Logs {#audit-logs}

Configure audit trail.

```typescript
auditLogs: {
  enabled: true,
  fireAndForget: false,  // Set true for performance (no await)
},
```

## Telemetry {#telemetry}

Anonymous usage telemetry (config shape only — no PII, IPs, or secrets). See [Telemetry](/docs/concepts/telemetry) for exactly what is sent.

```typescript
telemetry: {
  enabled: false,  // Opt out (default: true)
},
```

| Option | Description | Default |
| --- | --- | --- |
| `enabled` | Enable anonymous usage telemetry | `true` |

:::note Opt-out without code changes
Set `NAUTH_TELEMETRY_DISABLED=1` (or `DO_NOT_TRACK=1`) in the environment. Telemetry is always disabled in CI and tests.
:::

## reCAPTCHA {#recaptcha}

Protect authentication endpoints from bot attacks using Google reCAPTCHA v2, v3, or Enterprise.

:::note
Social OAuth endpoints (`/auth/social/*`) are **not** protected by reCAPTCHA — OAuth providers handle their own bot protection.
:::

```bash npm2yarn
npm install @nauth-toolkit/recaptcha
```

```typescript
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';

recaptcha: {
  enabled: true,
  provider: new RecaptchaV3Provider({
    secretKey: process.env.RECAPTCHA_SECRET_KEY,
  }),
  minimumScore: 0.5,  // v3/Enterprise only. 0.0 = bot, 1.0 = human
  actionScores: {     // Optional: per-action overrides
    login: 0.3,       // More permissive for returning users
    signup: 0.7,      // Stricter for new registrations
  },
  validateOnStartup: 'warn',  // 'warn' | 'error' | false
},
```

**reCAPTCHA Options:**

| Option         | Description                                                                                    | Default |
| -------------- | ---------------------------------------------------------------------------------------------- | ------- |
| `enabled`      | Enable reCAPTCHA validation on auth endpoints.                                                 | false   |
| `provider`     | Provider instance. Choose [`RecaptchaV2Provider`](/docs/api/recaptcha/providers/recaptcha-v2-provider), [`RecaptchaV3Provider`](/docs/api/recaptcha/providers/recaptcha-v3-provider), or [`RecaptchaEnterpriseProvider`](/docs/api/recaptcha/providers/recaptcha-enterprise-provider). | —  |
| `minimumScore` | Default minimum score (0.0–1.0). Used when no per-action override exists in `actionScores`. v3/Enterprise only. | 0.5 |
| `actionScores` | Per-action score overrides (`Record<string, number>`). Keys: `login`, `signup`, `password_reset`, etc. Falls back to `minimumScore`. | — |
| `validateOnStartup` | Validate credentials at startup. `'warn'`: log warning on failure. `'error'`: halt startup. `false`: skip. | `'warn'` |

**Choosing a provider:**

| Provider | Interaction | Best For |
| -------- | ----------- | -------- |
| [`RecaptchaV3Provider`](/docs/api/recaptcha/providers/recaptcha-v3-provider) | Invisible, score-based | Most web apps — no user friction |
| [`RecaptchaV2Provider`](/docs/api/recaptcha/providers/recaptcha-v2-provider) | Checkbox ("I'm not a robot") | Highest-risk actions, legacy setups |
| [`RecaptchaEnterpriseProvider`](/docs/api/recaptcha/providers/recaptcha-enterprise-provider) | Score-based with advanced signals | Enterprise — requires GCP project |

## Challenge Configuration {#challenge}

Challenge session limits for flows like verification, MFA, and step-up challenges.

```typescript
challenge: {
  maxAttempts: 3, // Default: 3
},
```

## API Keys {#api-keys}

Long-lived keys that authenticate as their owning user. Disabled by default. See the [API Keys guide](../guides/api-keys.md) for routes and decorators.

```typescript
apiKeys: {
  enabled: true,             // Default: false
  allowUserCreation: false,  // Default: false (admin-only creation). true = users self-serve
  header: 'X-API-Key',       // Default: 'X-API-Key' (case-insensitive)
  maxKeysPerUser: 10,        // Default: 10
  maxExpiryDays: 365,        // Caps finite expiries; omit for no cap
  allowIndefinite: true,     // Default: true (allow never-expiring keys)
  trackUsageIp: true,        // Default: true (record last-used IP per key)
  lastUsedThrottleSeconds: 60, // Default: 60 (throttle last-used writes)
  globalAllowlist: false,    // Default: false (opt-in per route via @AllowApiKey())
  ipRestrictions: {
    enabled: true,           // Default: true (allow per-key IP allowlists)
    requireForNewKeys: false, // Default: false
    maxIpsPerKey: 20,        // Default: 20
  },
},
```

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `false` | Enable API key authentication |
| `allowUserCreation` | `false` | Allow end users (not just admins) to create keys |
| `header` | `'X-API-Key'` | Header carrying the key; when present it is the only credential used |
| `maxKeysPerUser` | `10` | Maximum active keys per user |
| `maxExpiryDays` | — | Caps finite expiry; unset means no cap |
| `allowIndefinite` | `true` | Allow never-expiring keys |
| `trackUsageIp` | `true` | Record the source IP of each key's last use |
| `globalAllowlist` | `false` | Accept keys on all protected routes (opt-out via `@DenyApiKey()`) |
| `ipRestrictions.enabled` | `true` | Allow per-key IP allowlists (IPs / IPv4 CIDR) |
| `ipRestrictions.requireForNewKeys` | `false` | Require an allowlist on every new key |
| `ipRestrictions.maxIpsPerKey` | `20` | Max allowlist entries per key |

## Complete Example

Here's a production-ready configuration:

```typescript title="src/config/auth.config.ts"
import { NAuthModuleConfig, MFAMethod, createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
import { AWSSMSProvider } from '@nauth-toolkit/sms-aws-sns';
import { Logger } from '@nestjs/common';

export const authConfig: NAuthModuleConfig = {
  tablePrefix: 'nauth_',

  storageAdapter: createRedisStorageAdapter(process.env.REDIS_URL || 'redis://localhost:6379'),

  jwt: {
    algorithm: 'HS256',
    issuer: 'com.myapp',
    audience: ['web', 'mobile'],
    accessToken: { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
      reuseDetection: true,
    },
  },

  logger: {
    instance: new Logger('NAuth'),
    enablePiiRedaction: true,
    logLevel: 'log',  // 'error' | 'warn' | 'log' | 'debug' | 'verbose'
  },

  signup: {
    enabled: true,
    verificationMethod: 'email',
    emailVerification: {
      expiresIn: 3600,
      resendDelay: 60,
      rateLimitMax: 3,
      rateLimitWindow: 3600,
      baseUrl: 'https://myapp.com',  // Optional: include verification link in emails
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

  // Option 1: SMTP Transport
  emailProvider: new NodemailerEmailProvider({
    transport: {
      host: process.env.SMTP_HOST,
      port: 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    defaults: {
      from: `My App <${process.env.EMAIL_FROM || 'noreply@myapp.com'}>`,
    },
  }),

  // Option 2: AWS SES SDK Transport (with IAM roles)
  // import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
  // emailProvider: new NodemailerEmailProvider({
  //   transport: {
  //     SES: {
  //       sesClient: new SESv2Client({ region: process.env.AWS_REGION || 'us-east-1' }),
  //       SendEmailCommand,
  //     },
  //   },
  //   defaults: {
  //     from: 'My App <noreply@myapp.com>',
  //   },
  // }),

  email: {
    globalVariables: {
      appName: 'My App',
      companyName: 'My Company Inc.',
      supportEmail: 'support@myapp.com',
      logoUrl: 'https://myapp.com/logo.png',
      brandColor: '#4f46e5',
    },
  },

  smsProvider: new AWSSMSProvider({
    region: process.env.AWS_REGION as string,
    originationNumber: process.env.AWS_SMS_ORIGINATION as string,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    // apiMode: 'end-user-messaging-sms',
    // configurationSetName: 'default',
  }),

  sms: {
    templates: {
      globalVariables: {
        appName: 'My App',
      },
    },
  },

  social: {
    redirect: {
      frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'https://app.myapp.com',
    },
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: `${process.env.API_BASE_URL || 'https://api.myapp.com'}/auth/social/google/callback`,
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
