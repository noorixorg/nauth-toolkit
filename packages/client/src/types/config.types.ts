import { AuthUser } from './user.types';
import { NAuthError } from './error.types';
import { NAuthStorageAdapter } from '../storage/interface';
import type { HttpAdapter } from '../core/http-adapter';
import type { AuthResponse, AuthChallenge } from './auth.types';
export type { NAuthStorageAdapter } from '../storage/interface';
export type { HttpAdapter } from '../core/http-adapter';

/**
 * Token delivery mode for the frontend SDK.
 *
 * - `'cookies'` - For web applications. Tokens sent as httpOnly cookies by backend.
 *   Uses `withCredentials`, CSRF tokens, no Authorization header.
 *
 * - `'json'` - For mobile/native apps (Capacitor, React Native). Tokens returned
 *   in response body, stored locally, sent via Authorization header.
 *
 * Note: "Hybrid" is a backend deployment pattern (supporting both web and mobile
 * via separate endpoints), not a frontend mode. The frontend chooses ONE mode
 * based on whether it's a web or mobile build.
 */
export type TokenDeliveryMode = 'json' | 'cookies';

/**
 * Endpoint paths for the client SDK.
 */
export interface NAuthEndpoints {
  login: string;
  signup: string;
  logout: string;
  logoutAll: string;
  refresh: string;
  respondChallenge: string;
  resendCode: string;
  getSetupData: string;
  getChallengeData: string;
  profile: string;
  changePassword: string;
  forgotPassword: string;
  confirmForgotPassword: string;
  confirmAdminResetPassword: string;
  mfaStatus: string;
  mfaDevices: string;
  mfaSetupData: string;
  mfaVerifySetup: string;
  mfaRemove: string;
  mfaPreferred: string;
  mfaBackupCodes: string;
  socialLinked: string;
  socialLink: string;
  socialUnlink: string;
  socialVerify: string;
  socialRedirectStart: string;
  socialExchange: string;
  trustDevice: string;
  isTrustedDevice: string;
  auditHistory: string;
  updateProfile: string;
}

/**
 * Admin endpoint paths for administrative operations.
 */
export interface NAuthAdminEndpoints {
  /** POST /signup - Create user */
  signup: string;
  /** POST /signup-social - Import social user */
  signupSocial: string;
  /** GET /users - List users with filters */
  getUsers: string;
  /** GET /users/:sub - Get user by sub */
  getUser: string;
  /** DELETE /users/:sub - Delete user */
  deleteUser: string;
  /** POST /users/:sub/disable - Disable user account */
  disableUser: string;
  /** POST /users/:sub/enable - Enable user account */
  enableUser: string;
  /** POST /users/:sub/force-password-change - Force password change */
  forcePasswordChange: string;
  /** POST /set-password - Set password for user */
  setPassword: string;
  /** POST /reset-password/initiate - Initiate password reset */
  resetPasswordInitiate: string;
  /** GET /users/:sub/sessions - Get user sessions */
  getUserSessions: string;
  /** POST /users/:sub/logout-all - Logout all sessions */
  logoutAll: string;
  /** GET /users/:sub/mfa/status - Get MFA status */
  getMfaStatus: string;
  /** POST /mfa/preferred-method - Set preferred MFA method */
  setPreferredMfaMethod: string;
  /** POST /mfa/remove-devices - Remove MFA devices */
  removeMfaDevices: string;
  /** POST /mfa/exemption - Set MFA exemption */
  setMfaExemption: string;
  /** GET /audit/history - Get audit history */
  getAuditHistory: string;
}

/**
 * Context provided to onAuthResponse callback.
 */
export interface AuthResponseContext {
  /** Source of the auth operation */
  source: 'login' | 'signup' | 'social' | 'challenge' | 'refresh';

  /** OAuth provider (if source is 'social') */
  provider?: string;

  /** Whether this was triggered from a guard */
  fromGuard?: boolean;
}

/**
 * MFA-specific route configuration.
 * Only applies when challenge type is MFA_REQUIRED.
 */
export interface MfaRoutesConfig {
  /** Route for passkey verification (when preferredMethod is 'passkey') */
  passkey?: string;
  /** Route for MFA method selector (when multiple methods available) */
  selector?: string;
  /** Default route for other MFA methods (sms, email, totp) */
  default?: string;
}

