/**
 * @nauth-toolkit/social-apple
 *
 * Platform-agnostic Apple OAuth provider for nauth-toolkit.
 * For NestJS integration, use '@nauth-toolkit/social-apple/nestjs'
 */

export { AppleOAuthClient } from './apple-oauth.client';
export { TokenVerifierService } from './token-verifier.service';
export { AppleSocialAuthService } from './apple-social-auth.service';
export { VerifiedAppleTokenProfile } from './verified-token-profile.interface';
export * from './dto/social-login.dto';
