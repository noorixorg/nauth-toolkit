# Admin/User API Separation Plan

**Status:** Draft
**Created:** 2025-01-17

## Problem Statement

Current `AuthService` mixes admin and user self-service APIs. DTOs accept optional `sub` field, requiring consumer apps to override it with `@CurrentUser().sub`. This is error-prone—forgetting to override allows users to operate on other accounts.

**Security Risk:** The onus is on consumer app to ensure frontend-sent `sub` is replaced with authenticated user's sub.

## Solution Overview

1. **Create `AdminAuthService`** - Separate service for admin operations
2. **Refactor user self-service DTOs** - Remove `sub` field; derive from context internally
3. **Admin DTOs require `sub`** - Non-optional, validated UUID
4. **Fix `logoutAll()` cookie bug** - Admin version shouldn't clear admin's cookies

## Architecture Decision

**Composition over Inheritance**: `AdminAuthService` delegates to shared internal services (`UserService`, `SessionService`, `AuthServiceInternalHelpers`), not extends `AuthService`.

Rationale:

- `AuthService` is 4000+ lines, inheritance bloats further
- Cleaner separation of concerns
- Admin context passed explicitly to shared services

---

## Phase 1: Foundation & Skeleton

### 1.1 Create AdminAuthService

**File:** `packages/core/src/services/admin-auth.service.ts`

```typescript
export class AdminAuthService {
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly passwordService: PasswordService,
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
    private readonly auditService?: AuthAuditService,
    // ... other shared dependencies
  ) {}
}
```

**Injection Pattern (NestJS):**

- Add `AdminAuthService` to `AuthModule.forRoot()` providers
- Export it for consumer injection
- Token: `AdminAuthService` (class-based, same pattern as `AuthService`)

**Injection Pattern (Express/Fastify):**

- Expose via `nauth.adminAuthService` on bootstrap

### 1.2 Create spec file skeleton

**File:** `packages/core/src/services/admin-auth.service.spec.ts`

---

## Phase 2: DTO Conventions

### 2.1 Identifier Consistency Decision

**Standard:** ALL admin DTOs use `sub` (UUID) for user identification. No `identifier` patterns.

This removes regex-based identifier type detection bloat and ensures consistency across all admin APIs.

**Migration Required:** `AdminSetPasswordDTO`, `AdminResetPasswordDTO`, `ConfirmAdminResetPasswordDTO` change `identifier` → `sub`.

### 2.2 Base DTO Patterns

**Pattern A: User self-service (no sub)**

```typescript
// User changes own password - no sub field
class ChangePasswordDTO {
  @IsString()
  oldPassword: string;

  @IsString()
  newPassword: string;
}
```

**Pattern B: Admin operation (required sub)**

```typescript
// Admin changes user's password - sub required
class AdminChangeUserPasswordDTO {
  @IsUUID()
  sub!: string; // Required, not optional

  @IsString()
  newPassword: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
```

### 2.3 Validator Consistency

All DTOs must use consistent validators:

- **Email:** `@IsEmail()`
- **UUID/sub:** `@IsUUID('4')` with `@Transform` for lowercase/trim
- **Identifier:** Existing pattern with `@IsString()` + service-level validation

---

## Phase 3: Function Migration Plan

### Legend

| Column     | Meaning                       |
| ---------- | ----------------------------- |
| Current    | Current location/name         |
| Target     | New location/name             |
| DTO Change | DTO modifications needed      |
| Breaking   | Breaking change to public API |

---

### 3.1 Already Admin-Only (Move to AdminAuthService)

These functions already require `sub` and are admin-only. Move without DTO changes.

