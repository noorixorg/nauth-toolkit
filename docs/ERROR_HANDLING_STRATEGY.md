# Error Handling - nauth-toolkit

## Philosophy

The toolkit's responsibility is to **throw consistent, structured errors**. Consumer applications handle their own error formatting, filtering, and response mapping.

---

## Architecture

### Framework-Agnostic Design

`NAuthException` extends standard `Error` (not `HttpException`), making it usable in:

- ✅ HTTP APIs (REST, NestJS)
- ✅ WebSocket connections
- ✅ GraphQL resolvers
- ✅ gRPC services
- ✅ Message queue workers
- ✅ CLI tools
- ✅ Standalone services

### Separation of Concerns

```
┌─────────────────────────────────────┐
│   nauth-toolkit (Domain Layer)      │
│   Throws: NAuthException            │
│   - code: AuthErrorCode             │
│   - message: string                 │
│   - details: Record<string, any>    │
└─────────────────────────────────────┘
              ▼
┌─────────────────────────────────────┐
│   Consumer App (Transport Layer)    │
│   Maps: NAuthException → Response   │
│   - HTTP status codes (REST)        │
│   - WebSocket events                │
│   - GraphQL errors                  │
└─────────────────────────────────────┘
```

---

## Implementation

### 1. Toolkit Side (Done ✅)

The toolkit throws structured domain exceptions:

```typescript
throw new NAuthException(AuthErrorCode.RATE_LIMIT_SMS, 'Too many verification SMS sent', {
  retryAfter: 3600,
  currentCount: 4,
  maxAttempts: 3,
});
```

### 2. Consumer Side (HTTP Applications)

For HTTP/REST APIs, the toolkit provides a ready-to-use exception filter:

#### Option A: Use Provided Filter (Easiest)

```typescript
// src/main.ts
import { NAuthHttpExceptionFilter } from '@nauth-toolkit/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply the filter globally
  app.useGlobalFilters(new NAuthHttpExceptionFilter());

  await app.listen(3000);
}
```

**That's it!** The filter only catches `NAuthException` and won't interfere with your other exception filters.

**Apply per-controller or per-route:**

```typescript
import { NAuthHttpExceptionFilter } from '@nauth-toolkit/core';

// Per-controller
@Controller('auth')
@UseFilters(NAuthHttpExceptionFilter)
export class AuthController {}

// Per-route
@Post('signup')
@UseFilters(NAuthHttpExceptionFilter)
async signup() {}
```

#### Option B: Custom HTTP Filter

If you need custom behavior (logging, different response format, etc.):

```typescript
// src/filters/custom-nauth.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { NAuthException, getHttpStatusForErrorCode } from '@nauth-toolkit/core';

@Catch(NAuthException)
export class CustomNAuthFilter implements ExceptionFilter {
  constructor(private logger: Logger) {}

  catch(exception: NAuthException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Custom logging
    this.logger.error({
      code: exception.code,
      message: exception.message,
      path: request.url,
      user: request.user?.id,
    });

    // Custom status mapping
    const statusCode = this.customStatusMapping(exception.code);

    // Custom response format
    response.status(statusCode).json({
      error: {
        type: exception.code,
        description: exception.message,
        metadata: exception.details,
      },
    });
  }

  private customStatusMapping(code: string): number {
    // Your own mapping logic
    if (code === 'RATE_LIMIT_SMS') return 429;
    return 400;
  }
}
```

#### Option D: WebSocket Handler

```typescript
// src/gateways/auth.gateway.ts
@WebSocketGateway()
export class AuthGateway {
  @SubscribeMessage('verify-phone')
  async handleVerifyPhone(client: Socket, payload: any) {
    try {
      return await this.authService.verifyPhone(payload);
    } catch (error) {
      if (error instanceof NAuthException) {
        client.emit('error', {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: error.timestamp,
        });
      }
      throw error;
    }
  }
}
```

#### Option C: GraphQL Error Handling

```typescript
// src/common/graphql-error-formatter.ts
import { NAuthException, getHttpStatusForErrorCode } from '@nauth-toolkit/core';
import { GraphQLFormattedError } from 'graphql';

export const formatError = (error: GraphQLError): GraphQLFormattedError => {
  const originalError = error.originalError;

  if (originalError instanceof NAuthException) {
    return {
      message: originalError.message,
      extensions: {
        code: originalError.code,
        details: originalError.details,
        timestamp: originalError.timestamp,
        http: {
          status: getHttpStatusForErrorCode(originalError.code),
        },
      },
    };
  }

  return error;
};
```

#### Option D: Custom Mapping

