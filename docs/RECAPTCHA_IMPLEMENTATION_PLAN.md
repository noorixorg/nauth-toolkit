# reCAPTCHA Support Implementation Plan

**Version:** 1.0
**Date:** 2026-01-19
**Status:** Planning Phase

---

## Overview

Add Google reCAPTCHA v2/v3/Enterprise support to nauth-toolkit for protecting login and signup endpoints from bot attacks. Implementation follows the existing provider pattern (email, SMS, social) with platform-agnostic core and optional framework adapters.

### Key Principles

1. **Optional Package** - `@nauth-toolkit/recaptcha` separate from core
2. **Zero Dependencies** - No third-party reCAPTCHA libraries
3. **Smart Defaults** - Auto-skip for mobile (JSON delivery), enforce for web (cookies)
4. **Explicit Overrides** - Decorators/helpers for fine-grained control
5. **Lazy Loading** - Frontend script loads only when needed
6. **Server-Driven** - Client SDK respects server's reCAPTCHA requirements
7. **Zero Breaking Changes** - Fully backward compatible, all new features opt-in
8. **Platform Agnostic** - Works with Express, Fastify, NestJS without framework-specific errors

---

## Architecture Summary

### Backend
```
@nauth-toolkit/recaptcha (new package)
  ├── RecaptchaProvider interface
  ├── v2/v3/Enterprise implementations
  └── NestJS module (optional)

@nauth-toolkit/core (modifications)
  ├── Config interface (RecaptchaConfig)
  ├── DTO changes (optional recaptchaToken field)
  ├── AuthService validation logic
  ├── Error codes
  └── Route decorators/helpers
```

### Frontend
```
@nauth-toolkit/client (modifications)
  ├── Request types (optional recaptchaToken)
  └── Client methods (accept optional token)

@nauth-toolkit/client-angular (modifications)
  ├── RecaptchaService (script loader)
  ├── Config interface (RecaptchaAngularConfig)
  └── AuthService (auto-inject tokens for v3)
```

---

## Phase 1: Backend Core Infrastructure

### 1.1 Create `@nauth-toolkit/recaptcha` Package

**Location:** `packages/recaptcha/`

**Package Structure:**
```
packages/recaptcha/
├── package.json
├── tsconfig.json
├── jest.config.js
├── LICENSE
├── README.md
├── src/
│   ├── index.ts
│   ├── recaptcha-provider.interface.ts
│   ├── providers/
│   │   ├── recaptcha-v2.provider.ts
│   │   ├── recaptcha-v2.provider.spec.ts
│   │   ├── recaptcha-v3.provider.ts
│   │   ├── recaptcha-v3.provider.spec.ts
│   │   ├── recaptcha-enterprise.provider.ts
│   │   └── recaptcha-enterprise.provider.spec.ts
└── nestjs/
    ├── index.ts
    ├── recaptcha.module.ts
    └── recaptcha.module.spec.ts
```

**Files to Create:**

#### `package.json`
- Name: `@nauth-toolkit/recaptcha`
- Peer dependencies: `@nauth-toolkit/core`
- Exports: main (`./dist/src/index.js`) and nestjs (`./dist/nestjs/index.js`)
- Keywords: recaptcha, bot-protection, security

#### `src/recaptcha-provider.interface.ts`
```typescript
export interface RecaptchaProvider {
  verify(
    token: string,
    remoteIp?: string,
    action?: string
  ): Promise<RecaptchaVerificationResult>;
}

export interface RecaptchaVerificationResult {
  success: boolean;
  score?: number;
  action?: string;
  challengeTs?: string;
  hostname?: string;
  errorCodes?: string[];
}
```

#### `src/providers/recaptcha-v3.provider.ts`
- Implements `RecaptchaProvider`
- Calls `https://www.google.com/recaptcha/api/siteverify`
- Returns score (0.0-1.0)
- Full JSDoc comments
- Unit tests with mocked fetch

#### `src/providers/recaptcha-v2.provider.ts`
- Implements `RecaptchaProvider`
- No score, only success/fail
- Unit tests

#### `src/providers/recaptcha-enterprise.provider.ts`
- Implements `RecaptchaProvider`
- Uses Enterprise API endpoint
- Unit tests

#### `nestjs/recaptcha.module.ts` (Optional)
- Empty module for future NestJS-specific features
- Currently just re-exports providers

**Deliverables:**
- [ ] Package structure created
- [ ] Interface defined with JSDoc
- [ ] v2 provider implemented and tested
- [ ] v3 provider implemented and tested
- [ ] Enterprise provider implemented and tested
- [ ] NestJS module created
- [ ] README with usage examples
- [ ] 80%+ test coverage

---

### 1.2 Core Package Modifications

**Location:** `packages/core/src/`

#### A. Add Configuration Interface

**File:** `packages/core/src/interfaces/config.interface.ts`

Add `RecaptchaConfig` interface:
```typescript
export interface RecaptchaConfig {
  enabled: boolean;
  provider: RecaptchaProvider;
  enforceFor?: TokenDeliveryMode[];
  minimumScore?: number;
}
```