| Current                                   | Target                                     | DTO Change                                | Breaking |
| ----------------------------------------- | ------------------------------------------ | ----------------------------------------- | -------- |
| `authService.deleteUser()`                | `adminAuthService.deleteUser()`            | None                                      | Yes      |
| `authService.disableUser()`               | `adminAuthService.disableUser()`           | None                                      | Yes      |
| `authService.enableUser()`                | `adminAuthService.enableUser()`            | None                                      | Yes      |
| `authService.getUsers()`                  | `adminAuthService.getUsers()`              | None                                      | Yes      |
| `authService.adminSignup()`               | `adminAuthService.signup()`                | Rename DTO: `AdminSignupDTO` → keep       | Yes      |
| `authService.adminSignupSocial()`         | `adminAuthService.signupSocial()`          | Rename DTO: `AdminSignupSocialDTO` → keep | Yes      |
| `authService.adminSetPassword()`          | `adminAuthService.setPassword()`           | `identifier` → `sub`                      | Yes      |
| `authService.adminResetPassword()`        | `adminAuthService.resetPassword()`         | `identifier` → `sub`                      | Yes      |
| `authService.confirmAdminResetPassword()` | `adminAuthService.confirmResetPassword()`  | `identifier` → `sub`                      | Yes      |
| `authService.getUserById()`               | `adminAuthService.getUserById()`           | None                                      | Yes      |
| `authService.getUserByEmail()`            | `adminAuthService.getUserByEmail()`        | None                                      | Yes      |
| `authService.setMustChangePassword()`     | `adminAuthService.setMustChangePassword()` | None                                      | Yes      |
| `authService.updateVerifiedStatus()`      | `adminAuthService.updateVerifiedStatus()`  | None                                      | Yes      |

**Per-function checklist:**

- [ ] Move implementation to `AdminAuthService`
- [ ] Remove from `AuthService`
- [ ] Update spec file
- [ ] Update docusaurus: `auth-service.md` (remove method), create/update `admin-auth-service.md`
- [ ] Update client SDK (if applicable)
- [ ] Update sample-nestjs controller

---

### 3.2 Dual-Purpose APIs (Split into User + Admin versions)

These functions currently accept optional `sub`. Split into two separate APIs.

#### 3.2.1 logoutAll

| Aspect             | User Version                                      | Admin Version                       |
| ------------------ | ------------------------------------------------- | ----------------------------------- |
| Service            | `authService`                                     | `adminAuthService`                  |
| Method             | `logoutAll()`                                     | `logoutAll()`                       |
| DTO                | `LogoutAllDTO` (remove `sub`)                     | `AdminLogoutAllDTO` (require `sub`) |
| Cookie behavior    | Clears caller's cookies                           | Does NOT clear caller's cookies     |
| Gets user identity | From context (`ContextStorage.get(CURRENT_USER)`) | From DTO `sub`                      |

**Implementation Notes:**

- User version calls `ContextStorage.get(CURRENT_USER).sub` internally
- Admin version receives `sub` in DTO, does NOT call `clearAuthCookies()`
- Audit: User version `initiatedBy: 'user'`, Admin version `initiatedBy: 'admin'`

**DTO Changes:**

```typescript
// User: remove sub field entirely
export class LogoutAllDTO {
  @IsOptional()
  @IsBoolean()
  forgetDevices?: boolean;
}

// Admin: sub required (new file)
export class AdminLogoutAllDTO {
  @IsUUID()
  sub!: string;

  @IsOptional()
  @IsBoolean()
  forgetDevices?: boolean;
}
```

---

#### 3.2.2 changePassword → split

| Aspect   | User Version                                               | Admin Version                      |
| -------- | ---------------------------------------------------------- | ---------------------------------- |
| Service  | `authService`                                              | `adminAuthService`                 |
| Method   | `changePassword()`                                         | `setUserPassword()`                |
| DTO      | `ChangePasswordDTO` (remove `sub`, keep `currentPassword`) | Use existing `AdminSetPasswordDTO` |
| Behavior | Requires current password                                  | Admin sets directly                |

**DTO Changes:**

```typescript
// User: Remove sub, require currentPassword
export class ChangePasswordDTO {
  @IsString()
  currentPassword: string;

  @IsString()
  newPassword: string;
}

// Admin: Already exists as AdminSetPasswordDTO
```

**Note:** `ChangePasswordRequestDTO` currently extends `ChangePasswordDTO` and adds `sub`. **Delete** `ChangePasswordRequestDTO`, use `ChangePasswordDTO` directly. Service gets user from context.

---

#### 3.2.3 updateUserAttributes → split

| Aspect  | User Version                       | Admin Version                                |
| ------- | ---------------------------------- | -------------------------------------------- |
| Service | `authService`                      | `adminAuthService`                           |
| Method  | `updateUserAttributes()`           | `updateUserAttributes()`                     |
| DTO     | `UpdateUserAttributesDTO` (no sub) | `AdminUpdateUserAttributesDTO` (require sub) |

**DTO Changes:**

