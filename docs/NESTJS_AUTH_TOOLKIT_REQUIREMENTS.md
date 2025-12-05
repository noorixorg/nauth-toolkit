# nauth-toolkit - Requirements & Roadmap

## Project Overview

**A platform-agnostic authentication toolkit for Node.js applications.** Add complete auth functionality to your NestJS (or any Node.js framework) application without external dependencies or vendor lock-in.

**NPM Packages:**

- **Core:** `@nauth-toolkit/core` (Platform-agnostic)
- **NestJS Adapter:** `@nauth-toolkit/nestjs` (NestJS-specific integrations)
- **License:** Early Access (transitioning to open source) | **Target:** NestJS 11+, Node 22+, TypeORM 0.3+

### What Is This?

**This IS:**

- **Platform-Agnostic Core** - Pure TypeScript, works with any Node.js framework
- **NestJS Adapter** - Full NestJS integration via `@nauth-toolkit/nestjs`
- Backend library that installs directly into your application
- Creates auth tables in YOUR database (not separate service)
- Standard `@Module()` for NestJS (or direct service usage for other frameworks)
- Auth logic runs in your application server
- Full control - you own code, data, and deployment
- TypeORM integration with your existing setup

**This IS NOT:**

- Standalone service like Cognito/Auth0/Keycloak (separate servers)
- Directory service / LDAP/Active Directory replacement
- OAuth provider for 3rd party apps (unless you configure it)
- SaaS / hosted service you call via API
- Separate microservice you deploy independently

**Think of it as:**

- **NestJS:** `@nestjs/typeorm` or `@nestjs/passport` - a library you add to YOUR backend
- **Other Frameworks:** Direct service usage - instantiate classes directly with dependencies

---

## Implementation Status Summary

### ✅ **COMPLETE** Features

**Core Authentication:**

- ✅ Email/password authentication
- ✅ JWT tokens (access & refresh) with HS256/HS384/HS512/RS256/RS384/RS512
- ✅ Session management with device tracking
- ✅ Password policies (complexity, history, expiry)
- ✅ Account lockout after failed attempts
- ✅ Password reset flow

**Verification:**

- ✅ Email verification with rate limiting
- ✅ Phone/SMS verification with rate limiting
- ✅ Challenge-based verification flow

**Social Login:**

- ✅ Google OAuth integration
- ✅ Apple Sign-In with JWT verification
- ✅ Facebook OAuth integration
- ✅ Social account linking

**Multi-Factor Authentication:**

- ✅ TOTP (Time-based One-Time Password)
- ✅ SMS-based MFA
- ✅ Passkey/WebAuthn support
- ✅ Backup codes generation
- ✅ MFA device management
- ✅ Adaptive MFA (risk-based authentication)

**Session Management:**

- ✅ Device tracking (deviceId, deviceName, deviceType)
- ✅ IP tracking (ipAddress, ipCountry, ipCity)
- ✅ User agent tracking (platform, browser)
- ✅ MaxMind GeoIP2 integration (optional)
- ✅ Single session mode
- ✅ Max concurrent sessions enforcement
- ✅ Remember device feature (trusted devices)

**Security:**

- ✅ Storage adapters (Memory, Database, Redis with cluster support)
- ✅ Distributed locks for token refresh
- ✅ Token reuse detection
- ✅ Comprehensive audit logging
- ✅ Rate limiting (per-IP, per-user, per-endpoint)
- ✅ CSRF protection (cookie-based token delivery)
- ✅ Cookie name prefixing (configurable)

### 🔄 **PARTIAL** Features

**Session Management:**

- ✅ Basic device/IP/geolocation tracking
- 🔜 Session notifications (new device login alerts)
- 🔜 Advanced concurrent session policies (BLOCK_NEW mode)

**Security:**

- ✅ Basic rate limiting
- 🔜 Advanced rate limiting (sliding window, adaptive)
- 🔜 Security headers enforcement (CSP, HSTS, etc.)

### ❌ **PLANNED** Features

**Developer Experience:**

- ❌ CLI tool for user management
- ❌ CLI tool for migrations
- ❌ Testing utilities package
- ❌ Documentation site
- ❌ Additional example applications

---

## Architecture Principles

### Platform-Agnostic Design

**Core Architecture:**

- **Platform-Agnostic Core** (`@nauth-toolkit/core`):
  - Pure TypeScript classes, zero framework dependencies
  - Uses `jose` library for JWT (not `@nestjs/jwt`)
  - Uses `AsyncLocalStorage` for context (not `nestjs-cls`)
  - Can be used with any Node.js framework (NestJS, Express, Fastify, Koa, etc.)

- **Framework Adapters:**
  - `@nauth-toolkit/nestjs` - NestJS-specific integrations (guards, interceptors, decorators, modules)
  - Provider packages have `/nestjs` subpaths for NestJS modules
  - Future: `/express`, `/fastify` adapters can be added

