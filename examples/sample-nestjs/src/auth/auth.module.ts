import { Module } from '@nestjs/common';
import { CustomAuthController } from './auth.controller';
import { SocialRedirectController } from './social-redirect.controller';
import { AuthModule } from '@nauth-toolkit/nestjs';
import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';
import { AppleSocialAuthModule } from '@nauth-toolkit/social-apple/nestjs';
import { FacebookSocialAuthModule } from '@nauth-toolkit/social-facebook/nestjs';
import { SMSMFAModule } from '@nauth-toolkit/mfa-sms/nestjs';
import { EmailMFAModule } from '@nauth-toolkit/mfa-email/nestjs';
import { TOTPMFAModule } from '@nauth-toolkit/mfa-totp/nestjs';
import { PasskeyMFAModule } from '@nauth-toolkit/mfa-passkey/nestjs';
import { authConfig } from '../config/auth.config';

/**
 * Custom Auth Module
 *
 * Simple example showing how easy it is to add authentication to your NestJS app.
 *
 * Just:
 * 1. Import AuthModule.forRoot(config) for core auth
 * 2. Import social provider modules you need (Google, Apple, Facebook)
 *
 * That's it! No manual provider registration needed.
 */
@Module({
  imports: [
    GoogleSocialAuthModule, // 👈 IMPORTANT: Import provider modules BEFORE AuthModule.forRoot()
    AppleSocialAuthModule, // 👈 Apple OAuth support
    FacebookSocialAuthModule, // 👈 Facebook OAuth support
    SMSMFAModule, // 👈 SMS MFA support (requires SMS provider configured)
    EmailMFAModule, // 👈 Email MFA support (requires email provider configured)
    TOTPMFAModule, // 👈 TOTP MFA support (Authenticator App)
    PasskeyMFAModule, // 👈 Passkey MFA support (WebAuthn/FIDO2)
    AuthModule.forRoot(authConfig), // 👈 Import core module AFTER providers so they're registered
  ],
  controllers: [CustomAuthController, SocialRedirectController],
})
export class CustomAuthModule {}
