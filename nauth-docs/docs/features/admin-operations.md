# Admin Operations

Administrative user management features for creating and managing user accounts with override capabilities.

## Overview

The admin operations include two methods for administrative user creation:

1. **`adminSignup()`** - Create password-based user accounts with override capabilities
2. **`adminSignupSocial()`** - Import social users from external platforms (Cognito, Auth0) with social linkage

### adminSignup() Capabilities

The `adminSignup()` method allows administrators to create user accounts with capabilities not available in regular signup:

- **Bypass verification requirements** - Pre-verify email/phone without sending verification codes
- **Force password change** - Require users to change password on first login
- **Auto-generate passwords** - Create secure temporary passwords for new accounts
- **Skip challenge system** - Create accounts that can login immediately (if verified)

### adminSignupSocial() Capabilities

The `adminSignupSocial()` method is specifically designed for importing users with social login credentials:

- **Import social users** - Create accounts with pre-linked social providers (Google, Apple, Facebook)
- **Migrate from external platforms** - Seamlessly migrate users from Cognito, Auth0, or other auth providers
- **Social-only or hybrid accounts** - Create social-only users (no password) or hybrid users (social + password)
- **Pre-verify credentials** - Same bypass capabilities as `adminSignup()` for email/phone verification
- **Preserve social metadata** - Store complete OAuth profile data for audit and debugging

## Password-Based Admin Signup

## Security Warning

**IMPORTANT:** The `adminSignup()` endpoint has **NO built-in authentication**. You **MUST** protect it with your own admin authentication guard/middleware.

```typescript
// INSECURE - No protection
@Post('admin/signup')
async createUser(@Body() dto: AdminSignupDTO) {
  return this.authService.adminSignup(dto);
}

// SECURE - Protected with admin guard
@Post('admin/signup')
@UseGuards(AdminAuthGuard) // Your own guard
async createUser(@Body() dto: AdminSignupDTO) {
  return this.authService.adminSignup(dto);
}
```

## Usage

### Basic Admin Signup

Create a user with default settings (unverified email/phone):

```typescript
const result = await authService.adminSignup({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe',
});

// Returns: { user: IUser }
// User must verify email/phone through normal flow
```

### Pre-Verified Accounts

Create accounts with pre-verified email and phone:

```typescript
const result = await authService.adminSignup({
  email: 'user@example.com',
  password: 'SecurePass123!',
  isEmailVerified: true,
  isPhoneVerified: true,
});

// User can login immediately (no verification challenges)
```

### Auto-Generated Passwords

Generate secure temporary passwords for new accounts:

```typescript
const result = await authService.adminSignup({
  email: 'user@example.com',
  generatePassword: true,
  isEmailVerified: true,
  mustChangePassword: true, // User must change password on first login
});

// Returns: { user: IUser, generatedPassword: 'Kx9#mP2$vN7@qR4!' }
// Admin should securely deliver the password to the user
```

**Security Note:** Generated passwords are returned **once** in the response and **never stored in plain text**. The admin must securely deliver the password to the user (e.g., via secure email, in-person, etc.).

### Force Password Change

Require users to change their password on first login:

```typescript
const result = await authService.adminSignup({
  email: 'user@example.com',
  password: 'TemporaryPass123!',
  mustChangePassword: true,
});

// User will be required to change password on next login
```

## API Reference

### AdminSignupDTO

```typescript
interface AdminSignupDTO {
  // Required fields
  email: string; // Valid email format, max 255 chars

  // Password (required unless generatePassword is true)
  password?: string; // Min 8 chars, max 128 chars, validated against policy

  // Optional user fields
  username?: string; // 3-50 chars, alphanumeric + underscore/hyphen
  firstName?: string; // 1-100 chars, letters/spaces/hyphens/apostrophes
  lastName?: string; // 1-100 chars, letters/spaces/hyphens/apostrophes
  phone?: string; // E.164 format (e.g., +14155552671)
  metadata?: Record<string, unknown>; // Custom fields

  // Admin override flags
  isEmailVerified?: boolean; // Default: false - bypass email verification
  isPhoneVerified?: boolean; // Default: false - bypass phone verification
  mustChangePassword?: boolean; // Default: false - force password change on login
  generatePassword?: boolean; // Default: false - auto-generate secure password
}
```

