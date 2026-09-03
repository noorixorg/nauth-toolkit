export {
  OIDCProviderModule,
  NAUTH_OIDC_PROVIDER,
  NAUTH_OIDC_BRIDGE,
  NAUTH_OIDC_SESSIONS,
} from './oidc-provider.module';
export type { OIDCProviderModuleOptions } from './oidc-provider.module';
export { mountOIDCProviderNest } from './mount';

// Re-exported so a consumer's controller can type the bridge it injects without
// reaching into the root entry point as well.
export { OIDCInteractionBridge } from '../src/interaction-bridge';
export type { InteractionStateDTO, InteractionRedirectDTO } from '../src/interaction-bridge';
export { OIDCSessionTerminator } from '../src/session-termination';
export { createOIDCRateLimiter } from '../src/rate-limit';
export type { OIDCRateLimitConfig } from '../src/rate-limit';
