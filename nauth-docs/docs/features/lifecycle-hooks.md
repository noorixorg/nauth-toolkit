---
title: Lifecycle Hooks
description: Extend authentication flows with custom validation, notifications, and integrations
sidebar_position: 21
keywords: [hooks, lifecycle, events, validation, notifications]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Lifecycle Hooks

Inject custom logic at specific points in the authentication flow. Lifecycle hooks enable validation, notifications, integrations, and business logic without modifying core authentication code.

This guide assumes you already completed the [Quick Start](/docs/quick-start) and have `AuthModule.forRoot(authConfig)` working.

## What You Can Do with Hooks

- **Block signups** based on business rules (domain whitelisting, invite codes, rate limits)
- **Send notifications** (welcome emails, Slack alerts, admin notifications)
- **Integrate external systems** (CRM sync, analytics tracking, billing setup)
- **Audit events** (custom logging, compliance tracking)
- **Provision resources** (create workspace, assign default permissions)

## How Hooks Work

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Hooks as Lifecycle Hooks
    participant DB as Database

    User->>Frontend: Sign up
    Frontend->>Backend: POST /auth/signup
    Backend->>Hooks: executePreSignup()

    alt Pre-signup hook blocks
        Hooks-->>Backend: throw NAuthException
        Backend-->>Frontend: 400 Error
        Frontend-->>User: Show error message
    else Pre-signup hook passes
        Hooks-->>Backend: Success
        Backend->>DB: Create user
        DB-->>Backend: User created
        Backend->>Hooks: executeAfterSignup()
        Note over Hooks: Errors logged,<br/>don't block signup
        Hooks-->>Backend: Complete (non-blocking)
        Backend-->>Frontend: 200 { challengeName or tokens }
        Frontend-->>User: Continue flow
    end
```

## Available Hooks

| Hook            | When                 | Can Block? | Use Cases                                                  |
| --------------- | -------------------- | ---------- | ---------------------------------------------------------- |
| **preSignup**   | Before user creation | Yes        | Validation, domain whitelisting, invite codes              |
| **afterSignup** | After user creation  | No         | Welcome emails, analytics, CRM sync, resource provisioning |

:::tip Future Hooks
Additional hooks (afterLogin, beforePasswordChange, etc.) will follow the same pattern. The architecture is designed for extensibility.
:::

## Before You Start

Choose your integration approach:

| Platform    | Registration Method     | Dependency Injection |
| ----------- | ----------------------- | -------------------- |
| **NestJS**  | Automatic (decorators)  | Full DI support      |
| **Express** | Manual (registry calls) | Manual instantiation |
| **Fastify** | Manual (registry calls) | Manual instantiation |

## Step 1: Create Your Hook

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

Create a hook class that implements the hook interface:

```typescript title="src/auth/hooks/domain-validation.hook.ts"
import { Injectable, Logger } from '@nestjs/common';
import { PreSignupHook, IPreSignupHookProvider, NAuthException, AuthErrorCode } from '@nauth-toolkit/nestjs';

@Injectable()
@PreSignupHook({ priority: 1 })
export class DomainValidationHook implements IPreSignupHookProvider {
  private readonly logger = new Logger(DomainValidationHook.name);
  private readonly allowedDomains = ['company.com', 'partner.com'];

