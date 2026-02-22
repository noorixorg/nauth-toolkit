---
title: MFA Setup
description: Guide to implementing multi-factor authentication setup and verification
keywords: [mfa, totp, sms, email, passkey, webauthn, 2fa]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MFA Setup

Guide to implementing multi-factor authentication (MFA) setup, verification, and management in the frontend SDK.

## Supported MFA Methods

| Method                               | Description                                                | Requirements            |
| ------------------------------------ | ---------------------------------------------------------- | ----------------------- |
| [`totp`](../api/types/mfa-method)    | Time-based One-Time Password (Google Authenticator, Authy) | Authenticator app       |
| [`sms`](../api/types/mfa-method)     | SMS verification code                                      | Verified phone number   |
| [`email`](../api/types/mfa-method)   | Email verification code                                    | Verified email address  |
| [`passkey`](../api/types/mfa-method) | WebAuthn/FIDO2 biometric authentication                    | HTTPS + browser support |
| [`backup`](../api/types/mfa-method)  | Single-use recovery codes                                  | MFA already configured  |

See [`MFAMethod`](../api/types/mfa-method) and [`MFADeviceMethod`](../api/types/mfa-method#mfadevicemethod) for type definitions.

## MFA During Authentication

### MFA Required Challenge

When MFA is enabled and user logs in:

```typescript
import { getMFAMethod, getMaskedDestination } from '@nauth-toolkit/client';

const response = await client.login(email, password);

if (response.challengeName === 'MFA_REQUIRED') {
  // Get preferred MFA method
  const method = getMFAMethod(response);
  // Returns: 'sms' | 'email' | 'totp' | 'backup' | 'passkey' | undefined

  // Get masked destination (automatically uses preferredMethod)
  const destination = getMaskedDestination(response);
  // For SMS: "***-***-9393"
  // For Email: "m***2@example.com"

  // Available methods in challengeParameters
  const methods = response.challengeParameters?.availableMethods;
  // ['totp', 'sms', 'backup']

  navigateToMfaPage(response, method, destination);
}
```

**Note:** For `MFA_REQUIRED` challenges, the backend provides `preferredMethod`, `maskedPhone`, and `maskedEmail` in `challengeParameters`. Use [`getMaskedDestination()`](../api/utilities/challenge-helpers#getmaskeddestination) to get the correct masked destination based on the preferred method.

See [`AuthResponse`](../api/types/auth-response) for challenge structure and [`AuthChallenge`](../api/types/auth-challenge) for challenge types.

### Verifying MFA

<Tabs groupId="platform">
<TabItem value="vanilla" label="Vanilla JS/TS">

```typescript
async function verifyMfa(method: string, code: string): Promise<void> {
  const response = await client.respondToChallenge({
    session: challengeSession.session,
    type: 'MFA_REQUIRED',
    method,
    code,
  });

  if (!response.challengeName) {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  }
}

// For passkey authentication
async function verifyPasskey(): Promise<void> {
  // Option 1: SimpleWebAuthn (recommended)
  import { startAuthentication } from '@simplewebauthn/browser';

  // Get challenge options
  const options = await client.getChallengeData(session, 'passkey');

  // Authenticate with passkey
  const credential = await startAuthentication(options);

  // Verify
  await client.respondToChallenge({
    session,
    type: 'MFA_REQUIRED',
    method: 'passkey',
    credential,
  });
}
```

</TabItem>
<TabItem value="angular" label="Angular">

```typescript
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@nauth-toolkit/client-angular';

@Component({
  selector: 'app-mfa-verify',
  template: `
    <div class="method-tabs">
      @for (method of availableMethods; track method) {
        <button [class.active]="selectedMethod === method" (click)="selectMethod(method)">
          {{ getMethodLabel(method) }}
        </button>
      }
    </div>

    @if (selectedMethod !== 'passkey') {
      <form (ngSubmit)="verify()">
        <input [(ngModel)]="code" name="code" placeholder="Enter 6-digit code" maxlength="6" />
        <button [disabled]="loading">Verify</button>
      </form>
    } @else {
      <button (click)="verifyPasskey()" [disabled]="loading">
        Authenticate with Passkey
      </button>
    }
  `,
})
export class MfaVerifyComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  availableMethods: string[] = [];
  selectedMethod = '';
  code = '';
  loading = false;
  private session = '';

  verify(): void {
    this.loading = true;
    this.auth
      .respondToChallenge({
        session: this.session,
        type: 'MFA_REQUIRED',
        method: this.selectedMethod,
        code: this.code,
      })
      .subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: (err) => {
          this.loading = false;
          alert(err.message);
        },
      });
  }

  async verifyPasskey(): Promise<void> {
    this.loading = true;
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');

      // Get challenge options
      const options = await this.auth.getClient().getChallengeData(this.session, 'passkey');

      // Authenticate with passkey
      const credential = await startAuthentication(options);

      // Verify via backend
      this.auth
        .respondToChallenge({
          session: this.session,
          type: 'MFA_REQUIRED',
          method: 'passkey',
          credential,
        })
        .subscribe({
          next: () => this.router.navigate(['/dashboard']),
          error: (err) => {
            this.loading = false;
            alert(err.message);
          },
        });
    } catch (error) {
      this.loading = false;
      console.error('Passkey authentication failed:', error);
    }
  }

  getMethodLabel(method: string): string {
}
```

</TabItem>
</Tabs>

## MFA Setup During Authentication

When MFA setup is enforced during signup/login:

### MFA Setup Required Challenge

```typescript
if (response.challengeName === 'MFA_SETUP_REQUIRED') {
  const availableMethods = response.challengeParameters?.availableMethods;
  navigateToMfaSetupPage(response);
}
```

### Setting Up TOTP

**Complete Flow:**

```typescript
// 1. Get TOTP setup data
const setupData = await client.getSetupData(session, 'totp');
// Returns GetSetupDataResponse: {
//   setupData: {
//     secret: 'JBSWY3DPEHPK3PXP',           // Base32-encoded secret (REQUIRED for verification)
//     qrCode: 'data:image/png;base64,...',   // QR code data URL
//     manualEntryKey: 'JBSW Y3DP EHPK 3PXP', // Formatted secret for manual entry
//     issuer: 'MyApp',                       // Issuer name from backend config
//     accountName: 'user@example.com'       // User's email/identifier
//   }
// }

// 2. Display QR code to user
displayQrCode(setupData.setupData.qrCode);

// 3. Also show manual entry option (if QR scan fails)
showManualEntryOption(setupData.setupData.manualEntryKey);

// 4. User scans QR code with authenticator app (Google Authenticator, Authy, etc.)
//    Authenticator app generates 6-digit codes that refresh every 30 seconds

// 5. User enters verification code from authenticator app
// IMPORTANT: SDK validation requires BOTH secret and code
const response = await client.respondToChallenge({
  session,
  type: 'MFA_SETUP_REQUIRED',
  method: 'totp',
  setupData: {
    secret: setupData.setupData.secret, // Must include secret from getSetupData()
    code: '123456', // User-entered 6-digit code from authenticator app
  },
});

// 6. Handle response (may contain another challenge or success)
if (response.challengeName) {
  // Progressive challenge (e.g., email verification next)
  navigateToChallenge(response.challengeName);
} else {
  // Setup complete, user authenticated
  navigateToSuccess();
}
```

**Key Points:**

- **Secret is Required**: The `secret` from `getSetupData()` must be included in `setupData` when calling `respondToChallenge()`. The SDK validates this client-side.
- **Manual Entry**: If QR code scanning fails, users can manually enter the `manualEntryKey` into their authenticator app.
- **Device Name**: Optional `deviceName` can be provided (defaults to "Authenticator App").
- **Progressive Challenges**: After TOTP setup, the response may contain another challenge (e.g., `VERIFY_EMAIL`) or complete authentication.

### Setting Up SMS MFA

```typescript
// 1. Get SMS setup data
const setupData = await client.getSetupData(session, 'sms');

// May auto-complete if phone already verified
if (setupData.autoCompleted) {
  // Already set up, complete challenge
  await client.respondToChallenge({
    session,
    type: 'MFA_SETUP_REQUIRED',
    method: 'sms',
    setupData: { deviceId: setupData.deviceId },
  });
} else {
  // Need to verify code
  // setupData: { maskedPhone: '+1***5678' }

  // User receives SMS and enters code
  await client.respondToChallenge({
    session,
    type: 'MFA_SETUP_REQUIRED',
    method: 'sms',
    setupData: { code: '123456' },
  });
}
```

### Setting Up Passkey (WebAuthn)

**Prerequisites:** HTTPS (or localhost) and browser support required.

#### Recommended: SimpleWebAuthn Browser

For best developer experience, use `@simplewebauthn/browser` (handles encoding, errors, retry logic):

```bash npm2yarn
npm install @simplewebauthn/browser
```

```typescript
import { startRegistration } from '@simplewebauthn/browser';

// 1. Get passkey registration options from backend
const { setupData } = await client.getSetupData(session, 'passkey');
const optionsJSON = setupData.options;

// 2. Prompt user to create passkey (Touch ID, Face ID, Windows Hello, etc.)
try {
  const credential = await startRegistration({ optionsJSON });

  // 3. Complete setup
  await client.respondToChallenge({
    session,
    type: 'MFA_SETUP_REQUIRED',
    method: 'passkey',
    setupData: {
      credential: {
        credential,
        deviceName: 'My Passkey',
      },
      expectedChallenge: optionsJSON.challenge,
    },
  });

  console.log('Passkey registered successfully');
} catch (error) {
  if (error.name === 'NotAllowedError') {
    console.error('User cancelled or timeout');
  } else if (error.name === 'NotSupportedError') {
    console.error('Passkeys not supported in this browser');
  } else if (error.name === 'InvalidStateError') {
    console.error('Passkey already registered, clear and retry');
  }
}
```

#### Alternative: Native WebAuthn API

Use browser's native API (no dependencies, but requires manual error handling):

```typescript
// 1. Get registration options
const { setupData } = await client.getSetupData(session, 'passkey');
const optionsJSON = setupData.options;

// 2. Create credential
const credential = await navigator.credentials.create({
  publicKey: optionsJSON as unknown as PublicKeyCredentialCreationOptions,
});

// 3. Complete setup
await client.respondToChallenge({
  session,
  type: 'MFA_SETUP_REQUIRED',
  method: 'passkey',
  setupData: {
    credential: {
      credential: credential as unknown as Record<string, unknown>,
      deviceName: 'My Passkey',
    },
    expectedChallenge: optionsJSON.challenge,
  },
});
```

**Note:** Native API requires manual base64url encoding and error handling.

## MFA Management (Authenticated User)

### Check MFA Status

```typescript
const status = await client.getMfaStatus();
// status: {
//   enabled: true,
//   required: true,
//   methods: ['totp', 'passkey'],
//   availableMethods: ['totp', 'sms', 'email', 'passkey', 'backup'],
//   preferredMethod: 'totp',
//   hasBackupCodes: true,
//   mfaExempt: false
// }
```

### Get MFA Devices

```typescript
const devices = await client.getMfaDevices(); // Returns MFADevice[]
// devices: [
//   { id: 1, method: 'totp', name: 'Authenticator', createdAt: '...' },
//   { id: 2, method: 'sms', name: 'Phone', createdAt: '...' }
// ]
```

### Add New MFA Device

```typescript
// 1. Initiate setup
const setupData = await client.setupMfaDevice('totp');

// 2. Verify and complete
const result = await client.verifyMfaSetup('totp', {
  secret: setupData.secret,
  code: '123456',
  deviceName: 'My Authenticator',
});
// result: { deviceId: 3 }
```

### Remove a Single MFA Device

```typescript
await client.removeMfaDeviceById(3);
```

### Remove Specific Device by ID

For granular control, remove individual devices by their unique ID:

```typescript
// Get user's devices
const devices = await client.getMfaDevices();
// [{ id: 48, name: "Google Authenticator", type: "totp", isPreferred: true },
//  { id: 52, name: "Microsoft Authenticator", type: "totp", isPreferred: false }]

// Remove specific device
await client.removeMfaDeviceById(52);
```

### Set Preferred Device

```typescript
// Get user's devices
const devices = await client.getMfaDevices();

// Set preferred device by ID
await client.setPreferredMfaDevice(devices[0].id);
```

### Generate Backup Codes

```typescript
const codes = await client.generateBackupCodes(); // Returns string[] (see BackupCodesResponse)
// codes: ['ABC123', 'DEF456', 'GHI789', ...]

// Show to user and instruct to save securely
displayBackupCodes(codes);
```

## Complete MFA Setup UI

<Tabs groupId="platform">
<TabItem value="angular" label="Angular">

```typescript
@Component({
  selector: 'app-mfa-setup',
  template: `
    <h2>Set Up Two-Factor Authentication</h2>

    <div class="method-selector">
      @for (method of availableMethods; track method) {
        <button [class.active]="selectedMethod === method" (click)="selectMethod(method)">
          {{ getMethodLabel(method) }}
        </button>
      }
    </div>

    @switch (selectedMethod) {
      @case ('totp') {
        <div class="totp-setup">
          @if (qrCode) {
            <p>Scan this QR code with your authenticator app:</p>
            <img [src]="qrCode" alt="QR Code" />
            <p class="manual-key">Manual entry: {{ manualKey }}</p>
          }
          <form (ngSubmit)="verifyTotp()">
            <input [(ngModel)]="code" name="code" placeholder="Enter 6-digit code" />
            <button [disabled]="loading">Verify</button>
          </form>
        </div>
      }
      @case ('sms') {
        <div class="sms-setup">
          @if (autoCompleted) {
            <p>Your phone number is already verified.</p>
            <button (click)="completeAutoSetup()">Continue</button>
          } @else {
            <p>Enter the code sent to {{ maskedPhone }}</p>
            <form (ngSubmit)="verifySms()">
              <input [(ngModel)]="code" placeholder="Enter code" />
              <button [disabled]="loading">Verify</button>
            </form>
          }
        </div>
      }
      @case ('passkey') {
        <div class="passkey-setup">
          <p>Register a passkey using your device.</p>
          <button (click)="setupPasskey()">Register Passkey</button>
        </div>
      }
    }
  `,
})
export class MfaSetupComponent implements OnInit {
  availableMethods: string[] = [];
  selectedMethod = '';
  qrCode = '';
  manualKey = '';
  maskedPhone = '';
  autoCompleted = false;
  deviceId?: number;
  code = '';
  loading = false;

  private session = '';

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit() {
    const challenge = this.auth.getCurrentChallenge();
    if (challenge?.challengeName !== 'MFA_SETUP_REQUIRED') {
      this.router.navigate(['/login']);
      return;
    }

    this.session = challenge.session!;
    this.availableMethods = (challenge.challengeParameters?.['availableMethods'] as string[]) ?? [];
    this.selectedMethod = this.availableMethods[0] ?? 'totp';
    await this.loadSetupData();
  }

  async selectMethod(method: string) {
    this.selectedMethod = method;
    this.code = '';
    await this.loadSetupData();
  }

  private async loadSetupData() {
    this.loading = true;
    try {
      const data = await this.auth.getClient().getSetupData(this.session, this.selectedMethod);

      if (this.selectedMethod === 'totp') {
        this.qrCode = data.qrCode;
        this.manualKey = data.manualEntryKey;
      } else if (this.selectedMethod === 'sms') {
        if (data.autoCompleted) {
          this.autoCompleted = true;
          this.deviceId = data.deviceId;
        } else {
          this.maskedPhone = data.maskedPhone;
        }
      }
    } finally {
      this.loading = false;
    }
  }

  verifyTotp() {
    this.completeSetup({ code: this.code });
  }

  verifySms() {
    this.completeSetup({ code: this.code });
  }

  completeAutoSetup() {
    this.completeSetup({ deviceId: this.deviceId });
  }

  async setupPasskey(): Promise<void> {
    this.loading = true;
    try {
      // Dynamic import for SimpleWebAuthn (recommended)
      const { startRegistration } = await import('@simplewebauthn/browser');

      // Get registration options from backend
      const options = await this.auth.getClient().getSetupData(this.session, 'passkey');

      // Prompt user to create passkey
      const credential = await startRegistration(options);

      // Complete setup
      this.completeSetup({ credential });
    } catch (error: any) {
      this.loading = false;
      if (error.name === 'NotAllowedError') {
        alert('Passkey registration cancelled or timed out');
      } else if (error.name === 'NotSupportedError') {
        alert('Passkeys are not supported in this browser');
      } else {
        alert('Failed to register passkey: ' + error.message);
      }
    }
  }

  private completeSetup(setupData: Record<string, unknown>) {
    this.loading = true;
    this.auth
      .respondToChallenge({
        session: this.session,
        type: 'MFA_SETUP_REQUIRED',
        method: this.selectedMethod,
        setupData,
      })
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.challengeName) {
            this.router.navigate(['/challenge', response.challengeName.toLowerCase()]);
          } else {
            this.router.navigate(['/dashboard']);
          }
        },
        error: (err) => {
          this.loading = false;
          alert(err.message);
        },
      });
  }

  getMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      totp: 'Authenticator App',
      sms: 'SMS',
      email: 'Email',
      passkey: 'Passkey',
    };
    return labels[method] ?? method;
  }
}
```

</TabItem>
</Tabs>

## Backup Codes

### During Setup

Show backup codes after MFA setup:

```typescript
// After setting up first MFA device
const codes = await client.generateBackupCodes(); // Returns string[] (see BackupCodesResponse)

// Display to user
showBackupCodesModal(codes);
```

### Using Backup Code

```typescript
await client.respondToChallenge({
  session,
  type: 'MFA_REQUIRED',
  method: 'backup',
  code: 'ABC123',
});
```

## Passkey Browser Support

| Browser     | Version | Platform Support                                                                    |
| ----------- | ------- | ----------------------------------------------------------------------------------- |
| Chrome/Edge | 67+     | <i class="fa-duotone fa-light fa-check"></i> Windows Hello, Touch ID, security keys |
| Safari      | 13+     | <i class="fa-duotone fa-light fa-check"></i> Touch ID, Face ID (iOS 14+)            |
| Firefox     | 60+     | <i class="fa-duotone fa-light fa-check"></i> Windows Hello, security keys           |

**Check support at runtime:**

```typescript
if (window.PublicKeyCredential) {
  // Passkeys supported
} else {
  // Show alternative MFA methods
}
```

**Platform authenticators** (built-in): Touch ID, Face ID, Windows Hello
**Cross-platform authenticators** (removable): USB security keys, NFC

See [Backend Passkey Configuration](/docs/guides/mfa/passkey#step-2-configure) for server setup.

## Error Handling

### MFA Errors

| Error Code                   | Description               | Action                  |
| ---------------------------- | ------------------------- | ----------------------- |
| `MFA_INVALID_CODE`           | Wrong code entered        | Retry with correct code |
| `MFA_CODE_EXPIRED`           | Verification code expired | Request new code        |
| `MFA_DEVICE_NOT_FOUND`       | Device doesn't exist      | Re-setup MFA device     |
| `MFA_BACKUP_CODES_EXHAUSTED` | All backup codes used     | Generate new codes      |

### TOTP-Specific Errors

| Error Code                  | Description                                | Action                                                                          |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| `VALIDATION_FAILED`         | SDK validation: Missing `secret` or `code` | Ensure both `secret` (from `getSetupData`) and `code` (user input) are included |
| `VERIFICATION_CODE_INVALID` | TOTP code is incorrect or expired          | Check device time sync, request new code                                        |
| `MFA_SETUP_INVALID`         | TOTP setup verification failed             | Verify device time is synchronized, retry setup                                 |

**SDK Client-Side Validation:**

The SDK validates TOTP setup requests before sending to the backend:

```typescript
// This will throw NAuthClientError with VALIDATION_FAILED
await client.respondToChallenge({
  session,
  type: 'MFA_SETUP_REQUIRED',
  method: 'totp',
  setupData: { code: '123456' }, // Missing secret!
});

// Correct - includes both secret and code
const setupData = await client.getSetupData(session, 'totp');
await client.respondToChallenge({
  session,
  type: 'MFA_SETUP_REQUIRED',
  method: 'totp',
  setupData: {
    secret: setupData.setupData.secret, // From getSetupData
    code: '123456', // From user
  },
});
```

### WebAuthn Errors

| Error Name          | Cause                            | User-Friendly Message                                            |
| ------------------- | -------------------------------- | ---------------------------------------------------------------- |
| `NotAllowedError`   | User cancelled or timeout (60s)  | "Passkey registration cancelled. Please try again."              |
| `NotSupportedError` | Browser doesn't support passkeys | "Your browser doesn't support passkeys. Use another MFA method." |
| `InvalidStateError` | Credential already registered    | "This passkey is already registered. Try a different device."    |
| `SecurityError`     | Not HTTPS or invalid origin      | "Passkeys require HTTPS. Check your connection."                 |
| `AbortError`        | Operation aborted                | "Passkey registration interrupted. Please try again."            |

## TOTP Setup Best Practices

### Manual Entry Key

If QR code scanning fails (camera issues, damaged screen, etc.), users can manually enter the secret:

1. Display the `manualEntryKey` from `getSetupData()` response
2. User enters this into their authenticator app manually
3. Authenticator app generates codes normally

**Example:**

```typescript
const setupData = await client.getSetupData(session, 'totp');

// Show QR code (primary method)
<img src={setupData.setupData.qrCode} alt="QR Code" />

// Show manual entry option (fallback)
<div>
  <p>Can't scan? Enter this code manually:</p>
  <code>{setupData.setupData.manualEntryKey}</code>
  <button onClick={() => copyToClipboard(setupData.setupData.manualEntryKey)}>
    Copy
  </button>
</div>
```

### Device Name

Optionally provide a user-friendly device name for identification:

```typescript
// Device name is optional - defaults to "Authenticator App"
// Currently not supported in challenge flow, but available in authenticated MFA management
```

### Progressive Challenges

After TOTP setup completes, the response may contain:

- **Another Challenge**: If email/phone verification is still required
- **Success**: If all challenges are complete, returns user and tokens

**Example:**

```typescript
const response = await client.respondToChallenge({
  session,
  type: 'MFA_SETUP_REQUIRED',
  method: 'totp',
  setupData: { secret, code },
});

if (response.challengeName) {
  // Handle next challenge (e.g., VERIFY_EMAIL, VERIFY_PHONE)
  switch (response.challengeName) {
    case 'VERIFY_EMAIL':
      navigateToEmailVerification(response);
      break;
    case 'VERIFY_PHONE':
      navigateToPhoneVerification(response);
      break;
  }
} else {
  // All challenges complete - user authenticated
  navigateToDashboard();
}
```

## Trusted Devices

Trusted devices allow users to skip MFA verification on devices they've previously marked as trusted. This improves UX while maintaining security.

### How Trusted Devices Work

**Token Delivery Modes:**

- **Cookies Mode (Web)**: Device token stored as `nauth_device_id` httpOnly cookie
- **JSON Mode (Mobile)**: Device token returned in response body, stored securely by app
- **Hybrid Mode**: Uses cookies for web, JSON for mobile

**Device Trust Flow:**

1. User logs in with MFA
2. After successful MFA, user can trust the device
3. Device token is created and stored
4. On next login, MFA is skipped if device is trusted and valid

### Configuration

Backend configuration (see [Backend MFA Configuration](/docs/guides/mfa/how-mfa-works)):

```typescript
mfa: {
  rememberDevices: 'user_opt_in', // Options: 'never', 'always', 'user_opt_in'
  rememberDeviceDays: 30,          // How long trust lasts
  bypassMFAForTrustedDevices: true // Allow trusted devices to skip MFA
}
```

| Mode          | Behavior                                           |
| ------------- | -------------------------------------------------- |
| `never`       | Trusted device feature disabled                    |
| `always`      | Devices automatically trusted after MFA            |
| `user_opt_in` | User chooses whether to trust device (recommended) |

### Trust Current Device

After successful MFA verification, allow user to trust the device:

<Tabs groupId="platform">
<TabItem value="vanilla" label="Vanilla JS">

```typescript
// After successful MFA verification
const response = await client.respondToChallenge({
  type: 'MFA_REQUIRED',
  session: challengeSession,
  method: 'totp',
  code: userCode,
});

if (!response.challengeName) {
  // Authentication complete, offer to trust device
  const shouldTrust = confirm('Trust this device for 30 days?');

  if (shouldTrust) {
    try {
      const result = await client.trustDevice();
      console.log('Device trusted:', result.deviceToken);
      // Token is automatically stored by SDK
    } catch (error) {
      console.error('Failed to trust device:', error);
    }
  }
}
```

</TabItem>
<TabItem value="react" label="React">

```tsx
function TrustDevicePrompt({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const client = useNAuthClient();

  const handleTrustDevice = async () => {
    setLoading(true);
    try {
      await client.trustDevice();
      toast.success('This device has been marked as trusted');
      onComplete();
    } catch (error) {
      toast.error('Failed to trust device');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="trust-device-prompt">
      <p>Trust this device for 30 days?</p>
      <p className="text-sm text-gray-600">You won't need to verify MFA on this device for 30 days.</p>
      <div className="buttons">
        <button onClick={handleTrustDevice} disabled={loading}>
          {loading ? 'Trusting...' : 'Trust Device'}
        </button>
        <button onClick={onComplete}>Not Now</button>
      </div>
    </div>
  );
}
```

</TabItem>
<TabItem value="angular" label="Angular">

```typescript
@Component({
  selector: 'app-trust-device-prompt',
  template: `
    <div class="trust-device-prompt">
      <p>Trust this device for 30 days?</p>
      <p class="help-text">You won't need to verify MFA on this device for 30 days.</p>
      <button (click)="trustDevice()" [disabled]="loading">
        {{ loading ? 'Trusting...' : 'Trust Device' }}
      </button>
      <button (click)="skip()">Not Now</button>
    </div>
  `,
})
export class TrustDevicePromptComponent {
  loading = false;

  constructor(
    private auth: AuthService,
    private toastr: ToastrService,
  ) {}

  async trustDevice() {
    this.loading = true;
    try {
      const client = this.auth.getClient();
      await client.trustDevice();
      this.toastr.success('This device has been marked as trusted');
      this.close();
    } catch (error) {
      this.toastr.error('Failed to trust device');
    } finally {
      this.loading = false;
    }
  }

  skip() {
    this.close();
  }

  private close() {
    // Emit close event or navigate
  }
}
```

</TabItem>
</Tabs>

### Check Device Trust Status

Check if the current device is already trusted:

<Tabs groupId="platform">
<TabItem value="vanilla" label="Vanilla JS">

```typescript
// Check if current device is trusted
try {
  const result = await client.isTrustedDevice();

  if (result.trusted) {
    console.log('This device is trusted');
    // Don't show "trust device" prompt
  } else {
    console.log('This device is not trusted');
    // Show "trust device" option after MFA
  }
} catch (error) {
  // User not authenticated or feature disabled
  console.error('Cannot check trust status:', error);
}
```

</TabItem>
<TabItem value="react" label="React">

```tsx
function Dashboard() {
  const [isTrusted, setIsTrusted] = useState<boolean | null>(null);
  const client = useNAuthClient();

  useEffect(() => {
    checkTrustStatus();
  }, []);

  const checkTrustStatus = async () => {
    try {
      const result = await client.isTrustedDevice();
      setIsTrusted(result.trusted);
    } catch (error) {
      setIsTrusted(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="device-status">
        {isTrusted === true && (
          <div className="trusted-badge">
            <Shield className="icon" />
            <span>Trusted Device</span>
          </div>
        )}
        {isTrusted === false && <button onClick={() => showTrustDeviceDialog()}>Trust This Device</button>}
      </div>
    </div>
  );
}
```

</TabItem>
<TabItem value="angular" label="Angular">

```typescript
@Component({
  selector: 'app-dashboard',
  template: `
    <div class="dashboard">
      <div class="device-status">
        @if (isTrusted) {
          <div class="trusted-badge">
            <i class="pi pi-shield"></i>
            <span>Trusted Device</span>
          </div>
        } @else if (isTrusted === false) {
          <button (click)="showTrustDeviceDialog()">Trust This Device</button>
        }
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  isTrusted: boolean | null = null;

  constructor(private auth: AuthService) {}

  async ngOnInit() {
    await this.checkTrustStatus();
  }

  async checkTrustStatus() {
    try {
      const client = this.auth.getClient();
      const result = await client.isTrustedDevice();
      this.isTrusted = result.trusted;
    } catch (error) {
      this.isTrusted = false;
    }
  }

  showTrustDeviceDialog() {
    // Show dialog to trust device
  }
}
```

</TabItem>
</Tabs>

### Security Considerations

**Device Token Security:**

- **Cookies Mode**: Token stored as httpOnly cookie (cannot be accessed by JavaScript)
- **JSON Mode**: Store token in secure storage
  - iOS: Use Keychain Services
  - Android: Use EncryptedSharedPreferences
  - Web: Tokens handled by SDK, stored in localStorage (cookies mode recommended for web)

**Best Practices:**

1. Always use `user_opt_in` mode to let users choose
2. Set reasonable expiration (30 days is recommended)
3. Allow users to view and revoke trusted devices
4. Log device trust events for audit trail
5. Use cookies mode for web apps (httpOnly protection)
6. Use JSON mode for mobile apps with secure storage

**When Device Trust Fails:**

Device trust will fail (MFA required) if:

- Device token is missing or invalid
- Trust has expired (past `rememberDeviceDays`)
- Device token was tampered with
- User revoked the device trust
- Backend configuration changed

### Revoking Device Trust

Users can revoke device trust in several ways:

**1. Logout and forget current device:**

```typescript
// Logout and untrust current device
await client.logout(true); // forgetDevice = true
```

**2. Global logout and forget all devices:**

```typescript
// Revoke all sessions AND all trusted devices
await client.logoutAll(true); // forgetDevices = true
```

**3. Global logout (keep devices trusted):**

```typescript
// Revoke all sessions but keep devices trusted
await client.logoutAll(); // forgetDevices defaults to false
```

:::info Authentication Required
All logout methods (`logout()` and `logoutAll()`) require the user to be authenticated. These endpoints are protected and cannot be called publicly.
:::

## Related Documentation

- [NAuthClient API](../api/nauth-client) - Full API reference
- [Challenge Helpers](../api/utilities/challenge-helpers) - Helper utilities for working with challenges
- [Challenge Handling](./challenge-handling) - Challenge flows
- [GetSetupDataResponse](../api/types/get-setup-data-response) - Setup data structure
- [ChallengeResponse](../api/types/challenge-response) - Challenge response types
- [Backend MFA Configuration](/docs/guides/mfa/how-mfa-works) - Server setup
