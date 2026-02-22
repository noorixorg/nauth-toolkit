---
title: IEmailChangedHook
description: Hook interface for email address change events
keywords: [hooks, email, security, interface]
image: /img/api-social-card.png
---
# IEmailChangedHook

Hook interface for executing actions after email address changes.

## Overview

The `IEmailChangedHook` interface enables reactions to email change events. Typically triggers TWO emails for security: one to the old address (alert) and one to the new address (confirmation).

The hook is **non-blocking** - errors are logged but do not affect the email change operation.

## Interface

```typescript
interface IEmailChangedHook {
  execute(metadata: EmailChangedMetadata): Promise<void>;
}
```

## Metadata

### EmailChangedMetadata

```typescript
interface EmailChangedMetadata {
  user: IUser;
  oldEmail: string;
  newEmail: string;
  updateSource: UserProfileUpdateSource;
  deactivatedMFADevices?: number;
  clientInfo?: ClientInfo;
}
```

| Property               | Type                       | Description                           |
| ---------------------- | -------------------------- | ------------------------------------- |
| `user`                 | `IUser`                    | User whose email changed              |
| `oldEmail`             | `string`                   | Old email address (before change)     |
| `newEmail`             | `string`                   | New email address (after change)      |
| `updateSource`         | `UserProfileUpdateSource`  | Source of the email change            |
| `deactivatedMFADevices`| `number`                   | MFA devices deactivated due to change |
| `clientInfo`           | `ClientInfo`               | IP, user agent, location              |

## When Hook Fires

- User changes email via `updateUserAttributes()`

## Example

```typescript
import { IEmailChangedHook, EmailChangedMetadata } from '@nauth-toolkit/core';

export class EmailChangedNotificationHook implements IEmailChangedHook {
  async execute(metadata: EmailChangedMetadata): Promise<void> {
    // Alert to old email
    await this.emailService.sendEmailChangedAlertEmail({
      to: metadata.oldEmail,
      newEmail: metadata.newEmail,
    });

    // Confirmation to new email
    await this.emailService.sendEmailChangedConfirmationEmail({
      to: metadata.newEmail,
    });
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [@EmailChangedHook()](/docs/api/nestjs/decorators/email-changed-hook) - NestJS decorator
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete hooks overview