  /**
   * Validate email domain before signup
   */
  async execute(userData, signupMethod, providerId, adminSignup) {
    // Skip validation for admin-initiated signups
    if (adminSignup) {
      this.logger.log(`Skipping validation for admin signup: ${userData.email}`);
      return;
    }

    // Extract and validate domain
    const email = userData.email;
    if (!email) return; // Let core validation handle missing email

    const domain = email.split('@')[1];
    if (!this.allowedDomains.includes(domain)) {
      this.logger.warn(`Blocked signup from disallowed domain: ${domain}`);

      // Block the signup
      throw new NAuthException(
        AuthErrorCode.PRESIGNUP_FAILED,
        `Email domain ${domain} is not allowed. Please use a company email address.`,
      );
    }

    this.logger.log(`Domain validation passed: ${domain}`);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

Create a hook class that implements the hook interface:

```typescript title="src/hooks/domain-validation.hook.ts"
import { IPreSignupHookProvider, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

export class DomainValidationHook implements IPreSignupHookProvider {
  private allowedDomains = ['company.com', 'partner.com'];

  async execute(userData, signupMethod, providerId, adminSignup) {
    // Skip validation for admin signups
    if (adminSignup) return;

    const email = userData.email;
    if (!email) return;

    const domain = email.split('@')[1];
    if (!this.allowedDomains.includes(domain)) {
      throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, `Email domain ${domain} is not allowed`);
    }
  }
}
```

</TabItem>
<TabItem value="fastify" label="Fastify">

Create a hook class that implements the hook interface:

```typescript title="src/hooks/domain-validation.hook.ts"
import { IPreSignupHookProvider, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

export class DomainValidationHook implements IPreSignupHookProvider {
  private allowedDomains = ['company.com', 'partner.com'];

  async execute(userData, signupMethod, providerId, adminSignup) {
    // Skip validation for admin signups
    if (adminSignup) return;

    const email = userData.email;
    if (!email) return;

    const domain = email.split('@')[1];
    if (!this.allowedDomains.includes(domain)) {
      throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, `Email domain ${domain} is not allowed`);
    }
  }
}
```

</TabItem>
</Tabs>

## Step 2: Register Your Hook

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

Register hooks using `NAuthHooksModule.forFeature()`:

```typescript title="src/auth/auth.module.ts"
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { authConfig } from './auth.config';
import { DomainValidationHook } from './hooks/domain-validation.hook';

@Module({
  imports: [AuthModule.forRoot(authConfig), NAuthHooksModule.forFeature([DomainValidationHook])],
})
export class CustomAuthModule {}
```

**That's it!** The hook is automatically discovered and registered.

</TabItem>
<TabItem value="express" label="Express">

Register hooks manually with the `HookRegistryService`:

```typescript title="src/index.ts"
import { NAuth } from '@nauth-toolkit/core';
import { DomainValidationHook } from './hooks/domain-validation.hook';

const nauth = await NAuth.create(authConfig, dataSource);

// Register pre-signup hook
nauth.hookRegistry.registerPreSignup(new DomainValidationHook());

app.use('/auth', nauth.routes);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

Register hooks manually with the `HookRegistryService`:

```typescript title="src/index.ts"
import { NAuth } from '@nauth-toolkit/core';
import { DomainValidationHook } from './hooks/domain-validation.hook';

const nauth = await NAuth.create(authConfig, dataSource);

// Register pre-signup hook
nauth.hookRegistry.registerPreSignup(new DomainValidationHook());

fastify.register(nauth.routes, { prefix: '/auth' });
```

</TabItem>
</Tabs>

## Step 3: Test Your Hook

Try signing up with an invalid domain:

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@blocked.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Response (blocked):**

```json
{
  "statusCode": 400,
  "code": "PRESIGNUP_FAILED",
  "message": "Email domain blocked.com is not allowed. Please use a company email address."
}
```

Try with an allowed domain:

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Response (success):**

```json
{
  "challengeName": "VERIFY_EMAIL",
  "session": "...",
  "challengeParameters": {
    "email": "user@company.com",
    "codeDeliveryDestination": "u***@company.com"
  }
}
```

## Pre-Signup Hooks (Validation)

Pre-signup hooks execute **before** user creation and can **block signups** by throwing exceptions.

### When They Run

- Password signup (before user saved to database)
- Social signup (before user creation)
- Admin signup (`adminSignup` and `adminSignupSocial`)

### Common Use Cases

<Tabs>
<TabItem value="domain" label="Domain Whitelisting" default>

Block signups from unauthorized email domains:

```typescript
@Injectable()
@PreSignupHook()
export class DomainValidationHook implements IPreSignupHookProvider {
  private readonly allowedDomains = ['company.com', 'partner.com'];

  async execute(userData, signupMethod, providerId, adminSignup) {
    if (adminSignup) return;

    const domain = userData.email?.split('@')[1];
    if (domain && !this.allowedDomains.includes(domain)) {
      throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, `Domain ${domain} not allowed`);
    }
  }
}
```

</TabItem>
<TabItem value="invite" label="Invite Code">

Require valid invite code for signups:

```typescript
@Injectable()
@PreSignupHook()
export class InviteCodeHook implements IPreSignupHookProvider {
  constructor(private readonly inviteService: InviteService) {}

  async execute(userData, signupMethod, providerId, adminSignup) {
    if (adminSignup) return;

    const inviteCode = userData.metadata?.inviteCode;
    if (!inviteCode) {
      throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Invite code required');
    }

    const isValid = await this.inviteService.validate(inviteCode);
    if (!isValid) {
      throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Invalid invite code');
    }

    // Mark invite as used
    await this.inviteService.markUsed(inviteCode, userData.email);
  }
}
```

</TabItem>
<TabItem value="ratelimit" label="Rate Limiting">

Prevent signup abuse with custom rate limiting:

```typescript
@Injectable()
@PreSignupHook()
export class SignupRateLimitHook implements IPreSignupHookProvider {
  constructor(
    private readonly redis: RedisService,
    @Inject('REQUEST') private readonly req: Request,
  ) {}

