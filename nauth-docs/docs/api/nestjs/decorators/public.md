---
title: "@Public()"
description: Mark routes as public to bypass authentication
sidebar_position: 2
---

# @Public()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Method Decorator

Method decorator that marks a route as public, allowing it to bypass the `AuthGuard`.

:::tip Import from NestJS Package
```typescript
import { Public } from '@nauth-toolkit/nestjs';
```
:::

## Overview

The `@Public()` decorator sets metadata on a route to indicate it should skip authentication. It's particularly useful when using a global `AuthGuard`.

**Key Features:**

- Skip authentication for specific routes
- Works with global or controller-level guards
- Clean, declarative syntax
- No manual guard configuration needed

## Usage

### Basic Usage

```typescript
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard, Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
@UseGuards(AuthGuard)  // Applied to all routes
export class AuthController {
  @Public()  // This route skips authentication
  @Post('/login')
  async login(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }

  @Public()  // This route also skips authentication
  @Post('/signup')
  async signup(@Body() dto: SignupDTO) {
    return this.authService.signup(dto);
  }

  @Get('/profile')  // This route requires authentication
  async getProfile(@CurrentUser() user: IUser) {
    return { user };
  }
}
```

### With Global Guard

When using a global `AuthGuard`, mark public routes explicitly:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '@nauth-toolkit/nestjs';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,  // Applied globally
    },
  ],
})
export class AppModule {}

// Controllers can now use @Public()
@Controller('api')
export class ApiController {
  @Public()
  @Get('/health')
  getHealth() {
    return { status: 'ok' };
  }

  @Get('/protected')  // Requires auth (global guard)
  getProtected(@CurrentUser() user: IUser) {
    return { data: 'protected' };
  }
}
```

## Common Use Cases

### Health Check Endpoints

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '@nauth-toolkit/nestjs';

@Controller()
export class HealthController {
  @Public()
  @Get('/health')
  checkHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('/ping')
  ping() {
    return 'pong';
  }
}
```

### Authentication Endpoints

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('/login')
  login(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('/signup')
  signup(@Body() dto: SignupDTO) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('/forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDTO) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('/reset-password')
  resetPassword(@Body() dto: ResetPasswordDTO) {
    return this.authService.resetPassword(dto);
  }

  // Not public - requires authentication
  @Post('/change-password')
  changePassword(
    @CurrentUser() user: IUser,
    @Body() dto: ChangePasswordDTO,
  ) {
    return this.authService.changePassword(user.sub, dto);
  }
}
```

### Public API Endpoints

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '@nauth-toolkit/nestjs';

@Controller('blog')
export class BlogController {
  @Public()
  @Get('/posts')
  getPublicPosts(@Query('page') page: number = 1) {
    return this.blogService.getPublicPosts(page);
  }

  @Public()
  @Get('/posts/:slug')
  getPublicPost(@Param('slug') slug: string) {
    return this.blogService.getPublicPost(slug);
  }

  // Not public - requires auth
  @Post('/posts')
  createPost(
    @CurrentUser() user: IUser,
    @Body() dto: CreatePostDTO,
  ) {
    return this.blogService.createPost(user.sub, dto);
  }
}
```

### Documentation Endpoints

```typescript
import { Controller, Get, Res } from '@nestjs/common';
import { Public } from '@nauth-toolkit/nestjs';
import { Response } from 'express';

@Controller('docs')
export class DocsController {
  @Public()
  @Get()
  serveDocs(@Res() res: Response) {
    return res.sendFile('docs/index.html');
  }

  @Public()
  @Get('/api-spec')
  getApiSpec() {
    return {
      openapi: '3.0.0',
      info: { title: 'API', version: '1.0.0' },
      // ... OpenAPI spec
    };
  }
}
```

## Mixed Authentication

Support optional authentication (public but user-aware):

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public, CurrentUser, IUser } from '@nauth-toolkit/nestjs';

@Controller('posts')
export class PostsController {
  @Public()
  @Get()
  getPosts(@CurrentUser() user?: IUser) {
    if (user) {
      // Authenticated - show personalized content
      return this.postsService.getPersonalized(user.sub);
    } else {
      // Anonymous - show public content
      return this.postsService.getPublic();
    }
  }
}
```

## Implementation Details

The decorator uses NestJS metadata:

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

The `AuthGuard` checks for this metadata:

```typescript
// In AuthGuard
const isPublic = this.reflector.getAllAndOverride<boolean>(
  IS_PUBLIC_KEY,
  [context.getHandler(), context.getClass()]
);

if (isPublic) {
  return true;  // Skip authentication
}
```

## Testing

Public routes don't need authentication mocking:

```typescript
import { Test, TestingModule } from '@nestjs/testing';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return health status', () => {
    const result = controller.checkHealth();
    expect(result.status).toBe('ok');
  });
});
```

## Best Practices

1. **Use for auth endpoints** (login, signup, password reset)
2. **Use for health checks** and monitoring endpoints
3. **Use for public content** (blog posts, documentation)
4. **Don't overuse** - most routes should require auth
5. **Document public routes** clearly in your API docs
6. **Consider rate limiting** for public endpoints
7. **Use with global guard** for cleaner code

## Security Considerations

1. **Validate input** even on public routes
2. **Rate limit** public endpoints to prevent abuse
3. **CSRF protection** still applies (if using cookies)
4. **Don't expose sensitive data** on public routes
5. **Monitor usage** of public endpoints

## Related APIs

- [AuthGuard](../guards/auth-guard) - Respects `@Public()` metadata
- [`@CurrentUser()` Decorator](./current-user) - Extract user (optional with `@Public()`)
- [AuthGuard](../guards/auth-guard) - Setting up global authentication

## See Also

- [NestJS Metadata](https://docs.nestjs.com/fundamentals/execution-context#reflection-and-metadata) - Official documentation
- [AuthGuard](../guards/auth-guard) - Complete route protection guide
- [Configuration](/docs/concepts/configuration) - Authentication configuration