### Core Design

- **Embedded Library:** Runs inside your application process (NestJS or other frameworks)
- **Plugin-Based:** Each feature is an optional module (NestJS) or service (platform-agnostic)
- **Database-Agnostic:** TypeORM with adapter pattern (PostgreSQL, MySQL)
- **Type-Safe:** Full TypeScript, zero `any` types
- **NestJS Integration:** Via adapter package (guards, decorators, interceptors, dependency injection)
- **Framework Independence:** Core services work with any framework

### Configuration Philosophy

- **Sensible Defaults:** Works out of box with minimal config
- **Everything Configurable:** Override any behavior via type-safe config
- **Environment-Specific:** Dev/staging/prod configurations
- **Validation:** Config validated on app startup with helpful error messages
- **JWT Algorithm:** HS256 as default - symmetric key (configurable to HS384, HS512, RS256, RS384, RS512)

---

## Detailed Roadmap

### Phase 1: Core Foundation ✅ **COMPLETE**

**Status:** Fully implemented and production-ready

**Implemented:**

- ✅ Email/password authentication
- ✅ JWT access & refresh tokens
- ✅ Session management with device tracking
- ✅ Password policies (complexity, history, expiry)
- ✅ Account lockout after failed attempts
- ✅ Password reset flow
- ✅ Password expiry enforcement
- ✅ Login identifier type filtering
- ✅ User management (CRUD operations)

---

### Phase 2: Verification System ✅ **COMPLETE**

**Status:** Fully implemented and production-ready

**Implemented:**

- ✅ Email verification with rate limiting
- ✅ Phone/SMS verification with rate limiting
- ✅ Challenge-based verification flow
- ✅ Verification code generation and validation
- ✅ Resend cooldown mechanisms
- ✅ Configurable code length and expiry

---

### Phase 3: Social Login ✅ **COMPLETE**

**Status:** Fully implemented and production-ready

**Implemented:**

- ✅ Google OAuth integration
- ✅ Apple Sign-In with JWT verification
- ✅ Facebook OAuth integration
- ✅ Cryptographic token verification
- ✅ Social account linking
- ✅ Email/phone collection for social users

---

### Phase 4: Multi-Factor Authentication ✅ **COMPLETE**

**Status:** Fully implemented and production-ready

**Implemented:**

- ✅ TOTP (Time-based One-Time Password)
- ✅ SMS-based MFA
- ✅ Passkey/WebAuthn support
- ✅ Backup codes generation
- ✅ MFA device management
- ✅ Preferred MFA method selection
- ✅ MFA setup during signup/login

---

### Phase 5: Advanced Session Management 🔄 **MOSTLY COMPLETE**

**✅ Completed:**

- Basic device tracking (deviceId, deviceName, deviceType)
- IP tracking (ipAddress, ipCountry, ipCity, ipIsp)
- User agent tracking (userAgent, platform, browser)
- MaxMind GeoIP2 integration (optional)
- Single session mode
- Max concurrent sessions enforcement
- Adaptive MFA (risk-based authentication)
- Remember device feature

**🔜 Remaining:**

- Session notifications (email/SMS on new device login)
- Advanced concurrent session policies (BLOCK_NEW mode)
- Session analytics dashboard

---

### Phase 6: Security Features 🔄 **MOSTLY COMPLETE**

**✅ Completed:**

- All three storage adapters (Memory, Database, Redis with cluster support)
- Distributed locks for token refresh
- Token reuse detection
- Comprehensive audit logging
- Rate limiting (per-IP, per-user, per-endpoint)
- Account lockout with IP tracking
- Optimistic locking for sessions
- CSRF protection (cookie-based token delivery)

**🔜 Remaining:**

- Advanced rate limiting (sliding window, adaptive)
- Security headers enforcement (CSP, HSTS, X-Frame-Options)

---

### Phase 7: Developer Experience ❌ **NOT STARTED**

**Planned:**

- CLI tool for user management and migrations
- Testing utilities package (`@nauth-toolkit/testing`)
- Documentation site
- Additional example applications

---

## Database Schema Summary

**All core tables are implemented.** Key tables:

- `nauth_users` - User accounts
- `nauth_sessions` - Active JWT sessions
- `nauth_social_accounts` - OAuth provider linkage
- `nauth_verification_tokens` - Email/phone verification
- `nauth_mfa_devices` - MFA device enrollments
- `nauth_auth_audit` - Security event logging
- `nauth_rate_limits` - Rate limiting counters (DatabaseStorageAdapter only)
- `nauth_storage_locks` - Distributed locks (DatabaseStorageAdapter only)
- `nauth_challenge_sessions` - Challenge session tracking
- `nauth_login_attempts` - Failed login attempt tracking

