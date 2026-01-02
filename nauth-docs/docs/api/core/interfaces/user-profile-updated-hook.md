# IUserProfileUpdatedHook

Post-hook interface for tracking user profile attribute changes.

## Overview

The `IUserProfileUpdatedHook` interface enables external systems to react when user profile attributes change. This includes core attributes (firstName, lastName, username, email, phone, metadata) and verification status (isEmailVerified, isPhoneVerified).

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
  clientInfo?: {
    ipAddress?: string;
    userAgent?: string;
    ipCountry?: string;
    ipCity?: string;
  };
}
```

| Property | Type | Description |
|----------|------|-------------|
| `user` | `IUser` | Updated user entity (complete state after change) |
| `changedFields` | `ChangedField[]` | Array of fields that changed with old/new values |
| `updateSource` | `UserProfileUpdateSource` | What triggered the update |
| `performedBy` | `string` | Admin user sub (only for admin_action source) |
| `clientInfo` | `object` | Client information (IP address, user agent, location) |

### ChangedField

```typescript
interface ChangedField {
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `fieldName` | `string` | Name of the field that changed |
| `oldValue` | `unknown` | Previous value before update |
| `newValue` | `unknown` | New value after update |

### UserProfileUpdateSource

```typescript
type UserProfileUpdateSource =
  | 'user_request'
  | 'admin_action'
  | 'email_verification'
  | 'phone_verification';
```

## When Hook Fires

### Included Changes
- Core attributes: `firstName`, `lastName`, `username`, `email`, `phone`, `metadata`
- Verification status: `isEmailVerified`, `isPhoneVerified`

### Excluded Changes
- Password changes
- Account lock/unlock
- Login state
- MFA changes
- Social account linkages

## Example

```typescript
import { IUserProfileUpdatedHook, UserProfileUpdatedMetadata } from '@nauth-toolkit/core';

export class CrmSyncHook implements IUserProfileUpdatedHook {
  async execute(metadata: UserProfileUpdatedMetadata): Promise<void> {
    // Sync email changes to CRM
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

- [HookRegistryService](../services/hook-registry-service.md)
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks)