### AdminSignupResponseDTO

```typescript
interface AdminSignupResponseDTO {
  user: IUser; // Created user object
  generatedPassword?: string; // Only present if generatePassword was true
}
```

## Framework Examples

### NestJS

```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService, AdminSignupDTO } from '@nauth-toolkit/nestjs';
import { AdminAuthGuard } from './guards/admin-auth.guard'; // Your guard

@Controller('admin')
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UseGuards(AdminAuthGuard) // Protect with your admin guard
  async createUser(@Body() dto: AdminSignupDTO) {
    return this.authService.adminSignup(dto);
  }
}
```

### Express

```typescript
import { nauth } from './nauth'; // Your NAuth instance
import { requireAdminAuth } from './middleware/admin-auth'; // Your middleware

app.post(
  '/admin/signup',
  requireAdminAuth, // Protect with your admin middleware
  async (req, res) => {
    const result = await nauth.authService.adminSignup(req.body);
    res.json(result);
  },
);
```

### Fastify

```typescript
import { nauth } from './nauth'; // Your NAuth instance
import { requireAdminAuth } from './hooks/admin-auth'; // Your hook

fastify.post(
  '/admin/signup',
  { preHandler: requireAdminAuth }, // Protect with your admin hook
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.adminSignup(req.body as AdminSignupDTO);
  }),
);
```

## Verification Bypass Behavior

When `isEmailVerified` or `isPhoneVerified` are set to `true`:

- **No verification emails/SMS are sent** - The user's email/phone is marked as verified immediately
- **No challenge system is triggered** - User can login without verification challenges
- **User can login immediately** - If both email and phone are verified (or verification is not required by config)

When set to `false` (default):

- User must verify through normal verification flow
- Verification codes/links are sent when user attempts to login
- Challenge system enforces verification before allowing access

## Force Password Change Workflow

When `mustChangePassword: true`:

1. User account is created with the provided/generated password
2. User attempts to login with the password
3. Login succeeds but returns `FORCE_CHANGE_PASSWORD` challenge
4. User must call `respondToChallenge()` with new password
5. After password change, user receives tokens and can access the system

**Example Flow:**

```typescript
// Admin creates user
const { user } = await authService.adminSignup({
  email: 'user@example.com',
  generatePassword: true,
  mustChangePassword: true,
});

// User logs in
const loginResult = await authService.login({
  identifier: 'user@example.com',
  password: generatedPassword,
});

// Result contains challenge
// loginResult.challengeName === 'FORCE_CHANGE_PASSWORD'

// User responds to challenge
await authService.respondToChallenge({
  session: loginResult.session,
  type: 'FORCE_CHANGE_PASSWORD',
  newPassword: 'NewSecurePass123!',
});
```

## Generated Password Best Practices

1. **Never log generated passwords** - They appear only in the API response
2. **Deliver securely** - Use encrypted email, secure messaging, or in-person delivery
3. **Set expiration** - Consider setting `mustChangePassword: true` to force immediate change
4. **One-time use** - Generated passwords should be changed immediately after first login
5. **Audit trail** - All admin-created accounts are logged with `createdByAdmin: true` in audit logs

## Audit Trail

All admin-created accounts are logged in the audit trail with:

- `eventType: ACCOUNT_CREATED`
- `authMethod: 'admin'`
- `metadata.createdByAdmin: true`
- `metadata.adminIdentifier: <IP address>`
- `metadata.isEmailVerified: <boolean>`
- `metadata.isPhoneVerified: <boolean>`
- `metadata.mustChangePassword: <boolean>`
- `metadata.passwordGenerated: <boolean>`

Query admin-created accounts:

