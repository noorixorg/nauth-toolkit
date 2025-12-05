# @nauth-toolkit/database-typeorm-mysql

MySQL database adapter for nauth-toolkit using TypeORM.

## Installation

```bash
yarn add @nauth-toolkit/core @nauth-toolkit/database-typeorm-mysql typeorm mysql2
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@nauth-toolkit/core';
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-mysql';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: 3306,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: getNAuthEntities(), // ✅ Register entities here
      synchronize: false, // Use migrations in production!
    }),
    AuthModule.forRoot({
      // ✅ Entities not needed - auto-discovered from DataSource
      jwt: {
        accessToken: { secret: process.env.JWT_SECRET },
        refreshToken: { secret: process.env.JWT_REFRESH_SECRET },
      },
      // ... other config
    }),
  ],
})
export class AppModule {}
```

## Features

- ✅ MySQL-compatible column types
- ✅ JSON storage for complex types (metadata, arrays)
- ✅ UUID support via char(36)
- ✅ All nauth-toolkit entities included
- ✅ Optimized indexes for performance

## Column Type Mappings

The MySQL adapter automatically maps PostgreSQL types to MySQL equivalents:

| PostgreSQL | MySQL | Notes |
|------------|-------|-------|
| `uuid` | `char(36)` | UUID stored as string |
| `jsonb` | `json` | MySQL uses json, not jsonb |
| `text[]` | `json` | Arrays stored as JSON |
| `boolean` | `tinyint(1)` | MySQL boolean is tinyint |
| `timestamp` | `datetime` | MySQL datetime type |
| `integer` | `int` | MySQL int type |

## Entities

- `User` - User accounts and authentication data
- `Session` - Active user sessions
- `SocialAccount` - OAuth provider linkages
- `MFADevice` - Multi-factor authentication devices
- `VerificationToken` - Email/phone verification tokens
- `ChallengeSession` - Temporary challenge sessions
- `LoginAttempt` - Login attempt audit logs

## License

MIT

