import { test as base, APIResponse } from '@playwright/test';

type ParsedCookie = {
  value: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
};

type CookieJar = Map<string, { value: string; domain?: string; path?: string; expires?: Date }>;

type AuthFlowState = {
  userEmail: string;
  userPhone?: string;
  password: string;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  deviceToken?: string;
  challengeSession?: string;
  challengeName?: string;
  mfaSecret?: string;
};

type FlowResult<T> = {
  success: boolean;
  data?: T;
  response?: APIResponse;
  error?: string;
};

type ApiClient = {
  get: (url: string, options?: any) => Promise<APIResponse>;
  post: (url: string, options?: any) => Promise<APIResponse>;
  put: (url: string, options?: any) => Promise<APIResponse>;
  patch: (url: string, options?: any) => Promise<APIResponse>;
  delete: (url: string, options?: any) => Promise<APIResponse>;
  getCookies: () => Record<string, string>;
};

type IPFixture = {
  current: string;
  setIP: (ip: string) => void;
  reset: () => void;
};

type AuthConfig = {
  deliveryMode: 'cookies' | 'json';
  verificationMethod: 'none' | 'email' | 'phone' | 'both';
  mfaEnforcement: 'OPTIONAL' | 'REQUIRED' | 'ADAPTIVE';
  mfaGracePeriod: number;
  expectCookies: () => boolean;
  expectJsonTokens: () => boolean;
  shouldVerifyEmail: () => boolean;
  shouldVerifyPhone: () => boolean;
  shouldRequireMFA: () => boolean;
};

type Flows = {
  signup: (email: string, phone?: string) => Promise<FlowResult<{ challengeName?: string; session?: string }>>;
  login: (email: string, password: string) => Promise<FlowResult<{ challengeName?: string; session?: string }>>;
  completeChallenge: (
    challengeName: string,
    code: string,
  ) => Promise<FlowResult<{ challengeName?: string; session?: string }>>;
  resendCode: () => Promise<FlowResult<{ destination?: string }>>;
  refreshToken: () => Promise<FlowResult<void>>;
  logout: () => Promise<FlowResult<void>>;
  setupMFA: (method: 'TOTP' | 'SMS') => Promise<FlowResult<{ secret?: string }>>;
  verifyMFA: (code: string) => Promise<FlowResult<void>>;
  completeMFASetupChallenge: (code: string) => Promise<FlowResult<{ challengeName?: string; session?: string }>>;
};

type EndpointConfig = {
  signup: string;
  login: string;
  refresh: string;
  logout: string;
  verifyEmail: string;
  verifyPhone: string;
  challenge: string;
  respondChallenge: string;
  completeChallenge: string;
  mfa: {
    setup: string;
    verify: string;
  };
};

type TestFixtures = {
  flowState: AuthFlowState;
  ipAddress: IPFixture;
  endpoints: EndpointConfig;
  authConfig: AuthConfig;
  api: ApiClient;
  mail: { latestCode: (email: string) => Promise<string>; latestLink: (email: string) => Promise<string> };
  sms: { latestCode: (phone: string) => Promise<string> };
  testApi: {
    reset: () => Promise<void>;
    getTotpSecret: (userId: string) => Promise<string>;
  };
  cookies: {
    parseFromHeaders: (headers: Record<string, string | string[]>) => Record<string, ParsedCookie>;
    parseFromResponse: (response: APIResponse) => Record<string, ParsedCookie>;
  };
  flows: Flows;
};

// Shared storage for flow state - persists across serial tests in the same file
// Key: test file path + config name + worker index (for parallel execution isolation)
// Value: AuthFlowState object
// This ensures:
// - "Signup Flow" and "Login Lifecycle" test suites share the same email/password
// - Parallel workers don't interfere (different worker index)
// - Different test configs don't interfere (different config name)
const sharedFlowState = new Map<string, AuthFlowState>();

// Shared storage for cookie jar - persists across serial tests in the same file
// Key: test file path + config name + worker index (for parallel execution isolation)
// Value: CookieJar object
// This ensures cookies persist across tests in the same test suite
const sharedCookieJars = new Map<string, CookieJar>();