```typescript
const adminCreatedAccounts = await auditService.getEventsByType({
  eventType: AuthAuditEventType.ACCOUNT_CREATED,
  filters: {
    metadata: { createdByAdmin: true },
  },
});
```

## Validation Rules

Admin signup enforces the same validation rules as regular signup:

- **Email uniqueness** - Email must not already exist
- **Username uniqueness** - Username must not already exist (if provided)
- **Phone uniqueness** - Phone must not already exist (if duplicates not allowed)
- **Password policy** - Password must meet strength requirements (unless auto-generated)
- **Field formats** - Email, phone, username must match required formats

## Differences from Regular Signup

| Feature               | Regular Signup                       | Admin Signup                         |
| --------------------- | ------------------------------------ | ------------------------------------ |
| Signup enabled check  | Enforced                             | Bypassed                             |
| Email verification    | Always false initially               | Can be set to true                   |
| Phone verification    | Always false initially               | Can be set to true                   |
| Password generation   | Not supported                        | Supported                            |
| Force password change | Not supported                        | Supported                            |
| Challenge system      | Triggered if verification required   | Never triggered                      |
| Verification emails   | Sent automatically                   | Never sent                           |
| Response type         | `AuthResponseDTO` (tokens/challenge) | `AdminSignupResponseDTO` (user only) |
| Audit log             | `authMethod: 'password'`             | `authMethod: 'admin'`                |

## When to Use

**Use `adminSignup()` when:**

- Creating accounts for existing users (e.g., migrating from another system)
- Bulk account creation (with proper admin authentication)
- Creating test accounts in development
- Onboarding users via admin panel
- Creating accounts with pre-verified credentials

**Use regular `signup()` when:**

- Users are self-registering
- You want standard verification flow
- You want challenge system to handle verification
- You want automatic verification emails/SMS

## Error Handling

Common errors:

- `EMAIL_EXISTS` - Email already registered
- `USERNAME_EXISTS` - Username already taken
- `PHONE_EXISTS` - Phone already registered (if duplicates not allowed)
- `WEAK_PASSWORD` - Password doesn't meet policy requirements
- `VALIDATION_FAILED` - Invalid DTO format

All errors follow the standard `NAuthException` format with error codes and metadata.

---

## Social User Migration

The `adminSignupSocial()` method is designed for importing users with existing social login credentials from external platforms (e.g., Cognito, Auth0, Firebase Auth).

### Use Cases

- **Platform migration** - Moving users from Cognito/Auth0 to nauth-toolkit
- **Social account imports** - Bulk import users with social logins
- **Hybrid account creation** - Create users with both social and password auth
- **Pre-verified social users** - Import users with verified email from providers

### Basic Social User Import

Import a social-only user (no password):

```typescript
const result = await authService.adminSignupSocial({
  email: 'user@example.com',
  provider: 'google',
  providerId: 'google_12345',
  providerEmail: 'user@gmail.com',
  isEmailVerified: true, // Trust provider's verification
});

// Returns: { user: IUser, socialAccount: { provider, providerId, providerEmail } }
// User can login via Google OAuth
```

### Hybrid Social + Password User

Create a user with both social and password authentication:

```typescript
const result = await authService.adminSignupSocial({
  email: 'user@example.com',
  password: 'SecurePass123!',
  provider: 'apple',
  providerId: 'apple_67890',
  isEmailVerified: true,
});

// User can login via Apple OR email+password
```

### Cognito Migration Example

Complete example migrating a Cognito user with Google social login:

