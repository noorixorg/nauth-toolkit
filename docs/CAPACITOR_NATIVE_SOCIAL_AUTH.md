# Capacitor Native Social Auth Implementation Guide

## Architecture Overview

**Key Principle**: Backend remains platform-agnostic. Mobile app handles native OAuth and sends tokens to backend.

```
Mobile App (Capacitor) → Native SDK → ID Tokens → Backend Verification → JWT Tokens
```

## Backend Changes Required

### New Endpoint: `POST /auth/social/:provider/verify`

The backend must expose verify endpoints for each provider. The provider services already have `verifyToken()` methods - you just need to expose them as HTTP endpoints.

**Request Body:**

```typescript
{
  idToken?: string;        // Required for Google/Apple
  accessToken?: string;    // Optional for Google, required for Facebook
  authorizationCode?: string; // Optional for Apple
}
```

### NestJS Implementation Example

Add verify endpoints to your social redirect controller:

```typescript
import { Controller, Post, Body, Inject, BadRequestException } from '@nestjs/common';
import { Public, AuthResponseDTO } from '@nauth-toolkit/nestjs';
import { GoogleSocialAuthService } from '@nauth-toolkit/social-google/nestjs';

@Controller('auth/social')
export class SocialRedirectController {
  constructor(
    @Inject(GoogleSocialAuthService)
    private readonly googleAuth?: GoogleSocialAuthService,
  ) {}

  /**
   * Verify native Google token from mobile apps
   */
  @Public()
  @Post('google/verify')
  async verifyGoogle(@Body() body: { idToken: string; accessToken?: string }): Promise<AuthResponseDTO> {
    if (!this.googleAuth) {
      throw new BadRequestException('Google OAuth is not configured');
    }
    if (!body.idToken) {
      throw new BadRequestException('idToken is required');
    }
    return await this.googleAuth.verifyToken(body.idToken, body.accessToken);
  }
}
```

The provider services (`GoogleSocialAuthService`, `AppleSocialAuthService`, `FacebookSocialAuthService`) already implement:

- ✅ ID token verification with provider's public keys
- ✅ User creation/update
- ✅ Social account linking
- ✅ JWT token generation

You just need to expose the `verifyToken()` method as an HTTP endpoint.

### ID Token Verification Libraries

- **Google**: `google-auth-library` npm package
- **Apple**: `apple-signin-auth` or manual JWT verification with Apple public keys
- **Facebook**: Verify access token via Graph API

## Mobile App Integration

### 1. Install Required Packages