/**
 * Redirect URLs configuration for authentication flows.
 * Provides platform-agnostic routing configuration for all authentication scenarios.
 */
export interface NAuthRedirectsConfig {
  /**
   * URL to redirect to after successful authentication (login, signup, or OAuth).
   * @default '/'
   */
  success?: string;

  /**
   * URL to redirect to when session expires (refresh fails with 401).
   * @default '/login'
   */
  sessionExpired?: string;

  /**
   * URL to redirect to when OAuth authentication fails.
   * @default '/login'
   */
  oauthError?: string;

  /**
   * Base URL for challenge routes (email verification, MFA, etc.).
   * The challenge type will be appended (e.g., '/auth/challenge/verify-email').
   * @default '/auth/challenge'
   */
  challengeBase?: string;

  /**
   * Custom route for each challenge type.
   * When specified, overrides default route construction.
   *
   * @example
   * ```typescript
   * challengeRoutes: {
   *   [AuthChallenge.MFA_REQUIRED]: '/auth/mfa',
   *   [AuthChallenge.VERIFY_EMAIL]: '/verify',
   * }
   * ```
   */
  challengeRoutes?: Partial<Record<AuthChallenge, string>>;

  /**
   * Custom routes for MFA-specific flows.
   * Allows fine-grained control over MFA navigation.
   * Only applies when challenge type is MFA_REQUIRED.
   *
   * @example
   * ```typescript
   * mfaRoutes: {
   *   passkey: '/auth/passkey',
   *   selector: '/auth/choose-method',
   *   default: '/auth/verify-code',
   * }
   * ```
   */
  mfaRoutes?: MfaRoutesConfig;

  /**
   * Use single route with query parameter.
   * When true: /auth/challenge?challenge=VERIFY_EMAIL
   * When false: /auth/challenge/verify-email
   *
   * @default false
   */
  useSingleChallengeRoute?: boolean;
}

/**
 * Client configuration.
 */
export interface NAuthClientConfig {
  /**
   * Base URL for authentication API.
   *
   * For web apps using cookies: `'https://api.example.com/auth'`
   * For mobile apps using JSON: `'https://api.example.com/mobile/auth'`
   *
   * When backend uses hybrid deployment, mobile apps should use a different
   * base URL that points to the JSON-based mobile auth endpoints.
   */
  baseUrl: string;

  /**
   * Optional path prefix automatically prepended to all endpoint paths.
   * Simplifies configuration when all auth endpoints share a common prefix.
   *
   * Benefits:
   * - Avoids repeating `/auth` in every endpoint path or having to give it if using default endpoints in backend.
   * - Cleaner endpoint configuration
   * - Easier to change the auth path globally
   *
   * Note: Authorization tokens are still sent to ALL requests matching `baseUrl`,
   * regardless of this prefix. This is a convenience feature, not a security boundary.
   *
   * @example Without authPathPrefix (verbose)
   * ```typescript
   * {
   *   baseUrl: 'https://api.example.com',
   *   endpoints: {
   *     profile: '/auth/profile',
   *     login: '/auth/login/mobile',
   *     mfaStatus: '/auth/mfa/status',
   *   }
   * }
   * ```
   *
   * @example With authPathPrefix (clean)
   * ```typescript
   * {
   *   baseUrl: 'https://api.example.com',
   *   authPathPrefix: '/auth',
   *   endpoints: {
   *     profile: '/profile',          // SDK builds: /auth/profile
   *     login: '/login/mobile',       // SDK builds: /auth/login/mobile
   *     mfaStatus: '/mfa/status',     // SDK builds: /auth/mfa/status
   *   }
   * }
   * ```
   */
  authPathPrefix?: string;

  /**
   * How tokens are delivered between client and server.
   *
   * - `'cookies'` - For web apps. Backend sets httpOnly cookies.
   * - `'json'` - For mobile apps. Tokens in response body, stored locally.
   */
  tokenDelivery: TokenDeliveryMode;

  /** Custom storage adapter. Defaults to localStorage (web) or memory (SSR). */
  storage?: NAuthStorageAdapter;

