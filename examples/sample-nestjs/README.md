# Sample NestJS App with nauth-toolkit

Complete example of integrating `@nauth-toolkit/core` into a NestJS application.

##  Quick Start (5 Minutes)

### 1. Install & Setup

```bash
cd examples/sample-app
yarn install

# Create .env file
cp .env.example .env
# Edit .env with your database credentials
```

### 2. Run the App

```bash
yarn start
```

Visit: http://localhost:3000

---

##  What's Inside

This sample app demonstrates:

- - Basic NestJS 11 setup
- - PostgreSQL connection with TypeORM
- - Local `@nauth-toolkit/core` integration (workspace package)
- ⏳ Auth endpoints (coming soon via AuthModule)

---

##  Current Setup

### Environment Variables (Important!)

**Two types of environment variables:**

1. **App-Level Variables** (No prefix)
   - Variables YOUR app reads and configures
   - Examples: `DB_HOST`, `JWT_SECRET`, `PORT`

2. **NAuth Variables** (`NAUTH_` prefix)
   - Variables nauth-toolkit reads internally
   - Examples: `NAUTH_EMAIL_PROVIDER`, `NAUTH_SMTP_HOST`

**File:** `.env.example`

```env
# ========================================
# Application Configuration (Your App)
# ========================================
PORT=3000
NODE_ENV=development

# Database (your app configures TypeORM)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=nauth_user
DB_PASSWORD=your_password_here
DB_DATABASE=nauth_sample

# JWT (your app passes to AuthModule.forRoot())
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# ========================================
# nauth-toolkit Configuration
# ========================================
# Email Provider
NAUTH_EMAIL_PROVIDER=console
NAUTH_EMAIL_FROM="My App <noreply@example.com>"

# SMTP Settings (for nodemailer)
NAUTH_SMTP_HOST=smtp.mailtrap.io
NAUTH_SMTP_PORT=2525
NAUTH_SMTP_USER=your_smtp_username
NAUTH_SMTP_PASS=your_smtp_password

# Email Templates
NAUTH_TEMPLATE_APP_NAME="My Application"
NAUTH_TEMPLATE_COMPANY_NAME="My Company"
NAUTH_TEMPLATE_BRAND_COLOR="#4CAF50"

# Google OAuth (Social Login)
NAUTH_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
NAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
# iOS Client ID (optional, for Capacitor iOS apps)
NAUTH_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```

**Why the prefix?** The `NAUTH_` prefix prevents conflicts with your application's environment variables. Your app owns `JWT_SECRET`, but nauth-toolkit owns `NAUTH_EMAIL_PROVIDER`.

**Google OAuth - Multiple Client IDs:**

- **Web/Android**: One client ID works for both
- **iOS**: Requires separate client ID due to Capacitor plugin requirements
- Backend accepts both client IDs and validates ID tokens from either platform

### Database Configuration

See `.env.example` for all database settings.

### TypeORM Configuration

**File:** `src/app.module.ts`

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [], // nauth entities will be added here
  synchronize: true, // Auto-create tables in development
  logging: true,
});
```

---

##  How to Integrate nauth-toolkit

### Option A: Using AuthModule (Recommended - Coming Soon)

This is how it WILL work once `AuthModule` is complete:

**File:** `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@nauth-toolkit/core';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      // ... your DB config
      entities: [], // Auto-populated by AuthModule
      synchronize: true, // Creates tables automatically
    }),

    //  ONE LINE - Everything is configured!
    AuthModule.forRoot({
      jwt: {
        algorithm: 'HS256',
        accessToken: {
          secret: process.env.JWT_SECRET,
          expiresIn: '15m',
        },
        refreshToken: {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: '30d',
        },
      },
      password: {
        minLength: 8,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
      },
    }),
  ],
  // No need to create controllers manually!
  // AuthModule provides them automatically
})
export class AppModule {}
```

**That's it!** The `AuthModule` will:

- - Create database tables automatically (`nauth_users`, `nauth_sessions`, etc.)
- - Provide pre-built controllers with all endpoints:
  - `POST /auth/signup`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `GET /auth/logout`
  - `POST /auth/password/reset`
  - `GET /auth/me` (get current user)
- - Add guards (`@UseGuards(AuthGuard)`)
- - Add decorators (`@CurrentUser()`, `@Public()`)

### Option B: Manual Integration (Current - For Testing)

While `AuthModule` is being completed, you can test individual services:

**File:** `src/test.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PasswordService } from '@nauth-toolkit/core';