```typescript
// src/utils/error-mapper.ts
import { NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

export class CustomErrorMapper {
  /**
   * Map to your own HTTP status codes
   */
  static toHttpStatus(code: AuthErrorCode): number {
    switch (code) {
      case AuthErrorCode.RATE_LIMIT_SMS:
        return 429; // Too Many Requests
      case AuthErrorCode.INVALID_CREDENTIALS:
        return 401; // Unauthorized
      case AuthErrorCode.EMAIL_EXISTS:
        return 422; // Unprocessable Entity (your preference)
      default:
        return 400;
    }
  }

  /**
   * Map to custom error format
   */
  static toApiError(exception: NAuthException) {
    return {
      error: {
        type: exception.code,
        description: exception.message,
        metadata: exception.details,
        occurred_at: exception.timestamp,
      },
    };
  }
}
```

---

## Helper Function

The toolkit provides `getHttpStatusForErrorCode()` as a **suggested** mapping:

```typescript
import { getHttpStatusForErrorCode, AuthErrorCode } from '@nauth-toolkit/core';

getHttpStatusForErrorCode(AuthErrorCode.RATE_LIMIT_SMS); // 429
getHttpStatusForErrorCode(AuthErrorCode.INVALID_CREDENTIALS); // 401
getHttpStatusForErrorCode(AuthErrorCode.EMAIL_EXISTS); // 409
getHttpStatusForErrorCode(AuthErrorCode.NOT_FOUND); // 404
```

**Mapping logic:**

- `RATE_LIMIT_*` → 429 (Too Many Requests)
- `AUTH_*` → 401 (Unauthorized) or 403 (Forbidden for locked/inactive)
- `EMAIL_EXISTS`, `USERNAME_EXISTS`, `PHONE_EXISTS` → 409 (Conflict)
- `VALIDATION_*`, `INVALID_*` → 400 (Bad Request)
- `NOT_FOUND` → 404 (Not Found)
- `FORBIDDEN` → 403 (Forbidden)
- `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE` → 500 (Server Error)

**You can ignore this and use your own mapping!**

---

## Error Response Format

### Toolkit Exception Structure

```typescript
class NAuthException extends Error {
  code: AuthErrorCode; // Programmatic error code
  message: string; // Human-readable message
  details?: Record<string, unknown>; // Optional metadata
  timestamp: string; // ISO 8601 timestamp
}
```

### Suggested HTTP Response

```json
{
  "statusCode": 429,
  "code": "RATE_LIMIT_SMS",
  "message": "Too many verification SMS sent. Please try again later.",
  "details": {
    "retryAfter": 3600,
    "currentCount": 4,
    "maxAttempts": 3
  },
  "timestamp": "2025-10-31T12:00:00.000Z",
  "path": "/auth/verify-phone"
}
```

**You can transform this to any format you want!**

---

## Complete Example: NestJS Application

```typescript
// ============================================================================
// 1. Register Filter (ONE LINE!)
// ============================================================================

// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NAuthHttpExceptionFilter } from '@nauth-toolkit/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply provided filter globally
  app.useGlobalFilters(new NAuthHttpExceptionFilter());

  await app.listen(3000);
}
bootstrap();

// ============================================================================
// 2. Use in Controllers (no changes needed!)
// ============================================================================

// src/auth/auth.controller.ts
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('verify-phone')
  async verifyPhone(@Body() dto: VerifyPhoneDTO) {
    // If service throws NAuthException, filter catches and converts to HTTP
    return this.authService.verifyPhone(dto);
  }
}

// ============================================================================
// 3. Frontend Receives Structured Error
// ============================================================================

// Frontend TypeScript
try {
  await authService.verifyPhone(code);
} catch (error) {
  if (error.response?.data?.code === 'RATE_LIMIT_SMS') {
    const retryAfter = error.response.data.details.retryAfter;
    showError(`Too many attempts. Try again in ${retryAfter}s`);
  }
}
```

**That's it!** The filter only catches `NAuthException` - your other exception filters continue to work normally.

---

## Toolkit Responsibilities

### ✅ What nauth-toolkit provides:

- `NAuthException` - Framework-agnostic exception class
- `AuthErrorCode` - Enum with all error codes
- Structured metadata (retryAfter, validation details, etc.)
- `getHttpStatusForErrorCode()` - Helper for HTTP status mapping
- `NAuthHttpExceptionFilter` - **Optional** ready-to-use HTTP filter

### 🚫 What nauth-toolkit does NOT do:

