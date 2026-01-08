---
title: IUserProfileUpdatedHook
description: Hook interface for user profile attribute changes
keywords: [hooks, profile, user, interface]
image: /img/api-social-card.png
---
# IUserProfileUpdatedHook

Hook interface for executing actions after user profile attribute changes.

## Overview

The `IUserProfileUpdatedHook` interface enables reactions to user profile attribute changes. This includes core attributes (firstName, lastName, username, email, phone, metadata) and verification status (isEmailVerified, isPhoneVerified).

The hook is **non-blocking** - errors are logged but do not affect the update operation.

## Interface

```typescript
interface IUserProfileUpdatedHook {
  execute(metadata: UserProfileUpdatedMetadata): Promise<void>;
}
```

## Metadata

### UserProfileUpdatedMetadata

```typescript
interface UserProfileUpdatedMetadata {
  user: IUser;
  changedFields: ChangedField[];
  updateSource: UserProfileUpdateSource;
  performedBy?: string;
  clientInfo?: ClientInfo;
}
```

| Property        | Type                      | Description                                 |
| --------------- | ------------------------- | ------------------------------------------- |
| `user`          | `IUser`                   | Updated user entity (after change)          |
| `changedFields` | `ChangedField[]`          | Fields that changed with old/new values     |
| `updateSource`  | `UserProfileUpdateSource` | What triggered the update                   |
| `performedBy`   | `string`                  | Admin user sub (admin_action source only)   |
| `clientInfo`    | `ClientInfo`              | IP, user agent, location                    |

### ChangedField

```typescript
interface ChangedField {
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
}
```

| Property    | Type      | Description                 |
| ----------- | --------- | --------------------------- |
| `fieldName` | `string`  | Name of the field           |
| `oldValue`  | `unknown` | Previous value              |
| `newValue`  | `unknown` | New value                   |

### UserProfileUpdateSource

```typescript
type UserProfileUpdateSource =
  | 'user_request'
  | 'admin_action'
  | 'email_verification'
  | 'phone_verification';
```

## When Hook Fires

**Included Changes:**
- Core attributes: `firstName`, `lastName`, `username`, `email`, `phone`, `metadata`
- Verification status: `isEmailVerified`, `isPhoneVerified`

**Excluded Changes:**
- Password changes (use `IPasswordChangedHook`)
- Account lock/unlock (use `IAccountLockedHook`)
- MFA changes (use `IMFADeviceRemovedHook`, `IMFAFirstEnabledHook`)

## Example

```typescript
import { IUserProfileUpdatedHook, UserProfileUpdatedMetadata } from '@nauth-toolkit/core';

export class CrmSyncHook implements IUserProfileUpdatedHook {
  async execute(metadata: UserProfileUpdatedMetadata): Promise<void> {
    const emailChange = metadata.changedFields.find(f => f.fieldName === 'email');
    if (emailChange) {
      await this.crmService.updateContact(metadata.user.sub, {
        email: emailChange.newValue as string
      });
    }
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [@UserProfileUpdatedHook()](/docs/api/nestjs/decorators/user-profile-updated-hook) - NestJS decorator
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete hooks overview