**Recommended Plugin**: [`@capgo/capacitor-social-login`](https://github.com/Cap-go/capacitor-social-login)

This plugin provides a unified API for Google, Apple, and Facebook social authentication across iOS and Android platforms.

```bash
# Install the Capacitor social login plugin
npm install @capgo/capacitor-social-login

# Install nauth-toolkit client SDK
npm install @nauth-toolkit/client

# Sync Capacitor
npx cap sync
```

### 2. Configure Capacitor Config

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

### 3. Install nauth-toolkit Client SDK

```bash
npm install @nauth-toolkit/client
```

### 4. Initialize & Mobile Auth Service

**Important**: You must call `initialize()` before using any login methods.

**Recommended Plugin**: Use [`@capgo/capacitor-social-login`](https://github.com/Cap-go/capacitor-social-login) for native social authentication. This plugin provides a unified API for Google, Apple, and Facebook across iOS and Android.

```typescript
import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NAuthClient, type AuthResponse, type SocialVerifyRequest } from '@nauth-toolkit/client';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private client: NAuthClient;
  private initialized = false;
  private router = inject(Router);

  // Reactive state using signals
  public readonly user = signal<AuthResponse['user'] | null>(null);
  public readonly isAuthenticated = signal<boolean>(false);
  public readonly isLoading = signal<boolean>(false);
  public readonly error = signal<string | null>(null);

  constructor() {
    // Initialize nauth-toolkit client
    this.client = new NAuthClient({
      baseUrl: `${environment.apiBaseUrl}/auth`,
      tokenDelivery: 'json', // Mobile apps use JSON mode
      onAuthStateChange: (user) => {
        this.user.set(user);
        this.isAuthenticated.set(!!user);
      },
      onSessionExpired: () => {
        this.logout();
      },
    });
  }

  /**
   * Initialize the auth service and social login providers
   * Call this on app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.isLoading.set(true);

      // Initialize Capacitor social login plugin
      await SocialLogin.initialize({
        google: {
          webClientId: 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com',
          iOSClientId: 'YOUR_GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com', // iOS only
          mode: 'online', // 'online' returns user data, 'offline' returns only serverAuthCode
        },
        facebook: {
          appId: 'YOUR_FACEBOOK_APP_ID',
          clientToken: 'YOUR_FACEBOOK_CLIENT_TOKEN', // Required for iOS, optional for Android
        },
        apple: {
          clientId: 'YOUR_APPLE_CLIENT_ID',
          redirectUrl: 'https://your-app.com/auth/apple/callback', // Android only
        },
      });

      // Initialize nauth-toolkit client
      await this.client.initialize();

      // Check if user is already authenticated
      const currentUser = this.client.getCurrentUser();
      if (currentUser) {
        this.user.set(currentUser);
        this.isAuthenticated.set(true);
      }

      this.initialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Initialization failed';
      this.error.set(errorMessage);
      console.error('Auth initialization error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      // Get native token from Capacitor
      const result = await SocialLogin.login({
        provider: 'google',
        options: {
          scopes: ['email', 'profile'],
        },
      });

      // Type assertion for the response - the plugin returns different types based on mode
      // The plugin types don't fully match the runtime structure, so we use type assertion
      const googleResult = result.result as {
        idToken?: string;
        accessToken?: { token?: string } | string;
      };

      if (!googleResult?.idToken) {
        throw new Error('No ID token received from Google');
      }

      // Extract access token - can be an object with token property or a string
      const accessToken =
        typeof googleResult.accessToken === 'string' ? googleResult.accessToken : googleResult.accessToken?.token;

      // Verify token with nauth-toolkit backend using SDK
      const verifyRequest: SocialVerifyRequest = {
        provider: 'google',
        idToken: googleResult.idToken,
        accessToken,
      };

      const authResponse = await this.client.verifyNativeSocial(verifyRequest);
      this.user.set(authResponse.user);
      this.isAuthenticated.set(true);

      // Navigate to user info page using Angular Router
      await this.router.navigate(['/user']);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google sign-in failed';
      this.error.set(errorMessage);
      console.error('Google sign-in error:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Sign in with Facebook
   */
  async signInWithFacebook(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      const result = await SocialLogin.login({
        provider: 'facebook',
        options: {
          permissions: ['email', 'public_profile'],
        },
      });

      // Type assertion for the response
      const facebookResult = result.result as {
        accessToken?: { token?: string } | string;
      };

      const accessToken =
        typeof facebookResult.accessToken === 'string' ? facebookResult.accessToken : facebookResult.accessToken?.token;

      if (!accessToken) {
        throw new Error('No access token received from Facebook');
      }

      // Verify token with nauth-toolkit backend using SDK
      const verifyRequest: SocialVerifyRequest = {
        provider: 'facebook',
        accessToken,
      };

      const authResponse = await this.client.verifyNativeSocial(verifyRequest);
      this.user.set(authResponse.user);
      this.isAuthenticated.set(true);

      await this.router.navigate(['/user']);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Facebook sign-in failed';
      this.error.set(errorMessage);
      console.error('Facebook sign-in error:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Sign in with Apple
   */
  async signInWithApple(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      const result = await SocialLogin.login({
        provider: 'apple',
        options: {
          scopes: ['email', 'name'],
        },
      });

      // Type assertion for the response
      const appleResult = result.result as {
        idToken?: string;
        authorizationCode?: string;
      };

      if (!appleResult?.idToken) {
        throw new Error('No ID token received from Apple');
      }

      // Verify token with nauth-toolkit backend using SDK
      const verifyRequest: SocialVerifyRequest = {
        provider: 'apple',
        idToken: appleResult.idToken,
        authorizationCode: appleResult.authorizationCode,
      };

      const authResponse = await this.client.verifyNativeSocial(verifyRequest);
      this.user.set(authResponse.user);
      this.isAuthenticated.set(true);

      await this.router.navigate(['/user']);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Apple sign-in failed';
      this.error.set(errorMessage);
      console.error('Apple sign-in error:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      this.isLoading.set(true);
      await this.client.logout();
      this.user.set(null);
      this.isAuthenticated.set(false);
      this.error.set(null);
      await this.router.navigate(['/login']);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      this.error.set(errorMessage);
      console.error('Logout error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
```

**Key Points:**

- Use `NAuthClient.verifyNativeSocial()` from `@nauth-toolkit/client` instead of raw `fetch()` calls
- The SDK handles token storage, refresh, and session management automatically
- Type assertions are needed because the plugin's TypeScript types don't fully match the runtime structure
- Use Angular Router for navigation instead of `window.location.href` to avoid full page reloads

### 5. Native Platform Setup

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

**2. Modify MainActivity.java (CRITICAL for Google Sign-In):**

⚠️ **REQUIRED**: Without this modification, Google Sign-In will NOT work on Android.

Edit `android/app/src/main/java/com/yourapp/MainActivity.java`:

```java
package com.yourapp;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.Plugin;
import android.content.Intent;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity with social login support
 * ModifiedMainActivityForSocialLoginPlugin is VERY VERY important !!!!!!
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

  @Override
  public void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);

    if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
      PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
      if (pluginHandle == null) {
        Log.i("Google Activity Result", "SocialLogin login handle is null");
        return;
      }
      Plugin plugin = pluginHandle.getInstance();
      if (!(plugin instanceof SocialLoginPlugin)) {
        Log.i("Google Activity Result", "SocialLogin plugin instance is not SocialLoginPlugin");
        return;
      }
      ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }
  }

  /**
   * This function will never be called, leave it empty
   * Required by ModifiedMainActivityForSocialLoginPlugin interface
   */
  @Override
  public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
```

**3. Add permissions and activities to AndroidManifest.xml:**

Edit `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config">

        <!-- Facebook -->
        <meta-data
            android:name="com.facebook.sdk.ApplicationId"
            android:value="@string/facebook_app_id" />

        <!-- Facebook Activity -->
        <activity
            android:name="com.facebook.FacebookActivity"
            android:configChanges="orientation|keyboardHidden|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
            android:label="@string/app_name" />

        <!-- Facebook CustomTabActivity -->
        <activity
            android:name="com.facebook.CustomTabActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="fbYOUR_FACEBOOK_APP_ID" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

**4. Create network_security_config.xml (for development):**

Create `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext traffic for development -->
    <!-- WARNING: This allows HTTP connections. Remove for production! -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>

    <!-- Explicitly allow your local development server -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">192.168.50.39</domain>
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
    </domain-config>
</network-security-config>
```

**5. Configure strings.xml:**

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

**6. Configure build.gradle:**

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

### Phase 1: Backend (Consumer App)

1. ✅ Provider services already have `verifyToken()` methods (no changes needed to core library)
2. ✅ Token verification is already implemented in provider services
3. Add `POST /auth/social/:provider/verify` endpoint to your controller (see example above)
4. Inject provider services (`GoogleSocialAuthService`, etc.) in your controller

### Phase 2: Example Mobile App

1. Install `@capgo/capacitor-social-login` and `@nauth-toolkit/client`
2. Implement mobile auth service using `NAuthClient.verifyNativeSocial()`
3. Configure native SDKs (Google Cloud Console, Apple Developer, Facebook)
4. **CRITICAL**: Modify Android MainActivity.java (see Android Setup section)
5. Configure iOS Info.plist and AppDelegate.swift
6. Test on physical devices or emulators with Google Play Services

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

## Recommended Plugin

**[@capgo/capacitor-social-login](https://github.com/Cap-go/capacitor-social-login)** is the recommended plugin for native social authentication in Capacitor apps. It provides:

- ✅ Unified API for Google, Apple, and Facebook
- ✅ Works on both iOS and Android
- ✅ Native SDK integration (no web views)
- ✅ TypeScript support
- ✅ Active maintenance

## References

- **Plugin**: [@capgo/capacitor-social-login](https://github.com/Cap-go/capacitor-social-login) - **Recommended for Capacitor apps**
- **SDK**: [@nauth-toolkit/client](https://www.npmjs.com/package/@nauth-toolkit/client) - Use `verifyNativeSocial()` method
- **Google Verification**: [google-auth-library](https://www.npmjs.com/package/google-auth-library) - Used by backend services
- **Apple Verification**: [Apple JWT Verification](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user)
- **Facebook Verification**: [Facebook Graph API](https://developers.facebook.com/docs/graph-api)
- **Capgo Documentation**: [Google Login on Android](https://capgo.app/docs/plugins/social-login/google/android/) - Detailed Android setup guide
