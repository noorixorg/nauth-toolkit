---
title: AuthGuard
description: NestJS guard that authenticates requests and attaches the current user.
keywords: [nestjs, guard, auth, jwt, cookies, token delivery]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AuthGuard

**Package:** `@nauth-toolkit/nestjs`
**Type:** Guard

NestJS guard that validates the access token, checks session status, and attaches `req.user`.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthGuard } from '@nauth-toolkit/nestjs';
```

</TabItem>
</Tabs>

## Methods

### canActivate()

```typescript
async canActivate(context: ExecutionContext): Promise<boolean>
```

::::important AuthGuard Throws Exceptions
The guard throws [`NAuthException`](../../core/exceptions/nauth-exception) on auth failures. It does not return `false`.
::::

**Errors**

| Code                   | When                  | Details     |
| ---------------------- | --------------------- | ----------- |
| `BEARER_NOT_ALLOWED`   | Bearer disallowed     | `undefined` |
| `COOKIES_NOT_ALLOWED`  | Cookies disallowed    | `undefined` |
| `SESSION_EXPIRED`      | Session expired       | `undefined` |
| `SESSION_NOT_FOUND`    | Session missing       | `undefined` |
| `TOKEN_INVALID`        | Missing/invalid token | `undefined` |
| `TOKEN_REUSE_DETECTED` | Revoked session       | `undefined` |

Throws [`NAuthException`](../../core/exceptions/nauth-exception) with the codes listed above.

## Example (inherit without constructor deps)

```typescript
import { Injectable, ExecutionContext, ForbiddenException, UseGuards, Controller, Get } from '@nestjs/common';
import { AuthGuard } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Injectable()
export class VerifiedEmailGuard extends AuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const req = context.switchToHttp().getRequest<{ user: IUser }>();
    if (!req.user.isEmailVerified) {
      throw new ForbiddenException('Email verification required');
    }
    return true;
  }
}

@Controller('profile')
@UseGuards(VerifiedEmailGuard)
export class ProfileController {
  @Get()
  getProfile(): { ok: true } {
    return { ok: true };
  }
}
```

## Related APIs

- [CsrfGuard](./csrf-guard) - CSRF protection (cookies mode)
- [NAuthContextGuard](./nauth-context-guard) - Initializes request context
- [NAuthContextInterceptor](../interceptors/nauth-context-interceptor) - Restores context in controllers
- [`@CurrentUser()`](../decorators/current-user) - Get `req.user`
- [`@Public()`](../decorators/public) - Skip authentication
- [`@TokenDelivery()`](../decorators/token-delivery) - Route-level delivery override
- [AuthService](../../core/services/auth-service) - User loading and auth flows
