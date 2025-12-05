/**
 * @nauth-toolkit/social-facebook/nestjs
 *
 * NestJS adapter for Facebook Social Authentication
 */

export { FacebookSocialAuthModule } from './facebook-social-auth.module';

// Re-export core Facebook social auth components
export * from '../src/facebook-social-auth.service';
export * from '../src/facebook-oauth.client';
export * from '../src/token-verifier.service';
export * from '../src/verified-token-profile.interface';
export * from '../src/dto/social-login.dto';

