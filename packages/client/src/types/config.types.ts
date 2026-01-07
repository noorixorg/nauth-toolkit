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
  requestPasswordChange: string;
  forgotPassword: string;
  confirmForgotPassword: string;
  mfaStatus: string;
  mfaDevices: string;
  mfaSetupData: string;
  mfaVerifySetup: string;
  mfaRemove: string;
  mfaPreferred: string;
  mfaBackupCodes: string;
  mfaExemption: string;
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
   * Redirect URLs for various authentication scenarios.
   * Used by guards and interceptors to handle routing in a platform-agnostic way.
   */
  redirects?: {
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
  };

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
}
