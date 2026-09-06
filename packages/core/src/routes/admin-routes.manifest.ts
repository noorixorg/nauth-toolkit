/**
 * Administrative route manifest
 *
 * Operations one user performs on another's account. Never mounted by default, and
 * refused at startup unless an `IAuthorizationProvider` is configured — the toolkit
 * ships no role model, so without one these routes would be reachable by any
 * authenticated caller.
 *
 * Every route declares the {@link AuthAction} it performs. The service authorizes that
 * action independently, so the same policy also covers a hand-written controller or a
 * script; the declaration here lets a mount fail fast rather than at first request.
 *
 * @packageDocumentation
 */

import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { AdminSignupDTO } from '../dto/admin-signup.dto';
import { AdminSignupSocialDTO } from '../dto/admin-signup-social.dto';
import { GetUsersDTO } from '../dto/get-users.dto';
import { GetUserByIdDTO } from '../dto/get-user-by-id.dto';
import { GetUserByEmailDTO } from '../dto/get-user-by-email.dto';
import { DeleteUserDTO } from '../dto/delete-user.dto';
import { DisableUserDTO } from '../dto/disable-user.dto';
import { EnableUserDTO } from '../dto/enable-user.dto';
import { SetMustChangePasswordDTO } from '../dto/set-must-change-password.dto';
import { UpdateVerifiedStatusRequestDTO } from '../dto/update-verified-status-request.dto';
import { AdminUpdateUserAttributesDTO } from '../dto/admin-update-user-attributes.dto';
import { AdminSetPasswordDTO } from '../dto/admin-set-password.dto';
import { AdminResetPasswordDTO } from '../dto/admin-reset-password.dto';
import { GetUserSessionsDTO } from '../dto/get-user-sessions.dto';
import { AdminRevokeSessionDTO } from '../dto/admin-revoke-session.dto';
import { AdminManageTrustedDevicesDTO, AdminRevokeTrustedDeviceDTO } from '../dto/trusted-device.dto';
import { AdminLogoutAllDTO } from '../dto/admin-logout-all.dto';
import { AdminGetMFAStatusDTO } from '../dto/admin-get-mfa-status.dto';
import { AdminGetUserDevicesDTO } from '../dto/get-user-devices.dto';
import { AdminRemoveDeviceDTO } from '../dto/admin-remove-device.dto';
import { AdminSetPreferredDeviceDTO } from '../dto/admin-set-preferred-device.dto';
import { SetMFAExemptionDTO } from '../dto/set-mfa-exemption.dto';
import { AdminGetUserAuthHistoryDTO } from '../dto/admin-get-user-auth-history.dto';
import { GetEventsByTypeDTO } from '../dto/get-events-by-type.dto';
import { GetSuspiciousActivityDTO } from '../dto/get-suspicious-activity.dto';
import { GetRiskAssessmentHistoryDTO } from '../dto/get-risk-assessment-history.dto';
import { AdminCreateApiKeyDTO, AdminUpdateApiKeyDTO, AdminManageApiKeyDTO } from '../dto/admin-api-key.dto';
import { AnyNAuthRouteDefinition, defineRoute } from './route-manifest.types';

/**
 * Resolve an optional service or fail with a configuration error.
 *
 * @param service - The optionally-configured service
 * @param name - Name used in the error message
 * @returns The service
 * @throws {NAuthException} When the service is not configured
 */
function required<T>(service: T | undefined, name: string): T {
  if (!service) {
    throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `${name} is not configured`);
  }
  return service;
}

/**
 * Every administrative route the toolkit ships.
 *
 * All are `access: 'admin'`, and all deny API-key authentication so that
 * `apiKeys.globalAllowlist` cannot inadvertently expose them. The guard enforces that
 * before the handler runs, so an authorization provider is never consulted for a
 * key-authenticated call here; `viaApiKey` on the authorization context exists for
 * hand-written admin routes marked `allowApiKey`.
 *
 * Ordering places literal segments before parametric ones at the same depth.
 */
