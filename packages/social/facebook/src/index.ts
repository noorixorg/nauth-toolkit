/**
 * @nauth-toolkit/social-facebook
 *
 * Platform-agnostic Facebook OAuth provider for nauth-toolkit.
 * For NestJS integration, use '@nauth-toolkit/social-facebook/nestjs'
 */

export { FacebookOAuthClient } from './facebook-oauth.client';
export { TokenVerifierService } from './token-verifier.service';
export { FacebookSocialAuthService } from './facebook-social-auth.service';
export { VerifiedFacebookTokenProfile } from './verified-token-profile.interface';
export * from './dto/social-login.dto';
