import { AdminOperations } from './admin-operations';
import { ResolvedNAuthClientConfig } from './config';
import { HttpAdapter, HttpRequest, HttpResponse } from './http-adapter';
import { NAuthStorageAdapter } from '../types/config.types';
import { NAuthClientError } from './errors';
import { NAuthErrorCode } from '../types/error.types';

/**
 * Mock storage adapter for testing
 */
class MockStorage implements NAuthStorageAdapter {
  private data = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key);
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

/**
 * Mock HTTP adapter for testing
 */
class MockHttpAdapter implements HttpAdapter {
  private requests: HttpRequest[] = [];
  private response: HttpResponse<unknown> = {
    data: {},
    status: 200,
    headers: {},
  };

  /**
   * Set mock response
   */
  setResponse<T>(data: T, status = 200): void {
    this.response = { data, status, headers: {} };
  }

  /**
   * Get captured requests
   */
  getRequests(): HttpRequest[] {
    return this.requests;
  }

  /**
   * Clear captured requests
   */
  clearRequests(): void {
    this.requests = [];
  }

  async request<T>(config: HttpRequest): Promise<HttpResponse<T>> {
    this.requests.push(config);
    return this.response as HttpResponse<T>;
  }
}

/**
 * Create resolved config for testing
 */
const createTestConfig = (
  overrides?: Partial<ResolvedNAuthClientConfig>,
): ResolvedNAuthClientConfig => {
  const storage = new MockStorage();
  const httpAdapter = new MockHttpAdapter();

  return {
    baseUrl: 'https://api.example.com',
    authPathPrefix: '/auth',
    tokenDelivery: 'cookies',
    storage,
    httpAdapter,
    csrf: {
      cookieName: 'nauth_csrf_token',
      headerName: 'x-csrf-token',
    },
    deviceTrust: {
      headerName: 'X-Device-Token',
      storageKey: 'nauth_device_token',
    },
    headers: {},
    timeout: 30000,
    endpoints: {
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
      confirmAdminResetPassword: '/admin/reset-password/confirm',
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
    },
    admin: {
      pathPrefix: '/admin',
      endpoints: {
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
      },
      headers: {},
    },
    ...overrides,
  };
};

