/**
 * @nauth-toolkit/social-apple/nestjs
 *
 * NestJS adapter for Apple Social Authentication
 */

export { AppleSocialAuthModule } from './apple-social-auth.module';

// Re-export core Apple social auth components
export * from '../src/apple-social-auth.service';
export * from '../src/apple-oauth.client';
export * from '../src/token-verifier.service';
export * from '../src/verified-token-profile.interface';
export * from '../src/dto/social-login.dto';