export const ADMIN_ROUTES_MANIFEST: readonly AnyNAuthRouteDefinition[] = [
  // ==========================================================================
  // User lifecycle
  // ==========================================================================
  defineRoute({
    key: 'adminSignup',
    group: 'admin',
    method: 'POST',
    path: 'signup',
    access: 'admin',
    action: 'admin.user.create',
    status: 201,
    source: 'body',
    dto: AdminSignupDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.signup(dto),
  }),
  defineRoute({
    key: 'adminSignupSocial',
    group: 'admin',
    method: 'POST',
    path: 'signup-social',
    access: 'admin',
    action: 'admin.user.createSocial',
    status: 201,
    source: 'body',
    dto: AdminSignupSocialDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.signupSocial(dto),
  }),
  defineRoute({
    key: 'adminSetPassword',
    group: 'admin',
    method: 'POST',
    path: 'set-password',
    access: 'admin',
    action: 'admin.user.setPassword',
    status: 200,
    source: 'body',
    dto: AdminSetPasswordDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.setPassword(dto),
  }),
  defineRoute({
    key: 'adminResetPasswordInitiate',
    group: 'admin',
    method: 'POST',
    path: 'reset-password/initiate',
    access: 'admin',
    action: 'admin.user.resetPassword',
    status: 200,
    source: 'body',
    dto: AdminResetPasswordDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.resetPassword(dto),
  }),

  // ==========================================================================
  // User queries and mutations - literal paths before ':sub'
  // ==========================================================================
  defineRoute({
    key: 'adminGetUserByEmail',
    group: 'admin',
    method: 'GET',
    path: 'users/by-email',
    access: 'admin',
    action: 'admin.user.read',
    status: 200,
    source: 'query',
    dto: GetUserByEmailDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.getUserByEmail(dto),
  }),
  defineRoute({
    key: 'adminGetUsers',
    group: 'admin',
    method: 'GET',
    path: 'users',
    access: 'admin',
    action: 'admin.user.list',
    status: 200,
    source: 'query',
    dto: GetUsersDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.getUsers(dto),
  }),
  defineRoute({
    key: 'adminGetUser',
    group: 'admin',
    method: 'GET',
    path: 'users/:sub',
    access: 'admin',
    action: 'admin.user.read',
    status: 200,
    source: 'params',
    dto: GetUserByIdDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.getUserById(dto),
  }),
  defineRoute({
    key: 'adminUpdateUser',
    group: 'admin',
    method: 'PUT',
    path: 'users/:sub',
    access: 'admin',
    action: 'admin.user.update',
    status: 200,
    source: 'params+body',
    dto: AdminUpdateUserAttributesDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.updateUserAttributes(dto),
  }),
  defineRoute({
    key: 'adminDeleteUser',
    group: 'admin',
    method: 'DELETE',
    path: 'users/:sub',
    access: 'admin',
    action: 'admin.user.delete',
    status: 200,
    source: 'params',
    dto: DeleteUserDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.deleteUser(dto),
  }),
  defineRoute({
    key: 'adminDisableUser',
    group: 'admin',
    method: 'POST',
    path: 'users/:sub/disable',
    access: 'admin',
    action: 'admin.user.disable',
    status: 200,
    source: 'params+body',
    dto: DisableUserDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.disableUser(dto),
  }),
  defineRoute({
    key: 'adminEnableUser',
    group: 'admin',
    method: 'POST',
    path: 'users/:sub/enable',
    access: 'admin',
    action: 'admin.user.enable',
    status: 200,
    source: 'params+body',
    dto: EnableUserDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.enableUser(dto),
  }),
  defineRoute({
    key: 'adminForcePasswordChange',
    group: 'admin',
    method: 'POST',
    path: 'users/:sub/force-password-change',
    access: 'admin',
    action: 'admin.user.forcePasswordChange',
    status: 200,
    source: 'params+body',
    dto: SetMustChangePasswordDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.setMustChangePassword(dto),
  }),
  defineRoute({
    key: 'adminUpdateVerifiedStatus',
    group: 'admin',
    method: 'POST',
    path: 'users/:sub/verified-status',
    access: 'admin',
    action: 'admin.user.updateVerifiedStatus',
    status: 200,
    source: 'params+body',
    dto: UpdateVerifiedStatusRequestDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.updateVerifiedStatus(dto),
  }),

  // ==========================================================================
  // Trusted devices
  // ==========================================================================
  defineRoute({
    key: 'adminGetUserTrustedDevices',
    group: 'admin',
    method: 'GET',
    path: 'users/:sub/trusted-devices',
    access: 'admin',
    action: 'admin.trustedDevice.list',
    status: 200,
    source: 'params',
    dto: AdminManageTrustedDevicesDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.getUserTrustedDevices(dto),
  }),
  // Literal path declared before the parametric sibling below.
  defineRoute({
    key: 'adminRevokeAllUserTrustedDevices',
    group: 'admin',
    method: 'DELETE',
    path: 'users/:sub/trusted-devices',
    access: 'admin',
    action: 'admin.trustedDevice.revokeAll',
    status: 200,
    source: 'params',
    dto: AdminManageTrustedDevicesDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.revokeAllUserTrustedDevices(dto),
  }),
  defineRoute({
    key: 'adminRevokeUserTrustedDevice',
    group: 'admin',
    method: 'DELETE',
    path: 'users/:sub/trusted-devices/:deviceId',
    access: 'admin',
    action: 'admin.trustedDevice.revoke',
    status: 200,
    source: 'params',
    dto: AdminRevokeTrustedDeviceDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.revokeUserTrustedDevice(dto),
  }),

  // ==========================================================================
  // Sessions
  // ==========================================================================
  defineRoute({
    key: 'adminGetUserSessions',
    group: 'admin',
    method: 'GET',
    path: 'users/:sub/sessions',
    access: 'admin',
    action: 'admin.session.list',
    status: 200,
    source: 'params+query',
    dto: GetUserSessionsDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.getUserSessions(dto),
  }),
  defineRoute({
    key: 'adminRevokeUserSession',
    group: 'admin',
    method: 'DELETE',
    path: 'users/:sub/sessions/:sessionId',
    access: 'admin',
    action: 'admin.session.revoke',
    status: 200,
    source: 'params',
    dto: AdminRevokeSessionDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.revokeUserSession(dto),
  }),
  defineRoute({
    key: 'adminLogoutAll',
    group: 'admin',
    method: 'POST',
    path: 'users/:sub/logout-all',
    access: 'admin',
    action: 'admin.session.revokeAll',
    status: 200,
    source: 'params+body',
    dto: AdminLogoutAllDTO,
    apiKey: 'deny',
    handler: ({ dto, services }) => services.adminAuthService.logoutAll(dto),
  }),

  // ==========================================================================
  // MFA administration
  // ==========================================================================
  defineRoute({
    key: 'adminSetMfaExemption',
    group: 'admin',
    method: 'POST',
    path: 'mfa/exemption',
    access: 'admin',
    action: 'admin.mfa.setExemption',
    status: 200,
    source: 'body',
    dto: SetMFAExemptionDTO,
    apiKey: 'deny',
    requires: 'mfaService',
    handler: ({ dto, services }) => required(services.mfaService, 'MFAService').setMFAExemption(dto),
  }),
  defineRoute({
    key: 'adminRemoveMfaDevice',
    group: 'admin',
    method: 'DELETE',
    path: 'mfa/devices/:deviceId',
    access: 'admin',
    action: 'admin.mfa.removeDevice',
    status: 200,
    source: 'params+body',
    dto: AdminRemoveDeviceDTO,
    apiKey: 'deny',
    requires: 'mfaService',
    handler: ({ dto, services }) => required(services.mfaService, 'MFAService').adminRemoveDevice(dto),
  }),
  defineRoute({
    key: 'adminGetMfaStatus',
    group: 'admin',
    method: 'GET',
    path: 'users/:sub/mfa/status',
    access: 'admin',
    action: 'admin.mfa.readStatus',
    status: 200,
    source: 'params',
    dto: AdminGetMFAStatusDTO,
    apiKey: 'deny',
    requires: 'mfaService',
    handler: ({ dto, services }) => required(services.mfaService, 'MFAService').adminGetMfaStatus(dto),
  }),
  defineRoute({
    key: 'adminGetMfaDevices',
    group: 'admin',
    method: 'GET',
    path: 'users/:sub/mfa/devices',
    access: 'admin',
    action: 'admin.mfa.listDevices',
    status: 200,
    source: 'params',
    dto: AdminGetUserDevicesDTO,
    apiKey: 'deny',
    requires: 'mfaService',
    handler: ({ dto, services }) => required(services.mfaService, 'MFAService').adminGetUserDevices(dto),
  }),
  defineRoute({
    key: 'adminSetPreferredMfaDevice',
    group: 'admin',
    method: 'POST',
    path: 'users/:sub/mfa/devices/:deviceId/preferred',
    access: 'admin',
    action: 'admin.mfa.setPreferred',
    status: 200,
    source: 'params+body',
    dto: AdminSetPreferredDeviceDTO,
    apiKey: 'deny',
    requires: 'mfaService',
    handler: ({ dto, services }) => required(services.mfaService, 'MFAService').adminSetPreferredDevice(dto),
  }),

  // ==========================================================================
  // Audit
  // ==========================================================================
  defineRoute({
    key: 'adminGetEventsByType',
    group: 'admin',
    method: 'GET',
    path: 'audit/events',
    access: 'admin',
    action: 'admin.audit.read',
    status: 200,
    source: 'query',
    dto: GetEventsByTypeDTO,
    apiKey: 'deny',
    requires: 'auditService',
    handler: ({ dto, services }) => required(services.auditService, 'AuthAuditService').getEventsByType(dto),
  }),
  defineRoute({
    key: 'adminGetSuspiciousActivity',
    group: 'admin',
    method: 'GET',
    path: 'audit/suspicious',
    access: 'admin',
    action: 'admin.audit.read',
    status: 200,
    source: 'query',
    dto: GetSuspiciousActivityDTO,
    apiKey: 'deny',
    requires: 'auditService',
    handler: ({ dto, services }) => required(services.auditService, 'AuthAuditService').getSuspiciousActivity(dto),
  }),
  defineRoute({
    key: 'adminGetRiskAssessmentHistory',
    group: 'admin',
    method: 'GET',
    path: 'audit/risk',
    access: 'admin',
    action: 'admin.audit.read',
    status: 200,
    source: 'query',
    dto: GetRiskAssessmentHistoryDTO,
    apiKey: 'deny',
    requires: 'auditService',
    handler: ({ dto, services }) => required(services.auditService, 'AuthAuditService').getRiskAssessmentHistory(dto),
  }),
  defineRoute({
    key: 'adminGetAuditHistory',
    group: 'admin',
    method: 'GET',
    path: 'audit/history',
    access: 'admin',
    action: 'admin.audit.read',
    status: 200,
    source: 'query',
    dto: AdminGetUserAuthHistoryDTO,
    apiKey: 'deny',
    requires: 'auditService',
    handler: ({ dto, services }) => required(services.auditService, 'AuthAuditService').getUserAuthHistory(dto),
  }),

  // ==========================================================================
  // API keys on behalf of another user
  // ==========================================================================
  defineRoute({
    key: 'adminApiKeyCreate',
    group: 'apiKeysAdmin',
    method: 'POST',
    path: 'api-keys',
    access: 'admin',
    action: 'admin.apiKey.create',
    status: 201,
    source: 'body',
    dto: AdminCreateApiKeyDTO,
    apiKey: 'deny',
    requires: 'apiKeyService',
    handler: ({ dto, services }) => required(services.apiKeyService, 'ApiKeyService').adminCreateKey(dto),
  }),
  defineRoute({
    key: 'adminApiKeyList',
    group: 'apiKeysAdmin',
    method: 'GET',
    path: 'api-keys',
    access: 'admin',
    action: 'admin.apiKey.list',
    status: 200,
    source: 'query',
    dto: AdminManageApiKeyDTO,
    apiKey: 'deny',
    requires: 'apiKeyService',
    handler: ({ dto, services }) => required(services.apiKeyService, 'ApiKeyService').adminListKeys(dto),
  }),
  defineRoute({
    key: 'adminApiKeyUpdate',
    group: 'apiKeysAdmin',
    method: 'PATCH',
    path: 'api-keys/:keyId',
    access: 'admin',
    action: 'admin.apiKey.update',
    status: 200,
    source: 'params+body',
    dto: AdminUpdateApiKeyDTO,
    apiKey: 'deny',
    requires: 'apiKeyService',
    handler: ({ dto, services }) => required(services.apiKeyService, 'ApiKeyService').adminUpdateKey(dto),
  }),
  defineRoute({
    key: 'adminApiKeyRevoke',
    group: 'apiKeysAdmin',
    method: 'POST',
    path: 'api-keys/:keyId/revoke',
    access: 'admin',
    action: 'admin.apiKey.revoke',
    status: 200,
    source: 'params+body',
    dto: AdminManageApiKeyDTO,
    apiKey: 'deny',
    requires: 'apiKeyService',
    handler: ({ dto, services }) => required(services.apiKeyService, 'ApiKeyService').adminRevokeKey(dto),
  }),
  defineRoute({
    key: 'adminApiKeyDelete',
    group: 'apiKeysAdmin',
    method: 'DELETE',
    path: 'api-keys/:keyId',
    access: 'admin',
    action: 'admin.apiKey.delete',
    status: 200,
    source: 'params+body',
    dto: AdminManageApiKeyDTO,
    apiKey: 'deny',
    requires: 'apiKeyService',
    handler: ({ dto, services }) => required(services.apiKeyService, 'ApiKeyService').adminDeleteKey(dto),
  }),
];