@Injectable()
export class TestService {
  private readonly passwordService: PasswordService;

  constructor() {
    this.passwordService = new PasswordService();
  }

  async testPassword() {
    const hash = await this.passwordService.hashPassword('Test123!');
    const valid = await this.passwordService.verifyPassword('Test123!', hash);
    return { hash, valid };
  }
}
```

**Test it:**

```bash
curl http://localhost:3000/test-nauth
```

---

##  Database Tables

When `AuthModule` is integrated, it will automatically create these tables:

### `nauth_users`

```sql
id              uuid PRIMARY KEY
email           varchar(255) UNIQUE
passwordHash    varchar(255)
isEmailVerified boolean DEFAULT false
isActive        boolean DEFAULT true
isLocked        boolean DEFAULT false
createdAt       timestamp
updatedAt       timestamp
```

### `nauth_sessions`

```sql
id                  uuid PRIMARY KEY
userId              uuid FK -> nauth_users.id
accessTokenHash     varchar(255)
refreshTokenHash    varchar(255)
tokenFamily         varchar(255)
deviceId            varchar(255)
ipAddress           varchar(45)
userAgent           text
expiresAt           timestamp
isRevoked           boolean DEFAULT false
createdAt           timestamp
```

### `nauth_token_blacklist`

```sql
id          uuid PRIMARY KEY
tokenHash   varchar(255) UNIQUE
userId      uuid FK -> nauth_users.id
type        varchar(20)
expiresAt   timestamp
reason      varchar(100)
createdAt   timestamp
```

### `nauth_login_attempts`

```sql
id              serial PRIMARY KEY
email           varchar(255)
userId          uuid NULLABLE
ipAddress       varchar(45)
userAgent       text
success         boolean
failureReason   varchar(100)
createdAt       timestamp
```

**These are created automatically** when `synchronize: true` in development!

---

##  Using Guards in Your Controllers

After `AuthModule` is integrated:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Public } from '@nauth-toolkit/core';

@Controller('api')
@UseGuards(AuthGuard) // Protect all routes
export class ApiController {
  @Public() // This specific route is public
  @Get('public-data')
  getPublic() {
    return { message: 'Anyone can access this' };
  }

  @Get('protected-data')
  getProtected(@CurrentUser() user: any) {
    return {
      message: 'Only authenticated users',
      user: user,
    };
  }
}
```

---

##  API Endpoints (Auto-Generated)

Once `AuthModule` is integrated, you get these endpoints automatically:

### Authentication

```bash
# Signup
POST /auth/signup
Body: { email: "user@example.com", password: "SecurePass123!" }
Response: { accessToken, refreshToken, user }

# Login
POST /auth/login
Body: { email: "user@example.com", password: "SecurePass123!" }
Response: { accessToken, refreshToken, user }

# Refresh Token
POST /auth/refresh
Body: { refreshToken: "..." }
Response: { accessToken, refreshToken }

# Logout
GET /auth/logout
Headers: { Authorization: "Bearer <accessToken>" }
Response: { success: true }

# Get Current User
GET /auth/me
Headers: { Authorization: "Bearer <accessToken>" }
Response: { user }
```

### Password Management

```bash
# Change Password
POST /auth/password/change
Headers: { Authorization: "Bearer <accessToken>" }
Body: { oldPassword: "...", newPassword: "..." }

# Request Password Reset
POST /auth/password/reset/request
Body: { email: "user@example.com" }

# Reset Password
POST /auth/password/reset
Body: { token: "...", newPassword: "..." }
```

---

##  Development Workflow

### Testing Local Package Changes

**Terminal 1: Auto-rebuild core package**

```bash
cd /Users/noorix/development/nauth-toolkit/packages/core
yarn build --watch
```

**Terminal 2: Auto-restart sample app**

```bash
cd /Users/noorix/development/nauth-toolkit/examples/sample-app
yarn dev
```

Now changes in `packages/core/src/` automatically rebuild and restart the app!

### Testing the Integration

