---
title: Entities
description: Base entity classes for database models
keywords: [entities, database, typeorm, api]
image: /img/api-social-card.png
---
# Entities

**Package:** `@nauth-toolkit/core`
**Type:** Base Classes

Database-agnostic entity classes. Database adapters extend these with ORM decorators.

## Available Entities

| Entity | Description |
|--------|-------------|
| `BaseUser` | User account with credentials and profile |
| `BaseSession` | Active user session |
| `BaseTrustedDevice` | MFA-trusted device |
| `BaseLoginAttempt` | Login attempt tracking |
| `BaseVerificationToken` | Email/phone verification tokens |
| `BaseSocialAccount` | Linked social provider accounts |
| `BaseChallengeSession` | MFA challenge sessions |
| `BaseMFADevice` | Registered MFA devices |
| `BaseAuthAudit` | Security audit log entries |
| `BaseRateLimit` | Rate limiting records |
| `BaseStorageLock` | Distributed lock records |

## Usage

```typescript
import { BaseUser, BaseSession } from '@nauth-toolkit/core';
```

Database packages extend these:

```typescript
// @nauth-toolkit/database-typeorm-postgres
@Entity('users')
export class User extends BaseUser {
  @PrimaryGeneratedColumn('uuid')
  sub: string;

  @Column()
  email: string;
  // ...
}
```

## Related

- [Database Package](/docs/api/database/overview)

