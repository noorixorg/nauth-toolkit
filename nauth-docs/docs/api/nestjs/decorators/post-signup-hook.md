---
title: '@PostSignupHook()'
description: Decorator for automatic post-signup hook registration in NestJS
sidebar_position: 5
keywords: [decorator, hooks, lifecycle, postsignup, notifications]
image: /img/api-social-card.png
---

# @PostSignupHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Class decorator that automatically registers a provider as a post-signup hook. Post-signup hooks execute after successful user creation for notifications, integrations, and analytics. Non-blocking - errors are logged but don't affect signup.

:::tip Import from NestJS Package

```typescript
import { PostSignupHook } from '@nauth-toolkit/nestjs';
```

:::

## Overview

The `@PostSignupHook()` decorator enables automatic hook registration without manual setup. Classes decorated with this decorator are discovered at module initialization and registered with the [`HookRegistryService`](/docs/api/core/services/hook-registry-service).

**Key Features:**

- Automatic hook discovery and registration
- No manual registry calls required
- Full dependency injection support
- Priority-based execution ordering
- Non-blocking - errors don't affect signup
- Type-safe with TypeScript

**When Post-Signup Hooks Execute:**

- After password signup completes
- After social signup completes
- After admin signup completes

## Usage

### Basic Hook

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PostSignupHook, IPostSignupHookProvider } from '@nauth-toolkit/nestjs';
import { EmailService } from '../services/email.service';

@Injectable()
@PostSignupHook()
export class WelcomeEmailHook implements IPostSignupHookProvider {
  private readonly logger = new Logger(WelcomeEmailHook.name);

  constructor(private readonly emailService: EmailService) {}

  async execute(user, metadata) {
    try {
      this.logger.log(`Sending welcome email to: ${user.email}`);

      await this.emailService.sendWelcome({
        to: user.email,
        firstName: user.firstName,
        signupMethod: metadata?.signupType,
      });

      this.logger.log(`Welcome email sent to: ${user.email}`);
    } catch (error) {
      // Errors are logged but don't block signup
      this.logger.error(`Failed to send welcome email: ${error.message}`);
    }
  }
}
```

### With Priority

Control execution order using the `priority` option. Lower priority values execute first:

```typescript
import { Injectable } from '@nestjs/common';
import { PostSignupHook, IPostSignupHookProvider } from '@nauth-toolkit/nestjs';

@Injectable()
@PostSignupHook({ priority: 1 }) // Executes first
export class WelcomeEmailHook implements IPostSignupHookProvider {
  async execute(user, metadata) {
    // Send welcome email
  }
}

@Injectable()
@PostSignupHook({ priority: 2 }) // Executes second
export class AnalyticsHook implements IPostSignupHookProvider {
  async execute(user, metadata) {
    // Track signup event
  }
}
```

**Default Priority:** If not specified, priority defaults to `100`.

### With Dependency Injection

Hooks support full NestJS dependency injection:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PostSignupHook, IPostSignupHookProvider } from '@nauth-toolkit/nestjs';
import { EmailService } from '../services/email.service';
import { AnalyticsService } from '../services/analytics.service';
import { CrmService } from '../services/crm.service';

@Injectable()
@PostSignupHook()
export class UserProvisioningHook implements IPostSignupHookProvider {
  private readonly logger = new Logger(UserProvisioningHook.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly analytics: AnalyticsService,
    private readonly crm: CrmService,
  ) {}

  async execute(user, metadata) {
    try {
      // Send welcome email
      await this.emailService.sendWelcome(user.email);

      // Track signup event
      await this.analytics.track('user_signup', {
        userId: user.sub,
        signupMethod: metadata?.signupType,
        provider: metadata?.provider,
      });

      // Sync to CRM
      await this.crm.createContact({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });

      this.logger.log(`User provisioning complete for: ${user.email}`);
    } catch (error) {
      this.logger.error(`User provisioning failed: ${error.message}`);
      // Error doesn't block signup
    }
  }
}
```

### Module Registration

Register hooks using `NAuthHooksModule.forFeature()`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { authConfig } from './auth.config';
import { WelcomeEmailHook } from './hooks/welcome-email.hook';
import { AnalyticsHook } from './hooks/analytics.hook';