  async execute(userData, signupMethod, providerId, adminSignup) {
    if (adminSignup) return;

    const ip = this.req.ip;
    const key = `signup:ratelimit:${ip}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 3600); // 1 hour window
    }

    if (count > 3) {
      throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Too many signup attempts. Please try again later.');
    }
  }
}
```

</TabItem>
<TabItem value="api" label="External API Check">

Validate against external API before allowing signup:

```typescript
@Injectable()
@PreSignupHook()
export class ExternalValidationHook implements IPreSignupHookProvider {
  constructor(private readonly httpService: HttpService) {}

  async execute(userData, signupMethod, providerId, adminSignup) {
    if (adminSignup) return;

    // Check if email is disposable/temporary
    try {
      const response = await this.httpService
        .get(`https://api.emailvalidation.com/check?email=${userData.email}`)
        .toPromise();

      if (response.data.disposable) {
        throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Temporary email addresses are not allowed');
      }
    } catch (error) {
      // Log but don't block on API failures
      this.logger.error('Email validation API failed', error);
    }
  }
}
```

</TabItem>
</Tabs>

### Blocking Signups

Throw `NAuthException` with code `PRESIGNUP_FAILED` to block the signup:

```typescript
throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'User-facing error message');
```

The user receives a `400 Bad Request` response with your custom message.

### Execution Behavior

- Hooks execute in priority order (lower priority number = earlier execution)
- **First hook to throw stops execution** - subsequent hooks are skipped
- Signup is blocked when any hook throws

```typescript
// Priority 1 - Executes first
@PreSignupHook({ priority: 1 })
export class DomainValidation {}

// Priority 2 - Executes second (if priority 1 passes)
@PreSignupHook({ priority: 2 })
export class InviteCodeCheck {}
```

## After-Signup Hooks (Notifications & Integrations)

After-signup hooks execute **after** successful user creation. They're **non-blocking** - errors are logged but don't affect signup.

### When They Run

- After password signup completes
- After social signup completes
- After admin signup completes

### Common Use Cases

<Tabs>
<TabItem value="email" label="Welcome Email" default>

Send welcome email after signup:

```typescript
@Injectable()
@AfterSignupHook()
export class WelcomeEmailHook implements IAfterSignupHookProvider {
  private readonly logger = new Logger(WelcomeEmailHook.name);

  constructor(private readonly emailService: EmailService) {}

  async execute(user, metadata) {
    try {
      await this.emailService.sendWelcome({
        to: user.email,
        firstName: user.firstName,
        signupMethod: metadata?.signupType,
      });

      this.logger.log(`Welcome email sent to: ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email: ${error.message}`);
      // Error doesn't block signup
    }
  }
}
```

</TabItem>
<TabItem value="analytics" label="Analytics Tracking">

Track signup events in your analytics platform:

```typescript
@Injectable()
@AfterSignupHook()
export class AnalyticsHook implements IAfterSignupHookProvider {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly logger: Logger,
  ) {}

  async execute(user, metadata) {
    try {
      await this.analytics.track('user_signup', {
        userId: user.sub,
        email: user.email,
        signupMethod: metadata?.signupType,
        provider: metadata?.provider,
        timestamp: new Date().toISOString(),
      });

      // Create user profile
      await this.analytics.identify(user.sub, {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      });
    } catch (error) {
      this.logger.error('Analytics tracking failed', error);
    }
  }
}
```

</TabItem>
<TabItem value="crm" label="CRM Sync">

Sync new users to your CRM:

```typescript
@Injectable()
@AfterSignupHook()
export class CrmSyncHook implements IAfterSignupHookProvider {
  constructor(
    private readonly crm: CrmService,
    private readonly logger: Logger,
  ) {}

