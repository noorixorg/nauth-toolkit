/**
 * @nauth-toolkit/social-google
 *
 * Platform-agnostic Google OAuth provider for nauth-toolkit.
 * For NestJS integration, use '@nauth-toolkit/social-google/nestjs'
 */

export { GoogleOAuthClient } from './google-oauth.client';
export { TokenVerifierService } from './token-verifier.service';
export { GoogleSocialAuthService } from './google-social-auth.service';
export { VerifiedGoogleTokenProfile } from './verified-token-profile.interface';
export * from './dto/social-login.dto';
