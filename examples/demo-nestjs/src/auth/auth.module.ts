import { Module } from '@nestjs/common';
import { CustomAuthController, MobileAuthController } from './auth.controller';
import { SocialRedirectController } from './social-redirect.controller';
import {
  ApiKeysController,
  ApiKeyDemoController,
  ApiKeyUnmarkedDemoController,
} from '../api-keys/api-keys.controller';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';
import { AppleSocialAuthModule } from '@nauth-toolkit/social-apple/nestjs';
import { FacebookSocialAuthModule } from '@nauth-toolkit/social-facebook/nestjs';
import { SMSMFAModule } from '@nauth-toolkit/mfa-sms/nestjs';
import { EmailMFAModule } from '@nauth-toolkit/mfa-email/nestjs';
import { TOTPMFAModule } from '@nauth-toolkit/mfa-totp/nestjs';
import { PasskeyMFAModule } from '@nauth-toolkit/mfa-passkey/nestjs';
import { authConfig } from '../config/auth.config';
import { PreSignupDebugHook, PostSignupDebugHook } from './hooks';

/**
 * Custom Auth Module
 *
 * Simple example showing how easy it is to add authentication to your NestJS app.
 *
 * Just:
 * 1. Import AuthModule.forRoot(config) for core auth
 * 2. Import social provider modules you need (Google, Apple, Facebook)
 * 3. Import NAuthHooksModule.forFeature() with your custom hooks
 *
 * That's it! No manual provider registration needed.
 */
@Module({
  imports: [
    // Order no longer matters: providers are discovered via tokens and registered by AuthModule on bootstrap.
    GoogleSocialAuthModule,
    AppleSocialAuthModule,
    FacebookSocialAuthModule,
    SMSMFAModule,
    EmailMFAModule,
    TOTPMFAModule,
    PasskeyMFAModule,
    AuthModule.forRoot(authConfig),
    // Register lifecycle hooks - automatically discovered and registered
    NAuthHooksModule.forFeature([PreSignupDebugHook, PostSignupDebugHook]),
  ],
  controllers: [
    CustomAuthController,
    MobileAuthController,
    SocialRedirectController,
    ApiKeysController,
    ApiKeyDemoController,
    ApiKeyUnmarkedDemoController,
  ],
})
export class CustomAuthModule {}