```typescript
// Fetch user from Cognito
const cognitoUser = await cognitoIdentityProvider.adminGetUser({
  UserPoolId: 'us-east-1_xxx',
  Username: 'google_12345',
});

// Extract social identity
const googleIdentity = cognitoUser.UserAttributes.find((attr) => attr.Name === 'identities');
const identity = JSON.parse(googleIdentity.Value)[0];

// Import to nauth-toolkit
// Note: Email is automatically verified for social imports (like normal social signup)
const result = await authService.adminSignupSocial({
  email: cognitoUser.UserAttributes.find((attr) => attr.Name === 'email')?.Value,
  provider: identity.providerName.toLowerCase(), // 'google'
  providerId: identity.userId, // Provider's user ID
  providerEmail: identity.providerAttributes?.email,
  socialMetadata: identity.providerAttributes, // Store full OAuth profile
  firstName: cognitoUser.UserAttributes.find((attr) => attr.Name === 'given_name')?.Value,
  lastName: cognitoUser.UserAttributes.find((attr) => attr.Name === 'family_name')?.Value,
});
```

### API Reference

#### AdminSignupSocialDTO

```typescript
interface AdminSignupSocialDTO {
  // Required fields
  email: string; // User's primary email (automatically verified for social imports)
  provider: 'google' | 'apple' | 'facebook'; // Social provider
  providerId: string; // Provider's unique user ID (e.g., Google sub)

  // Optional social fields
  providerEmail?: string; // Email from provider (may differ from user email)
  socialMetadata?: Record<string, unknown>; // Full OAuth profile for audit

  // Optional password (for hybrid accounts)
  password?: string; // Min 8 chars, policy enforced

  // Optional user fields
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string; // E.164 format
  metadata?: Record<string, unknown>;

  // Admin override flags
  // Note: isEmailVerified is not part of the DTO - email is always verified for social imports
  isPhoneVerified?: boolean; // Default: false
  mustChangePassword?: boolean; // Only relevant if password provided
}
```

#### AdminSignupSocialResponseDTO

```typescript
interface AdminSignupSocialResponseDTO {
  user: IUser; // Created user with hasSocialAuth=true, socialProviders=['google']
  socialAccount: {
    provider: string; // 'google'
    providerId: string; // 'google_12345'
    providerEmail: string | null; // 'user@gmail.com' or null
  };
}
```

### Security Warning

Like `adminSignup()`, the `adminSignupSocial()` method has **NO built-in authentication**. **MUST** protect with admin guards.

```typescript
// SECURE - Protected
@Post('admin/import-social-user')
@UseGuards(AdminAuthGuard)
async importSocialUser(@Body() dto: AdminSignupSocialDTO) {
  return this.authService.adminSignupSocial(dto);
}
```

### Validation Rules

Additional social-specific validations:

- **Social account uniqueness** - `provider + providerId` combination must be unique
- **Email uniqueness** - Email must not already exist (same as regular signup)
- **Username uniqueness** - Username must not already exist (if provided)
- **Phone uniqueness** - Phone must not already exist (if duplicates not allowed)
- **Password policy** - Password must meet strength requirements (only if provided)

### Error Handling

Social-specific errors:

- `SOCIAL_ACCOUNT_EXISTS` - This provider + providerId combination already exists
- `SOCIAL_CONFIG_MISSING` - Social auth not configured in your NAuth instance
- `EMAIL_EXISTS` - Email already registered
- `USERNAME_EXISTS` - Username already taken
- `PHONE_EXISTS` - Phone already registered (if duplicates not allowed)
- `WEAK_PASSWORD` - Password doesn't meet policy (only if password provided)

### Framework Examples

#### NestJS

```typescript
@Controller('admin')
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Post('import-social-user')
  @UseGuards(AdminAuthGuard)
  async importSocialUser(@Body() dto: AdminSignupSocialDTO) {
    return this.authService.adminSignupSocial(dto);
  }
}
```

#### Express

```typescript
app.post('/admin/import-social-user', requireAdminAuth, async (req, res) => {
  const result = await nauth.authService.adminSignupSocial(req.body);
  res.json(result);
});
```

#### Fastify

```typescript
fastify.post(
  '/admin/import-social-user',
  { preHandler: requireAdminAuth },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.adminSignupSocial(req.body);
  }),
);
```

### User Flags Auto-Updated

When a social account is linked via `adminSignupSocial()`, the user's flags are automatically updated:

