# Capacitor Native Social Auth Implementation Guide

## Architecture Overview

**Key Principle**: Backend remains platform-agnostic. Mobile app handles native OAuth and sends tokens to backend.

```
Mobile App (Capacitor) → Native SDK → ID Tokens → Backend Verification → JWT Tokens
```

## Backend Changes Required

### New Endpoint: `POST /auth/social/:provider/verify`

```typescript
// Mobile sends ID tokens directly, not authorization codes
export class VerifyNativeSocialAuthDTO {
  @IsString()
  idToken!: string; // From native SDK
  @IsString()
  @IsOptional()
  accessToken?: string; // Additional provider data
}
```

### Implementation in `SocialAuthService`

```typescript
async verifyNativeToken(provider: string, dto: VerifyNativeSocialAuthDTO) {
  // 1. Verify ID token with provider's public keys
  const profile = await this.verifyIdToken(provider, dto.idToken);

  // 2. Find or create user (same as web flow)
  const user = await this.findOrCreateUser(profile, provider);

  // 3. Create session and return JWT tokens
  const session = await this.createSession(...);
  return { accessToken, refreshToken, user, expiresIn };
}

private async verifyIdToken(provider: string, idToken: string) {
  switch (provider) {
    case 'google':
      return await this.verifyGoogleIdToken(idToken);
    case 'apple':
      return await this.verifyAppleIdToken(idToken);
    case 'facebook':
      return await this.verifyFacebookToken(idToken);
  }
}
```

### ID Token Verification Libraries

- **Google**: `google-auth-library` npm package
- **Apple**: `apple-signin-auth` or manual JWT verification with Apple public keys
- **Facebook**: Verify access token via Graph API

## Mobile App Integration

### 1. Install Plugin

```bash
npm install @capgo/capacitor-social-login
npx cap sync
```

### 2. Configure Capacitor

```typescript
// capacitor.config.ts
{
  appId: 'com.yourapp.id',
  plugins: {
    CapacitorSocialLogin: {
      google: {
        clientId: 'YOUR_GOOGLE_CLIENT_ID',
        scopes: ['profile', 'email'],
      },
      facebook: {
        appId: 'YOUR_FACEBOOK_APP_ID',
      },
      apple: {
        // Automatic for iOS
      },
    },
  },
}
```

### 3. Initialize & Mobile Auth Service

**Important**: You must call `initialize()` before using any login methods.

```typescript
import { SocialLogin } from '@capgo/capacitor-social-login';

export class MobileAuthService {
  private initialized = false;

  /**
   * Initialize all social login providers
   * Call this on app startup
   */
  async initialize() {
    if (this.initialized) return;

    await SocialLogin.initialize({
      google: {
        webClientId: 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com',
        iOSClientId: 'YOUR_GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com', // iOS only
        mode: 'online', // 'online' returns user data, 'offline' returns only serverAuthCode
      },
      facebook: {
        appId: 'YOUR_FACEBOOK_APP_ID',
        clientToken: 'YOUR_FACEBOOK_CLIENT_TOKEN', // iOS only
      },
      apple: {
        clientId: 'YOUR_APPLE_CLIENT_ID',
        redirectUrl: 'https://your-app.com/auth/apple/callback', // Android only
      },
    });

    this.initialized = true;
  }

  async signInWithGoogle() {
    await this.initialize();

    const result = await SocialLogin.login({
      provider: 'google',
      options: {
        scopes: ['email', 'profile'],
      },
    });

    // Extract tokens from Google result
    const idToken = result.result.idToken;
    const accessToken = result.result.accessToken?.token;

    // Send to backend for verification
    const response = await fetch(`${API_URL}/auth/social/google/verify`, {
      method: 'POST',
      body: JSON.stringify({
        idToken,
        accessToken,
      }),
    });

    return await response.json();
  }

  async signInWithFacebook() {
    await this.initialize();

    const result = await SocialLogin.login({
      provider: 'facebook',
      options: {
        permissions: ['email', 'public_profile'],
      },
    });

    // Extract Facebook access token
    const accessToken = result.result.accessToken?.token;

    const response = await fetch(`${API_URL}/auth/social/facebook/verify`, {
      method: 'POST',
      body: JSON.stringify({ accessToken }),
    });

    return await response.json();
  }

  async signInWithApple() {
    await this.initialize();

    const result = await SocialLogin.login({
      provider: 'apple',
      options: {
        scopes: ['email', 'name'],
      },
    });

    // Extract Apple tokens
    const idToken = result.result.idToken;
    const authorizationCode = result.result.authorizationCode;

    const response = await fetch(`${API_URL}/auth/social/apple/verify`, {
      method: 'POST',
      body: JSON.stringify({
        idToken,
        authorizationCode,
      }),
    });

    return await response.json();
  }
}
```

### 4. Native Platform Setup

#### iOS Setup

**1. Install CocoaPods dependencies:**