```typescript
// User: no sub
export class UpdateUserAttributesDTO extends UserUpdateDTO {
  // Inherits all update fields, no sub
}

// Admin: require sub
export class AdminUpdateUserAttributesDTO extends UserUpdateDTO {
  @IsUUID()
  sub!: string;
}
```

---

#### 3.2.4 getUserSessions → split

| Aspect  | User Version           | Admin Version                      |
| ------- | ---------------------- | ---------------------------------- |
| Service | `authService`          | `adminAuthService`                 |
| Method  | `getUserSessions()`    | `getUserSessions()`                |
| DTO     | None (no input needed) | `GetUserSessionsDTO` (require sub) |

**DTO Changes:**

```typescript
// User: no DTO needed, or empty DTO
// No change to existing GetUserSessionsDTO for admin

// Admin: require sub (already has it, make non-optional)
export class GetUserSessionsDTO {
  @IsUUID()
  sub!: string; // Change from optional to required
}
```

---

#### 3.2.5 logoutSession → split

| Aspect  | User Version                                    | Admin Version                                     |
| ------- | ----------------------------------------------- | ------------------------------------------------- |
| Service | `authService`                                   | `adminAuthService`                                |
| Method  | `logoutSession()`                               | `revokeUserSession()`                             |
| DTO     | `LogoutSessionDTO` (remove sub, keep sessionId) | `AdminRevokeSessionDTO` (require sub + sessionId) |

**DTO Changes:**

```typescript
// User: sessionId only
export class LogoutSessionDTO {
  @IsString()
  sessionId!: string;
}

// Admin: sub + sessionId
export class AdminRevokeSessionDTO {
  @IsUUID()
  sub!: string;

  @IsString()
  sessionId!: string;
}
```

---

#### 3.2.6 logout (single session)

| Aspect  | User Version             | Admin Version                        |
| ------- | ------------------------ | ------------------------------------ |
| Service | `authService`            | Not needed (use `revokeUserSession`) |
| Method  | `logout()`               | N/A                                  |
| DTO     | `LogoutDTO` (remove sub) | N/A                                  |

**DTO Changes:**

```typescript
// User: remove sub
export class LogoutDTO {
  @IsOptional()
  @IsBoolean()
  forgetMe?: boolean;
}
```

---

### 3.3 User Self-Service Only (Refactor to remove sub)

These remain in `AuthService`, just remove optional `sub` from DTO. Service gets user from context.

| Method              | DTO Change    |
| ------------------- | ------------- |
| `trustDevice()`     | None (no DTO) |
| `isTrustedDevice()` | None (no DTO) |

---

## Phase 4: Implementation Order

Execute in this order to minimize churn:

### Phase 4.1: Create AdminAuthService skeleton

1. Create `admin-auth.service.ts` with constructor injection
2. Create `admin-auth.service.spec.ts` skeleton
3. Wire into `AuthModule.forRoot()` and `NAuth.create()`
4. Verify builds pass

### Phase 4.2: Migrate admin-only functions (no DTO changes)

For each function in order:

1. `deleteUser()`
2. `disableUser()`
3. `enableUser()`
4. `getUsers()`
5. `getUserById()`
6. `getUserByEmail()`
7. `adminSignup()` → `signup()`
8. `adminSignupSocial()` → `signupSocial()`
9. `setMustChangePassword()`
10. `updateVerifiedStatus()`
11. `adminSetPassword()` → `setPassword()` (change `identifier` → `sub`)
12. `adminResetPassword()` → `resetPassword()` (change `identifier` → `sub`)
13. `confirmAdminResetPassword()` → `confirmResetPassword()` (change `identifier` → `sub`)

**Per-function steps:**

```
- [ ] Move to AdminAuthService
- [ ] Remove from AuthService
- [ ] Update/add tests
- [ ] Update auth-service.md (remove)
- [ ] Update/create admin-auth-service.md
- [ ] Update sample-nestjs controller
- [ ] Build + test
```

### Phase 4.3: Split dual-purpose APIs

For each in order:

1. `logoutAll()` - Fix cookie bug here
2. `changePassword()` - Delete `change-password-request.dto.ts`
3. `updateUserAttributes()` - Delete `update-user-attributes-request.dto.ts`
4. `getUserSessions()`
5. `logoutSession()`
6. `logout()` (remove sub only)

**Per-function steps:**