export const test = base.extend<TestFixtures>({
  // ============================================================================
  // Flow State - Persists data across sequential tests
  // ============================================================================
  flowState: async ({}, use, testInfo) => {
    // Create unique key: file path + config name + worker index
    // This ensures:
    // - Serial tests in same file share state (same worker, same file, same config)
    // - Parallel workers don't interfere (different worker index)
    // - Different test configs don't interfere (different config name)
    const testFile = testInfo.file || 'unknown';
    const workerIndex = testInfo.workerIndex ?? 0;
    // Get config name from titlePath (e.g., "Current Config: email-phone-json")
    // This ensures each test config gets its own state, and "Signup Flow" and "Login Lifecycle" share state
    const configName = testInfo.titlePath.length > 1 ? testInfo.titlePath[1] : 'default';
    const stateKey = `${testFile}-${configName}-worker${workerIndex}`;

    // Check if we already have state for this key (from previous test in serial suite)
    // This works across different test.describe.serial blocks in the same config
    let state = sharedFlowState.get(stateKey);

    if (!state) {
      // First test with this key - generate unique email and phone once
      // These will be reused by all subsequent tests (Signup Flow + Login Lifecycle) on this worker
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000000000);
      state = {
        userEmail: `test+${timestamp}+${random}@example.com`,
        userPhone: `+1555${Math.floor(Math.random() * 10000000)
          .toString()
          .padStart(7, '0')}`, // E.164 format: +1555XXXXXXX
        password: 'SecurePass123!', // Fixed password - same for all tests in this flow
      };
      // Store for reuse in subsequent tests on this worker (including Login Lifecycle)
      sharedFlowState.set(stateKey, state);
    }

    await use(state);
  },

  // ============================================================================
  // IP Address Simulation
  // ============================================================================
  ipAddress: async ({}, use, testInfo) => {
    // Generate unique IP per test to avoid rate limiting
    // Use worker index and timestamp to ensure uniqueness
    const workerIndex = testInfo.workerIndex ?? 0;
    const timestamp = Date.now();
    // Generate IP in 192.168.x.y format where x = worker index + 1, y = last octet from timestamp
    const lastOctet = (timestamp % 254) + 1; // 1-254 range
    const uniqueIP = `192.168.${workerIndex + 1}.${lastOctet}`;

    let currentIP = uniqueIP;

    const ipFixture: IPFixture = {
      get current() {
        return currentIP;
      },
      setIP: (ip: string) => {
        currentIP = ip;
      },
      reset: () => {
        currentIP = uniqueIP;
      },
    };

    await use(ipFixture);
  },

  // ============================================================================
  // Endpoints - Reads from Playwright project configuration
  // ============================================================================
  endpoints: async ({}, use, testInfo) => {
    // Import endpoints from playwright.config.ts based on project name
    // Using relative path - this works at runtime even if TypeScript complains
    const { PROJECT_ENDPOINTS } = await import('../../playwright.config');
    const projectName = testInfo.project.name as 'cookies' | 'json';
    const endpoints = PROJECT_ENDPOINTS[projectName] || PROJECT_ENDPOINTS.cookies;
    await use(endpoints);
  },

  // ============================================================================
  // Auth Config - Detects delivery mode and provides config helpers
  // ============================================================================
  authConfig: async ({ endpoints }, use, testInfo) => {
    const projectName = testInfo.project.name;
    const deliveryMode: 'cookies' | 'json' = projectName === 'json' ? 'json' : 'cookies';

    // Default config values (can be overridden via test.use())
    const verificationMethod: 'none' | 'email' | 'phone' | 'both' = 'none' as const;
    const mfaEnforcement: 'OPTIONAL' | 'REQUIRED' | 'ADAPTIVE' = 'OPTIONAL' as const;
    const mfaGracePeriod = 7;

    await use({
      deliveryMode,
      verificationMethod,
      mfaEnforcement,
      mfaGracePeriod,
      // Endpoints are configured per project in playwright.config.ts via the endpoints fixture
      expectCookies: () => deliveryMode === 'cookies',
      expectJsonTokens: () => deliveryMode === 'json',
      shouldVerifyEmail: () => {
        const vm: 'none' | 'email' | 'phone' | 'both' = verificationMethod;
        return vm === 'email' || vm === 'both';
      },
      shouldVerifyPhone: () => {
        const vm: 'none' | 'email' | 'phone' | 'both' = verificationMethod;
        return vm === 'phone' || vm === 'both';
      },
      shouldRequireMFA: () => {
        const mfa: 'OPTIONAL' | 'REQUIRED' | 'ADAPTIVE' = mfaEnforcement;
        return mfa === 'REQUIRED' || mfa === 'ADAPTIVE';
      },
    });
  },

  // ============================================================================
  // API Client - Automatic token/cookie management and IP simulation
  // ============================================================================
  api: async ({ request, flowState, authConfig, ipAddress, cookies, baseURL }, use, testInfo) => {
    // Get Origin from project config only (single source of truth)
    const frontendURL = testInfo.project.use?.extraHTTPHeaders?.Origin as string | undefined;

    // Get or create shared cookie jar for this test suite
    // Use test file path + worker index as key to share cookies across serial tests
    const cookieJarKey = `${testInfo.file}:${testInfo.workerIndex}`;
    let cookieJar: CookieJar;
    if (sharedCookieJars.has(cookieJarKey)) {
      cookieJar = sharedCookieJars.get(cookieJarKey)!;
    } else {
      cookieJar = new Map();
      sharedCookieJars.set(cookieJarKey, cookieJar);
    }

    /**
     * Extract domain from URL
     */
    const getDomain = (url: string): string => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname;
      } catch {
        return '';
      }
    };

    /**
     * Extract cookies from response and store in jar
     */
    const storeCookies = (response: APIResponse, url: string): void => {
      const headersArray = response.headersArray();
      const setCookieHeaders = headersArray.filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value);

      for (const cookieHeader of setCookieHeaders) {
        const [nameValue, ...attributes] = cookieHeader.split(';').map((s) => s.trim());
        const equalIndex = nameValue.indexOf('=');

        if (equalIndex === -1) continue;

        const name = nameValue.substring(0, equalIndex);
        const value = nameValue.substring(equalIndex + 1);

        const cookie: { value: string; domain?: string; path?: string; expires?: Date } = {
          value,
          path: '/', // Default path
          // Don't set domain from URL - only use domain from Set-Cookie header if present
        };

        // Parse attributes - handle values that may contain '=' signs
        for (const attr of attributes) {
          const lowerAttr = attr.toLowerCase();
          if (lowerAttr.startsWith('domain=')) {
            // Domain from Set-Cookie header (e.g., ".angular.dev1.noorix.com")
            // Use indexOf to find first '=' and take everything after it
            const domainValue = attr.substring(attr.indexOf('=') + 1).trim();
            cookie.domain = domainValue;
          } else if (lowerAttr.startsWith('path=')) {
            // Path from Set-Cookie header
            const pathValue = attr.substring(attr.indexOf('=') + 1).trim();
            cookie.path = pathValue;
          } else if (lowerAttr.startsWith('expires=')) {
            const expiresValue = attr.substring(attr.indexOf('=') + 1).trim();
            cookie.expires = new Date(expiresValue);
          } else if (lowerAttr.startsWith('max-age=')) {
            const maxAgeValue = attr.substring(attr.indexOf('=') + 1).trim();
            const maxAge = parseInt(maxAgeValue, 10);
            if (!isNaN(maxAge)) {
              cookie.expires = new Date(Date.now() + maxAge * 1000);
            }
          }
        }

        // Store cookie (expiration check happens in buildCookieHeader)
        cookieJar.set(name, cookie);

        // Extract device token from cookie if present
        if (name === 'nauth_device_id' && authConfig.expectJsonTokens()) {
          flowState.deviceToken = value;
        }
      }
    };

    /**
     * Build Cookie header from jar for a given URL
     * Simple browser-like behavior: send all non-expired cookies
     */
    const buildCookieHeader = (url: string): string => {
      const cookieStrings: string[] = [];

      for (const [name, cookie] of cookieJar.entries()) {
        // Check expiration - remove expired cookies
        if (cookie.expires && cookie.expires < new Date()) {
          cookieJar.delete(name);
          continue;
        }

        // Send all non-expired cookies (browser behavior)
        cookieStrings.push(`${name}=${cookie.value}`);
      }

      return cookieStrings.join('; ');
    };

    /**
     * Get CSRF token from cookie jar for cookie-based token delivery
     * Returns undefined if token not found or expired
     */
    const getCsrfToken = (): string | undefined => {
      if (!authConfig.expectCookies()) {
        return undefined;
      }
      const csrfCookie = cookieJar.get('nauth_csrf_token');
      if (csrfCookie && (!csrfCookie.expires || csrfCookie.expires >= new Date())) {
        return csrfCookie.value;
      }
      return undefined;
    };

    /**
     * Extract tokens from response based on delivery mode
     */
    const extractTokens = async (response: APIResponse): Promise<void> => {
      // Extract from cookies (cookie mode)
      if (authConfig.expectCookies()) {
        const parsedCookies = cookies.parseFromResponse(response);
        if (parsedCookies['nauth_device_id']) {
          flowState.deviceToken = parsedCookies['nauth_device_id'].value;
        }
      }

      // Extract from JSON body (json mode)
      if (authConfig.expectJsonTokens()) {
        try {
          const body = await response.json();
          if (body.accessToken) {
            flowState.accessToken = body.accessToken;
          }
          if (body.refreshToken) {
            flowState.refreshToken = body.refreshToken;
          }
          if (body.deviceToken) {
            flowState.deviceToken = body.deviceToken;
          }
        } catch {
          // Response might not be JSON
        }
      }
    };

    /**
     * API client that automatically manages tokens, cookies, and IP
     */
    const apiClient: ApiClient = {
      get: async (url: string, options?: any) => {
        const cookieHeader = buildCookieHeader(url);
        const authHeader =
          flowState.accessToken && authConfig.expectJsonTokens() ? `Bearer ${flowState.accessToken}` : undefined;

        const headers: Record<string, string> = {
          'X-Forwarded-For': ipAddress.current,
        };

        // Only add Origin if configured in project
        if (frontendURL) {
          headers.Origin = frontendURL;
        }

        if (cookieHeader) {
          headers.Cookie = cookieHeader;
        }

        if (authHeader) {
          headers.Authorization = authHeader;
        }

        const response = await request.get(url, {
          ...options,
          headers: {
            ...headers,
            ...(options?.headers || {}),
          },
        });

        storeCookies(response, url);
        await extractTokens(response);

        return response;
      },

      post: async (url: string, options?: any) => {
        const cookieHeader = buildCookieHeader(url);
        const authHeader =
          flowState.accessToken && authConfig.expectJsonTokens() ? `Bearer ${flowState.accessToken}` : undefined;
        const deviceTokenHeader =
          flowState.deviceToken && authConfig.expectJsonTokens() ? flowState.deviceToken : undefined;

        const isAuthEndpoint = url.includes('/login') || url.includes('/signup') || url.includes('/refresh');

        const headers: Record<string, string> = {
          'X-Forwarded-For': ipAddress.current,
        };

        // Only add Origin if configured in project
        if (frontendURL) {
          headers.Origin = frontendURL;
        }

        if (cookieHeader) {
          headers.Cookie = cookieHeader;
        }

        // Add CSRF token header for cookie-based token delivery (required for state-changing requests)
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers['x-csrf-token'] = csrfToken;
        }

        // Add Authorization header for JSON mode (except auth endpoints)
        if (authHeader && !isAuthEndpoint) {
          headers.Authorization = authHeader;
        }

        // Add X-Device-Token header for JSON mode (on login/signup)
        if (deviceTokenHeader && (url.includes('/login') || url.includes('/signup'))) {
          headers['X-Device-Token'] = deviceTokenHeader;
        }

        const response = await request.post(url, {
          ...options,
          headers: {
            ...headers,
            ...(options?.headers || {}),
          },
        });

        storeCookies(response, url);
        await extractTokens(response);

        return response;
      },

      put: async (url: string, options?: any) => {
        const cookieHeader = buildCookieHeader(url);
        const authHeader =
          flowState.accessToken && authConfig.expectJsonTokens() ? `Bearer ${flowState.accessToken}` : undefined;

        const headers: Record<string, string> = {
          'X-Forwarded-For': ipAddress.current,
        };

        // Only add Origin if configured in project
        if (frontendURL) {
          headers.Origin = frontendURL;
        }

        if (cookieHeader) {
          headers.Cookie = cookieHeader;
        }

        // Add CSRF token header for cookie-based token delivery
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers['x-csrf-token'] = csrfToken;
        }

        if (authHeader) {
          headers.Authorization = authHeader;
        }

        const response = await request.put(url, {
          ...options,
          headers: {
            ...headers,
            ...(options?.headers || {}),
          },
        });

        storeCookies(response, url);
        await extractTokens(response);

        return response;
      },

      patch: async (url: string, options?: any) => {
        const cookieHeader = buildCookieHeader(url);
        const authHeader =
          flowState.accessToken && authConfig.expectJsonTokens() ? `Bearer ${flowState.accessToken}` : undefined;

        const headers: Record<string, string> = {
          'X-Forwarded-For': ipAddress.current,
        };

        // Only add Origin if configured in project
        if (frontendURL) {
          headers.Origin = frontendURL;
        }

        if (cookieHeader) {
          headers.Cookie = cookieHeader;
        }

        // Add CSRF token header for cookie-based token delivery
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers['x-csrf-token'] = csrfToken;
        }

        if (authHeader) {
          headers.Authorization = authHeader;
        }

        const response = await request.patch(url, {
          ...options,
          headers: {
            ...headers,
            ...(options?.headers || {}),
          },
        });

        storeCookies(response, url);
        await extractTokens(response);

        return response;
      },

      delete: async (url: string, options?: any) => {
        const cookieHeader = buildCookieHeader(url);
        const authHeader =
          flowState.accessToken && authConfig.expectJsonTokens() ? `Bearer ${flowState.accessToken}` : undefined;

        const headers: Record<string, string> = {
          'X-Forwarded-For': ipAddress.current,
        };

        // Only add Origin if configured in project
        if (frontendURL) {
          headers.Origin = frontendURL;
        }

        if (cookieHeader) {
          headers.Cookie = cookieHeader;
        }

        // Add CSRF token header for cookie-based token delivery
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers['x-csrf-token'] = csrfToken;
        }

        if (authHeader) {
          headers.Authorization = authHeader;
        }

        const response = await request.delete(url, {
          ...options,
          headers: {
            ...headers,
            ...(options?.headers || {}),
          },
        });

        storeCookies(response, url);
        await extractTokens(response);

        return response;
      },

      /**
       * Get current cookies (for debugging/validation)
       */
      getCookies: (): Record<string, string> => {
        const result: Record<string, string> = {};
        for (const [name, cookie] of cookieJar.entries()) {
          if (!cookie.expires || cookie.expires >= new Date()) {
            result[name] = cookie.value;
          }
        }
        return result;
      },
    };

    await use(apiClient);
  },

  // ============================================================================
  // Flow Helpers - Reusable authentication flow functions
  // ============================================================================
  flows: async ({ api, flowState, authConfig, endpoints, baseURL }, use) => {
    const flows: Flows = {
      /**
       * Signup with email and optional phone
       * Returns result - test should use expect() to validate
       */
      signup: async (
        email: string,
        phone?: string,
      ): Promise<FlowResult<{ challengeName?: string; session?: string }>> => {
        flowState.userEmail = email;
        if (phone) flowState.userPhone = phone;

        const endpoint = `${baseURL}${endpoints.signup}`;
        const response = await api.post(endpoint, {
          data: {
            email,
            phone,
            password: flowState.password,
          },
        });

        // Extract challenge if present
        let body: any = {};
        try {
          body = await response.json();
        } catch {
          // Response might not be JSON
        }

        if (body.challengeName) {
          flowState.challengeName = body.challengeName;
          flowState.challengeSession = body.session;
        }

        if (body.user?.id) {
          flowState.userId = body.user.id;
        }

        const success = response.status() === 201;
        if (!success) {
          // Log error for debugging
          console.error(`Signup failed: status=${response.status()}, body=`, body);
        }
        return {
          success,
          data: {
            challengeName: body.challengeName,
            session: body.session,
          },
          response,
          error: success ? undefined : body.message || body.error || `HTTP ${response.status()}`,
        };
      },

      /**
       * Login with credentials
       * Returns result - test should use expect() to validate
       */
      login: async (
        email: string,
        password: string,
      ): Promise<FlowResult<{ challengeName?: string; session?: string }>> => {
        const endpoint = `${baseURL}${endpoints.login}`;
        const response = await api.post(endpoint, {
          data: { identifier: email, password },
        });

        // Extract challenge if present
        let body: any = {};
        try {
          body = await response.json();
        } catch {
          // Response might not be JSON
        }

        if (body.challengeName) {
          flowState.challengeName = body.challengeName;
          flowState.challengeSession = body.session;
        }

        const success = response.status() === 200 || response.status() === 201;
        if (!success) {
          // Log error for debugging
          console.error(`Login failed: status=${response.status()}, body=`, body);
        }
        return {
          success,
          data: {
            challengeName: body.challengeName,
            session: body.session,
          },
          response,
          error: success ? undefined : body.message || body.error || `HTTP ${response.status()}`,
        };
      },

      /**
       * Complete a challenge (email/phone verification, MFA, etc.)
       * Uses unified respondToChallenge API endpoint
       * Returns result - test should use expect() to validate
       */
      completeChallenge: async (
        challengeName: string,
        code: string,
      ): Promise<FlowResult<{ challengeName?: string; session?: string }>> => {
        // Ensure we have a challenge session from previous step (signup/login)
        if (!flowState.challengeSession) {
          return {
            success: false,
            error: 'No challenge session available',
          };
        }

        // Use unified respondToChallenge endpoint
        // Single endpoint handles all challenge types via discriminated union
        let requestData: any = {
          session: flowState.challengeSession,
          type: challengeName,
        };

        // Add challenge-specific data
        if (challengeName === 'VERIFY_EMAIL') {
          requestData.code = code;
        } else if (challengeName === 'VERIFY_PHONE') {
          requestData.code = code;
        } else if (challengeName === 'MFA_REQUIRED') {
          // For MFA, need method and code
          requestData.method = 'sms'; // Default to SMS for now
          requestData.code = code;
        }

        const response = await api.post(`${baseURL}/auth/respond-challenge`, {
          data: requestData,
        });

        // Parse response and update flow state
        let body: any = {};
        try {
          body = await response.json();
        } catch {
          // Response might not be JSON
        }

        // Update flow state: if more challenges remain, store next challenge info
        // Otherwise clear challenge state (all challenges complete, tokens should be available)
        if (body.challengeName) {
          // More challenges remain - update session for next step
          flowState.challengeName = body.challengeName;
          flowState.challengeSession = body.session;
        } else {
          // All challenges complete - clear challenge state
          flowState.challengeName = undefined;
          flowState.challengeSession = undefined;
        }

        const success = response.status() === 200 || response.status() === 201;
        if (!success) {
          // Log error for debugging
          console.error(`Challenge completion failed: status=${response.status()}, body=`, body);
        }
        return {
          success,
          data: {
            challengeName: body.challengeName,
            session: body.session,
          },
          response,
          error: success ? undefined : body.message || body.error || `HTTP ${response.status()}`,
        };
      },

      /**
       * Refresh access token
       * Returns result - test should use expect() to validate
       */
      refreshToken: async (): Promise<FlowResult<void>> => {
        // For cookie mode, refresh token is in cookie automatically (handled by api fixture)
        // For JSON mode, need refreshToken in flowState
        if (!authConfig.expectCookies() && !flowState.refreshToken) {
          return {
            success: false,
            error: 'No refresh token available',
          };
        }

        const endpoint = `${baseURL}${endpoints.refresh}`;

        // For JSON mode, send refreshToken in body
        // For cookie mode, refresh token is in cookie (automatically sent by api fixture)
        // Note: extractTokens is called automatically by api.post, so tokens are already extracted
        const response = await api.post(
          endpoint,
          authConfig.expectJsonTokens() && !authConfig.expectCookies() && flowState.refreshToken
            ? { data: { refreshToken: flowState.refreshToken } }
            : {},
        );

        const success = response.status() === 200;
        if (!success) {
          // Log error for debugging
          try {
            const errorBody = await response.json();
            console.error(`Refresh token failed: status=${response.status()}, body=`, errorBody);
          } catch {
            console.error(`Refresh token failed: status=${response.status()}, no body`);
          }
        }

        return {
          success,
          response,
          error: success ? undefined : `HTTP ${response.status()}`,
        };
      },

      /**
       * Resend verification code
       * Returns result - test should use expect() to validate
       */
      resendCode: async (): Promise<FlowResult<{ destination?: string }>> => {
        const endpoint = `${baseURL}/auth/challenge/resend`;

        if (!flowState.challengeSession) {
          return {
            success: false,
            error: 'No active challenge session',
          };
        }

        let response = await api.post(endpoint, {
          data: {
            session: flowState.challengeSession,
          },
        });

        let success = response.status() === 200;
        let body: any = {};
        try {
          body = await response.json();
        } catch {
          // Response might not be JSON
        }

        // Handle rate limit errors by waiting and retrying once
        if (!success && body.code === 'RATE_LIMIT_RESEND' && body.details?.retryAfter) {
          const waitMs = (body.details.retryAfter + 0.1) * 1000; // Add 100ms buffer
          console.log(`Resend rate limited, waiting ${waitMs}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));

          // Retry once
          response = await api.post(endpoint, {
            data: {
              session: flowState.challengeSession,
            },
          });

          success = response.status() === 200;
          try {
            body = await response.json();
          } catch {
            // Response might not be JSON
          }
        }

        if (!success) {
          console.error(`Resend code failed: status=${response.status()}, body=`, JSON.stringify(body, null, 2));
          console.error(`Resend request was: session=${flowState.challengeSession}`);
        } else {
          console.log(`Resend code succeeded: destination=${body.destination}`);
        }

        return {
          success,
          response,
          data: body,
          error: success ? undefined : `HTTP ${response.status()}`,
        };
      },

      /**
       * Logout
       * Returns result - test should use expect() to validate
       */
      logout: async (): Promise<FlowResult<void>> => {
        const endpoint = `${baseURL}/auth/logout`;

        // Tokens/cookies are automatically sent by api fixture
        // Logout is now a GET request
        const response = await api.get(endpoint);

        const success = response.status() === 200;
        if (!success) {
          // Log error for debugging
          try {
            const errorBody = await response.json();
            console.error(`Logout failed: status=${response.status()}, body=`, errorBody);
          } catch {
            console.error(`Logout failed: status=${response.status()}, no body`);
          }
        }

        return {
          success,
          response,
          error: success ? undefined : `HTTP ${response.status()}`,
        };
      },

      /**
       * Setup MFA (TOTP or SMS)
       * Returns result - test should use expect() to validate
       */
      setupMFA: async (method: 'TOTP' | 'SMS'): Promise<FlowResult<{ secret?: string }>> => {
        if (!flowState.userId && !flowState.accessToken) {
          return {
            success: false,
            error: 'User ID or access token not available',
          };
        }

        const response = await api.post(`${baseURL}/auth/mfa/setup`, {
          data: { method },
        });

        let body: any = {};
        try {
          body = await response.json();
        } catch {
          // Response might not be JSON
        }

        if (body.secret) {
          flowState.mfaSecret = body.secret;
        }

        return {
          success: response.status() === 200 || response.status() === 201,
          data: { secret: body.secret },
          response,
        };
      },

      /**
       * Verify MFA code using unified challenge API
       * Returns result - test should use expect() to validate
       */
      verifyMFA: async (code: string): Promise<FlowResult<void>> => {
        // Ensure we have a challenge session from previous step (login)
        if (!flowState.challengeSession) {
          return {
            success: false,
            error: 'No challenge session available',
          };
        }

        // Use unified respondToChallenge endpoint
        const response = await api.post(`${baseURL}/auth/respond-challenge`, {
          data: {
            session: flowState.challengeSession,
            type: 'MFA_REQUIRED',
            method: 'sms',
            code,
          },
        });

        // Parse response and update flow state
        let body: any = {};
        try {
          body = await response.json();
        } catch {
          // Response might not be JSON
        }

        // Update flow state: if more challenges remain, store next challenge info
        // Otherwise clear challenge state (all challenges complete, tokens should be available)
        if (body.challengeName) {
          // More challenges remain - update session for next step
          flowState.challengeName = body.challengeName;
          flowState.challengeSession = body.session;
        } else {
          // All challenges complete - clear challenge state
          flowState.challengeName = undefined;
          flowState.challengeSession = undefined;
        }

        const success = response.status() === 200 || response.status() === 201;
        if (!success) {
          // Log error for debugging
          console.error(`MFA verification failed: status=${response.status()}, body=`, body);
        }
        return {
          success,
          response,
          error: success ? undefined : body.message || body.error || `HTTP ${response.status()}`,
        };
      },

      /**
       * Complete MFA setup challenge (for MFA_SETUP_REQUIRED)
       * Uses unified respondToChallenge API with MFA setup data
       * Returns result - test should use expect() to validate
       */
      completeMFASetupChallenge: async (
        code: string,
      ): Promise<FlowResult<{ challengeName?: string; session?: string }>> => {
        // Ensure we have a challenge session
        if (!flowState.challengeSession) {
          return {
            success: false,
            error: 'No challenge session available',
          };
        }

        // Step 1: Get setup data if needed (for SMS, this triggers sending the code)
        // This is optional - only needed if we want to explicitly request the setup SMS
        const setupDataResponse = await api.post(`${baseURL}/auth/challenge/setup-data`, {
          data: {
            session: flowState.challengeSession,
            method: 'sms',
            setupData: {
              phoneNumber: flowState.userPhone,
            },
          },
        });

        if (setupDataResponse.status() !== 200) {
          const errorBody = await setupDataResponse.json().catch(() => ({}));
          return {
            success: false,
            error: errorBody.message || `MFA setup data failed: ${setupDataResponse.status()}`,
            response: setupDataResponse,
          };
        }

        // Parse response - GetSetupDataResponseDTO wraps result in setupData
        const setupDataBody = await setupDataResponse.json().catch(() => ({}));
        const setupResult = setupDataBody.setupData || setupDataBody;

        // If phone already verified, autoCompleted will be true and we can skip code verification
        if (setupResult.autoCompleted) {
          // MFA setup was auto-completed, no code needed
          return {
            success: true,
            data: { autoCompleted: true, deviceId: setupResult.deviceId },
            response: setupDataResponse,
          };
        }

        // Step 2: Use unified respondToChallenge endpoint with MFA_SETUP_REQUIRED
        const response = await api.post(`${baseURL}/auth/respond-challenge`, {
          data: {
            session: flowState.challengeSession,
            type: 'MFA_SETUP_REQUIRED',
            method: 'sms',
            setupData: {
              code,
            },
          },
        });

        // Step 3: Parse response and update flow state
        let body: any = {};
        try {
          body = await response.json();
        } catch {
          // Response might not be JSON
        }

        // Update flow state
        if (body.challengeName) {
          flowState.challengeName = body.challengeName;
          flowState.challengeSession = body.session;
        } else {
          flowState.challengeName = undefined;
          flowState.challengeSession = undefined;
        }

        const success = response.status() === 200 || response.status() === 201;
        if (!success) {
          console.error(`MFA setup challenge completion failed: status=${response.status()}, body=`, body);
        }
        return {
          success,
          data: {
            challengeName: body.challengeName,
            session: body.session,
          },
          response,
          error: success ? undefined : body.message || body.error || `HTTP ${response.status()}`,
        };
      },
    };

    await use(flows);
  },

  // ============================================================================
  // Mail Fixture
  // ============================================================================
  mail: async ({ baseURL }, use) => {
    await use({
      latestCode: async (sessionId: string) => {
        // Retry logic: Email codes are sent asynchronously, so we need to poll
        const maxRetries = 10; // Increased retries
        const retryDelay = 500; // 500ms between retries
        // Initial delay: wait for email/sms to fire and forget trigger to complete
        // Email sending involves database writes which may take longer
        // Increased delay to account for async email sending in challenge creation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const url = `${baseURL}/test/code/latest?sessionId=${encodeURIComponent(sessionId)}`;
            const r = await fetch(url);
            if (r.ok) {
              const j = (await r.json()) as { code?: string };
              if (j.code) {
                return j.code;
              }
            }
          } catch {
            // Continue to next retry
          }

          // Wait before next retry (except on last attempt)
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }
        }

        return ''; // Return empty if code not found after all retries
      },
      latestLink: async (_sessionId: string) => {
        // Link extraction not available via test endpoint - would need to parse email body
        // For now, return empty string as links are typically not needed for E2E tests
        return '';
      },
    });
  },

  // ============================================================================
  // SMS Fixture
  // ============================================================================
  sms: async ({ baseURL }, use) => {
    await use({
      latestCode: async (sessionId: string) => {
        // Retry logic: SMS codes are sent asynchronously, so we need to poll
        const maxRetries = 10; // Increased retries
        const retryDelay = 500; // 500ms between retries
        // Initial delay: wait for email/sms to fire and forget trigger to complete
        // SMS sending involves database writes which may take longer
        // Increased delay to account for async SMS sending in challenge creation
        await new Promise((resolve) => setTimeout(resolve, 2000));
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const r = await fetch(`${baseURL}/test/code/latest?sessionId=${encodeURIComponent(sessionId)}`);
            if (r.ok) {
              const j = (await r.json()) as { code?: string };
              if (j.code) {
                return j.code;
              }
            }
          } catch {
            // Continue to next retry
          }

          // Wait before next retry (except on last attempt)
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }
        }

        return ''; // Return empty if code not found after all retries
      },
    });
  },

  // ============================================================================
  // Test API Fixture
  // ============================================================================
  testApi: async ({ baseURL }, use) => {
    await use({
      reset: async () => {
        await fetch(`${baseURL}/test/reset`, { method: 'POST' });
      },
      getTotpSecret: async (userId: string) => {
        const r = await fetch(`${baseURL}/test/totp/secret?userId=${userId}`);
        const j = (await r.json()) as { secret: string };
        return j.secret;
      },
    });
  },

  // ============================================================================
  // Cookies Fixture
  // ============================================================================
  cookies: async ({}, use) => {
    /**
     * Parse cookies from response headers
     * @param headers - Response headers object
     * @returns Parsed cookies as a record keyed by cookie name
     */
    const parseFromHeaders = (headers: Record<string, string | string[]>): Record<string, ParsedCookie> => {
      const cookies: Record<string, ParsedCookie> = {};

      // Collect all Set-Cookie headers (case-insensitive lookup)
      // Playwright may return headers with different casing or as separate entries
      const setCookieHeaders: string[] = [];

      // Check common variations of Set-Cookie header name
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === 'set-cookie') {
          if (Array.isArray(value)) {
            setCookieHeaders.push(...value);
          } else {
            setCookieHeaders.push(value);
          }
        }
      }

      // Parse each Set-Cookie header
      for (const cookieHeader of setCookieHeaders) {
        if (!cookieHeader || typeof cookieHeader !== 'string') {
          continue;
        }

        const [nameValue, ...attributes] = cookieHeader.split(';').map((s) => s.trim());
        const equalIndex = nameValue.indexOf('=');

        if (equalIndex === -1) {
          // Invalid cookie format - skip
          continue;
        }

        const name = nameValue.substring(0, equalIndex);
        const value = nameValue.substring(equalIndex + 1);
        const cookie: ParsedCookie = { value };

        for (const attr of attributes) {
          const lowerAttr = attr.toLowerCase();
          if (lowerAttr === 'httponly') {
            cookie.httpOnly = true;
          } else if (lowerAttr.startsWith('secure')) {
            cookie.secure = true;
          } else if (lowerAttr.startsWith('samesite=')) {
            cookie.sameSite = attr.split('=')[1].toLowerCase();
          } else if (lowerAttr.startsWith('path=')) {
            cookie.path = attr.split('=')[1];
          } else if (lowerAttr.startsWith('domain=')) {
            cookie.domain = attr.split('=')[1];
          } else if (lowerAttr.startsWith('max-age=')) {
            cookie.maxAge = parseInt(attr.split('=')[1], 10);
          } else if (lowerAttr.startsWith('expires=')) {
            cookie.expires = new Date(attr.split('=')[1]);
          }
        }

        cookies[name] = cookie;
      }

      return cookies;
    };

    await use({
      parseFromHeaders,

      /**
       * Parse cookies from Playwright APIResponse
       * @param response - Playwright APIResponse object
       * @returns Parsed cookies as a record keyed by cookie name
       */
      parseFromResponse: (response: APIResponse): Record<string, ParsedCookie> => {
        // Use headersArray() to get all headers including duplicates
        // This is the most reliable way to get multiple Set-Cookie headers
        const headersArray = response.headersArray();
        const setCookieHeaders = headersArray.filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value);

        const cookies: Record<string, ParsedCookie> = {};
        for (const cookieHeader of setCookieHeaders) {
          const [nameValue, ...attributes] = cookieHeader.split(';').map((s) => s.trim());
          const equalIndex = nameValue.indexOf('=');

          if (equalIndex === -1) {
            continue;
          }

          const name = nameValue.substring(0, equalIndex);
          const value = nameValue.substring(equalIndex + 1);
          const cookie: ParsedCookie = { value };

          for (const attr of attributes) {
            const lowerAttr = attr.toLowerCase();
            if (lowerAttr === 'httponly') {
              cookie.httpOnly = true;
            } else if (lowerAttr.startsWith('secure')) {
              cookie.secure = true;
            } else if (lowerAttr.startsWith('samesite=')) {
              cookie.sameSite = attr.split('=')[1].toLowerCase();
            } else if (lowerAttr.startsWith('path=')) {
              cookie.path = attr.split('=')[1];
            } else if (lowerAttr.startsWith('domain=')) {
              cookie.domain = attr.split('=')[1];
            } else if (lowerAttr.startsWith('max-age=')) {
              cookie.maxAge = parseInt(attr.split('=')[1], 10);
            } else if (lowerAttr.startsWith('expires=')) {
              cookie.expires = new Date(attr.split('=')[1]);
            }
          }

          cookies[name] = cookie;
        }

        return cookies;
      },
    });
  },
});

export const expect = test.expect;
