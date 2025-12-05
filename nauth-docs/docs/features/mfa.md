---
title: Multi-Factor Authentication
description: Add TOTP, SMS, and Passkey second-factor authentication
sidebar_position: 2
---

# Multi-Factor Authentication (MFA)

Add a second layer of security to user accounts. After entering their password, users provide a second authentication factor: a code from an authenticator app, an SMS code, or biometric verification.

For complete MFA configuration options, see the [Configuration guide](/docs/concepts/configuration#multi-factor-authentication).

:::info Supported Methods

- **TOTP** - Authenticator apps (Google Authenticator, Authy, Microsoft Authenticator)
- **SMS** - Text message codes
- **Passkey** - Biometric authentication (Face ID, Touch ID, Windows Hello, YubiKey)
- **Backup Codes** - One-time recovery codes if other methods are unavailable

**Coming Soon:** Email-based MFA codes
:::

## Why Use MFA?

**For security:**

- Protects against stolen passwords
- Required for compliance (PCI-DSS, SOC 2, HIPAA)
- Prevents account takeover attacks

**For users:**

- Peace of mind for sensitive data
- Control over which devices are trusted
- Recovery options via backup codes

:::tip Adaptive MFA
nauth-toolkit can automatically require MFA for risky logins (new device, new location, unusual login time) while skipping it for trusted scenarios. This balances security and user experience.
:::

## How It Works

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="user" label="User Experience" default>

**Setup (one-time per method):**

1. User goes to security settings in your app
2. They choose "Enable Authenticator App" (or SMS/Passkey)
3. They scan a QR code (for TOTP) or verify their phone (for SMS)
4. They enter a test code to confirm it works
5. MFA is now active on their account

**Login with MFA:**

1. User enters email and password
2. System returns: `{ requiresMFA: true, challengeId: "abc123", methods: ["totp", "sms"] }`
3. Your app prompts: "Enter code from authenticator app"
4. User enters the 6-digit code
5. Your app sends: `{ challengeId: "abc123", code: "123456" }`
6. System verifies and returns JWT tokens

  </TabItem>
  <TabItem value="dev" label="Developer Integration">

**Step 1: Configure MFA options**

```typescript
const config = {
  mfa: {
    // General Settings
    enabled: true,
    issuer: 'YourAppName',
    enforcement: 'OPTIONAL', // 'OPTIONAL' | 'REQUIRED' | 'ADAPTIVE'

    // TOTP Configuration
    totp: {
      window: 1, // Allow 1 step before/after for clock skew
      stepSeconds: 30,
      digits: 6,
    },

    // SMS Configuration
    sms: {
      codeLength: 6,
      expiryMinutes: 5,
    },

    // Passkey Configuration
    passkey: {
      rpName: 'YourAppName',
      rpId: 'yourdomain.com',
      origin: 'https://yourdomain.com',
      userVerification: 'preferred',
    },

    // Backup Codes
    backup: {
      enabled: true,
      codeCount: 10,
      codeLength: 8,
    },
  },
};
```

**Step 2: Add MFA setup endpoints**

```typescript
// Initiate TOTP setup
@Post('mfa/totp/setup')
@UseGuards(AuthGuard)
async setupTotp(@CurrentUser() user) {
  return this.mfaService.initiateTotpSetup(user.sub);
  // Returns: { secret, qrCode, backupCodes }
}

// Verify TOTP setup
@Post('mfa/totp/verify-setup')
@UseGuards(AuthGuard)
async verifyTotpSetup(@CurrentUser() user, @Body() dto) {
  return this.mfaService.verifyTotpSetup(user.sub, dto.code);
}

// During login - verify MFA challenge
@Post('auth/mfa/verify')
async verifyMfaChallenge(@Body() dto) {
  return this.authService.verifyMfaChallenge(dto.challengeId, dto.code);
  // Returns: { accessToken, refreshToken }
}
```

  </TabItem>
</Tabs>

## TOTP (Authenticator Apps)

The most common MFA method. Users install an authenticator app on their phone and scan a QR code.

**User flow:**

1. Your app calls `mfaService.initiateTotpSetup(userId)`
2. Display the QR code to the user
3. User scans with Google Authenticator (or similar)
4. User enters the 6-digit code they see
5. Your app calls `mfaService.verifyTotpSetup(userId, code)`
6. TOTP is now active

**Technical details:**

- Algorithm: SHA-1 (standard), SHA-256/SHA-512 (configurable)
- Code length: 6 digits (default), configurable
- Time step: 30 seconds (default)
- Window: ±1 step (allows for clock skew)

:::note Backup Codes
When enabling TOTP, always generate and display backup codes. Users should save these in case they lose their phone.
:::

<details>
<summary>QR Code Format</summary>

The QR code contains a URI like:

```
otpauth://totp/YourApp:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=YourApp
```

Authenticator apps parse this and start generating codes.

</details>

## SMS MFA

Send verification codes via text message. Users enter the code they receive.

**Prerequisites:**

- Configure an SMS provider (AWS SNS, Twilio, etc.)
- User must have a verified phone number

**Configuration:**

```typescript
import { TwilioSmsProvider } from '@nauth-toolkit/sms-twilio';

const config = {
  sms: {
    provider: new TwilioSmsProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: '+1234567890',
    }),
  },
  mfa: {
    sms: {
      enabled: true,
      codeLength: 6,
      expiryMinutes: 5,
    },
  },
};
```

:::warning SMS Security Considerations
SMS is less secure than TOTP or Passkey due to SIM swapping attacks. Consider using SMS as a backup option, not the primary MFA method.
:::

## Passkey (WebAuthn)

Modern biometric authentication. Users verify with Face ID, Touch ID, Windows Hello, or a hardware security key.

**Configuration:**

```typescript
mfa: {
  passkey: {
    rpName: 'My Application', // Name shown in browser prompt
    rpId: 'example.com',      // Domain (must match current domain)
    origin: 'https://example.com', // Origin URL
    timeout: 60000,           // Timeout in ms
    userVerification: 'preferred', // 'required' | 'preferred' | 'discouraged'
    authenticatorAttachment: 'platform', // 'platform' (FaceID) | 'cross-platform' (YubiKey)
  }
}
```

**Cross-device authentication:**

Users can authenticate on desktop using a passkey stored on their phone via QR codes (FIDO2 standard). This is handled automatically by the browser and nauth-toolkit.

## Backup Codes

One-time recovery codes in case users lose access to their primary MFA method.

**Configuration:**

```typescript
mfa: {
  backup: {
    enabled: true,
    codeCount: 10, // Number of codes to generate
    codeLength: 8, // Length of each code
  }
}
```

:::danger Security Notice
Backup codes are shown only once. Users must save them immediately. If they lose all codes and their MFA device, account recovery requires manual support intervention.
:::

## Adaptive MFA

Automatically require MFA for risky logins, but skip it for trusted scenarios.

**Risk factors:**

- **New Device**: 20 points
- **New IP Address**: 15 points
- **New Country**: 25 points
- **Impossible Travel**: 40 points (e.g. Tokyo to NY in 1 hour)
- **Suspicious Activity**: 30 points (recent failed logins)

**Configuration:**

```typescript
const config = {
  mfa: {
    enforcement: 'ADAPTIVE',
    adaptive: {
      // Risk thresholds
      riskLevels: {
        low: { maxScore: 20, action: 'allow' },
        medium: { maxScore: 50, action: 'require_mfa' },
        high: { maxScore: 100, action: 'block_signin' },
      },

      // Custom weights (optional)
      riskWeights: {
        new_device: 30,
        impossible_travel: 100,
      },

      // Impossible travel settings
      maxTravelSpeed: 900, // km/h
    },
  },
};
```

**How it works:**

1. User logs in from a known device in their usual location → Risk Score: 0 → **Allow**
2. User logs in from a new phone (20) in a different country (25) → Risk Score: 45 → **Require MFA**
3. User logs in from a new IP (15) → Risk Score: 15 → **Allow**

:::tip User Experience
Adaptive MFA provides the best balance:

- High security for suspicious logins
- Seamless experience for normal logins
- No need to force MFA 100% of the time
  :::

## Enforcement Policies

Control when and how MFA is required.

<Tabs>
  <TabItem value="optional" label="Optional (Default)" default>

```typescript
{
  mfa: {
    enforcement: 'OPTIONAL'; // Users choose to enable MFA
  }
}
```

Users can enable MFA if they want, but it's not required.

  </TabItem>
  <TabItem value="required" label="Required for All">

```typescript
{
  mfa: {
    enforcement: 'REQUIRED',
    gracePeriod: 7, // Give users 7 days to set up
  }
}
```

All users must enable MFA. After signup, they have 7 days to set it up before being locked out.

  </TabItem>
  <TabItem value="adaptive" label="Adaptive (Risk-Based)">

```typescript
{
  mfa: {
    enforcement: 'ADAPTIVE';
  }
}
```

MFA is only required when the login is deemed risky (e.g., new device, new location).

  </TabItem>
</Tabs>

## Remember Device

Users can mark devices as "trusted" to skip MFA for a period.

```typescript
{
  mfa: {
    rememberDevice: true,
    rememberDeviceDays: 30,
  }
}
```

**Security:**

- Device tokens are cryptographically signed
- Stored as secure HTTP-only cookies (web) or in secure storage (mobile)
- Automatically expire after the configured period
- Can be revoked at any time from user settings

## Managing MFA Devices

Users can manage their enrolled MFA methods from their account settings.

**API methods:**

```typescript
// List all enrolled devices
mfaService.getUserMfaDevices(userId);

// Remove a device
mfaService.removeMfaDevice(userId, deviceId);

// Set primary device (default method)
mfaService.setPrimaryMfaDevice(userId, deviceId);

// Regenerate backup codes
mfaService.regenerateBackupCodes(userId);
```

**Display to users:**

- Device name (e.g., "iPhone 14", "Google Authenticator")
- Type (TOTP, SMS, Passkey)
- Last used date
- Created date
- Primary indicator

## Error Handling

| Error Code              | Reason                                                 | User Action                  |
| ----------------------- | ------------------------------------------------------ | ---------------------------- |
| `MFA_REQUIRED`          | Login requires MFA but no challenge was verified       | Prompt for MFA code          |
| `MFA_INVALID_CODE`      | Code is incorrect                                      | Try again or use backup code |
| `MFA_EXPIRED_CODE`      | Code has expired (SMS codes typically expire in 5 min) | Request a new code           |
| `MFA_NO_DEVICES`        | User has MFA enabled but no devices enrolled           | Contact support for recovery |
| `MFA_CHALLENGE_EXPIRED` | MFA challenge timed out (typically 5 minutes)          | Re-login from the start      |
| `MFA_SETUP_INVALID`     | TOTP setup verification failed                         | Check time sync on phone     |