```
- [ ] Create admin DTO (if new)
- [ ] Modify user DTO (remove sub)
- [ ] Implement user version (gets user from context)
- [ ] Implement admin version
- [ ] Update tests for both
- [ ] Update auth-service.md
- [ ] Update admin-auth-service.md
- [ ] Update DTO docs (add new, update existing)
- [ ] Update sample-nestjs controller
- [ ] Update client SDK (if affected)
- [ ] Build + test
```

### Phase 4.4: Client SDK sync

1. Review `NAuthClient` methods
2. Update types in `packages/client/src/types/`
3. Admin methods may need separate admin client or clear docs that they're backend-only
4. Update client SDK docs in docusaurus

### Phase 4.5: Final validation

1. Run full test suite: `yarn workspace @nauth-toolkit/core test`
2. Build all packages: `yarn workspace @nauth-toolkit/core build`
3. Build sample-nestjs: `yarn workspace sample-nestjs build`
4. Build client-angular: `yarn workspace @nauth-toolkit/client-angular build`
5. Run sample-nestjs app to verify functionality
6. Review docs completeness

---

## File Inventory

### New Files

- `packages/core/src/services/admin-auth.service.ts`
- `packages/core/src/services/admin-auth.service.spec.ts`
- `packages/core/src/dto/admin-logout-all.dto.ts`
- `packages/core/src/dto/admin-update-user-attributes.dto.ts`
- `packages/core/src/dto/admin-revoke-session.dto.ts`
- `nauth-docs/docs/api/core/services/admin-auth-service.md`
- `nauth-docs/docs/api/core/dto/admin-logout-all-dto.md`
- `nauth-docs/docs/api/core/dto/admin-update-user-attributes-dto.md`
- `nauth-docs/docs/api/core/dto/admin-revoke-session-dto.md`

### Modified Files

- `packages/core/src/services/auth.service.ts` (remove admin methods)
- `packages/core/src/dto/logout-all.dto.ts` (remove sub)
- `packages/core/src/dto/logout.dto.ts` (remove sub)
- `packages/core/src/dto/change-password.dto.ts` (consolidate with request DTO)
- `packages/core/src/dto/change-password-request.dto.ts` (DELETE)
- `packages/core/src/dto/update-user-attributes-request.dto.ts` (DELETE)
- `packages/core/src/dto/get-user-sessions.dto.ts` (make sub required for admin)
- `packages/core/src/dto/logout-session.dto.ts` (remove sub)
- `packages/core/src/index.ts` (export AdminAuthService)
- `packages/nestjs/src/auth.module.ts` (provide AdminAuthService)
- `packages/nestjs/src/index.ts` (export AdminAuthService)
- `examples/sample-nestjs/src/auth/auth.controller.ts` (split admin endpoints)
- `nauth-docs/docs/api/core/services/auth-service.md` (remove admin methods)
- Various DTO docs

---

## Naming Conventions Summary

| Type                     | Convention                   | Example                                                                 |
| ------------------------ | ---------------------------- | ----------------------------------------------------------------------- |
| Admin service            | `AdminAuthService`           | `adminAuthService.deleteUser()`                                         |
| Admin DTO                | `Admin*DTO`                  | `AdminLogoutAllDTO`, `AdminRevokeSessionDTO`                            |
| Admin method rename      | Drop `admin` prefix          | `adminSignup()` → `signup()`                                            |
| User self-service DTO    | No sub field                 | `LogoutAllDTO`, `ChangePasswordDTO`                                     |
| User self-service method | Same name, different service | `authService.getUserSessions()` vs `adminAuthService.getUserSessions()` |

---

## Audit Trail Context

User version:

```typescript
await this.auditService.recordEvent({
  userId: currentUser.id,
  initiatedBy: 'user',
  // ...
});
```

Admin version:

```typescript
await this.auditService.recordEvent({
  userId: targetUser.id,
  initiatedBy: 'admin',
  adminIdentifier: this.clientInfoService.get().ipAddress,
  // ...
});
```

---

## Testing Requirements

Per PROJ_RULES.md:

- Unit tests for all new methods (`*.spec.ts`)
- 80%+ coverage minimum
- All public methods: Input DTO + Response DTO
- Each public method calls `ensureValidatedDto()` internally
- Run `yarn workspace @nauth-toolkit/core test` before completion
- Run `yarn workspace @nauth-toolkit/core build` for clean output
- Verify sample-nestjs builds and runs
- Verify client-angular builds