Add to `NAuthConfig`:
```typescript
export interface NAuthConfig {
  // ... existing fields ...
  recaptcha?: RecaptchaConfig;
}
```

**Deliverables:**
- [ ] Interface added with full JSDoc
- [ ] Import `RecaptchaProvider` from `@nauth-toolkit/recaptcha` (type-only)
- [ ] Update config examples in comments

#### B. Add Error Codes

**File:** `packages/core/src/enums/error-codes.enum.ts`

```typescript
export enum AuthErrorCode {
  // ... existing codes ...

  RECAPTCHA_REQUIRED = 'RECAPTCHA_REQUIRED',
  RECAPTCHA_PROVIDER_MISSING = 'RECAPTCHA_PROVIDER_MISSING',
  RECAPTCHA_VALIDATION_FAILED = 'RECAPTCHA_VALIDATION_FAILED',
  RECAPTCHA_SCORE_TOO_LOW = 'RECAPTCHA_SCORE_TOO_LOW',
}
```

**Deliverables:**
- [ ] Error codes added
- [ ] Error messages documented

#### C. Update DTOs

**Files:**
- `packages/core/src/dto/login.dto.ts`
- `packages/core/src/dto/signup.dto.ts`
- `packages/core/src/dto/admin-signup.dto.ts`
- `packages/core/src/dto/admin-signup-social.dto.ts`

Add optional field to each:
```typescript
@IsOptional()
@IsString({ message: 'ReCAPTCHA token must be a string' })
recaptchaToken?: string;
```

**Deliverables:**
- [ ] Field added to LoginDTO with JSDoc
- [ ] Field added to SignupDTO with JSDoc
- [ ] Field added to AdminSignupDTO with JSDoc
- [ ] Field added to AdminSignupSocialDTO with JSDoc
- [ ] Unit tests updated

#### D. Add Request Attributes

**File:** `packages/core/src/platform/interfaces.ts`

Add to `NAuthRequestAttributes`:
```typescript
export interface NAuthRequestAttributes {
  // ... existing fields ...
  nauthSkipRecaptcha?: boolean;
  nauthRequireRecaptcha?: boolean;
}
```

**Deliverables:**
- [ ] Attributes added
- [ ] JSDoc comments

#### E. Add Validation Logic to AuthService

**File:** `packages/core/src/services/auth.service.ts`

Add private method:
```typescript
private async validateRecaptchaIfNeeded(
  token: string | undefined,
  clientIp?: string
): Promise<void>
```

Call from:
- `login()`
- `signup()`
- `adminSignup()`
- `adminSignupSocial()`
- `forgotPassword()` (optional, config-controlled)

**Validation Priority:**
1. Check `req.attributes.nauthSkipRecaptcha` → skip
2. Check `req.attributes.nauthRequireRecaptcha` → enforce
3. Check `config.enforceFor` includes current delivery mode → enforce if no token
4. If token provided → always validate (opportunistic)
5. Otherwise → skip

**Deliverables:**
- [ ] Validation method implemented with full JSDoc
- [ ] Called from all auth methods
- [ ] Uses ClientInfoService for IP
- [ ] Uses ContextStorage for request attributes
- [ ] Logs decisions at debug level
- [ ] Unit tests for all code paths
- [ ] Integration tests

#### F. Add Route Helpers/Decorators

**File:** `packages/core/src/bootstrap.ts`

Add helpers:
```typescript
helpers: {
  // ... existing helpers ...

  skipRecaptcha: () =>
    adapter.registerMiddleware('skipRecaptcha', (req, res, next) => {
      req.attributes.nauthSkipRecaptcha = true;
      return next();
    }),

  requireRecaptcha: () =>
    adapter.registerMiddleware('requireRecaptcha', (req, res, next) => {
      req.attributes.nauthRequireRecaptcha = true;
      return next();
    }),
}
```

**File:** `packages/nestjs/src/decorators/`

Create new files:
- `skip-recaptcha.decorator.ts`
- `require-recaptcha.decorator.ts`

**Deliverables:**
- [ ] Express/Fastify helpers implemented
- [ ] NestJS decorators implemented
- [ ] Exported from main index files
- [ ] Unit tests
- [ ] Examples in JSDoc

---

## Phase 2: Frontend Client SDK

### 2.1 Base Client Modifications

**Location:** `packages/client/src/`

#### A. Update Type Definitions

**File:** `packages/client/src/types/auth.types.ts`

Add `recaptchaToken` to:
- `SignupRequest`
- `LoginRequest`

```typescript
export interface SignupRequest {
  // ... existing fields ...
  recaptchaToken?: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  recaptchaToken?: string;
}
```

**Deliverables:**
- [ ] Types updated with JSDoc
- [ ] Examples in comments

#### B. Update Client Methods

**File:** `packages/client/src/core/client.ts`