- `hasSocialAuth` - Set to `true`
- `socialProviders` - Array of linked providers (e.g., `['google']`)
- `hasPasswordHash` - Set to `true` only if password provided, otherwise remains `false`

This ensures users can login via their social provider immediately after import.

### Audit Trail

All admin social imports are logged with:

- `eventType: ACCOUNT_CREATED`
- `authMethod: 'admin-social'`
- `metadata.createdByAdmin: true`
- `metadata.provider: 'google'`
- `metadata.providerId: 'google_12345'`
- `metadata.hasPassword: boolean` (true for hybrid accounts)
- `metadata.socialImport: true`

### When to Use adminSignupSocial()

**Use `adminSignupSocial()` when:**

- Migrating users from Cognito, Auth0, Firebase Auth
- Bulk importing users with social logins
- Creating hybrid accounts (social + password)
- Importing users with provider-verified emails

**Use `adminSignup()` when:**

- Creating password-only accounts
- Users don't have social login credentials
- Generating temporary passwords

---

## Admin MFA Operations

Administrators can manage MFA devices for any user through dedicated admin endpoints.

### Get User's MFA Devices

Retrieve all active MFA devices for a specific user:

```typescript
const result = await mfaService.adminGetUserDevices({ 
  sub: 'user-uuid' 
});

// Returns: { devices: [...] }
```

**Response:**

```json
{
  "devices": [
    {
      "id": 1,
      "type": "totp",
      "name": "Google Authenticator",
      "isPreferred": true,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "type": "passkey",
      "name": "MacBook Pro",
      "isPreferred": false,
      "isActive": true,
      "createdAt": "2024-01-02T00:00:00.000Z"
    }
  ]
}
```

### Get User's MFA Status

Get comprehensive MFA status for a user:

```typescript
const status = await mfaService.adminGetMfaStatus({ sub: 'user-uuid' });
```

### Remove MFA Device

Remove a specific MFA device by ID:

```typescript
const result = await mfaService.adminRemoveDevice({ deviceId: 123 });
```

### Set Preferred MFA Device

Set a specific device as the user's preferred MFA device:

```typescript
const result = await mfaService.adminSetPreferredDevice({ 
  sub: 'user-uuid',
  deviceId: 123 
});
```

### Set MFA Exemption

Grant or revoke MFA exemption for a user:

```typescript
const result = await mfaService.setMFAExemption({
  sub: 'user-uuid',
  exempt: true,
  reason: 'Service account - no human login',
  grantedBy: adminUser.sub
});
```

### NestJS Controller Examples

```typescript
@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminMfaController {
  constructor(private readonly mfaService: MFAService) {}

  @Get('users/:sub/mfa/devices')
  async getUserDevices(@Param() dto: AdminGetUserDevicesDTO) {
    return this.mfaService.adminGetUserDevices(dto);
  }

  @Get('users/:sub/mfa/status')
  async getMfaStatus(@Param() dto: AdminGetMFAStatusDTO) {
    return this.mfaService.adminGetMfaStatus(dto);
  }

  @Delete('mfa/devices/:deviceId')
  async removeDevice(@Param() dto: AdminRemoveDeviceDTO) {
    return this.mfaService.adminRemoveDevice(dto);
  }

  @Post('users/:sub/mfa/devices/:deviceId/preferred')
  async setPreferredDevice(@Param() dto: AdminSetPreferredDeviceDTO) {
    return this.mfaService.adminSetPreferredDevice(dto);
  }
}
```

### Client SDK Usage

```typescript
// Get user's MFA devices
const result = await client.admin.getMfaDevices('user-uuid');
console.log(result.devices);

// Get MFA status
const status = await client.admin.getMfaStatus('user-uuid');
console.log(status.enabled, status.configuredMethods);

// Remove a device
await client.admin.removeMfaDeviceById(123);

// Set preferred device
await client.admin.setPreferredMfaDevice('user-uuid', 123);
```

### Security Warning

All admin MFA operations have **NO built-in authentication**. You **MUST** protect them with your own admin authentication guard/middleware.

---