**Future Tables:**

- `nauth_geo_locations` - Geolocation cache (if caching added)

---

## Configuration API

**NestJS Pattern:** `AuthModule.forRoot(config)` or `AuthModule.forRootAsync({ useFactory: ... })`

**Import from:** `@nauth-toolkit/nestjs` (not `@nauth-toolkit/core`)

**Core Configuration Sections:**

- `jwt`: Token configuration
  - `algorithm`: JWT algorithm (default: `'HS256'`, also supports `'HS384'`, `'HS512'`, `'RS256'`, `'RS384'`, `'RS512'`)
  - `accessToken`: Access token config (secret/privateKey, expiresIn)
  - `refreshToken`: Refresh token config (secret/privateKey, expiresIn)
- `signup`: Signup policies (verification, domains, invites)
- `login`: Login configuration (identifier type filtering)
- `password`: Password policies (complexity, history, expiry enforcement)
- `lockout`: Account lockout configuration
- `email`: Email provider and verification settings
- `phone`: Phone provider and verification settings
- `social`: OAuth provider configurations (Google, Apple, Facebook)
- `mfa`: MFA enforcement and method configuration
- `session`: Session management and policies
- `storageAdapter`: Storage adapter selection (Memory/Database/Redis)
- `geoLocation`: MaxMind GeoIP2 configuration (optional)
- `logger`: Logging configuration with PII redaction
- `hooks`: Lifecycle hooks for extensibility

**Full configuration reference available in codebase JSDoc.**

**Platform-Agnostic Usage:**

For non-NestJS applications, instantiate services directly:

```typescript
import { AuthService, JwtService } from '@nauth-toolkit/core';

const authService = new AuthService(
  config,
  logger,
  userRepository,
  sessionRepository,
  // ... other dependencies
);
```

---

## Security Features

**✅ Implemented:**

- Argon2id password hashing
- **JWT with HS256** - Default symmetric key algorithm (configurable to HS384, HS512, RS256, RS384, RS512)
- JWT token rotation and reuse detection
- Distributed locks for race condition prevention
- Comprehensive audit logging
- Rate limiting (per-IP, per-user, per-endpoint)
- Session hijacking detection
- Account lockout after failed attempts
- PII redaction in logs
- Cryptographic token verification for social auth
- Optimistic locking for session updates (TOCTOU prevention)
- Token family tracking
- **Platform-Agnostic Architecture** - Core works with any framework
- **AsyncLocalStorage** - Native Node.js context management (no `nestjs-cls` dependency)

**🔜 Planned:**

- Advanced rate limiting (sliding window, adaptive)
- Security headers enforcement

---

## Performance Targets

- Login: <200ms (excluding email/SMS delivery)
- Token validation: <50ms
- Session lookup: <100ms
- Token refresh: <150ms
- Support 10K+ concurrent users
- Database queries: Indexed, <100ms

---

## Success Metrics

- 1K+ GitHub stars in 6 months
- 100+ weekly npm downloads
- 10+ community contributors
- Zero critical security vulnerabilities
- 90%+ test coverage
- <5% bundle size overhead
- Production security audit passed

---

**Last Updated:** November 2025
**Current Version:** v0.1.0 (Platform-Agnostic Architecture, Phase 1-4 Complete, Phase 5-6 Partial)

---

## 🏗️ Platform-Agnostic Architecture (v0.1.0)

### Major Changes

**✅ Core Package Now Platform-Agnostic:**

- Removed all NestJS dependencies from `@nauth-toolkit/core`
- All services are plain TypeScript classes
- Uses `jose` library for JWT (not `@nestjs/jwt`)
- Uses `AsyncLocalStorage` for context (not `nestjs-cls`)
- Default JWT algorithm: HS256 - symmetric key (HMAC-SHA256)

**✅ New NestJS Adapter Package:**

- `@nauth-toolkit/nestjs` - NestJS-specific integrations
- Re-exports all core functionality for backward compatibility
- Provides `AuthModule`, guards, interceptors, decorators
- Uses factory providers to instantiate core services

**✅ Provider Packages with `/nestjs` Subpaths:**

- Social providers: `@nauth-toolkit/social-google/nestjs`
- MFA providers: `@nauth-toolkit/mfa-totp/nestjs`
- Core services remain platform-agnostic

**✅ Migration Path:**

- NestJS apps: Change `@nauth-toolkit/core` → `@nauth-toolkit/nestjs`
- Provider modules: Add `/nestjs` subpath (e.g., `@nauth-toolkit/social-google/nestjs`)
- No code changes required for service usage (backward compatible)

**✅ Future Framework Support:**

- Core can now be used directly with Express, Fastify, Koa, etc.
- Framework adapters can be added as separate packages or subpaths
