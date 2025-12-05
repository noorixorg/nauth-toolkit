# @nauth-toolkit/database-typeorm-postgres

PostgreSQL database adapter for nauth-toolkit using TypeORM.

## Installation

```bash
yarn add @nauth-toolkit/core @nauth-toolkit/database-typeorm-postgres typeorm pg
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@nauth-toolkit/core';
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: 5432,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: getNAuthEntities(), // ✅ Register entities here
      synchronize: false, // Use migrations in production!
    }),
    AuthModule.forRoot({
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

- ✅ Native UUID support
- ✅ JSONB for metadata storage
- ✅ Native array types
- ✅ All nauth-toolkit entities included
- ✅ Optimized indexes for performance

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
