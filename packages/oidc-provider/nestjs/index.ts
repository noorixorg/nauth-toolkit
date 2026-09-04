export { OIDCProviderModule } from './oidc-provider.module';
export type { OIDCProviderModuleOptions, OIDCInteractionRouteOptions } from './oidc-provider.module';
export { NAUTH_OIDC_PROVIDER, NAUTH_OIDC_BRIDGE, NAUTH_OIDC_SESSIONS } from './tokens';
export { createOIDCInteractionController, DEFAULT_INTERACTION_PATH } from './oidc-interaction.controller';
export type { OIDCConsentBody } from './oidc-interaction.controller';
export { mountOIDCProviderNest } from './mount';

// Re-exported so a consumer's controller can type the bridge it injects without
// reaching into the root entry point as well.
export { OIDCInteractionBridge } from '../src/interaction-bridge';
export type { InteractionStateDTO, InteractionRedirectDTO } from '../src/interaction-bridge';
export { OIDCSessionTerminator } from '../src/session-termination';
export { createOIDCRateLimiter } from '../src/rate-limit';
export type { OIDCRateLimitConfig } from '../src/rate-limit';
export { OIDCSelfMountService, NAUTH_OIDC_MOUNT_OPTIONS } from './self-mount.service';
export type { OIDCSelfMountOptions } from './self-mount.service';
