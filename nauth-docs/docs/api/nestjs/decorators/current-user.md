---
title: "@CurrentUser()"
description: Parameter decorator to extract authenticated user from request
sidebar_position: 1
---

# @CurrentUser()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Parameter Decorator

Parameter decorator that extracts the authenticated user from the request object. Must be used with `AuthGuard`.

:::tip Import from NestJS Package
```typescript
import { CurrentUser } from '@nauth-toolkit/nestjs';
```
:::

## Overview

The `@CurrentUser()` decorator provides a clean, type-safe way to access the authenticated user in your route handlers. It extracts `req.user` which is populated by the `AuthGuard`.

**Key Features:**

- Type-safe user access
- Clean, declarative syntax
- Works with any guard that populates `req.user`
- No manual request object access needed

## Usage

### Basic Usage

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
}
```

### Multiple Parameters

Combine with other decorators:

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('posts')
@UseGuards(AuthGuard)
export class PostsController {
  @Get()
  getUserPosts(
    @CurrentUser() user: IUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.postsService.findUserPosts(user.sub, page, limit);
  }
}
```

### With Body Data

```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('posts')
@UseGuards(AuthGuard)
export class PostsController {
  @Post()
  createPost(
    @CurrentUser() user: IUser,
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.postsService.create({
      ...createPostDto,
      authorId: user.sub,
    });
  }
}
```

### Service Injection

Access user in services:

```typescript
import { Controller, Put, Body, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Put()
  updateSettings(
    @CurrentUser() user: IUser,
    @Body() settings: UpdateSettingsDto,
  ) {
    return this.settingsService.update(user.sub, settings);
  }
}
```

## User Object Structure

The decorator returns the `IUser` interface:

```typescript
interface IUser {
  // Basic info
  sub: string;                    // User UUID
  email: string;                  // Email address
  username?: string;              // Username (if set)
  firstName?: string;             // First name (if set)
  lastName?: string;              // Last name (if set)
  phone?: string;                 // Phone number (if set)

  // Verification status
  isEmailVerified: boolean;       // Email verified
  isPhoneVerified?: boolean;      // Phone verified (if phone exists)

  // Account status
  isActive: boolean;              // Account active

  // Timestamps
  createdAt: Date;                // Account creation
  lastLoginAt?: Date;             // Last login time
  passwordChangedAt?: Date;       // Last password change

  // MFA
  isMFAEnabled?: boolean;         // Has MFA devices
  mfaMethods?: string[];          // Enabled MFA methods

  // Social
  socialProviders?: string[];     // Linked providers ['google', 'apple']
}
```

## Common Patterns

### User Authorization

Check if user owns resource:

```typescript
import { Controller, Get, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('posts')
@UseGuards(AuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get(':id')
  async getPost(
    @CurrentUser() user: IUser,
    @Param('id') postId: string,
  ) {
    const post = await this.postsService.findOne(postId);

    // Check ownership
    if (post.authorId !== user.sub) {
      throw new ForbiddenException('You can only view your own posts');
    }

    return post;
  }
}
```

### Audit Logging

Log user actions:

```typescript
import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('posts')
@UseGuards(AuthGuard)
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly auditService: AuditService,
  ) {}

  @Delete(':id')
  async deletePost(
    @CurrentUser() user: IUser,
    @Param('id') postId: string,
  ) {
    await this.postsService.delete(postId);

    // Log action
    await this.auditService.log({
      userId: user.sub,
      action: 'POST_DELETED',
      resourceId: postId,
      timestamp: new Date(),
    });

    return { success: true };
  }
}
```

### User Context in Services

Pass user to services:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@CurrentUser() user: IUser) {
    return this.dashboardService.getUserDashboard(user);
  }
}

// In service:
@Injectable()
export class DashboardService {
  async getUserDashboard(user: IUser) {
    return {
      welcome: `Hello, ${user.firstName || user.email}!`,
      stats: await this.getStats(user.sub),
      recentActivity: await this.getActivity(user.sub),
    };
  }
}
```

### Optional User

Make user optional for routes that work with or without auth:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Public } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('posts')
export class PostsController {
  @Get()
  @Public()  // Route is public but we still use AuthGuard globally
  async getPosts(@CurrentUser() user?: IUser) {
    if (user) {
      // Authenticated - show personalized posts
      return this.postsService.getPersonalizedPosts(user.sub);
    } else {
      // Anonymous - show public posts
      return this.postsService.getPublicPosts();
    }
  }
}
```

## Type Safety

Use TypeScript for full type safety:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: IUser) {
    // TypeScript knows all user properties
    const email: string = user.email;  // Type-safe
    const sub: string = user.sub;      // Type-safe

    // TypeScript prevents errors
    // const invalid = user.nonExistent;  // Compile error

    return { user };
  }
}
```

## Validation

Validate user properties:

```typescript
import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('posts')
@UseGuards(AuthGuard)
export class PostsController {
  @Post()
  createPost(
    @CurrentUser() user: IUser,
    @Body() dto: CreatePostDto,
  ) {
    // Ensure email is verified
    if (!user.isEmailVerified) {
      throw new BadRequestException('Email must be verified to create posts');
    }

    // Ensure profile complete
    if (!user.firstName || !user.lastName) {
      throw new BadRequestException('Complete your profile to create posts');
    }

    return this.postsService.create(dto, user.sub);
  }
}
```

## Testing

Mock the CurrentUser decorator in tests:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nauth-toolkit/nestjs';

describe('ProfileController', () => {
  let controller: ProfileController;

  const mockUser = {
    sub: 'test-user-id',
    email: 'test@example.com',
    isEmailVerified: true,
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          request.user = mockUser;  // Mock user
          return true;
        },
      })
      .compile();

    controller = module.get<ProfileController>(ProfileController);
  });

  it('should return user profile', () => {
    const result = controller.getProfile(mockUser);
    expect(result.user.email).toBe('test@example.com');
  });
});
```

## Error Handling

The decorator itself doesn't throw errors. If `req.user` is undefined, it returns `undefined`. Ensure `AuthGuard` is applied:

```typescript
// BAD: No guard, user will be undefined
@Controller('profile')
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: IUser) {
    // user will be undefined!
    return user; // Potential error
  }
}

// GOOD: Guard ensures user exists
@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: IUser) {
    // user is guaranteed to exist
    return user;
  }
}
```

## Best Practices

1. **Always use with `AuthGuard`** to ensure user exists
2. **Use TypeScript types** for type safety (`IUser`)
3. **Don't modify user object** - it's shared across requests
4. **Pass to services** instead of accessing request directly
5. **Validate user properties** when needed (email verified, etc.)
6. **Use for authorization** checks (ownership, roles, etc.)
7. **Mock in tests** for consistent test behavior

## Related APIs

- [AuthGuard](../guards/auth-guard) - Populates `req.user`
- [`@Public()` Decorator](./public) - Mark routes as public
- [`@ClientInfo()` Decorator](./client-info) - Extract client metadata
- `IUser` Interface - User interface definition (see TypeScript definitions)

## See Also

- [NestJS Custom Decorators](https://docs.nestjs.com/custom-decorators) - Official documentation
- [AuthGuard](../guards/auth-guard) - Protecting routes
- [Configuration](/docs/concepts/configuration) - Authentication configuration

