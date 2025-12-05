# Internal API Separation

## Overview

As of version 0.1.0, NAuth Toolkit separates **public** and **internal** APIs to provide a clearer boundary between consumer-facing services and framework adapter implementation details.

## Motivation

Previously, all services were exported from `@nauth-toolkit/core`, including low-level primitives like `PasswordService`, `JwtService`, and `SessionService`. This created confusion:

- ❌ Consumers imported internal services directly, bypassing the intended public API
- ❌ Breaking changes to internal services could affect consumer applications
- ❌ IDE auto-completion suggested internal services alongside public ones
- ❌ Documentation was cluttered with implementation details

## Solution: Dual Export Paths

### **Public API** (`@nauth-toolkit/core`)

The main export path contains only services intended for consumer use:

```typescript
import {
  AuthService,        // ✅ Main authentication API
  MFAService,         // ✅ Multi-factor authentication
  SocialAuthService,  // ✅ Social authentication (OAuth)
  ClientInfoService,  // ✅ Access request context
  // ... other public services
} from '@nauth-toolkit/core';
```

### **Internal API** (`@nauth-toolkit/core/internal`)

Internal services used by framework adapters (NestJS, Express) are available via `/internal`:

```typescript
// ⚠️ INTERNAL USE ONLY - Framework adapters only
import {
  PasswordService,    // Low-level password hashing
  JwtService,         // JWT token generation
  SessionService,     // Session management
  ChallengeService,   // Challenge orchestration
  // ... other internal services
} from '@nauth-toolkit/core/internal';
```

## Public Services

These services are the **official public API** for consumer applications:

| Service | Purpose |
|---------|---------|
| `AuthService` | Main authentication API (signup, login, logout, password management) |
| `MFAService` | MFA setup, verification, device management |
| `SocialAuthService` | OAuth flows and social account linking |
| `SocialAccountService` | Manage linked social accounts |
| `EmailVerificationService` | Email verification workflows |
| `PhoneVerificationService` | SMS verification workflows |
| `ClientInfoService` | Access request context (IP, user agent, session ID) |
| `AuthAuditService` | Query authentication audit logs |

## Internal Services

These services are **implementation details** and should NOT be used by consumer applications:

### Challenge Orchestration
- `ChallengeService` - Challenge session management
- `AuthChallengeHelperService` - Challenge flow orchestration

### Authentication Flow State Machine
- `AuthFlowStateMachineService` - State machine for auth flows
- `AuthFlowContextBuilder` - Context builder for state machine
- `AuthFlowStateDefinitions` - State definitions
- `AuthFlowRules` - State transition rules

### Low-Level Primitives
- `PasswordService` - Password hashing (use `AuthService.changePassword()` instead)
- `JwtService` - JWT tokens (automatically managed by `AuthService`)
- `SessionService` - Sessions (automatically managed by `AuthService`)
- `TrustedDeviceService` - Device trust (use `AuthService.trustDevice()` instead)
- `GeoLocationService` - IP geolocation (used internally for risk detection)

### Risk & Adaptive Security
- `RiskDetectionService` - Analyze authentication attempts
- `RiskScoringService` - Calculate risk scores
- `AdaptiveMFADecisionService` - Determine MFA requirements

### Base Classes (for Provider Implementations)
- `BaseMFAProviderService` - Base for MFA providers
- `BaseSocialAuthProviderService` - Base for social auth providers

## Migration Guide

If you were previously importing internal services, here's how to migrate:

### ❌ Before (Old Way)
```typescript
import { PasswordService, JwtService } from '@nauth-toolkit/nestjs';

// Manually hashing passwords
const hashedPassword = await passwordService.hashPassword('myPassword123');

// Manually generating tokens
const tokens = await jwtService.generateTokenPair(user, session);
```

### ✅ After (Public API)
```typescript
import { AuthService } from '@nauth-toolkit/nestjs';

// Use high-level APIs instead
const result = await authService.signup({
  email: 'user@example.com',
  password: 'myPassword123',
});
// AuthService handles password hashing and token generation internally
```

## Framework Adapter Development

If you're building a new framework adapter (e.g., Fastify, Hapi), you can access internal services:

```typescript
import {
  ChallengeService,
  PasswordService,
  JwtService,
  SessionService,
} from '@nauth-toolkit/core/internal';

// Initialize internal services for dependency injection
const challengeService = new ChallengeService(...);
const authService = new AuthService(..., challengeService, ...);
```

**Note:** Internal APIs may change without notice. Always use public APIs in consumer applications.

## TypeScript Support

The dual export system is fully supported in TypeScript with proper type definitions:

```json
// package.json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js"
    },
    "./internal": {
      "types": "./dist/internal.d.ts",
      "require": "./dist/internal.js"
    }
  },
  "typesVersions": {
    "*": {
      "internal": ["dist/internal.d.ts"]
    }
  }
}
```

## Benefits

1. **Clear API Boundary**: Consumers can only import public services
2. **Better IntelliSense**: IDEs only suggest public APIs to consumers
3. **Non-Breaking**: Adapters can still access internal services
4. **Better Documentation**: TypeDoc/TSDoc separates public from internal APIs
5. **Flexible Evolution**: Internal APIs can change without consumer impact

## FAQ

### Q: Why can't I import `PasswordService` anymore?
**A:** `PasswordService` is an internal primitive. Use `AuthService.changePassword()` instead.

### Q: I need to hash a password for testing. How do I do it?
**A:** Use `AuthService.signup()` or `AuthService.changePassword()`. For test utilities, create a test helper that uses the public API.

### Q: How do I know which services are public vs. internal?
**A:** If it's exported from `@nauth-toolkit/core`, `@nauth-toolkit/nestjs`, or `@nauth-toolkit/express` without `/internal`, it's public. Services in `/internal` are for adapter developers only.

### Q: Will internal APIs change often?
**A:** Internal APIs may evolve as we improve the framework, but public APIs follow semantic versioning and breaking changes will be clearly documented.

## Related

- [API Documentation](../api/overview.md)
- [AuthService Reference](../api/core/services/auth-service.md)
- [MFAService Reference](../api/core/services/mfa-service.md)