Update method signatures:
```typescript
async login(
  identifier: string,
  password: string,
  recaptchaToken?: string
): Promise<AuthResponse>

async signup(request: SignupRequest): Promise<AuthResponse>
```

**Deliverables:**
- [ ] Methods updated
- [ ] Token passed in request body
- [ ] JSDoc updated
- [ ] Unit tests updated

#### C. Update Error Types

**File:** `packages/client/src/types/error.types.ts`

Add error codes:
```typescript
export enum NAuthErrorCode {
  // ... existing codes ...
  RECAPTCHA_REQUIRED = 'RECAPTCHA_REQUIRED',
  RECAPTCHA_VALIDATION_FAILED = 'RECAPTCHA_VALIDATION_FAILED',
  RECAPTCHA_SCORE_TOO_LOW = 'RECAPTCHA_SCORE_TOO_LOW',
}
```

**Deliverables:**
- [ ] Error codes added
- [ ] Match backend codes exactly

#### D. Add Server Feature Detection

**File:** `packages/client/src/core/config.ts`

Add config option:
```typescript
export interface NAuthClientConfig {
  // ... existing fields ...

  /**
   * reCAPTCHA configuration for client SDK.
   *
   * Can be enabled/disabled independently of server.
   * Server will return RECAPTCHA_REQUIRED error if client doesn't send token when server expects it.
   *
   * @default { enabled: false }
   */
  recaptcha?: {
    enabled: boolean;
    siteKey?: string;
    version?: 'v2' | 'v3' | 'enterprise';
    action?: string;
  };
}
```

**File:** `packages/client/src/core/client.ts`

Add logic to handle server-driven requirements:
```typescript
private async handleRecaptchaError(error: NAuthClientError): Promise<void> {
  // If server requires reCAPTCHA but client doesn't have it configured
  if (error.code === 'RECAPTCHA_REQUIRED' && !this.config.recaptcha?.enabled) {
    this.logger?.warn?.(
      'Server requires reCAPTCHA but client SDK does not have it enabled. ' +
      'Configure recaptcha in client config or disable on server.'
    );
  }
  throw error;
}
```

**Deliverables:**
- [ ] Config option added with JSDoc
- [ ] Error handling for mismatched config
- [ ] Warning logs (not console.log in backend, use logger)
- [ ] Unit tests

---

### 2.2 Angular Client Modifications

**Location:** `packages/client-angular/src/`

#### A. Create RecaptchaService

**File:** `packages/client-angular/src/lib/recaptcha.service.ts`

Features:
- Lazy script loading
- v3 execute() method
- v2 render() method
- Response token getter for v2
- Reset method for v2
- Platform detection

**Deliverables:**
- [ ] Service created with full JSDoc
- [ ] Script loading logic
- [ ] v2 and v3 support
- [ ] Error handling
- [ ] Unit tests with mocked window.grecaptcha
- [ ] Injectable with providedIn: 'root'

#### B. Update Configuration Interface

**File:** `packages/client-angular/src/ngmodule/tokens.ts`

Add interface:
```typescript
export interface RecaptchaAngularConfig {
  enabled: boolean;
  version: 'v2' | 'v3' | 'enterprise';
  siteKey: string;
  action?: string;
  manualChallenge?: boolean;
  autoLoadScript?: boolean;
  language?: string;
}
```

Extend existing config:
```typescript
export interface NAuthAngularConfig extends NAuthClientConfig {
  recaptcha?: RecaptchaAngularConfig;
}
```

**Deliverables:**
- [ ] Interface added with JSDoc
- [ ] Type exports
- [ ] Examples in comments

#### C. Update AuthService

**File:** `packages/client-angular/src/ngmodule/auth.service.ts`

Add auto-injection logic with platform detection:
```typescript
/**
 * Get reCAPTCHA token - auto-generate for v3 or use provided token.
 *
 * Handles platform detection:
 * - Web browser: Generate token if enabled
 * - Capacitor native: Skip (use device attestation instead)
 * - SSR: Skip
 */
private async getRecaptchaToken(
  providedToken: string | undefined,
  action: string
): Promise<string | undefined> {
  // If token explicitly provided, use it
  if (providedToken) {
    return providedToken;
  }

  const config = (this.config as NAuthAngularConfig).recaptcha;

  // Check if enabled in config
  if (!config?.enabled) {
    return undefined;
  }

  // Detect platform
  const platform = this.detectPlatform();

  // Skip for Capacitor native mode (not WebView)
  if (platform === 'capacitor-native') {
    this.logger?.debug?.('Skipping reCAPTCHA for Capacitor native mode');
    return undefined;
  }

  // Auto-generate for v3 if not manual mode
  if (config.version === 'v3' && !config.manualChallenge && this.recaptchaService) {
    try {
      return await this.recaptchaService.execute(action);
    } catch (error) {
      this.logger?.error?.('Failed to execute reCAPTCHA:', error);
      // Let server decide if token is required
      return undefined;
    }
  }

  return undefined;
}

/**
 * Detect current platform
 */
private detectPlatform(): 'web' | 'capacitor-webview' | 'capacitor-native' | 'ssr' {
  if (typeof window === 'undefined') {
    return 'ssr';
  }

  // Check for Capacitor
  if ((window as any).Capacitor) {
    const platform = (window as any).Capacitor.getPlatform();
    // Capacitor.getPlatform() returns 'web', 'ios', 'android'
    if (platform === 'web') {
      return 'capacitor-webview';
    }
    return 'capacitor-native';
  }

  return 'web';
}
```

