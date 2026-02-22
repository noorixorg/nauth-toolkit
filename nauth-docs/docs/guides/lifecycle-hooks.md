---
title: 'Lifecycle Hooks'
description: 'Add custom validation, notifications, and integrations to authentication flows with lifecycle hooks'
sidebar_position: 7
keywords: [hooks, lifecycle, events, validation, notifications, pre-signup, post-signup]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Lifecycle Hooks

Add custom logic at specific points in the authentication flow --- block signups based on business rules, send notifications, sync to external systems, or audit events.

nauth-toolkit provides 13 hooks across user lifecycle, security, and account management events. See [Lifecycle Hooks Concept](/docs/concepts/lifecycle-hooks) for the full list, execution model, and API reference.

## Prerequisites

- A working auth setup ([Quick Start](/docs/quick-start/nestjs))

## Step 1: Create Your Hook

This example sends a custom email when a user changes their password:

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/hooks/password-changed-email.hook.ts"
import { Injectable } from '@nestjs/common';
import {
  PasswordChangedHook,
  IPasswordChangedHook,
  PasswordChangedMetadata,
} from '@nauth-toolkit/nestjs';

@Injectable()
@PasswordChangedHook({ priority: 1 })
export class PasswordChangedEmailHook implements IPasswordChangedHook {
  constructor(private readonly emailService: EmailService) {}

  async execute(metadata: PasswordChangedMetadata): Promise<void> {
    await this.emailService.sendPasswordChangedAlert({
      to: metadata.user.email,
      changedBy: metadata.changedBy,
      timestamp: new Date(),
      sessionsRevoked: metadata.sessionsRevoked,
    });
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/hooks/password-changed-email.hook.ts"
import { IPasswordChangedHook } from '@nauth-toolkit/core';

export class PasswordChangedEmailHook implements IPasswordChangedHook {
  constructor(private emailService) {}

  async execute(metadata) {
    await this.emailService.sendPasswordChangedAlert({
      to: metadata.user.email,
      changedBy: metadata.changedBy,
      timestamp: new Date(),
      sessionsRevoked: metadata.sessionsRevoked,
    });
  }
}
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/hooks/password-changed-email.hook.ts"
import { IPasswordChangedHook } from '@nauth-toolkit/core';

export class PasswordChangedEmailHook implements IPasswordChangedHook {
  constructor(private emailService) {}

  async execute(metadata) {
    await this.emailService.sendPasswordChangedAlert({
      to: metadata.user.email,
      changedBy: metadata.changedBy,
      timestamp: new Date(),
      sessionsRevoked: metadata.sessionsRevoked,
    });
  }
}
```

</TabItem>
</Tabs>

## Step 2: Register Your Hook

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/auth.module.ts"
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { authConfig } from './auth.config';
import { PasswordChangedEmailHook } from './hooks/password-changed-email.hook';

@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([PasswordChangedEmailHook]),
  ],
})
export class CustomAuthModule {}
```

The hook is automatically discovered and registered.

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/index.ts"
import { NAuth } from '@nauth-toolkit/core';
import { PasswordChangedEmailHook } from './hooks/password-changed-email.hook';

const nauth = await NAuth.create(authConfig, dataSource);

nauth.hookRegistry.registerPasswordChanged(
  new PasswordChangedEmailHook(emailService)
);

app.use('/auth', nauth.routes);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/index.ts"
import { NAuth } from '@nauth-toolkit/core';
import { PasswordChangedEmailHook } from './hooks/password-changed-email.hook';

const nauth = await NAuth.create(authConfig, dataSource);

nauth.hookRegistry.registerPasswordChanged(
  new PasswordChangedEmailHook(emailService)
);

fastify.register(nauth.routes, { prefix: '/auth' });
```

</TabItem>
</Tabs>

## Best Practices

### Keep hooks focused

Each hook should have a single responsibility:

```typescript
// Good - Single responsibility
@PasswordChangedHook()
export class PasswordChangedEmailHook {}

@PasswordChangedHook()
export class PasswordChangedAnalyticsHook {}

// Bad - Multiple responsibilities
@PasswordChangedHook()
export class PasswordChangedEverythingHook {
  // Sends email, logs to analytics, syncs to CRM — too many things
}
```

### Handle errors gracefully

Non-blocking hooks should handle errors explicitly:

```typescript
async execute(metadata) {
  try {
    await this.emailService.send(metadata.user.email);
  } catch (error) {
    this.logger.error('Email failed:', error);
    await this.queueService.add('retry-email', { userId: metadata.user.id });
  }
}
```

### Use dependency injection

Leverage framework DI for testability:

```typescript
@Injectable()
@PasswordChangedHook({ priority: 1 })
export class PasswordChangedEmailHook implements IPasswordChangedHook {
  constructor(
    private readonly emailService: EmailService,
    private readonly logger: Logger,
  ) {}
}
```

## What's Next

- **[Lifecycle Hooks Concept](/docs/concepts/lifecycle-hooks)** --- All 13 hooks, execution model, blocking behavior, and API reference
- **[Notifications & Templates](/docs/concepts/notifications)** --- Built-in email and SMS notifications (alternative to custom hooks)
- **[Email Templates](/docs/guides/email-templates)** --- Customize built-in email templates
- **[Challenge System](/docs/concepts/challenge-system)** --- Understanding authentication flows
