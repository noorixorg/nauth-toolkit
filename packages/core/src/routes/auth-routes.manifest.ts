/**
 * Self-service route manifest
 *
 * Every endpoint the signed-in (or signing-in) user calls on their own account. Paths
 * match the client SDK's `defaultEndpoints`, so a consumer who mounts this bundle at
 * `/auth` can point the SDK at it with no endpoint overrides.
 *
 * @packageDocumentation
 */

import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { getRefreshTokenCookieName } from '../utils/cookie-names.util';
import { ContextStorage } from '../utils/context-storage';
import { IUser } from '../interfaces/entities.interface';
import { UserResponseDTO } from '../dto/user-response.dto';
import { SignupDTO } from '../dto/signup.dto';
import { LoginDTO } from '../dto/login.dto';
import { RefreshTokenDTO } from '../dto/refresh-token.dto';
import { LogoutDTO } from '../dto/logout.dto';
import { LogoutAllDTO } from '../dto/logout-all.dto';
import { LogoutSessionDTO } from '../dto/logout-session.dto';
import { RevokeTrustedDeviceDTO } from '../dto/trusted-device.dto';
import { RespondChallengeDTO } from '../dto/respond-challenge.dto';
import { ResendCodeDTO } from '../dto/resend-code.dto';
import { GetSetupDataDTO } from '../dto/get-setup-data.dto';
import { GetChallengeDataDTO } from '../dto/get-challenge-data.dto';
import { ChangePasswordDTO } from '../dto/change-password.dto';
import { UpdateUserAttributesDTO } from '../dto/update-user-attributes.dto';
import { ForgotPasswordDTO } from '../dto/forgot-password.dto';
import { ConfirmForgotPasswordDTO } from '../dto/confirm-forgot-password.dto';
import { ConfirmAdminResetPasswordDTO } from '../dto/admin-reset-password.dto';
import { GetUserAuthHistoryDTO } from '../dto/get-user-auth-history.dto';
import { SetupMFADTO } from '../dto/setup-mfa.dto';
import { VerifyMFASetupResponseDTO } from '../dto/verify-mfa-setup-response.dto';
import { RemoveDeviceDTO } from '../dto/remove-device.dto';
import { SetPreferredDeviceDTO } from '../dto/set-preferred-device.dto';
import { GetUserDevicesDTO } from '../dto/get-user-devices.dto';
import { SocialCallbackQueryDTO, SocialCallbackFormDTO, StartSocialRedirectQueryDTO } from '../dto/social-redirect.dto';
import {
  LinkSocialAccountDTO,
  GetLinkedAccountsDTO,
  UnlinkSocialAccountDTO,
  SetPasswordForSocialUserDTO,
  VerifyTokenDTO,
  SocialExchangeDTO,
} from '../dto/social-auth.dto';
import { CreateApiKeyDTO, UpdateApiKeyDTO, RevokeApiKeyDTO, DeleteApiKeyDTO } from '../dto/api-key.dto';
import { AnyNAuthRouteDefinition, defineRoute } from './route-manifest.types';

/**
 * Resolve the MFA service or fail with a configuration error.
 *
 * Routes declaring `requires: 'mfaService'` are filtered out at mount time when MFA is
 * disabled, so this only fires if a mount was constructed by hand.
 *
 * @param service - The optionally-configured service
 * @returns The service
 * @throws {NAuthException} When MFA is not configured
 */
function required<T>(service: T | undefined, name: string): T {
  if (!service) {
    throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `${name} is not configured`);
  }
  return service;
}

/**
 * Every self-service route the toolkit ships.
 *
 * Ordering is significant and preserved by all three mounts: literal path segments are
 * declared before parametric ones at the same depth, so `/social/link` is matched ahead
 * of `/social/:provider/verify`.
 */