Update methods:
- `login()` - inject token with platform detection
- `signup()` - inject token with platform detection

**Deliverables:**
- [ ] Auto-injection for v3
- [ ] Platform detection (web, Capacitor WebView, Capacitor native, SSR)
- [ ] Skip for Capacitor native mode
- [ ] Manual mode support
- [ ] Error handling
- [ ] Use logger, not console.log
- [ ] Unit tests with platform mocks

#### D. Export RecaptchaService

**File:** `packages/client-angular/src/public-api.ts`

```typescript
export { RecaptchaService } from './lib/recaptcha.service';
```

**Deliverables:**
- [ ] Service exported
- [ ] Types exported

---

## Phase 3: Angular Client Modifications

**Goal:** Add reCAPTCHA support to Angular client package with automatic token generation and platform detection.

### 3.1 Create RecaptchaService

**Location:** `packages/client-angular/src/lib/recaptcha.service.ts`

**Features:**
- Lazy script loading (don't load until needed)
- v3 execute() method for invisible challenge
- v2 render() method for checkbox challenge
- Response token getter for v2
- Reset method for v2
- Platform detection (web, Capacitor WebView, Capacitor native, SSR)
- Skip reCAPTCHA in Capacitor native mode (use device attestation instead)

**Deliverables:**
- [ ] Service created with full JSDoc
- [ ] Script loading logic
- [ ] v2 and v3 support
- [ ] Error handling
- [ ] Unit tests with mocked window.grecaptcha
- [ ] Injectable with providedIn: 'root'

### 3.2 Update Configuration Interface

**File:** `packages/client-angular/src/ngmodule/tokens.ts`

Add interface extending base client config:

```typescript
export interface RecaptchaAngularConfig {
  enabled: boolean;
  version: 'v2' | 'v3' | 'enterprise';
  siteKey: string;
  action?: string;
  manualChallenge?: boolean;
  autoLoadScript?: boolean;
  language?: string;
}

export interface NAuthAngularConfig extends NAuthClientConfig {
  recaptcha?: RecaptchaAngularConfig;
}
```

**Deliverables:**
- [ ] Interface added with JSDoc
- [ ] Type exports
- [ ] Examples in comments

### 3.3 Update AuthService

**File:** `packages/client-angular/src/ngmodule/auth.service.ts`

Add auto-injection logic with platform detection:
- Auto-generate token for v3 before login/signup
- Skip for Capacitor native mode (detect platform)
- Skip for SSR (no window object)
- Manual mode support (user provides token)

**Deliverables:**
- [ ] Auto-injection for v3
- [ ] Platform detection (web, Capacitor WebView, Capacitor native, SSR)
- [ ] Skip for Capacitor native mode
- [ ] Manual mode support
- [ ] Error handling
- [ ] Use logger, not console.log
- [ ] Unit tests with platform mocks

### 3.4 Export RecaptchaService

**File:** `packages/client-angular/src/public-api.ts`

```typescript
export { RecaptchaService } from './lib/recaptcha.service';
```

**Deliverables:**
- [ ] Service exported
- [ ] Types exported

---

## Phase 4: Testing & Validation

### 4.1 Unit Tests

**Coverage targets: 80%+ (per PROJ_RULES.md)**

#### Backend (`@nauth-toolkit/recaptcha`)
- [ ] RecaptchaV2Provider tests
- [ ] RecaptchaV3Provider tests
- [ ] RecaptchaEnterpriseProvider tests
- [ ] Mock fetch responses
- [ ] Error handling
- [ ] All methods have tests

#### Backend (`@nauth-toolkit/core`)
- [ ] DTO validation with recaptchaToken (optional field)
- [ ] DTO validation without recaptchaToken (backward compatibility)
- [ ] AuthService validation logic
- [ ] All validation priority paths
- [ ] Error throwing scenarios (NAuthException)
- [ ] Skip scenarios (JSON delivery, decorators)
- [ ] Enforce scenarios (cookies delivery)
- [ ] Config disabled scenarios (must work as before)

#### Frontend (`@nauth-toolkit/client`)
- [ ] Request type tests
- [ ] Client method tests with optional token
- [ ] Client method tests without token (backward compatibility)
- [ ] Token passing tests
- [ ] Server error handling (RECAPTCHA_REQUIRED)

#### Frontend (`@nauth-toolkit/client-angular`)
- [ ] RecaptchaService script loading
- [ ] RecaptchaService execute/render
- [ ] AuthService auto-injection
- [ ] Platform detection tests (web, Capacitor, SSR)
- [ ] Capacitor native mode skip
- [ ] Manual mode tests
- [ ] Config disabled tests (backward compatibility)
- [ ] Error handling

**Backward Compatibility Tests:**
- [ ] Login without reCAPTCHA config works
- [ ] Signup without reCAPTCHA config works
- [ ] No errors when recaptcha field not in DTO
- [ ] Existing apps work without changes

**Deliverables:**
- [ ] All unit tests passing
- [ ] 80%+ coverage on new code (per PROJ_RULES.md)
- [ ] Mock strategies documented
- [ ] Test backward compatibility explicitly

### 4.2 Integration Tests

**Scenarios to test:**

#### Backend Integration
- [ ] Login with valid reCAPTCHA token (cookies mode)
- [ ] Login without token (JSON mode, auto-skip)
- [ ] Login without token (cookies mode, should fail)
- [ ] Login without reCAPTCHA config (must work as before)
- [ ] Signup with reCAPTCHA token
- [ ] Signup without reCAPTCHA config (must work as before)
- [ ] Low score rejection (v3)
- [ ] @SkipRecaptcha decorator
- [ ] @RequireRecaptcha decorator
- [ ] Express helpers
- [ ] Fastify helpers
- [ ] NestJS decorators
- [ ] Platform-agnostic errors (no HTTP exceptions)

#### Frontend Integration
- [ ] Angular v3 auto-injection (web)
- [ ] Angular v2 manual mode
- [ ] Script loading in browser
- [ ] Error handling on client
- [ ] Capacitor WebView compatibility (should work)
- [ ] Capacitor native mode detection (should skip)
- [ ] SSR compatibility (should skip)
- [ ] Client works without reCAPTCHA config (backward compatibility)
- [ ] Server requires but client disabled (graceful error)
- [ ] Server disabled but client enabled (token ignored)

**Deliverables:**
- [ ] Integration test suite created
- [ ] All scenarios passing
- [ ] CI/CD integration

### 4.3 E2E Tests (Optional)

**If time permits:**
- [ ] Full flow: Frontend → Backend → Google
- [ ] Real reCAPTCHA validation
- [ ] Test/sandbox keys only

---

## Phase 5: Example Applications

**Goal:** Update existing examples and create new ones to demonstrate reCAPTCHA integration.

### 5.1 Update Existing Examples

#### `examples/sample-nestjs/`
- Add reCAPTCHA config to NAuth initialization
- Add environment variable for secret key
- Update login/signup endpoints
- Show @SkipRecaptcha() decorator usage

#### `examples/sample-express/`
- Add reCAPTCHA config
- Show `nauth.helpers.skipRecaptcha()` usage
- Show `nauth.helpers.requireRecaptcha()` usage

#### `examples/sample-angular/`
- Add reCAPTCHA config to Angular client
- Add v3 automatic example (invisible)
- Add v2 checkbox example (manual)
- Show platform detection (Capacitor)

### 5.2 Create New Hybrid Example

#### `examples/recaptcha-hybrid/`
- Backend: Hybrid token delivery (web + mobile)
- Web frontend: v3 automatic
- Mobile frontend (Capacitor): Skip or v2
- Demonstrate platform-based enforcement

**Deliverables:**
- [ ] NestJS example updated
- [ ] Express example updated
- [ ] Angular example updated
- [ ] Hybrid example created
- [ ] All examples tested and working

---

## Phase 6: Docusaurus Documentation

**Goal:** Create comprehensive Docusaurus documentation following @nauth-docs/API_DOCUMENTATION_RULES.md style.

**Location:** `nauth-docs/docs/`

### 6.1 API Documentation
- [ ] All JSDoc comments complete (classes, methods, interfaces, enums)
- [ ] NO console.log statements in backend (use logger module)
- [ ] Frontend can use console.log (per PROJ_RULES.md)
- [ ] Use logger module consistently in backend
- [ ] No emojis or icons in logs (plain text only)
- [ ] No `any` types (use `unknown` if needed)
- [ ] Explicit return types on all functions
- [ ] Inline comments for complex logic (explain WHY not WHAT)
- [ ] Security-critical sections have warnings
- [ ] Section headers use `// ============`
- [ ] ESLint passing
- [ ] Prettier formatting applied
- [ ] No security warnings
- [ ] Platform-agnostic errors (NAuthException, not HTTP exceptions)
- [ ] No `require()` statements (use imports or dependency injection)

### 7.2 Build & Packaging

**Tasks (per PROJ_RULES.md - use `nest build` not `nest start`):**
- [ ] `yarn workspace @nauth-toolkit/recaptcha build` succeeds with clean output
- [ ] `yarn workspace @nauth-toolkit/core build` succeeds with clean output
- [ ] `yarn workspace @nauth-toolkit/client build` succeeds
- [ ] `yarn workspace @nauth-toolkit/client-angular build` succeeds
- [ ] `yarn workspace @nauth-toolkit/nestjs build` succeeds with clean output
- [ ] Type definitions generated correctly
- [ ] Exports configured properly
- [ ] No build warnings or errors
- [ ] Test all builds before marking complete

**Verification (per PROJ_RULES.md):**
```bash
# Check types
yarn workspace @nauth-toolkit/core build
yarn workspace @nauth-toolkit/recaptcha build

# Run tests
yarn workspace @nauth-toolkit/core test
yarn workspace @nauth-toolkit/recaptcha test
yarn workspace @nauth-toolkit/client test
yarn workspace @nauth-toolkit/client-angular test

# Check lints
yarn workspace @nauth-toolkit/core lint
yarn workspace @nauth-toolkit/recaptcha lint
```

### 7.3 Version Bumping

**Packages to version:**
- [ ] `@nauth-toolkit/recaptcha` - new package (0.1.0)
- [ ] `@nauth-toolkit/core` - minor bump
- [ ] `@nauth-toolkit/client` - minor bump
- [ ] `@nauth-toolkit/client-angular` - minor bump
- [ ] `@nauth-toolkit/nestjs` - minor bump

### 7.4 Changelog

**File:** `CHANGELOG.md`

Add entry:
```markdown
## [0.X.0] - 2026-XX-XX

### Added
- reCAPTCHA v2/v3/Enterprise support via new `@nauth-toolkit/recaptcha` package
- Optional `recaptchaToken` field in login/signup DTOs
- Smart defaults: auto-skip for mobile (JSON), enforce for web (cookies)
- `@SkipRecaptcha()` and `@RequireRecaptcha()` decorators for NestJS
- `nauth.helpers.skipRecaptcha()` and `requireRecaptcha()` for Express/Fastify
- `RecaptchaService` in Angular client for automatic v3 token generation
- Support for v2 checkbox with manual control
- Complete documentation and examples

### Changed
- DTOs now accept optional reCAPTCHA tokens
- Error codes enum extended with reCAPTCHA errors
```

**Deliverables:**
- [ ] Changelog updated
- [ ] Migration guide (if needed)

---

## Phase 6: Docusaurus Documentation

**Goal:** Create comprehensive Docusaurus documentation following @nauth-docs/API_DOCUMENTATION_RULES.md style.

**Location:** `nauth-docs/docs/`

### 6.1 API Documentation

#### Core DTOs

**Files to Create:**

1. `nauth-docs/docs/api/core/dto/login-dto.md` (Update)
   - Add `recaptchaToken` property to properties table
   - Add example with reCAPTCHA token
   - Add validation note

2. `nauth-docs/docs/api/core/dto/signup-dto.md` (Update)
   - Add `recaptchaToken` property to properties table
   - Add example with reCAPTCHA token
   - Add validation note

**Rules to Follow:**
- Use `groupId="platform"` for tabs
- Properties in alphabetical order
- Minimal prose, scannable tables
- One complete example (not multiple variations)
- No separate validation sections (put in table)

#### Core Config

**File to Create:**

3. `nauth-docs/docs/api/core/interfaces/recaptcha-config.md`
   - Document `RecaptchaConfig` interface
   - Properties table with all options
   - Examples for v2, v3, Enterprise
   - Platform tabs (NestJS/Express/Fastify)

**Template:**
```markdown
---
title: RecaptchaConfig
description: Configuration interface for Google reCAPTCHA v2/v3/Enterprise bot protection
keywords: [recaptcha, config, interface, bot-protection, security]
image: /img/api-social-card.png
sidebar_position: N
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RecaptchaConfig

**Package:** `@nauth-toolkit/core`
**Type:** Interface (Configuration)

Configuration interface for Google reCAPTCHA bot protection.

[... follow LoginDTO.md style exactly ...]
```

#### Recaptcha Package

**Files to Create:**

4. `nauth-docs/docs/api/recaptcha/overview.md`
   - Package overview
   - Installation (use `bash npm2yarn`)
   - Quick start for v2, v3, Enterprise
   - When to use which version

5. `nauth-docs/docs/api/recaptcha/providers/recaptcha-v2-provider.md`
   - Provider class documentation
   - Constructor parameters
   - `verify()` method
   - Example usage with platform tabs

6. `nauth-docs/docs/api/recaptcha/providers/recaptcha-v3-provider.md`
   - Provider class documentation
   - Constructor parameters
   - `verify()` method
   - Score-based validation
   - Example usage with platform tabs

7. `nauth-docs/docs/api/recaptcha/providers/recaptcha-enterprise-provider.md`
   - Provider class documentation
   - Constructor parameters
   - `verify()` method
   - Enterprise-specific features
   - Example usage with platform tabs

#### NestJS Decorators

**Files to Create:**

8. `nauth-docs/docs/api/nestjs/decorators/skip-recaptcha.md`
   - Decorator documentation
   - When to use
   - Example usage
   - Integration with guards

9. `nauth-docs/docs/api/nestjs/decorators/require-recaptcha.md`
   - Decorator documentation
   - When to use
   - Example usage
   - Integration with guards

### 6.2 Guide Documentation

#### Main Guide

**File to Create:**

10. `nauth-docs/docs/guides/recaptcha.md`
    - Complete guide following existing guide style
    - Architecture overview
    - Backend setup (NestJS/Express/Fastify tabs)
    - Frontend setup (Angular/React/Vue/Vanilla tabs)
    - Mobile/Capacitor considerations
    - Hybrid deployment strategies
    - Security best practices
    - Performance optimization
    - Testing strategies
    - Troubleshooting

**Structure:**
```markdown
---
title: reCAPTCHA Bot Protection
description: Add Google reCAPTCHA v2/v3/Enterprise to protect login and signup endpoints
keywords: [recaptcha, bot-protection, security, v2, v3, enterprise]
---

# reCAPTCHA Bot Protection

Protect your authentication endpoints from bots using Google reCAPTCHA.

## Overview

Brief overview (2-3 sentences).

## Quick Start

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

[... complete example ...]

</TabItem>
<TabItem value="express" label="Express">

[... complete example ...]

</TabItem>
<TabItem value="fastify" label="Fastify">

[... complete example ...]

</TabItem>
</Tabs>

## Backend Setup

### Installation

````bash npm2yarn
npm install @nauth-toolkit/recaptcha
​```
````

[... continue with setup steps ...]

## Frontend Setup

<Tabs groupId="frontend">
<TabItem value="angular" label="Angular">

[... Angular setup ...]

</TabItem>
<TabItem value="react" label="React">

[... React setup ...]

</TabItem>
<TabItem value="vue" label="Vue">

[... Vue setup ...]

</TabItem>
<TabItem value="vanilla" label="Vanilla JS">

[... Vanilla JS setup ...]

</TabItem>
</Tabs>

[... rest of guide ...]
```

#### Frontend SDK Guide

**File to Update:**

11. `nauth-docs/docs/frontend-sdk/guides/recaptcha.md` (New)
    - Frontend-specific guide
    - Angular automatic mode
    - Angular manual mode
    - React integration
    - Vue integration
    - Vanilla JS integration
    - Platform detection (Capacitor)

### 6.3 Client SDK API Documentation

#### Client Types

**Files to Update:**

12. `nauth-docs/docs/frontend-sdk/api/types/login-request.md` (Update)
    - Add `recaptchaToken` property

13. `nauth-docs/docs/frontend-sdk/api/types/signup-request.md` (Update)
    - Add `recaptchaToken` property

14. `nauth-docs/docs/frontend-sdk/api/types/recaptcha-config.md` (New)
    - Document `RecaptchaConfig` for client
    - All configuration options
    - Examples

#### Angular Client

**Files to Create:**

15. `nauth-docs/docs/frontend-sdk/angular/recaptcha-service.md` (New)
    - RecaptchaService documentation
    - Methods: execute(), render(), reset()
    - Platform detection
    - Lazy loading
    - Example usage

### 6.4 Documentation Quality Checklist

**For each file, verify:**
- [ ] Front matter complete (title, description, keywords, image, sidebar_position)
- [ ] Description 50-160 chars for SEO
- [ ] Keywords relevant (3-8 terms)
- [ ] All info in tables (no redundant prose)
- [ ] Methods/properties in alphabetical order
- [ ] One example per item
- [ ] Tabs use `groupId="platform"` or `groupId="frontend"`
- [ ] Installation uses `bash npm2yarn`
- [ ] Links work and are relative for API docs
- [ ] Code blocks have language specified
- [ ] No indented triple backticks
- [ ] Newline before code blocks
- [ ] Builds without errors
- [ ] Follows API_DOCUMENTATION_RULES.md exactly

**Deliverables:**
- [ ] All API documentation files created/updated
- [ ] Main reCAPTCHA guide created
- [ ] Frontend SDK guide created
- [ ] All files follow Docusaurus style
- [ ] All files follow API_DOCUMENTATION_RULES.md
- [ ] Alphabetical order maintained
- [ ] Sidebar positions set correctly
- [ ] Documentation builds successfully
- [ ] All links verified
- [ ] All examples tested

---

## Phase 7: Release Preparation

**Goal:** Final code quality checks, builds, and changelog updates.

### 7.1 Code Quality (PROJ_RULES.md Compliance)

**Checklist:**
3. ✅ **Graceful degradation** - Works when reCAPTCHA disabled
4. ✅ **Error compatible** - Use NAuthException, not HTTP exceptions

### Verification Checklist:

**Before ANY commit:**
- [ ] All existing tests still pass
- [ ] No modifications to existing method signatures (only additions)
- [ ] Optional fields only (no required fields added)
- [ ] Default behavior unchanged when `recaptcha` not configured
- [ ] Platform-agnostic errors (NAuthException, not HttpException)
- [ ] No console.log in backend (use logger module)
- [ ] All new code has JSDoc
- [ ] 80%+ test coverage on new code
- [ ] `yarn workspace @nauth-toolkit/core build` succeeds
- [ ] `yarn workspace @nauth-toolkit/core test` passes
- [ ] `yarn workspace @nauth-toolkit/core lint` passes

### Existing Functionality That Must NOT Break:

1. **Login/Signup without reCAPTCHA**
   - Must work exactly as before when `recaptcha` not configured
   - No errors, no warnings, no changed behavior

2. **Hybrid Token Delivery**
   - Existing origin-based routing still works
   - No changes to token delivery logic

3. **Social Auth**
   - OAuth flows unaffected
   - No reCAPTCHA validation on social endpoints

4. **Mobile Apps (JSON delivery)**
   - Apps using JSON delivery continue working
   - No forced reCAPTCHA requirements

5. **Custom DTOs**
   - Apps with custom DTOs still work
   - reCAPTCHA field is optional

6. **Error Handling**
   - Existing error codes unchanged
   - New errors don't conflict with existing ones

## Implementation Order

### Recommended Sequence:

1. **Backend Foundation** (Phase 1.1, 1.2)
   - Create `@nauth-toolkit/recaptcha` package
   - Add config interface to core
   - Add error codes
   - Update DTOs (optional fields only)
   - **Verify:** No breaking changes, existing tests pass

2. **Backend Logic** (Phase 1.2 continued)
   - Implement validation in AuthService (only when config present)
   - Add decorators/helpers
   - Unit tests
   - **Verify:** Default behavior unchanged when recaptcha not configured

3. **Frontend Base** (Phase 2.1)
   - Update client types (optional fields)
   - Update client methods (optional parameters)
   - Server feature detection
   - Unit tests
   - **Verify:** Works with/without reCAPTCHA config

4. **Frontend Angular** (Phase 2.2)
   - Create RecaptchaService
   - Update AuthService with platform detection
   - Unit tests
   - **Verify:** Capacitor native mode handling

5. **Integration Testing** (Phase 4.2)
   - Test with reCAPTCHA enabled
   - Test with reCAPTCHA disabled (must work as before)
   - Test platform variations
   - **Verify:** No regressions in existing flows

6. **Documentation** (Phase 3)
   - Package READMEs
   - Complete guide
   - Migration guide (none needed - backward compatible)
   - Update examples

7. **Polish & Release** (Phase 5, 6)
   - Code quality review (follow PROJ_RULES.md)
   - Build verification (all packages)
   - Final backward compatibility check
   - Changelog
   - Release

---

## Timeline Estimate

**Total: ~3-5 days of focused work**

- Phase 1 (Backend): 1.5-2 days
- Phase 2 (Frontend): 1-1.5 days
- Phase 3 (Docs): 0.5 day
- Phase 4 (Testing): 0.5-1 day
- Phase 5 (Release): 0.5 day

**Note:** Timeline assumes single developer working full-time.

---

## Success Criteria

### Must Have:
- [ ] `@nauth-toolkit/recaptcha` package published
- [ ] v2, v3, Enterprise providers working
- [ ] Core DTOs accept recaptchaToken
- [ ] AuthService validates tokens
- [ ] Smart defaults (skip for JSON, enforce for cookies)
- [ ] Decorators/helpers for explicit control
- [ ] Angular RecaptchaService with lazy loading
- [ ] 80%+ test coverage
- [ ] Complete documentation
- [ ] Examples updated

### Nice to Have:
- [ ] E2E tests with real reCAPTCHA
- [ ] React example
- [ ] Vue example
- [ ] Capacitor-specific guide
- [ ] Performance benchmarks
- [ ] Video tutorial

### Not in Scope (Future):
- CloudFlare Turnstile support
- hCaptcha support
- Custom CAPTCHA providers
- CAPTCHA UI components (use Google's)

---

## Risk Mitigation

### Potential Issues:

1. **Breaking Changes**
   - Risk: Low (all changes are additive)
   - Mitigation: Extensive testing, semantic versioning

2. **Mobile WebView Issues**
   - Risk: Medium (reCAPTCHA behavior varies)
   - Mitigation: Document known issues, provide v2 fallback

3. **Script Loading Race Conditions**
   - Risk: Low (proper promise chaining)
   - Mitigation: Thorough testing of lazy loading

4. **User Experience Impact**
   - Risk: Medium (reCAPTCHA can frustrate users)
   - Mitigation: Use v3 by default, clear docs on UX

5. **Google API Changes**
   - Risk: Low (stable API)
   - Mitigation: Version-specific documentation, quick updates

---

## Post-Release

### Monitoring:
- GitHub issues for bug reports
- User feedback on DX
- Performance impact reports

### Follow-up Tasks:
- Address community feedback
- Performance optimization if needed
- Additional examples based on requests
- Consider CloudFlare Turnstile if requested

---

## Notes

- All code follows nauth development rules (JSDoc, tests, no console.log)
- Provider pattern matches existing email/SMS/social providers
- Platform-agnostic core with framework adapters
- Zero breaking changes - fully backward compatible
- Mobile-first consideration built in from start