@Module({
  imports: [AuthModule.forRoot(authConfig), NAuthHooksModule.forFeature([WelcomeEmailHook, AnalyticsHook])],
  providers: [EmailService, AnalyticsService], // Hook dependencies
})
export class CustomAuthModule {}
```

## Error Handling

Post-signup hooks are non-blocking. All errors are caught and logged automatically:

```typescript
@Injectable()
@PostSignupHook()
export class NotificationHook implements IPostSignupHookProvider {
  async execute(user, metadata) {
    // If this throws, error is logged but signup continues
    await this.notificationService.send(user.email);

    // Subsequent code still executes
    await this.otherService.doSomething();
  }
}
```

**Execution Behavior:**

- All hooks execute regardless of errors
- Errors are caught and logged per hook
- Signup is never blocked
- Next hook always executes

**Best Practice:** Handle errors explicitly within your hook for better control:

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

## Using Signup Metadata

The `metadata` parameter provides context about the signup:

```typescript
@Injectable()
@PostSignupHook()
export class ContextualEmailHook implements IPostSignupHookProvider {
  async execute(user, metadata) {
    if (metadata?.signupType === 'social') {
      // Social signup - use profile picture and social metadata
      await this.emailService.sendSocialWelcome({
        email: user.email,
        provider: metadata.provider, // 'google', 'apple', 'facebook'
        profilePicture: metadata.profilePicture, // Profile picture URL
        locale: metadata.socialMetadata?.locale as string | undefined, // From social metadata
      });
    } else {
      // Password signup
      if (metadata?.requiresVerification) {
        // User needs to verify email/phone
        await this.emailService.sendVerificationReminder(user.email);
      } else {
        // Standard welcome
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

**Using Social Metadata:**

For social signups, you can access the complete OAuth profile data:

```typescript
@Injectable()
@PostSignupHook()
export class ProfileSetupHook implements IPostSignupHookProvider {
  async execute(user, metadata) {
    if (metadata?.signupType === 'social' && metadata.socialMetadata) {
      // Extract additional data from social provider
      const socialData = metadata.socialMetadata;
      const locale = socialData.locale as string | undefined;
      const timezone = socialData.timezone as string | undefined;

      // Update user profile with social data
      await this.userService.updateProfile(user.sub, {
        locale,
        timezone,
        profilePictureUrl: metadata.profilePicture,
      });

      // Sync to external systems with full OAuth profile
      await this.crmService.createContact({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: metadata.profilePicture,
        source: `social_${metadata.provider}`,
        metadata: metadata.socialMetadata, // Full OAuth profile data
      });
    }
  }
}
```

## Testing

Hooks are regular NestJS providers and can be unit tested:

```typescript
import { Test } from '@nestjs/testing';
import { WelcomeEmailHook } from './welcome-email.hook';
import { EmailService } from '../services/email.service';

describe('WelcomeEmailHook', () => {
  let hook: WelcomeEmailHook;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const mockEmailService = {
      sendWelcome: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [WelcomeEmailHook, { provide: EmailService, useValue: mockEmailService }],
    }).compile();

    hook = module.get(WelcomeEmailHook);
    emailService = module.get(EmailService);
  });

  it('should send welcome email', async () => {
    const user = {
      sub: 'user-123',
      email: 'user@example.com',
      firstName: 'John',
    };

    await hook.execute(user, { signupType: 'password' });

    expect(emailService.sendWelcome).toHaveBeenCalledWith({
      to: 'user@example.com',
      firstName: 'John',
      signupMethod: 'password',
    });
  });

  it('should not throw on email service error', async () => {
    emailService.sendWelcome.mockRejectedValue(new Error('SMTP failed'));

    const user = {
      sub: 'user-123',
      email: 'user@example.com',
      firstName: 'John',
    };

    // Should not throw - errors are caught
    await expect(hook.execute(user, { signupType: 'password' })).resolves.not.toThrow();
  });
});
```

## Related APIs

- [`IPostSignupHookProvider`](/docs/api/core/interfaces/hook-providers#ipostsignuphookprovider) - Post-signup hook interface
- [`@PreSignupHook()`](./pre-signup-hook) - Pre-signup hook decorator
- [`HookRegistryService`](/docs/api/core/services/hook-registry-service) - Hook registry service
- [`NAuthHooksModule`](./nauth-hooks-module) - Hook registration module
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete usage guide
