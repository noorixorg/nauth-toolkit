# Multiple MFA Devices

NAuth Toolkit supports multiple MFA devices of the same type, allowing users to register several authenticator apps or passkeys for added flexibility.

## Overview

Users can register multiple devices for:
- **TOTP**: Multiple authenticator apps (e.g., Microsoft Authenticator, Google Authenticator)
- **Passkey**: Multiple passkeys on different devices (e.g., iPhone, iPad, YubiKey)

Each device has a unique name, ID, and can be marked as primary.

## How It Works

### Backend Behavior

When a user logs in and requires MFA, the backend returns challenge parameters including:

```json
{
  "challengeName": "MFA_REQUIRED",
  "session": "abc123",
  "challengeParameters": {
    "availableMethods": ["totp", "email"],
    "preferredMethod": "totp",
    "preferredDeviceId": 48,
    "devices": [
      {
        "id": 48,
        "name": "Microsoft Authenticator",
        "type": "totp",
        "isPrimary": true
      },
      {
        "id": 3,
        "name": "Google Authenticator",
        "type": "totp",
        "isPrimary": false
      }
    ]
  }
}
```

### Client SDK Handles Everything

The client SDK (`@nauth-toolkit/client`) automatically manages device selection:

```typescript
// 1. Get devices from challenge (for UI rendering only)
const devices = client.getMFADevices(challengeResponse);

// 2. User selects a device - SDK stores it internally
client.selectMFADevice(48);

// 3. Submit verification code - SDK auto-injects deviceId!
await client.respondToChallenge({
  type: 'MFA_REQUIRED',
  session: 'abc123',
  method: 'totp',
  code: '123456',
  // deviceId automatically added by SDK
});
```

## Frontend Implementation (Angular Example)

### MFA Selector Component

```typescript
export class MfaSelectorComponent {
  // SDK provides devices array - zero manual parsing
  devices = computed(() => {
    const challenge = this.auth.challenge();
    return challenge ? this.auth.getMFADevicesFromChallenge(challenge) : [];
  });

  async selectDevice(device: MFADevice) {
    // Tell SDK which device was selected
    this.auth.selectMFADevice(device.id);
    
    // Navigate - NO deviceId in query params!
    await this.router.navigate(['/auth/challenge/mfa-required']);
  }
}
```

### OTP Verification Component

```typescript
export class OtpVerifyComponent {
  async onSubmit() {
    const challengeResponse = {
      type: AuthChallenge.MFA_REQUIRED,
      session: challenge.session,
      method: 'totp',
      code: code.trim(),
      // NO deviceId - SDK auto-injects it!
    };
    
    await this.auth.respondToChallenge(challengeResponse);
  }
}
```

## Benefits

✅ **Zero Consumer Burden**: SDK handles all device tracking internally  
✅ **Framework Agnostic**: Works with Angular, React, Vue, vanilla JS  
✅ **Backward Compatible**: Existing code works without changes  
✅ **Single Source of Truth**: SDK manages state  

## API Reference

### Client SDK Methods

#### `selectMFADevice(deviceId: number)`
Selects an MFA device for verification. SDK stores this internally and auto-injects it when `respondToChallenge()` is called.

#### `getMFADevices(challenge: AuthResponse)`
Returns array of available MFA devices from a challenge response. Use this only for rendering UI.

#### `clearSelectedDevice()`
Clears any selected MFA device. Useful if user navigates back or cancels MFA flow.

### Angular AuthService Methods

#### `selectMFADevice(deviceId: number)`
Angular wrapper for `client.selectMFADevice()`.

#### `getMFADevicesFromChallenge(challenge: AuthResponse)`
Angular wrapper for `client.getMFADevices()`.

#### `clearSelectedMFADevice()`
Angular wrapper for `client.clearSelectedDevice()`.

## Migration from Manual Device Tracking

If you were previously passing `deviceId` manually via query parameters:

**Before (Manual)**:
```typescript
// MFA Selector - pass deviceId in query params
await this.router.navigate(['/auth/mfa'], {
  queryParams: { method: 'totp', deviceId: 48 }
});

// OTP Component - extract deviceId from query params
const deviceId = this.route.snapshot.queryParams['deviceId'];
await this.auth.respondToChallenge({
  type: 'MFA_REQUIRED',
  method: 'totp',
  code: '123456',
  deviceId: deviceId ? Number(deviceId) : undefined,
});
```

**After (SDK-Driven)**:
```typescript
// MFA Selector - tell SDK which device
this.auth.selectMFADevice(48);
await this.router.navigate(['/auth/mfa'], {
  queryParams: { method: 'totp' } // No deviceId!
});

// OTP Component - SDK auto-injects deviceId
await this.auth.respondToChallenge({
  type: 'MFA_REQUIRED',
  method: 'totp',
  code: '123456',
  // SDK handles deviceId internally
});
```

## Device Management APIs

### Add MFA Device

```typescript
// Setup TOTP with custom device name
const setupData = await client.setupMfaDevice('totp');
await client.verifyMfaSetup('totp', { code: '123456' }, 'My iPhone');
```

### List User's MFA Devices

```typescript
const devices = await client.getMfaDevices();
// Returns: [{ id: 48, type: 'totp', name: 'My iPhone', isPrimary: true }, ...]
```

### Remove MFA Device

```typescript
await client.removeMfaDeviceById(48);
```

### Set Preferred Device

```typescript
// Get user's devices
const devices = await client.getMfaDevices();

// Set specific device as preferred
await client.setPreferredMfaDevice(48);
```

## See Also

- [MFA Overview](/docs/features/mfa)
- [Client SDK Reference](/docs/frontend-sdk/api/nauth-client)
