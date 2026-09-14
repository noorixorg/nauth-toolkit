/**
 * @nauth-toolkit/social-microsoft
 *
 * Platform-agnostic Microsoft Entra ID (Azure AD) provider for nauth-toolkit.
 * For NestJS integration, use '@nauth-toolkit/social-microsoft/nestjs'
 */

export { MicrosoftOAuthClient } from './microsoft-oauth.client';
export type { MicrosoftOAuthConfig } from './microsoft-oauth.client';
export { TokenVerifierService } from './token-verifier.service';
export type { VerifyMicrosoftTokenOptions } from './token-verifier.service';
export { MicrosoftSocialAuthService } from './microsoft-social-auth.service';
export { VerifiedMicrosoftTokenProfile } from './verified-token-profile.interface';
export {
  MSA_TENANT_ID,
  ENTRA_AUTHORITY_HOST,
  ENTRA_USERINFO_ENDPOINT,
  authorizeEndpoint,
  expectedIssuer,
  isPersonalAccountTenant,
  isTenantAlias,
  isTenantGuid,
  isValidTenant,
  jwksEndpoint,
  tokenEndpoint,
} from './entra-tenant';
export type { EntraTenantAlias } from './entra-tenant';
export * from './dto/social-login.dto';
