/**
 * @nauth-toolkit/social-google/nestjs
 *
 * NestJS adapter for Google Social Authentication
 */

export { GoogleSocialAuthModule } from './google-social-auth.module';

// Re-export core Google social auth components
export * from '../src/google-social-auth.service';
export * from '../src/google-oauth.client';
export * from '../src/token-verifier.service';
export * from '../src/verified-token-profile.interface';
export * from '../src/dto/social-login.dto';