describe('AdminOperations', () => {
  let config: ResolvedNAuthClientConfig;
  let adminOps: AdminOperations;
  let httpAdapter: MockHttpAdapter;

  beforeEach(() => {
    config = createTestConfig();
    adminOps = new AdminOperations(config);
    httpAdapter = config.httpAdapter as MockHttpAdapter;
    httpAdapter.clearRequests();
  });

  describe('Constructor', () => {
    it('should throw error if admin config is missing', () => {
      const configWithoutAdmin = createTestConfig();
      delete (configWithoutAdmin as { admin?: unknown }).admin;

      expect(() => new AdminOperations(configWithoutAdmin)).toThrow(
        'Admin operations require admin configuration',
      );
    });

    it('should initialize with admin config', () => {
      expect(adminOps).toBeDefined();
    });
  });

  describe('buildAdminUrl', () => {
    it('should build URL with path parameter replacement', async () => {
      httpAdapter.setResponse({ sub: 'test-uuid', email: 'test@example.com' });

      await adminOps.getUser('test-uuid');

      const requests = httpAdapter.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].url).toBe('https://api.example.com/auth/admin/users/test-uuid');
    });

    it('should apply admin path prefix', async () => {
      httpAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await adminOps.getUsers();

      const requests = httpAdapter.getRequests();
      expect(requests[0].url).toContain('/admin/users');
    });

    it('should apply auth path prefix if configured', async () => {
      httpAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await adminOps.getUsers();

      const requests = httpAdapter.getRequests();
      expect(requests[0].url).toContain('/auth/admin/users');
    });

    it('should handle custom admin path prefix', async () => {
      const customConfig = createTestConfig({
        admin: {
          pathPrefix: '/admin/v2',
          endpoints: config.admin!.endpoints,
          headers: {},
        },
      });
      const customAdminOps = new AdminOperations(customConfig);
      const customAdapter = customConfig.httpAdapter as MockHttpAdapter;
      customAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await customAdminOps.getUsers();

      const requests = customAdapter.getRequests();
      expect(requests[0].url).toContain('/admin/v2/users');
    });
  });

  describe('buildQueryString', () => {
    it('should build query string from simple params', async () => {
      httpAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await adminOps.getUsers({ page: 1, limit: 20, isEmailVerified: true });

      const requests = httpAdapter.getRequests();
      const url = requests[0].url;
      expect(url).toContain('page=1');
      expect(url).toContain('limit=20');
      expect(url).toContain('isEmailVerified=true');
    });

    it('should handle nested date filters', async () => {
      httpAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      const testDate = new Date('2024-01-01');
      await adminOps.getUsers({
        createdAt: {
          operator: 'gte',
          value: testDate,
        },
      });

      const requests = httpAdapter.getRequests();
      const url = requests[0].url;
      // URLSearchParams encodes brackets, so check for encoded version
      expect(url).toContain('createdAt%5Boperator%5D=gte');
      expect(url).toContain('createdAt%5Bvalue%5D=');
    });

    it('should handle arrays in query params', async () => {
      httpAdapter.setResponse({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });

      await adminOps.getAuditHistory({
        sub: 'test-uuid',
        eventType: 'LOGIN_SUCCESS',
      });

      const requests = httpAdapter.getRequests();
      expect(requests[0].url).toContain('sub=test-uuid');
      expect(requests[0].url).toContain('eventType=LOGIN_SUCCESS');
    });
  });

  describe('User Management', () => {
    it('should create user', async () => {
      const mockResponse = {
        user: {
          sub: 'new-uuid',
          email: 'new@example.com',
          isEmailVerified: true,
          isPhoneVerified: false,
          isActive: true,
          mfaEnabled: false,
          hasPasswordHash: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.createUser({
        email: 'new@example.com',
        password: 'SecurePass123!',
        isEmailVerified: true,
      });

      expect(result.user.email).toBe('new@example.com');
      const requests = httpAdapter.getRequests();
      expect(requests[0].method).toBe('POST');
      expect(requests[0].url).toBe('https://api.example.com/auth/admin/signup');
    });

    it('should get users with filters', async () => {
      const mockResponse = {
        users: [
          {
            sub: 'uuid-1',
            email: 'user1@example.com',
            isEmailVerified: true,
            isPhoneVerified: false,
            isActive: true,
            mfaEnabled: false,
            hasPasswordHash: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.getUsers({ page: 1, limit: 20, mfaEnabled: false });

      expect(result.users).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      const requests = httpAdapter.getRequests();
      expect(requests[0].method).toBe('GET');
      expect(requests[0].url).toContain('mfaEnabled=false');
    });

    it('should get user by sub', async () => {
      const mockResponse = {
        sub: 'test-uuid',
        email: 'test@example.com',
        isEmailVerified: true,
        isPhoneVerified: false,
        isActive: true,
        mfaEnabled: false,
        hasPasswordHash: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.getUser('test-uuid');

      expect(result.email).toBe('test@example.com');
      const requests = httpAdapter.getRequests();
      expect(requests[0].url).toContain('test-uuid');
    });

    it('should delete user', async () => {
      const mockResponse = {
        success: true,
        deletedUserId: 'test-uuid',
        deletedRecords: {
          sessions: 5,
          verificationTokens: 2,
          mfaDevices: 1,
          trustedDevices: 0,
          socialAccounts: 0,
          loginAttempts: 10,
          challengeSessions: 0,
          auditLogs: 50,
        },
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.deleteUser('test-uuid');

      expect(result.success).toBe(true);
      expect(result.deletedRecords.sessions).toBe(5);
      const requests = httpAdapter.getRequests();
      expect(requests[0].method).toBe('DELETE');
      expect(requests[0].url).toContain('test-uuid');
    });

    it('should disable user', async () => {
      const mockResponse = {
        success: true,
        user: {
          sub: 'test-uuid',
          email: 'test@example.com',
          isEmailVerified: true,
          isPhoneVerified: false,
          isActive: false,
          isLocked: true,
          mfaEnabled: false,
          hasPasswordHash: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        revokedSessions: 3,
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.disableUser('test-uuid', 'Account compromised');

      expect(result.success).toBe(true);
      expect(result.revokedSessions).toBe(3);
      const requests = httpAdapter.getRequests();
      expect(requests[0].method).toBe('POST');
      expect(requests[0].body).toEqual({ reason: 'Account compromised' });
    });

    it('should enable user', async () => {
      const mockResponse = {
        success: true,
        user: {
          sub: 'test-uuid',
          email: 'test@example.com',
          isEmailVerified: true,
          isPhoneVerified: false,
          isActive: true,
          isLocked: false,
          mfaEnabled: false,
          hasPasswordHash: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.enableUser('test-uuid');

      expect(result.success).toBe(true);
      expect(result.user.isLocked).toBe(false);
    });

    it('should force password change', async () => {
      httpAdapter.setResponse({ success: true });

      const result = await adminOps.forcePasswordChange('test-uuid');

      expect(result.success).toBe(true);
      const requests = httpAdapter.getRequests();
      expect(requests[0].url).toContain('force-password-change');
    });
  });

  describe('Password Management', () => {
    it('should set password', async () => {
      httpAdapter.setResponse({ success: true });

      const result = await adminOps.setPassword('user@example.com', 'NewPass123!');

      expect(result.success).toBe(true);
      const requests = httpAdapter.getRequests();
      expect(requests[0].body).toEqual({
        identifier: 'user@example.com',
        newPassword: 'NewPass123!',
      });
    });

    it('should initiate password reset', async () => {
      const mockResponse = {
        success: true,
        destination: 'u***r@example.com',
        deliveryMedium: 'email',
        expiresIn: 3600,
        sessionsRevoked: 2,
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.initiatePasswordReset({
        sub: 'test-uuid',
        deliveryMethod: 'email',
        baseUrl: 'https://myapp.com/reset',
        revokeSessions: true,
      });

      expect(result.success).toBe(true);
      expect(result.destination).toBe('u***r@example.com');
      expect(result.sessionsRevoked).toBe(2);
    });
  });

  describe('Session Management', () => {
    it('should get user sessions', async () => {
      const mockResponse = {
        sessions: [
          {
            sessionId: 'session-1',
            deviceId: 'device-1',
            deviceName: 'Chrome on Windows',
            deviceType: 'desktop',
            platform: 'Windows',
            browser: 'Chrome',
            ipAddress: '192.168.1.1',
            ipCountry: 'US',
            ipCity: 'New York',
            lastActivityAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
            isRemembered: true,
            isCurrent: true,
            authMethod: 'password',
            authProvider: null,
          },
        ],
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.getUserSessions('test-uuid');

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].sessionId).toBe('session-1');
    });

    it('should logout all sessions', async () => {
      httpAdapter.setResponse({ revokedCount: 5 });

      const result = await adminOps.logoutAllSessions('test-uuid', true);

      expect(result.revokedCount).toBe(5);
      const requests = httpAdapter.getRequests();
      expect(requests[0].body).toEqual({ forgetDevices: true });
    });
  });

  describe('MFA Management', () => {
    it('should get MFA status', async () => {
      const mockResponse = {
        enabled: true,
        methods: ['totp'],
        preferredMethod: 'totp',
        devices: [],
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.getMfaStatus('test-uuid');

      expect(result.enabled).toBe(true);
    });

    it('should set preferred MFA method', async () => {
      httpAdapter.setResponse({ message: 'Preferred method updated' });

      const result = await adminOps.setPreferredMfaMethod('test-uuid', 'totp');

      expect(result.message).toBe('Preferred method updated');
      const requests = httpAdapter.getRequests();
      expect(requests[0].body).toEqual({ sub: 'test-uuid', method: 'totp' });
    });

    it('should remove MFA devices', async () => {
      httpAdapter.setResponse({ message: 'Devices removed' });

      const result = await adminOps.removeMfaDevices('test-uuid', 'sms');

      expect(result.message).toBe('Devices removed');
    });

    it('should set MFA exemption', async () => {
      httpAdapter.setResponse({ message: 'Exemption updated' });

      const result = await adminOps.setMfaExemption('test-uuid', true, 'Service account');

      expect(result.message).toBe('Exemption updated');
      const requests = httpAdapter.getRequests();
      expect(requests[0].body).toEqual({
        sub: 'test-uuid',
        exempt: true,
        reason: 'Service account',
      });
    });
  });

  describe('Audit', () => {
    it('should get audit history', async () => {
      const mockResponse = {
        data: [
          {
            id: 'audit-1',
            userId: 'test-uuid',
            eventType: 'LOGIN_SUCCESS',
            eventStatus: 'SUCCESS',
            timestamp: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.getAuditHistory({
        sub: 'test-uuid',
        page: 1,
        limit: 50,
        eventType: 'LOGIN_SUCCESS',
      });

      expect(result.data).toHaveLength(1);
      const requests = httpAdapter.getRequests();
      expect(requests[0].url).toContain('sub=test-uuid');
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP errors', async () => {
      class ErrorHttpAdapter implements HttpAdapter {
        async request<T>(): Promise<HttpResponse<T>> {
          throw new Error('Network error');
        }
      }

      const errorConfig = createTestConfig({
        httpAdapter: new ErrorHttpAdapter(),
      });
      const errorAdminOps = new AdminOperations(errorConfig);

      await expect(errorAdminOps.getUser('test-uuid')).rejects.toThrow();
    });

    it('should handle NAuthClientError', async () => {
      class NAuthErrorAdapter implements HttpAdapter {
        async request<T>(): Promise<HttpResponse<T>> {
          throw new NAuthClientError(NAuthErrorCode.INTERNAL_ERROR, 'Test error');
        }
      }

      const errorConfig = createTestConfig({
        httpAdapter: new NAuthErrorAdapter(),
      });
      const errorAdminOps = new AdminOperations(errorConfig);

      await expect(errorAdminOps.getUser('test-uuid')).rejects.toThrow(NAuthClientError);
    });
  });

  describe('Headers', () => {
    it('should include admin-specific headers', async () => {
      const customConfig = createTestConfig({
        admin: {
          pathPrefix: '/admin',
          endpoints: config.admin!.endpoints,
          headers: {
            'X-Admin-Context': 'dashboard',
          },
        },
      });
      const customAdminOps = new AdminOperations(customConfig);
      const customAdapter = customConfig.httpAdapter as MockHttpAdapter;
      customAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await customAdminOps.getUsers();

      const requests = customAdapter.getRequests();
      expect(requests[0].headers?.['X-Admin-Context']).toBe('dashboard');
    });

    it('should merge admin headers with parent headers', async () => {
      const customConfig = createTestConfig({
        headers: {
          'X-Common-Header': 'common-value',
        },
        admin: {
          pathPrefix: '/admin',
          endpoints: config.admin!.endpoints,
          headers: {
            'X-Admin-Header': 'admin-value',
          },
        },
      });
      const customAdminOps = new AdminOperations(customConfig);
      const customAdapter = customConfig.httpAdapter as MockHttpAdapter;
      customAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await customAdminOps.getUsers();

      const requests = customAdapter.getRequests();
      expect(requests[0].headers?.['X-Common-Header']).toBe('common-value');
      expect(requests[0].headers?.['X-Admin-Header']).toBe('admin-value');
    });
  });

  describe('Social Import', () => {
    it('should import social user', async () => {
      const mockResponse = {
        user: {
          sub: 'new-uuid',
          email: 'social@example.com',
          isEmailVerified: true,
          isPhoneVerified: false,
          isActive: true,
          mfaEnabled: false,
          hasPasswordHash: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        socialAccount: {
          provider: 'google',
          providerId: 'google_12345',
          providerEmail: 'social@gmail.com',
        },
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.importSocialUser({
        email: 'social@example.com',
        provider: 'google',
        providerId: 'google_12345',
        providerEmail: 'social@gmail.com',
      });

      expect(result.user.email).toBe('social@example.com');
      expect(result.socialAccount.provider).toBe('google');
    });
  });
});
