---
title: AuthGuard
description: JWT authentication guard for protecting NestJS routes
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AuthGuard

**Package:** `@nauth-toolkit/nestjs`
**Type:** Guard

NestJS guard that validates JWT tokens and protects routes from unauthorized access.

:::tip Import from NestJS Package
```typescript
import { AuthGuard } from '@nauth-toolkit/nestjs';
```
:::

## Overview

The `AuthGuard` is a NestJS CanActivate guard that extracts and validates JWT access tokens from requests. It automatically populates `req.user` with authenticated user information.

**Key Features:**

- JWT token validation
- Session-based revocation checking
- Automatic session activity updates
- Support for public routes via `@Public()` decorator
- Support for both Authorization header and cookies
- User data attachment to request
- Token reuse detection

**Security Features:**

- Token expiration checking
- Session expiration validation
- Token blacklist checking
- Optimistic locking for TOCTOU prevention
- Session revocation enforcement

## Usage

### Basic Route Protection

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nauth-toolkit/nestjs';

@Controller('api')
@UseGuards(AuthGuard)  // Protect all routes in controller
export class ApiController {
  @Get('/protected')
  getProtectedData() {
    return { data: 'This is protected' };
  }
}
```

### Global Guard

Apply guard globally to all routes:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard, AuthModule } from '@nauth-toolkit/nestjs';

@Module({
  imports: [AuthModule.forRoot(config)],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
```

### Public Routes

Mark routes as public using `@Public()` decorator:

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
@UseGuards(AuthGuard)  // Applied to controller
export class AuthController {
  @Public()  // Bypass guard for this route
  @Post('/login')
  async login(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('/signup')
  async signup(@Body() dto: SignupDTO) {
    return this.authService.signup(dto);
  }

  @Get('/profile')  // Protected - requires auth
  getProfile(@CurrentUser() user: IUser) {
    return { user };
  }
}
```

### Access User Data

Use `@CurrentUser()` decorator to get authenticated user:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: IUser) {
    return {
      sub: user.sub,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  @Get('/settings')
  getSettings(@CurrentUser() user: IUser) {
    // User automatically available from AuthGuard
    return this.settingsService.getUserSettings(user.sub);
  }
}
```

## Token Extraction

The guard extracts tokens based on the configured token delivery mode:

### JSON Mode (Authorization Header)

```http
GET /api/protected HTTP/1.1
Host: example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Cookie Mode

```http
GET /api/protected HTTP/1.1
Host: example.com
Cookie: nauth_access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Hybrid Mode

Supports both Authorization header and cookies.

## Request Flow

1. **NAuthContextGuard:** Initializes AsyncLocalStorage context (runs first)
2. **Check Public Route:** If route marked `@Public()`, bypass guard
3. **Extract Token:** From Authorization header or cookie (based on delivery mode)
4. **Validate Token:** Verify JWT signature and expiration
5. **Check Session:** Verify session exists and not revoked
6. **Load User:** Fetch user data via `AuthService.getUserForAuthContext()` (service-first architecture)
7. **Store in Context:** Store user, session, and token in AsyncLocalStorage
8. **Attach to Request:** Add user and token to `req.user` and `req.token`
9. **NAuthContextInterceptor:** Restores context for controller execution
10. **Allow Access:** Return true to proceed to route handler

## Error Handling

The guard throws `NAuthException` for various failure scenarios:

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `TOKEN_INVALID` | No token provided or invalid format | 401 |
| `TOKEN_EXPIRED` | Token has expired | 401 |
| `SESSION_NOT_FOUND` | Session doesn't exist | 401 |
| `SESSION_EXPIRED` | Session has expired | 401 |
| `TOKEN_REUSE_DETECTED` | Session revoked (security violation) | 401 |
| `USER_NOT_FOUND` | User no longer exists | 401 |
| `ACCOUNT_DISABLED` | User account disabled | 403 |

**Error Response Example:**

```json
{
  "statusCode": 401,
  "message": "Token has expired",
  "error": "Unauthorized",
  "code": "TOKEN_EXPIRED"
}
```

## Request User Object

After successful authentication, `req.user` contains:

```typescript
interface IUser {
  sub: string;                    // User UUID
  email: string;                  // Email address
  username?: string;              // Username
  firstName?: string;             // First name
  lastName?: string;              // Last name
  phone?: string;                 // Phone number
  isEmailVerified: boolean;       // Email verification status
  isPhoneVerified?: boolean;      // Phone verification status
  isActive: boolean;              // Account active status
  createdAt: Date;                // Account creation date
  lastLoginAt?: Date;             // Last login timestamp
  passwordChangedAt?: Date;       // Last password change

  // Authentication capabilities
  hasPasswordHash?: boolean;      // Whether user has password set (for password-based auth)

  // MFA status
  isMFAEnabled?: boolean;
  mfaMethods?: string[];

  // Social accounts
  socialProviders?: string[];
}
```

## Configuration

The guard behavior is configured via `NAuthConfig`:

```typescript
{
  tokenDelivery: {
    mode: 'cookies', // 'json' | 'cookies' | 'hybrid'
  },

  jwt: {
    algorithm: 'HS256',
    accessToken: {
      secret: 'your-secret',
      expiresIn: '15m',
    },
  },

  session: {
    maxLifetime: '30d',
    updateActivityInterval: 300, // Update activity every 5 minutes
  },
}
```

## Advanced Usage

### Custom Guard Logic

Extend the guard for custom logic:

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nauth-toolkit/nestjs';

@Injectable()
export class CustomAuthGuard extends AuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Call parent guard first
    const isAuthenticated = await super.canActivate(context);