  async execute(user, metadata) {
    try {
      const contact = await this.crm.createContact({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        source: metadata?.signupType === 'social' ? `social_${metadata.provider}` : 'direct_signup',
        tags: ['new_user', 'pending_onboarding'],
      });

      this.logger.log(`CRM contact created: ${contact.id}`);
    } catch (error) {
      this.logger.error('CRM sync failed', error);
      // Queue for retry
      await this.queueService.add('crm-sync', {
        userId: user.sub,
        retryCount: 0,
      });
    }
  }
}
```

</TabItem>
<TabItem value="provision" label="Resource Provisioning">

Create workspace and assign default permissions:

```typescript
@Injectable()
@AfterSignupHook()
export class ProvisioningHook implements IAfterSignupHookProvider {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly permissionService: PermissionService,
    private readonly logger: Logger,
  ) {}

  async execute(user, metadata) {
    try {
      // Create default workspace
      const workspace = await this.workspaceService.create({
        name: `${user.firstName}'s Workspace`,
        ownerId: user.sub,
      });

      // Assign default permissions
      await this.permissionService.assignRole(user.sub, 'owner', workspace.id);

      // Create default resources
      await this.workspaceService.createDefaults(workspace.id);

      this.logger.log(`Workspace provisioned for user: ${user.sub}`);
    } catch (error) {
      this.logger.error('Provisioning failed', error);
    }
  }
}
```

</TabItem>
</Tabs>

### Error Handling

After-signup hooks are non-blocking. All errors are caught and logged:

```typescript
async execute(user, metadata) {
  // If this throws, error is logged but signup continues
  await this.emailService.sendWelcome(user.email);

  // This still executes even if above fails
  await this.analytics.track('signup', { userId: user.sub });
}
```

**Best Practice:** Handle errors explicitly for better control:

```typescript
async execute(user, metadata) {
  try {
    await this.emailService.sendWelcome(user.email);
  } catch (error) {
    this.logger.error('Welcome email failed:', error);
    // Optional: Queue for retry
    await this.queueService.add('welcome-email', { userId: user.id });
  }
}
```

### Execution Behavior

- All hooks execute regardless of errors
- Errors are caught and logged per hook
- Signup is never blocked
- Next hook always executes

## Multiple Hooks

Register multiple hooks to compose behavior:

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript
@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([
      // Pre-signup hooks (execute in priority order)
      DomainValidationHook, // priority: 1
      InviteCodeHook, // priority: 2
      // After-signup hooks (execute in priority order)
      WelcomeEmailHook, // priority: 1
      AnalyticsHook, // priority: 2
      CrmSyncHook, // priority: 3
    ]),
  ],
  providers: [
    // Don't forget hook dependencies
    InviteService,
    EmailService,
    AnalyticsService,
    CrmService,
  ],
})
export class AuthModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
// Register pre-signup hooks (execute in order)
nauth.hookRegistry.registerPreSignup(new DomainValidationHook());
nauth.hookRegistry.registerPreSignup(new InviteCodeHook(inviteService));

// Register after-signup hooks (execute in order)
nauth.hookRegistry.registerAfterSignup(new WelcomeEmailHook(emailService));
nauth.hookRegistry.registerAfterSignup(new AnalyticsHook(analytics));
nauth.hookRegistry.registerAfterSignup(new CrmSyncHook(crm));
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
// Register pre-signup hooks (execute in order)
nauth.hookRegistry.registerPreSignup(new DomainValidationHook());
nauth.hookRegistry.registerPreSignup(new InviteCodeHook(inviteService));

// Register after-signup hooks (execute in order)
nauth.hookRegistry.registerAfterSignup(new WelcomeEmailHook(emailService));
nauth.hookRegistry.registerAfterSignup(new AnalyticsHook(analytics));
nauth.hookRegistry.registerAfterSignup(new CrmSyncHook(crm));
```

</TabItem>
</Tabs>

## Using Signup Metadata

The `metadata` parameter provides context about the signup:

```typescript
interface SignupMetadata {
  requiresVerification?: boolean; // User needs to verify email/phone
  signupType?: 'password' | 'social'; // How user signed up
  provider?: string; // Social provider (google, apple, facebook)
  adminSignup?: boolean; // Whether admin-initiated
}
```

**Example: Contextual logic based on signup type:**

```typescript
@AfterSignupHook()
export class ContextualEmailHook implements IAfterSignupHookProvider {
  async execute(user, metadata) {
    if (metadata?.signupType === 'social') {
      // Social signup
      await this.emailService.sendSocialWelcome(
        user.email,
        metadata.provider, // 'google', 'apple', 'facebook'
      );
    } else {
      // Password signup
      if (metadata?.requiresVerification) {
        await this.emailService.sendVerificationReminder(user.email);
      } else {
        await this.emailService.sendWelcome(user.email);
      }
    }

    // Track admin-initiated signups separately
    if (metadata?.adminSignup) {
      await this.analytics.track('admin_created_user', { userId: user.sub });
    }
  }
}
```

## Testing Hooks

Hooks are regular classes and can be unit tested:

