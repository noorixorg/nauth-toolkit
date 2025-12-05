# Remember Device Feature

## Overview

The Remember Device feature allows users to skip Multi-Factor Authentication (MFA) verification for a configured period after successfully completing MFA once. This improves user experience by reducing friction while maintaining security through server-controlled device tokens.

## Architecture

### Device Token Generation

- **Server-Generated**: Device tokens are always generated server-side (UUID v4)
- **Secure Storage**: Only hash (SHA-256) stored in database
- **Persistence**: Tokens survive logout and session expiry (independent lifecycle)
- **Expiry**: Configurable via `rememberDeviceDays` (default: 30 days)

### Delivery Methods

The feature works across all token delivery modes:

#### Web (Cookies Mode)
- Device token set as `nauth_device_id` httpOnly cookie
- Automatically sent with requests (no frontend code needed)
- Most secure implementation

#### Mobile (JSON/Hybrid Mode)
- Device token returned in response body
- Client must store in secure storage:
  - **iOS**: Keychain
  - **Android**: EncryptedSharedPreferences
- Client sends token in `X-Device-Token` header on subsequent logins

#### Hybrid Mode
- Web requests: Cookie automatically set and used
- Mobile requests: Token in response body, stored by client

## Configuration

```typescript
mfa: {
  enabled: true,
  rememberDevice: true,              // Enable remember device feature
  rememberDeviceDays: 30,            // Days to remember trusted devices
  bypassMFAForTrustedDevices: true,  // Skip MFA for trusted devices (default: false)
}
```

### Security Considerations

**Bypass MFA for Trusted Devices (`bypassMFAForTrustedDevices`)**

- `false` (default): More secure - require MFA even for trusted devices
- `true`: Better UX - skip MFA for trusted devices
- **Note**: Does NOT apply to ADAPTIVE enforcement mode (has its own risk-based logic)
- **Recommendation**: Set to `false` for high-security applications

**JSON Mode Security**

- Device token is returned in response body (not httpOnly cookie)
- **Risk**: Token can be intercepted if not stored securely
- **Mitigation**: Mobile apps must use secure storage (Keychain/EncryptedSharedPreferences)
- **Documentation**: Consumer apps responsible for secure implementation

## Usage

### Backend Configuration

```typescript
import { AuthModule } from '@nauth-toolkit/core';

AuthModule.forRoot({
  // ... other config
  mfa: {
    enabled: true,
    rememberDevice: true,
    rememberDeviceDays: 30,
    bypassMFAForTrustedDevices: true, // Optional: skip MFA for trusted devices
  },
  tokenDelivery: {
    method: 'hybrid', // Works with 'json', 'cookies', or 'hybrid'
    // ...
  },
});
```

### Frontend Implementation

#### Web (Automatic - Cookies Mode)

No frontend code needed! Device token is automatically handled via httpOnly cookie.

```typescript
// Login with rememberMe flag
const response = await authService.login({
  email: 'user@example.com',
  password: 'password123',
  rememberMe: true, // Enable device trust
});
// Device token automatically set as cookie
```

#### Mobile (Manual - JSON/Hybrid Mode)

Store device token in secure storage and send on subsequent logins:

```typescript
import { SecureStorage } from '@capacitor-community/secure-storage';

// After successful login with rememberMe
const response = await authService.login({
  email: 'user@example.com',
  password: 'password123',
  rememberMe: true,
});

// Store device token in secure storage
if (response.deviceToken) {
  await SecureStorage.set({
    key: 'deviceToken',
    value: response.deviceToken,
  });
}

// On subsequent logins, send device token in header
const deviceToken = await SecureStorage.get({ key: 'deviceToken' });
const response = await authService.login({
  email: 'user@example.com',
  password: 'password123',
}, {
  headers: {
    'X-Device-Token': deviceToken,
  },
});
```

## Flow Diagram

```
User Login → Password Verified
    ↓
MFA Required? (check trusted device)
    ├─ Device Trusted? → Skip MFA → Create Session
    └─ Device Not Trusted → MFA Challenge
         ↓
    MFA Verified
         ↓
    Remember Me = true?
         ├─ Yes → Generate Device Token
         │         ├─ Web: Set Cookie
         │         └─ Mobile: Return in Response
         └─ No → Normal Login
```

## Security Features

1. **Server-Generated Tokens**: No client manipulation possible
2. **Hash Storage**: Only hash stored in database, not plain token
3. **Expiry Management**: Automatic cleanup of expired tokens
4. **Independent Lifecycle**: Tokens persist across logout/session expiry
5. **Cookie Security**: httpOnly, secure, sameSite for web

## API Reference

### TrustedDeviceService

```typescript
// Create trusted device (automatically called after MFA)
await trustedDeviceService.createTrustedDevice(
  userId,
  deviceName,
  deviceType,
  ipAddress,
  userAgent,
  platform,
  browser
);

// Check if device is trusted
const isTrusted = await trustedDeviceService.isDeviceTrusted(
  deviceToken,
  userId
);

// Revoke trusted device
await trustedDeviceService.revokeTrustedDevice(deviceToken, userId);

// Get user's trusted devices
const devices = await trustedDeviceService.getUserTrustedDevices(userId);
```

## Database Schema

```sql
nauth_trusted_devices
  - id: integer (PK)
  - userId: integer (FK to nauth_users.id)
  - deviceTokenHash: string (SHA-256 hash)
  - deviceId: string (nullable, backward compatibility)
  - deviceName: string (nullable)
  - deviceType: string (nullable)
  - ipAddress: string (nullable)
  - userAgent: string (nullable)
  - platform: string (nullable)
  - browser: string (nullable)
  - trustedUntil: timestamp
  - lastUsedAt: timestamp (nullable)
  - createdAt: timestamp
  - updatedAt: timestamp
```

## Troubleshooting

### Device Not Being Trusted

1. Check `rememberDevice` is enabled in config
2. Verify `rememberMe` flag was true on login
3. Check device token in cookie/header
4. Verify token hasn't expired (check `trustedUntil`)
5. Review logs for error messages

### JSON Mode Security Concerns

If using JSON mode:
- Ensure mobile apps use secure storage
- Document security requirements for developers
- Consider warning users about JSON mode risks
- Prefer cookies mode for web applications

## Migration Notes

### From Client-Controlled Device IDs

**Breaking Change**: `deviceId` field removed from `LoginDTO`

**Before:**
```typescript
// ❌ Old way (insecure - client-controlled)
login({ email, password, deviceId: 'client-generated-id' });
```

**After:**
```typescript
// ✅ New way (secure - server-controlled)
login({ email, password, rememberMe: true });
// Device token automatically generated and stored
```

### Frontend Updates Required

1. Remove `deviceId` from login requests
2. For mobile: Implement secure storage for `deviceToken`
3. Send `X-Device-Token` header on subsequent logins
4. Handle `deviceToken` in login responses

## Best Practices

1. **Enable for Production**: Use `bypassMFAForTrustedDevices: false` initially, enable after testing
2. **Monitor Usage**: Track trusted device creation/usage in audit logs
3. **Expiry Tuning**: Adjust `rememberDeviceDays` based on security requirements
4. **Revocation**: Provide UI for users to revoke trusted devices
5. **Hybrid Mode**: Use hybrid delivery for apps supporting both web and mobile

