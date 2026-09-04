import { Module } from '@nestjs/common';
import { AuthModule as NAuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';
import { EmailMFAModule } from '@nauth-toolkit/mfa-email/nestjs';
import { SMSMFAModule } from '@nauth-toolkit/mfa-sms/nestjs';
import { authConfig } from '../config/auth.config';
import { RoleAuthorizer } from './role.authorizer';
import { PreSignupHook } from './hooks';

/**
 * Auth module — wires up nauth-toolkit with Google OAuth, Email + SMS MFA, and a pre-signup hook.
 *
 * There are no controllers here: the auth endpoints are mounted from the toolkit's own
 * route manifest, configured under `routes` in `auth.config.ts`. To customise a single
 * route, `exclude` its key there and declare a controller for just that one.
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
    NAuthModule.forRoot({ ...authConfig, authorization: RoleAuthorizer }),
    NAuthHooksModule.forFeature([PreSignupHook]),
  ],
})
export class AuthModule {}
