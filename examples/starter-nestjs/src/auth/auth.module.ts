import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SocialRedirectController } from './social-redirect.controller';
import { AuthModule as NAuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';
import { EmailMFAModule } from '@nauth-toolkit/mfa-email/nestjs';
import { SMSMFAModule } from '@nauth-toolkit/mfa-sms/nestjs';
import { authConfig } from '../config/auth.config';
import { PreSignupHook } from './hooks';

/**
 * Auth module — wires up nauth-toolkit with Google OAuth, Email + SMS MFA, and a pre-signup hook.
 *
 * To add more providers, import their modules here:
 *   - AppleSocialAuthModule from '@nauth-toolkit/social-apple/nestjs'
 *   - FacebookSocialAuthModule from '@nauth-toolkit/social-facebook/nestjs'
 *   - TOTPMFAModule from '@nauth-toolkit/mfa-totp/nestjs'
 */
@Module({
  imports: [
    GoogleSocialAuthModule,
    EmailMFAModule,
    SMSMFAModule,
    NAuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([PreSignupHook]),
  ],
  controllers: [AuthController, SocialRedirectController],
})
export class AuthModule {}
