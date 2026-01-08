---
title: Database
description: TypeORM entity packages for PostgreSQL and MySQL
keywords: [database, typeorm, postgres, mysql, entities, api]
image: /img/api-social-card.png
---
# Database

TypeORM entity packages for different databases.

## Available Packages

| Database | Package |
|----------|---------|
| PostgreSQL | [TypeORM PostgreSQL](./typeorm-postgres) |
| MySQL/MariaDB | [TypeORM MySQL](./typeorm-mysql) |

## What They Provide

Database packages provide TypeORM entity classes for authentication data.

### User/Session Entities

Always include via `getNAuthEntities()`:
- User accounts
- Active sessions
- Login history
- Email/phone verification
- Social account links
- MFA devices
- Audit logs

### Storage Entities

Only include via `getNAuthTransientStorageEntities()` if using `DatabaseStorageAdapter`:
- Rate limiting counters
- Distributed locks

## Quick Start

Pick your database package, import entities:

```typescript
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';
// or
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-mysql';
```

Add to TypeORM:

```typescript
entities: [
  ...getNAuthEntities(),
  // Your entities...
]
```

## Related

- [TypeORM PostgreSQL](./typeorm-postgres)
- [TypeORM MySQL](./typeorm-mysql)
- [Session Storage](../storage/overview)