**Test current integration:**

```bash
# Health check
curl http://localhost:3000

# Test nauth password service
curl http://localhost:3000/test-nauth
```

**Once AuthModule is ready:**

```bash
# Create a user
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Get current user
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

---

##  Configuration Options

Full configuration available in `AuthModule.forRoot()`:

```typescript
AuthModule.forRoot({
  // JWT Configuration
  jwt: {
    algorithm: 'HS256' | 'RS256',
    accessToken: {
      secret: string,
      expiresIn: '15m',
    },
    refreshToken: {
      secret: string,
      expiresIn: '30d',
      rotation: true,
      reuseDetection: true,
    },
  },

  // Password Policy
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    historyCount: 5, // Prevent reusing last 5 passwords
  },

  // Account Lockout
  lockout: {
    enabled: true,
    maxAttempts: 5,
    duration: 900, // 15 minutes in seconds
    resetOnSuccess: true,
  },

  // Session Management
  session: {
    enabled: true,
    maxConcurrent: 5,
    slidingExpiration: true,
  },

  // Email Verification (Phase 2)
  email: {
    verification: {
      enabled: true,
      method: 'code',
      expiresIn: 3600,
    },
  },
});
```

---

##  Troubleshooting

### Database Connection Failed

```bash
# Test PostgreSQL connection
psql -h dev.anyspaces.ph -U nauth_user -d nauth_sample

# If database doesn't exist, create it:
CREATE DATABASE nauth_sample;
```

### "Cannot find module '@nauth-toolkit/core'"

```bash
# Rebuild and reinstall
cd /Users/noorix/development/nauth-toolkit
yarn install
cd packages/core
yarn build
```

### Tables Not Created

Make sure `synchronize: true` in `TypeOrmModule.forRoot()` for development.

For production, use migrations:

```bash
# Generate migration
npx typeorm migration:generate -n InitialSchema

# Run migrations
npx typeorm migration:run
```

### Changes Not Reflecting

1. Rebuild core: `cd packages/core && yarn build`
2. Restart app: `cd examples/sample-app && yarn start`

---

##  What's Next?

### Current Status: Phase 1 (~40% Complete)

- **Done:**

- Password hashing (Argon2id)
- JWT generation & validation
- Storage adapters (Memory)
- Services (PasswordService, JwtService)
- Unit tests (32 passing)

 **In Progress:**

- AuthModule (will provide auto-registration)
- Database entities (User, Session, etc.)
- Guards and decorators
- Pre-built controllers

⏳ **Not Started:**

- Email verification
- Social login
- Multi-factor authentication

### How You'll Use It (Final Version)

**Step 1: Install**

```bash
yarn add @nauth-toolkit/core
```

**Step 2: Configure**

```typescript
// src/app.module.ts
import { AuthModule } from '@nauth-toolkit/core';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      /* your DB */
    }),
    AuthModule.forRoot({
      /* auth config */
    }),
  ],
})
export class AppModule {}
```

**Step 3: Done!**
All endpoints, guards, and decorators are ready to use.

---

##  Learning Resources

- **Main README:** `/README.md` - Project overview
- **Requirements:** `/docs/NESTJS_AUTH_TOOLKIT_REQUIREMENTS.md` - Full specifications
- **Rules:** `/docs/RULES.md` - Development standards
- **Progress:** `/docs/PROGRESS.md` - Implementation status

---

##  Tips

### Generate Strong Secrets

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate refresh secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Environment-Specific Config

```typescript
// Use ConfigModule for better env management
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthModule.forRoot(authConfig),
  ],
})
```

---

##  Current Sample App Structure

```
sample-app/
├── src/
│   ├── main.ts              # Bootstrap (loads .env)
│   ├── app.module.ts        # Root module + TypeORM
│   ├── app.controller.ts    # Health & test endpoints
│   ├── app.service.ts       # App info service
│   └── test.service.ts      # Tests PasswordService
├── .env                     # Your database config
├── package.json            # Dependencies (includes @nauth-toolkit/core)
└── README.md               # This file
```

---

** Ready to use!** Start the app and visit http://localhost:3000/test-nauth to see nauth-toolkit in action.

Once `AuthModule` is complete, just add one import and you'll have a complete auth system! 