```typescript
describe('DomainValidationHook', () => {
  let hook: DomainValidationHook;

  beforeEach(() => {
    hook = new DomainValidationHook();
  });

  it('should allow valid domain', async () => {
    const userData = { email: 'user@company.com' };
    await expect(hook.execute(userData, 'password', null, false)).resolves.not.toThrow();
  });

  it('should block invalid domain', async () => {
    const userData = { email: 'user@blocked.com' };
    await expect(hook.execute(userData, 'password', null, false)).rejects.toThrow(NAuthException);
  });

  it('should skip validation for admin signups', async () => {
    const userData = { email: 'user@blocked.com' };
    await expect(hook.execute(userData, 'password', null, true)).resolves.not.toThrow();
  });
});
```

## Best Practices

### Keep Hooks Focused

Each hook should have a single responsibility:

```typescript
// Good - Single responsibility
@PreSignupHook()
export class DomainValidationHook {}

@PreSignupHook()
export class InviteCodeHook {}

// Bad - Multiple responsibilities
@PreSignupHook()
export class ValidationHook {
  // Validates domain
  // Validates invite code
  // Checks rate limits
  // Too many responsibilities!
}
```

### Use Dependency Injection

Leverage framework DI for testability:

```typescript
@Injectable()
@PreSignupHook()
export class InviteCodeHook implements IPreSignupHookProvider {
  constructor(
    private readonly inviteService: InviteService,
    private readonly logger: Logger,
  ) {}

  async execute(userData, signupMethod, providerId, adminSignup) {
    const isValid = await this.inviteService.validate(userData.email);
    if (!isValid) {
      throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Valid invite required');
    }
  }
}
```

### Handle Errors Gracefully

For after-signup hooks, handle errors to avoid breaking signup flow:

```typescript
@AfterSignupHook()
export class WelcomeEmailHook implements IAfterSignupHookProvider {
  async execute(user, metadata) {
    try {
      await this.emailService.sendWelcome(user.email);
    } catch (error) {
      this.logger.error('Welcome email failed:', error);
      // Queue for retry instead of failing
      await this.queueService.add('welcome-email', { userId: user.id });
    }
  }
}
```

### Skip Admin Signups When Appropriate

Admin signups often bypass validation rules:

```typescript
async execute(userData, signupMethod, providerId, adminSignup) {
  // Skip validation for admin-initiated signups
  if (adminSignup) return;

  // Apply validation rules for normal signups
  // ...
}
```

### Use Priority for Ordering

Order hooks by dependency and importance:

```typescript
@PreSignupHook({ priority: 1 }) // Check domain first (fast)
export class DomainValidation {}

@PreSignupHook({ priority: 2 }) // Then check invite (database query)
export class InviteCodeCheck {}

@PreSignupHook({ priority: 3 }) // Finally check API (slow)
export class ExternalApiCheck {}
```

## API Reference

Complete reference for all hook-related classes and interfaces:

### Interfaces

| Interface                  | Description                 | Documentation                                                                                 |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| `IPreSignupHookProvider`   | Pre-signup hook interface   | [IPreSignupHookProvider](/docs/api/core/interfaces/hook-providers#ipreSignuphookprovider)     |
| `IAfterSignupHookProvider` | After-signup hook interface | [IAfterSignupHookProvider](/docs/api/core/interfaces/hook-providers#iaftersignuphookprovider) |
| `SignupMetadata`           | Signup metadata interface   | [SignupMetadata](/docs/api/core/interfaces/hook-providers#signupmetadata)                     |

### Services

| Service               | Description               | Documentation                                                        |
| --------------------- | ------------------------- | -------------------------------------------------------------------- |
| `HookRegistryService` | Hook registration service | [HookRegistryService](/docs/api/core/services/hook-registry-service) |

### NestJS Decorators

| Decorator            | Description                 | Documentation                                                       |
| -------------------- | --------------------------- | ------------------------------------------------------------------- |
| `@PreSignupHook()`   | Pre-signup hook decorator   | [@PreSignupHook()](/docs/api/nestjs/decorators/pre-signup-hook)     |
| `@AfterSignupHook()` | After-signup hook decorator | [@AfterSignupHook()](/docs/api/nestjs/decorators/after-signup-hook) |
| `NAuthHooksModule`   | Hook registration module    | [NAuthHooksModule](/docs/api/nestjs/decorators/nauth-hooks-module)  |

## Related

- [Challenge System](/docs/concepts/challenge-system) - Understanding authentication flows
- [Error Handling](/docs/concepts/error-handling) - Exception handling patterns
- [Authentication Routes](/docs/features/routes) - Complete route implementation
