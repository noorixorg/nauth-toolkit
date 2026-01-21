import {
  NAuthClientConfig,
  NAuthEndpoints,
  NAuthAdminEndpoints,
  NAuthStorageAdapter,
  TokenDeliveryMode,
  HttpAdapter,
} from '../types/config.types';

/**
 * Fully resolved configuration with all defaults applied.
 */
export type ResolvedNAuthClientConfig = Omit<
  NAuthClientConfig,
  'endpoints' | 'storage' | 'tokenDelivery' | 'httpAdapter'
> & {
  tokenDelivery: TokenDeliveryMode;
  endpoints: NAuthEndpoints;
  storage: NAuthStorageAdapter;
  httpAdapter: HttpAdapter;
  csrf: { cookieName: string; headerName: string };
  deviceTrust: { headerName: string; storageKey: string };
  headers: Record<string, string>;
  timeout: number;
  admin?: {
    pathPrefix: string;
    endpoints: NAuthAdminEndpoints;
    headers: Record<string, string>;
  };
};

/**
 * Default endpoint paths matching backend controller.
 */
export const defaultEndpoints: NAuthEndpoints = {
  login: '/login',
  signup: '/signup',
  logout: '/logout',
  logoutAll: '/logout/all',
  refresh: '/refresh',
  respondChallenge: '/respond-challenge',
  resendCode: '/challenge/resend',
  getSetupData: '/challenge/setup-data',
  getChallengeData: '/challenge/challenge-data',
  profile: '/profile',
  changePassword: '/change-password',
  forgotPassword: '/forgot-password',
  confirmForgotPassword: '/forgot-password/confirm',
  confirmAdminResetPassword: '/reset-password/confirm',
  mfaStatus: '/mfa/status',
  mfaDevices: '/mfa/devices',
  mfaSetupData: '/mfa/setup-data',
  mfaVerifySetup: '/mfa/verify-setup',
  mfaRemove: '/mfa/method',
  mfaPreferred: '/mfa/preferred-method',
  mfaBackupCodes: '/mfa/backup-codes/generate',
  socialLinked: '/social/linked',
  socialLink: '/social/link',
  socialUnlink: '/social/unlink',
  socialVerify: '/social/:provider/verify',
  socialRedirectStart: '/social/:provider/redirect',
  socialExchange: '/social/exchange',
  trustDevice: '/trust-device',
  isTrustedDevice: '/is-trusted-device',
  auditHistory: '/audit/history',
  updateProfile: '/profile',
};

/**
 * Default admin endpoint paths matching backend admin controller.
 */
export const defaultAdminEndpoints: NAuthAdminEndpoints = {
  signup: '/signup',
  signupSocial: '/signup-social',
  getUsers: '/users',
  getUser: '/users/:sub',
  deleteUser: '/users/:sub',
  disableUser: '/users/:sub/disable',
  enableUser: '/users/:sub/enable',
  forcePasswordChange: '/users/:sub/force-password-change',
  setPassword: '/set-password',
  resetPasswordInitiate: '/reset-password/initiate',
  getUserSessions: '/users/:sub/sessions',
  logoutAll: '/users/:sub/logout-all',
  getMfaStatus: '/users/:sub/mfa/status',
  setPreferredMfaMethod: '/mfa/preferred-method',
  removeMfaDevices: '/mfa/remove-devices',
  setMfaExemption: '/mfa/exemption',
  getAuditHistory: '/audit/history',
};

/**
 * Normalize user config with defaults.
 *
 * @param config - User supplied config
 * @param defaultAdapter - Default HTTP adapter (FetchAdapter for vanilla, AngularHttpAdapter for Angular)
 * @returns Resolved config with defaults applied
 */
export const resolveConfig = (config: NAuthClientConfig, defaultAdapter: HttpAdapter): ResolvedNAuthClientConfig => {
  const resolvedEndpoints: NAuthEndpoints = {
    ...defaultEndpoints,
    ...(config.endpoints ?? {}),
  };

  // Resolve admin config if provided
  let resolvedAdmin: ResolvedNAuthClientConfig['admin'];
  if (config.admin) {
    const resolvedAdminEndpoints: NAuthAdminEndpoints = {
      ...defaultAdminEndpoints,
      ...(config.admin.endpoints ?? {}),
    };

    resolvedAdmin = {
      pathPrefix: config.admin.pathPrefix ?? '/admin',
      endpoints: resolvedAdminEndpoints,
      headers: {
        ...config.headers,
        ...(config.admin.headers ?? {}),
      },
    };
  }

  return {
    ...config,
    csrf: {
      cookieName: config.csrf?.cookieName ?? 'nauth_csrf_token',
      headerName: config.csrf?.headerName ?? 'x-csrf-token',
    },
    deviceTrust: {
      headerName: config.deviceTrust?.headerName ?? 'X-Device-Token',
      storageKey: config.deviceTrust?.storageKey ?? 'nauth_device_token',
    },
    headers: config.headers ?? {},
    timeout: config.timeout ?? 30000,
    endpoints: resolvedEndpoints,
    storage: config.storage as NAuthStorageAdapter,
    httpAdapter: config.httpAdapter ?? defaultAdapter,
    admin: resolvedAdmin,
  };
};