  /**
   * CSRF configuration (required for cookies mode).
   * Default cookie name: 'csrf_token', header name: 'x-csrf-token'
   */
  csrf?: {
    cookieName?: string;
    headerName?: string;
  };

  /** Custom endpoint paths (merged with defaults). */
  endpoints?: Partial<NAuthEndpoints>;

  /** Device trust configuration for "remember this device" feature. */
  deviceTrust?: {
    headerName?: string;
    storageKey?: string;
  };

  /** Additional headers to include in all requests. */
  headers?: Record<string, string>;

  /** Request timeout in milliseconds. Default: 30000 */
  timeout?: number;

  /**
   * Custom handler called after auth operations complete.
   *
   * If provided, SDK will NOT auto-navigate. Instead, it calls this
   * function with the auth response, allowing apps to handle navigation
   * or show dialogs.
   *
   * @example Dialog-based app
   * ```typescript
   * onAuthResponse: (response, context) => {
   *   if (response.challengeName) {
   *     this.dialog.open(ChallengeDialogComponent, { data: response });
   *   } else {
   *     this.router.navigate(['/dashboard']);
   *   }
   * }
   * ```
   */
  onAuthResponse?: (response: AuthResponse, context: AuthResponseContext) => void | Promise<void>;

  /**
   * Custom navigation function.
   * Only used when onAuthResponse is NOT provided.
   *
   * @example Angular Router
   * ```typescript
   * navigationHandler: (url) => inject(Router).navigateByUrl(url)
   * ```
   *
   * @default Uses window.location.replace (works in guards)
   */
  navigationHandler?: (url: string) => void | Promise<void>;

  /**
   * Redirect URLs for various authentication scenarios.
   * Used by guards and interceptors to handle routing in a platform-agnostic way.
   *
   * @see {@link NAuthRedirectsConfig} for complete configuration options
   */
  redirects?: NAuthRedirectsConfig;

  /**
   * Called when session expires (refresh fails with 401).
   */
  onSessionExpired?: () => void;

  /** Called after successful token refresh. */
  onTokenRefresh?: () => void;

  /** Called when authentication state changes (login/logout). */
  onAuthStateChange?: (user: AuthUser | null) => void;

  /** Called on authentication errors. */
  onError?: (error: NAuthError) => void;

  /** Enable debug logging. */
  debug?: boolean;

  /**
   * HTTP adapter for making requests.
   *
   * - **Auto-provided in Angular**: Uses HttpClient (works with interceptors)
   * - **Manual setup in React/Vue**: Provide AxiosAdapter or custom adapter
   * - **Defaults to FetchAdapter**: If not provided, uses native fetch
   *
   * @example
   * ```typescript
   * // Angular (automatic)
   * // AuthService auto-injects AngularHttpAdapter
   *
   * // React with Axios
   * const client = new NAuthClient({
   *   httpAdapter: new AxiosAdapter(axiosInstance),
   * });
   *
   * // Vanilla JS (auto-defaults to fetch)
   * const client = new NAuthClient({
   *   // httpAdapter auto-defaults to FetchAdapter
   * });
   * ```
   */
  httpAdapter?: HttpAdapter;

  /**
   * Admin operations configuration (optional).
   * If provided, enables client.admin.* methods.
   *
   * @example
   * ```typescript
   * const client = new NAuthClient({
   *   baseUrl: 'https://api.example.com/auth',
   *   tokenDelivery: 'cookies',
   *   admin: {
   *     pathPrefix: '/admin',
   *     endpoints: {
   *       getUsers: '/users/list',  // Override specific endpoint
   *     },
   *     headers: {
   *       'X-Admin-Context': 'dashboard',
   *     },
   *   },
   * });
   * ```
   */
  admin?: {
    /**
     * Path prefix for admin endpoints.
     * Prepended to all admin endpoint paths.
     * @default '/admin'
     * @example '/admin' -> /auth/admin/users
     */
    pathPrefix?: string;

    /**
     * Custom admin endpoint overrides.
     * Merged with default admin endpoints.
     */
    endpoints?: Partial<NAuthAdminEndpoints>;

    /**
     * Additional headers specific to admin requests.
     * Merged with main client headers.
     * @example { 'X-Admin-Role': 'super-admin' }
     */
    headers?: Record<string, string>;
  };
}