```bash
cd ios/App
pod install
```

**2. Configure Info.plist:**

Edit `ios/App/App/Info.plist` and add URL schemes for each provider:

```xml
<key>CFBundleURLTypes</key>
<array>
  <!-- Google Sign-In -->
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.YOUR_CLIENT_ID</string>
    </array>
  </dict>
  <!-- Facebook Login -->
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>fbYOUR_FACEBOOK_APP_ID</string>
    </array>
  </dict>
</array>
```

**3. Configure URL handler in AppDelegate.swift:**

```swift
import FBSDKCoreKit
import GoogleSignIn

func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    // Handle Facebook URL
    if FBSDKCoreKit.ApplicationDelegate.shared.application(app, open: url, sourceApplication: options[UIApplication.OpenURLOptionsKey.sourceApplication] as? String, annotation: options[UIApplication.OpenURLOptionsKey.annotation]) {
        return true
    }

    // Handle Google URL
    if GIDSignIn.sharedInstance.handle(url) {
        return true
    }

    // Pass to Capacitor
    return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
}
```

**4. Enable Apple Sign In (iOS 13+):**

In Xcode:

- Signing & Capabilities → + Capability → Sign In with Apple
- Enable "Sign In with Apple" capability

**5. Privacy Manifest (iOS 17+):**

Create `ios/App/PrivacyInfo.xcprivacy`:

```json
{
  "NSPrivacyCollectedDataTypes": [
    {
      "NSPrivacyCollectedDataType": "EmailAddress",
      "NSPrivacyCollectedDataTypeLinked": true,
      "NSPrivacyCollectedDataTypeTracking": false
    },
    {
      "NSPrivacyCollectedDataType": "Name",
      "NSPrivacyCollectedDataTypeLinked": true,
      "NSPrivacyCollectedDataTypeTracking": false
    },
    {
      "NSPrivacyCollectedDataType": "UserID",
      "NSPrivacyCollectedDataTypeLinked": true,
      "NSPrivacyCollectedDataTypeTracking": false
    }
  ]
}
```

#### Android Setup

**1. Configure google-services.json:**

Place your Firebase `google-services.json` in `android/app/`

**2. Add permissions to AndroidManifest.xml:**

Edit `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Facebook Login -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<application>
  <!-- Facebook -->
  <meta-data
    android:name="com.facebook.sdk.ApplicationId"
    android:value="@string/facebook_app_id" />

  <!-- Facebook Activity -->
  <activity
    android:name="com.facebook.FacebookActivity"
    android:configChanges="orientation|keyboardHidden|screenSize"
    android:label="@string/app_name" />

  <!-- Google Sign-In -->
  <activity
    android:name="com.google.android.gms.auth.GoogleSignInActivity"
    android:configChanges="orientation|screenSize" />
</application>
```

**3. Configure strings.xml:**

Edit `android/app/src/main/res/values/strings.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Sample FE</string>
    <string name="facebook_app_id">YOUR_FACEBOOK_APP_ID</string>
    <string name="fb_login_protocol_scheme">fbYOUR_FACEBOOK_APP_ID</string>
    <string name="server_client_id">YOUR_GOOGLE_SERVER_CLIENT_ID</string>
</resources>
```

**4. Configure build.gradle:**

Edit `android/app/build.gradle`:

```gradle
dependencies {
    // Add Facebook and Google dependencies
    implementation 'com.facebook.android:facebook-login:latest-version'
    implementation 'com.google.android.gms:play-services-auth:latest-version'
}
```

### Platform-Specific Configuration Files

## Implementation Steps

### Phase 1: Backend (Core Library)

1. Add `verifyNativeToken()` to `SocialAuthService`
2. Implement ID token verification for each provider
3. Add `POST /auth/social/:provider/verify` endpoint to controller
4. Add unit tests for verification logic

### Phase 2: Example Mobile App

1. Install `@capgo/capacitor-social-login`
2. Implement mobile auth service
3. Configure native SDKs (Google Cloud Console, Apple Developer, Facebook)
4. Test on physical devices

### Phase 3: Security

1. Always verify ID tokens on backend
2. Use secure token storage (Capacitor Preferences)
3. Implement automatic token refresh
4. Add device fingerprinting for session security

## Key Points

- **Backend agnostic**: No dependency on Capacitor plugins
- **Native UX**: Leverages platform-specific UI
- **Security**: Verify all tokens on backend
- **Provider support**: Google, Apple, Facebook via single plugin
- **Reuse existing**: User management, session creation unchanged

## References

- Plugin: [@capgo/capacitor-social-login](https://github.com/Cap-go/capacitor-social-login)
- Google Verification: [google-auth-library](https://www.npmjs.com/package/google-auth-library)
- Apple Verification: [Apple JWT Verification](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user)
- Facebook Verification: [Facebook Graph API](https://developers.facebook.com/docs/graph-api)