- Force specific HTTP status codes (you can override)
- Require using the provided filter (it's optional)
- Handle error logging (consumer's responsibility)
- Interfere with your other exception filters

### 🎯 What consumer apps handle:

- Create exception filter for their transport layer
- Map error codes to status codes (or use helper)
- Transform response format
- Add logging, monitoring, tracing
- Internationalization

---

## Benefits

### For Any Transport Layer:

- ✅ Works with HTTP, WebSocket, GraphQL, gRPC, etc.
- ✅ Consumer controls response format
- ✅ No framework coupling

### For Developers:

- ✅ **Programmatic error handling** - Check error codes, not strings
- ✅ **Structured metadata** - retryAfter, validation details
- ✅ **Type-safe** - Error codes are enums
- ✅ **Flexible** - Use helper or define own mapping

### For Production:

- ✅ **Consistent errors** - Same structure everywhere
- ✅ **Debuggable** - Timestamps, structured details
- ✅ **Monitorable** - Error codes for dashboards
- ✅ **Internationalization-ready** - Codes separate from messages

---

## Migration from Standard Exceptions

### Before:

```typescript
throw new BadRequestException('Too many SMS sent');
```

**Problems:**

- No error code for programmatic handling
- No metadata (retryAfter)
- Frontend has to parse message strings

### After:

```typescript
throw new NAuthException(AuthErrorCode.RATE_LIMIT_SMS, 'Too many SMS sent', { retryAfter: 3600 });
```

**Benefits:**

- ✅ Error code for programmatic handling
- ✅ Metadata included
- ✅ Frontend can show countdown timer

---

## Error Codes Reference

See `AuthErrorCode` enum for all available codes:

- **Authentication**: `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `TOKEN_EXPIRED`
- **Signup**: `EMAIL_EXISTS`, `WEAK_PASSWORD`, `SIGNUP_DISABLED`
- **Verification**: `VERIFICATION_CODE_INVALID`, `VERIFICATION_CODE_EXPIRED`
- **Rate Limits**: `RATE_LIMIT_SMS`, `RATE_LIMIT_EMAIL`, `RATE_LIMIT_RESEND`
- **Social Auth**: `SOCIAL_TOKEN_INVALID`, `SOCIAL_ACCOUNT_LINKED`
- **General**: `NOT_FOUND`, `FORBIDDEN`, `INTERNAL_ERROR`

---

## FAQ

### Q: Do I have to use `NAuthHttpExceptionFilter`?

**A:** No! It's a convenience. You can:

- Use it as-is
- Extend it for custom behavior
- Create your own filter from scratch
- Not use any filter (handle exceptions yourself)

### Q: Will the filter interfere with my other exception filters?

**A:** No! `@Catch(NAuthException)` means it ONLY catches `NAuthException`. Your other filters continue to work normally.

### Q: Can I change the error response format?

**A:** Yes! Create your own filter or extend `NAuthHttpExceptionFilter`:

```typescript
@Catch(NAuthException)
export class MyCustomFilter extends NAuthHttpExceptionFilter {
  catch(exception: NAuthException, host: ArgumentsHost) {
    // Your custom logic here
  }
}
```

### Q: What if I want to add logging?

**A:** Add it to your exception filter:

```typescript
@Catch(NAuthException)
export class NAuthExceptionFilter implements ExceptionFilter {
  constructor(private logger: Logger) {}

  catch(exception: NAuthException, host: ArgumentsHost) {
    // Log the error
    this.logger.error({
      code: exception.code,
      message: exception.message,
      details: exception.details,
      stack: exception.stack,
    });

    // Then return response
    // ...
  }
}
```

### Q: Can I use this with GraphQL/WebSocket/gRPC?

**A:** Yes! Just catch `NAuthException` and map to your transport format. The exception is framework-agnostic.

### Q: Does the toolkit need my exception filter to work?

**A:** No. The toolkit just throws structured errors. Your app decides how to handle them.

---

## Implementation Status

### Phase 1: Core Infrastructure ✅

- ✅ Created `NAuthException` (framework-agnostic)
- ✅ Created `AuthErrorCode` enum
- ✅ Created `getHttpStatusForErrorCode()` helper
- ✅ Exported from core package

### Phase 2: Backend Migration ✅ (100% Complete)

- ✅ Phone verification service
- ✅ Core auth service
- ✅ Challenge service
- ✅ Auth challenge helper service
- ✅ Social account service
- ✅ Email verification service
- ✅ Social auth providers (base, google, apple, facebook)
- ✅ Social token verifiers (google, apple, facebook)
- ✅ MFA services (totp, sms, passkey)
- ✅ Guards (auth.guard.ts)

**All NestJS exceptions migrated to `NAuthException` with structured error codes.**

### Phase 3: Documentation ✅

- ✅ Consumer exception filter examples
- ✅ Multi-transport examples (HTTP, WS, GraphQL)
- ✅ Custom mapping examples