    if (!isAuthenticated) {
      return false;
    }

    // Custom logic
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Example: Check user role
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
```

### Per-Route Delivery Mode

Override delivery mode for specific routes:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, TokenDelivery } from '@nauth-toolkit/nestjs';

@Controller('api')
@UseGuards(AuthGuard)
export class ApiController {
  @Get('/mobile-endpoint')
  @TokenDelivery('json')  // Force JSON mode for mobile
  getMobileData(@CurrentUser() user: IUser) {
    return { data: 'mobile data' };
  }

  @Get('/web-endpoint')
  @TokenDelivery('cookies')  // Force cookie mode for web
  getWebData(@CurrentUser() user: IUser) {
    return { data: 'web data' };
  }
}
```

### Check Authentication Manually

Access user in service without guard:

```typescript
import { Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Inject } from '@nestjs/common';
import type { IUser } from '@nauth-toolkit/nestjs';

@Injectable()
export class MyService {
  constructor(
    @Inject(REQUEST) private readonly request: any
  ) {}

  getCurrentUser(): IUser | undefined {
    return this.request.user;
  }
}
```

## Testing

### Mock Authenticated User

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nauth-toolkit/nestjs';

describe('ProfileController', () => {
  let controller: ProfileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          request.user = {
            sub: 'test-user-id',
            email: 'test@example.com',
            isEmailVerified: true,
          };
          return true;
        },
      })
      .compile();

    controller = module.get<ProfileController>(ProfileController);
  });

  it('should return user profile', () => {
    // Test with mocked user
  });
});
```

## Best Practices

1. **Use global guard** for consistent protection
2. **Mark public routes** with `@Public()` decorator
3. **Use `@CurrentUser()`** to access user data
4. **Handle errors gracefully** with exception filters
5. **Test with mocked guard** in unit tests
6. **Keep token lifetime short** (15 minutes recommended)
7. **Use HTTPS only** in production
8. **Implement refresh token rotation** for security

## Related APIs

- [`@Public()` Decorator](../decorators/public) - Mark routes as public
- [`@CurrentUser()` Decorator](../decorators/current-user) - Extract user from request
- [`@TokenDelivery()` Decorator](../decorators/token-delivery) - Override delivery mode
- [NAuthContextGuard](./nauth-context-guard) - Context initialization guard (runs first)
- [NAuthContextInterceptor](../interceptors/nauth-context-interceptor) - Context restoration interceptor
- [CsrfGuard](./csrf-guard) - CSRF protection guard
- [AuthService](/docs/api/core/services/auth-service) - Main authentication service

## See Also

- [NestJS Guards](https://docs.nestjs.com/guards) - Official NestJS documentation
- [Token Delivery](/docs/features/token-delivery) - Token delivery modes
- [Configuration](/docs/concepts/configuration) - Security configuration