export const AUTH_ROUTES_MANIFEST: readonly AnyNAuthRouteDefinition[] = [
  // ==========================================================================
  // Core - signup, login, refresh, logout
  // ==========================================================================
  defineRoute({
    key: 'signup',
    group: 'core',
    method: 'POST',
    path: 'signup',
    access: 'public',
    status: 201,
    source: 'body',
    dto: SignupDTO,
    handler: ({ dto, services }) => services.authService.signup(dto),
  }),
  defineRoute({
    key: 'login',
    group: 'core',
    method: 'POST',
    path: 'login',
    access: 'public',
    status: 200,
    source: 'body',
    dto: LoginDTO,
    handler: ({ dto, services }) => services.authService.login(dto),
  }),
  defineRoute({
    key: 'refresh',
    group: 'core',
    method: 'POST',
    path: 'refresh',
    access: 'public',
    status: 200,
    source: 'body',
    dto: RefreshTokenDTO,
    handler: ({ dto, cookies, services, config }) => {
      // In cookie delivery the token never reaches the body, so fall back to the
      // configured cookie. Consumers hand-rolling this have historically hardcoded
      // 'nauth_refresh_token', which breaks under a custom cookieNamePrefix.
      if (!dto.refreshToken?.trim()) {
        dto.refreshToken = cookies[getRefreshTokenCookieName(config)] ?? '';
      }
      return services.authService.refreshToken(dto);
    },
  }),
  defineRoute({
    key: 'logout',
    group: 'core',
    method: 'GET',
    path: 'logout',
    access: 'authenticated',
    // GET with CSRF disabled: destroying a session is safe, and requiring a CSRF token
    // to sign out strands users whose token has already expired.
    csrf: false,
    status: 200,
    source: 'query',
    dto: LogoutDTO,
    handler: ({ dto, services }) => services.authService.logout(dto),
  }),
  defineRoute({
    key: 'logoutAll',
    group: 'core',
    method: 'POST',
    path: 'logout/all',
    access: 'authenticated',
    csrf: false,
    status: 200,
    source: 'body',
    dto: LogoutAllDTO,
    handler: ({ dto, services }) => services.authService.logoutAll(dto),
  }),
  defineRoute({
    key: 'forgotPassword',
    group: 'core',
    method: 'POST',
    path: 'forgot-password',
    access: 'public',
    status: 200,
    source: 'body',
    dto: ForgotPasswordDTO,
    handler: ({ dto, services }) => services.authService.forgotPassword(dto),
  }),
  defineRoute({
    key: 'confirmForgotPassword',
    group: 'core',
    method: 'POST',
    path: 'forgot-password/confirm',
    access: 'public',
    status: 200,
    source: 'body',
    dto: ConfirmForgotPasswordDTO,
    handler: ({ dto, services }) => services.authService.confirmForgotPassword(dto),
  }),
  defineRoute({
    key: 'confirmAdminResetPassword',
    group: 'core',
    method: 'POST',
    path: 'reset-password/confirm',
    // Public by necessity: an admin initiated the reset, but the end user completes it
    // from an emailed link and has no session yet.
    access: 'public',
    status: 200,
    source: 'body',
    dto: ConfirmAdminResetPasswordDTO,
    handler: ({ dto, services }) => services.adminAuthService.confirmResetPassword(dto),
  }),

  // ==========================================================================
  // Challenge responses - the second half of signup and login
  //
  // Part of `core` rather than a group of their own: login can answer with a
  // challenge, and a caller with no way to respond to it cannot sign in.
  // ==========================================================================
  defineRoute({
    key: 'respondChallenge',
    group: 'core',
    method: 'POST',
    path: 'respond-challenge',
    access: 'public',
    status: 200,
    source: 'body',
    dto: RespondChallengeDTO,
    handler: ({ dto, services }) => services.authService.respondToChallenge(dto),
  }),
  defineRoute({
    key: 'resendCode',
    group: 'core',
    method: 'POST',
    path: 'challenge/resend',
    access: 'public',
    status: 200,
    source: 'body',
    dto: ResendCodeDTO,
    handler: ({ dto, services }) => services.authService.resendCode(dto),
  }),
  defineRoute({
    key: 'getSetupData',
    group: 'core',
    method: 'POST',
    path: 'challenge/setup-data',
    // Reached mid-challenge, while enrolling a factor during sign-in: the caller is
    // authorized by the challenge session token, not a JWT.
    access: 'public',
    status: 200,
    source: 'body',
    dto: GetSetupDataDTO,
    requires: 'mfaService',
    handler: ({ dto, services }) => required(services.mfaService, 'MFAService').getSetupData(dto),
  }),
  defineRoute({
    key: 'getChallengeData',
    group: 'core',
    method: 'POST',
    path: 'challenge/challenge-data',
    access: 'public',
    status: 200,
    source: 'body',
    dto: GetChallengeDataDTO,
    requires: 'mfaService',
    handler: ({ dto, services }) => required(services.mfaService, 'MFAService').getChallengeData(dto),
  }),

  // ==========================================================================
  // Profile
  // ==========================================================================
  defineRoute({
    key: 'profile',
    group: 'profile',
    method: 'GET',
    path: 'profile',
    access: 'authenticated',
    status: 200,
    source: 'none',
    handler: async ({ services }) => {
      // Self-service: the subject is the authenticated caller, resolved from request
      // context rather than accepted as a parameter.
      const current = ContextStorage.get<IUser>('CURRENT_USER');
      if (!current?.sub) {
        throw new NAuthException(AuthErrorCode.FORBIDDEN, 'Authentication required');
      }
      const user = await services.authService.getUserForAuthContext(current.sub);
      return UserResponseDTO.fromEntity(user);
    },
  }),
  defineRoute({
    key: 'updateProfile',
    group: 'profile',
    method: 'PUT',
    path: 'profile',
    access: 'authenticated',
    status: 200,
    source: 'body',
    dto: UpdateUserAttributesDTO,
    handler: ({ dto, services }) => services.authService.updateUserAttributes(dto),
  }),
  defineRoute({
    key: 'changePassword',
    group: 'profile',
    method: 'POST',
    path: 'change-password',
    access: 'authenticated',
    status: 200,
    source: 'body',
    dto: ChangePasswordDTO,
    handler: ({ dto, services }) => services.authService.changePassword(dto),
  }),

  // ==========================================================================
  // MFA - the current user's own factors
  // ==========================================================================
  defineRoute({
    key: 'mfaStatus',
    group: 'mfa',
    method: 'GET',
    path: 'mfa/status',
    access: 'authenticated',
    status: 200,
    source: 'none',
    requires: 'mfaService',
    handler: ({ services }) => required(services.mfaService, 'MFAService').getMfaStatus(),
  }),
  defineRoute({
    key: 'mfaAvailableMethods',
    group: 'mfa',
    method: 'GET',
    path: 'mfa/available-methods',
    access: 'authenticated',
    status: 200,
    source: 'none',
    requires: 'mfaService',
    handler: ({ services }) => required(services.mfaService, 'MFAService').getAvailableMethods(),
  }),
  defineRoute({
    key: 'mfaSetupData',
    group: 'mfa',
    method: 'POST',
    path: 'mfa/setup-data',
    access: 'authenticated',
    status: 200,
    source: 'body',
    dto: SetupMFADTO,
    requires: 'mfaService',
    handler: ({ dto, services }) => required(services.mfaService, 'MFAService').setup(dto),
  }),
  defineRoute({
    key: 'mfaVerifySetup',
    group: 'mfa',
    method: 'POST',
    path: 'mfa/verify-setup',
    access: 'authenticated',
    status: 200,
    source: 'body',
    dto: SetupMFADTO,
    requires: 'mfaService',
    // Completes the enrolment `mfa/setup-data` began, returning the new device id.
    // Not `setup()` - that starts an enrolment, so calling it here would loop the
    // caller back to the beginning and no device could ever be created.
    handler: async ({ dto, services }): Promise<VerifyMFASetupResponseDTO> => {
      const provider = required(services.mfaService, 'MFAService').getProvider(dto.methodName);
      const deviceId = await provider.verifySetup(dto.setupData);
      // Backup codes are issued separately and deliberately not returned here.
      return { deviceId };
    },
  }),
  defineRoute({
    key: 'mfaBackupCodes',
    group: 'mfa',
    method: 'POST',
    path: 'mfa/backup-codes/generate',
    access: 'authenticated',
    status: 200,
    source: 'none',
    requires: 'mfaService',
    handler: ({ services }) => required(services.mfaService, 'MFAService').generateBackupCodes(),
  }),
  // Literal path declared before the parametric sibling below.
  defineRoute({
    key: 'mfaDevices',
    group: 'mfa',
    method: 'GET',
    path: 'mfa/devices',
    access: 'authenticated',
    status: 200,
    source: 'query',
    dto: GetUserDevicesDTO,
    requires: 'mfaService',
    handler: ({ dto, services }) => required(services.mfaService, 'MFAService').getUserDevices(dto),
  }),
  defineRoute({
    key: 'mfaPreferred',
    group: 'mfa',
    method: 'POST',
    path: 'mfa/devices/:deviceId/preferred',
    access: 'authenticated',
    status: 200,
    source: 'params+body',
    dto: SetPreferredDeviceDTO,
    requires: 'mfaService',
    handler: ({ dto, services }) => required(services.mfaService, 'MFAService').setPreferredDevice(dto, 'user'),
  }),
  defineRoute({
    key: 'mfaRemoveDevice',
    group: 'mfa',
    method: 'DELETE',
    path: 'mfa/devices/:deviceId',
    access: 'authenticated',
    status: 200,
    source: 'params+body',
    dto: RemoveDeviceDTO,
    requires: 'mfaService',
    handler: ({ dto, services }) => required(services.mfaService, 'MFAService').removeDevice(dto),
  }),

  // ==========================================================================
  // Social - linking and OAuth flows
  // ==========================================================================
  defineRoute({
    key: 'socialLinked',
    group: 'social',
    method: 'GET',
    path: 'social/linked',
    access: 'authenticated',
    status: 200,
    source: 'query',
    dto: GetLinkedAccountsDTO,
    requires: 'socialAuthService',
    handler: ({ dto, services }) => required(services.socialAuthService, 'SocialAuthService').getLinkedAccounts(dto),
  }),
  defineRoute({
    key: 'socialLink',
    group: 'social',
    method: 'POST',
    path: 'social/link',
    access: 'authenticated',
    status: 200,
    source: 'body',
    dto: LinkSocialAccountDTO,
    requires: 'socialAuthService',
    handler: ({ dto, services }) => required(services.socialAuthService, 'SocialAuthService').linkSocialAccount(dto),
  }),
  defineRoute({
    key: 'socialUnlink',
    group: 'social',
    method: 'POST',
    path: 'social/unlink',
    access: 'authenticated',
    status: 200,
    source: 'body',
    dto: UnlinkSocialAccountDTO,
    requires: 'socialAuthService',
    handler: ({ dto, services }) => required(services.socialAuthService, 'SocialAuthService').unlinkSocialAccount(dto),
  }),
  defineRoute({
    key: 'socialCanSetPassword',
    group: 'social',
    method: 'GET',
    path: 'social/can-set-password',
    access: 'authenticated',
    status: 200,
    source: 'none',
    requires: 'socialAuthService',
    handler: ({ services }) => required(services.socialAuthService, 'SocialAuthService').canSetPassword(),
  }),
  defineRoute({
    key: 'socialSetPassword',
    group: 'social',
    method: 'POST',
    path: 'social/set-password',
    access: 'authenticated',
    status: 200,
    source: 'body',
    dto: SetPasswordForSocialUserDTO,
    requires: 'socialAuthService',
    handler: ({ dto, services }) =>
      required(services.socialAuthService, 'SocialAuthService').setPasswordForSocialUser(dto),
  }),
  defineRoute({
    key: 'socialExchange',
    group: 'social',
    method: 'POST',
    path: 'social/exchange',
    access: 'public',
    status: 200,
    source: 'body',
    dto: SocialExchangeDTO,
    // Exists to hand tokens to a JSON client after a redirect flow; cookies would
    // defeat its purpose.
    delivery: 'json',
    requires: 'socialRedirect',
    handler: ({ dto, services }) =>
      required(services.socialRedirect, 'SocialRedirectHandler').exchange(dto.exchangeToken),
  }),
  defineRoute({
    key: 'socialRedirectStart',
    group: 'social',
    method: 'GET',
    path: 'social/:provider/redirect',
    access: 'public',
    status: 302,
    source: 'params+query',
    dto: StartSocialRedirectQueryDTO,
    redirect: true,
    requires: 'socialRedirect',
    handler: ({ dto, params, services }) =>
      required(services.socialRedirect, 'SocialRedirectHandler').start(params.provider, dto),
  }),
  defineRoute({
    key: 'socialCallback',
    group: 'social',
    method: 'GET',
    path: 'social/:provider/callback',
    // The OAuth provider redirects the browser here; there is no session yet.
    access: 'public',
    status: 302,
    source: 'params+query',
    dto: SocialCallbackQueryDTO,
    redirect: true,
    requires: 'socialRedirect',
    handler: ({ dto, params, services }) =>
      required(services.socialRedirect, 'SocialRedirectHandler').callback(params.provider, dto),
  }),
  defineRoute({
    key: 'socialCallbackPost',
    group: 'social',
    method: 'POST',
    path: 'social/:provider/callback',
    // Apple posts the callback as a form when name scopes are requested.
    access: 'public',
    status: 302,
    source: 'params+body',
    dto: SocialCallbackFormDTO,
    redirect: true,
    requires: 'socialRedirect',
    handler: ({ dto, params, services }) =>
      required(services.socialRedirect, 'SocialRedirectHandler').callback(params.provider, dto),
  }),
  defineRoute({
    key: 'socialVerify',
    group: 'social',
    method: 'POST',
    path: 'social/:provider/verify',
    access: 'public',
    status: 200,
    source: 'params+body',
    dto: VerifyTokenDTO,
    requires: 'socialAuthService',
    handler: ({ dto, params, services }) => {
      const provider = params.provider;
      const verifier = services.socialProviders?.[provider];
      if (!verifier) {
        throw new NAuthException(
          AuthErrorCode.SOCIAL_CONFIG_MISSING,
          `Social provider '${provider}' is not configured`,
        );
      }
      return verifier.verifyToken(dto);
    },
  }),

  // ==========================================================================
  // Sessions and device trust
  // ==========================================================================
  defineRoute({
    key: 'sessions',
    group: 'device',
    method: 'GET',
    path: 'sessions',
    access: 'authenticated',
    status: 200,
    source: 'none',
    handler: ({ services }) => services.authService.getUserSessions(),
  }),
  defineRoute({
    key: 'logoutSession',
    group: 'device',
    method: 'DELETE',
    path: 'sessions/:sessionId',
    access: 'authenticated',
    status: 200,
    source: 'params+body',
    dto: LogoutSessionDTO,
    handler: ({ dto, services }) => services.authService.logoutSession(dto),
  }),
  defineRoute({
    key: 'trustDevice',
    group: 'device',
    method: 'POST',
    path: 'trust-device',
    access: 'authenticated',
    status: 200,
    source: 'none',
    handler: ({ services }) => services.authService.trustDevice(),
  }),
  defineRoute({
    key: 'isTrustedDevice',
    group: 'device',
    method: 'GET',
    path: 'is-trusted-device',
    access: 'authenticated',
    status: 200,
    source: 'none',
    handler: ({ services }) => services.authService.isTrustedDevice(),
  }),
  defineRoute({
    key: 'trustedDevices',
    group: 'device',
    method: 'GET',
    path: 'trusted-devices',
    access: 'authenticated',
    status: 200,
    source: 'none',
    handler: ({ services }) => services.authService.listTrustedDevices(),
  }),
  // Literal path declared before the parametric sibling below.
  defineRoute({
    key: 'revokeAllTrustedDevices',
    group: 'device',
    method: 'DELETE',
    path: 'trusted-devices',
    access: 'authenticated',
    status: 200,
    source: 'none',
    handler: ({ services }) => services.authService.revokeAllTrustedDevices(),
  }),
  defineRoute({
    key: 'revokeTrustedDevice',
    group: 'device',
    method: 'DELETE',
    path: 'trusted-devices/:deviceId',
    access: 'authenticated',
    status: 200,
    source: 'params',
    dto: RevokeTrustedDeviceDTO,
    handler: ({ dto, services }) => services.authService.revokeTrustedDevice(dto),
  }),

  // ==========================================================================
  // Audit - the caller's own history
  // ==========================================================================
  defineRoute({
    key: 'auditHistory',
    group: 'audit',
    method: 'GET',
    path: 'audit/history',
    access: 'authenticated',
    status: 200,
    source: 'query',
    dto: GetUserAuthHistoryDTO,
    handler: ({ dto, services }) => services.authService.getUserAuthHistory(dto),
  }),

  // ==========================================================================
  // API keys - the caller's own keys
  // ==========================================================================
  defineRoute({
    key: 'apiKeyCreate',
    group: 'apiKeys',
    method: 'POST',
    path: 'api-keys',
    access: 'authenticated',
    status: 201,
    source: 'body',
    dto: CreateApiKeyDTO,
    // A key must never be able to mint another key.
    apiKey: 'deny',
    requires: 'apiKeyService',
    handler: ({ dto, services }) => required(services.apiKeyService, 'ApiKeyService').createKey(dto),
  }),
  defineRoute({
    key: 'apiKeyList',
    group: 'apiKeys',
    method: 'GET',
    path: 'api-keys',
    access: 'authenticated',
    status: 200,
    source: 'none',
    apiKey: 'deny',
    requires: 'apiKeyService',
    handler: ({ services }) => required(services.apiKeyService, 'ApiKeyService').listKeys(),
  }),
  defineRoute({
    key: 'apiKeyUpdate',
    group: 'apiKeys',
    method: 'PATCH',
    path: 'api-keys/:keyId',
    access: 'authenticated',
    status: 200,
    source: 'params+body',
    dto: UpdateApiKeyDTO,
    apiKey: 'deny',
    requires: 'apiKeyService',
    handler: ({ dto, services }) => required(services.apiKeyService, 'ApiKeyService').updateKey(dto),
  }),
  defineRoute({
    key: 'apiKeyRevoke',
    group: 'apiKeys',
    method: 'POST',
    path: 'api-keys/:keyId/revoke',
    access: 'authenticated',
    status: 200,
    source: 'params+body',
    dto: RevokeApiKeyDTO,
    apiKey: 'deny',
    requires: 'apiKeyService',
    handler: ({ dto, services }) => required(services.apiKeyService, 'ApiKeyService').revokeKey(dto),
  }),
  defineRoute({
    key: 'apiKeyDelete',
    group: 'apiKeys',
    method: 'DELETE',
    path: 'api-keys/:keyId',
    access: 'authenticated',
    status: 200,
    source: 'params+body',
    dto: DeleteApiKeyDTO,
    apiKey: 'deny',
    requires: 'apiKeyService',
    handler: ({ dto, services }) => required(services.apiKeyService, 'ApiKeyService').deleteKey(dto),
  }),
];
