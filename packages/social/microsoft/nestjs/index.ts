/**
 * @nauth-toolkit/social-microsoft/nestjs
 *
 * NestJS adapter for Microsoft Entra ID Social Authentication
 */

export { MicrosoftSocialAuthModule } from './microsoft-social-auth.module';

// Re-export core Microsoft social auth components
export * from '../src/microsoft-social-auth.service';
export * from '../src/microsoft-oauth.client';
export * from '../src/token-verifier.service';
export * from '../src/verified-token-profile.interface';
export * from '../src/entra-tenant';
export * from '../src/dto/social-login.dto';
