import { AdminOperations } from './admin-operations';
import { ResolvedNAuthClientConfig, defaultEndpoints, defaultAdminEndpoints } from './config';
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
    endpoints: { ...defaultEndpoints },
    admin: {
      pathPrefix: '/admin',
      endpoints: { ...defaultAdminEndpoints },
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

      expect(result?.email).toBe('test@example.com');
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
    it('should set password by sub', async () => {
      httpAdapter.setResponse({ success: true, mustChangePassword: true, sessionsRevoked: 3 });

      const result = await adminOps.setPassword('cb69dfbc-1188-41fc-92ef-bef86e771d9d', 'NewPass123!');

      expect(result).toEqual({ success: true, mustChangePassword: true, sessionsRevoked: 3 });
      const requests = httpAdapter.getRequests();
      expect(requests[0].url).toContain('/set-password');
      expect(requests[0].body).toEqual({
        sub: 'cb69dfbc-1188-41fc-92ef-bef86e771d9d',
        newPassword: 'NewPass123!',
      });
    });

    it('should forward set-password options without a second round-trip', async () => {
      httpAdapter.setResponse({ success: true, mustChangePassword: false, sessionsRevoked: 0 });

      await adminOps.setPassword('cb69dfbc-1188-41fc-92ef-bef86e771d9d', 'NewPass123!', {
        mustChangePassword: false,
        revokeSessions: false,
      });

      expect(httpAdapter.getRequests()[0].body).toEqual({
        sub: 'cb69dfbc-1188-41fc-92ef-bef86e771d9d',
        newPassword: 'NewPass123!',
        mustChangePassword: false,
        revokeSessions: false,
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
            isTrustedDevice: true,
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

    it('should get MFA devices', async () => {
      const mockResponse = {
        devices: [
          { id: 1, name: 'My Authenticator', type: 'totp', isPreferred: true, isActive: true, createdAt: '2024-01-01' },
          { id: 2, name: 'Backup Phone', type: 'sms', isPreferred: false, isActive: true, createdAt: '2024-01-02' },
        ],
      };
      httpAdapter.setResponse(mockResponse);

      const result = await adminOps.getMfaDevices('test-uuid');

      expect(result.devices).toHaveLength(2);
      expect(result.devices[0].name).toBe('My Authenticator');
      expect(result.devices[0].isPreferred).toBe(true);
    });

    it('should set MFA exemption', async () => {
      const grantedAt = new Date().toISOString();
      httpAdapter.setResponse({
        mfaExempt: true,
        mfaExemptReason: 'Service account',
        mfaExemptGrantedAt: grantedAt,
      });

      const result = await adminOps.setMfaExemption('test-uuid', true, 'Service account');

      expect(result.mfaExempt).toBe(true);
      expect(result.mfaExemptReason).toBe('Service account');
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

  describe('Query String Building', () => {
    it('should skip undefined and null values', async () => {
      httpAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await adminOps.getUsers({
        page: 1,
        limit: 10,
        email: undefined,
        phone: null as any,
      });

      const requests = httpAdapter.getRequests();
      const url = requests[0].url;
      expect(url).not.toContain('email');
      expect(url).not.toContain('phone');
    });

    it('should handle array values in query string', async () => {
      httpAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      const adminOpsWithArray = new AdminOperations(createTestConfig());
      const adapter = (adminOpsWithArray as any).config.httpAdapter as MockHttpAdapter;
      adapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      const buildQueryString = (adminOpsWithArray as any).buildQueryString.bind(adminOpsWithArray);
      const queryString = buildQueryString({ tags: ['tag1', 'tag2'], page: 1 });

      expect(queryString).toContain('tags=tag1');
      expect(queryString).toContain('tags=tag2');
      expect(queryString).toContain('page=1');
    });

    it('should handle date filter values in query string', async () => {
      httpAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
      const testDate = new Date('2024-01-01T00:00:00Z');

      await adminOps.getUsers({
        page: 1,
        limit: 10,
        createdAt: { operator: 'gte', value: testDate },
      });

      const requests = httpAdapter.getRequests();
      const url = decodeURIComponent(requests[0].url);
      expect(url).toContain('createdAt[operator]=gte');
      expect(url).toContain('createdAt[value]');
      expect(url).toContain(testDate.toISOString());
    });

    it('should handle nested objects in query string', async () => {
      httpAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await adminOps.getUsers({
        page: 1,
        limit: 10,
        createdAt: { operator: 'gte', value: new Date('2024-01-01') } as any,
      });

      const requests = httpAdapter.getRequests();
      const url = decodeURIComponent(requests[0].url);
      expect(url).toContain('createdAt[operator]');
      expect(url).toContain('createdAt[value]');
    });
  });

  describe('JSON Mode Authentication', () => {
    it('should include access token in headers for JSON mode', async () => {
      const jsonConfig = createTestConfig({
        tokenDelivery: 'json',
      });
      const jsonStorage = jsonConfig.storage as MockStorage;
      await jsonStorage.setItem('nauth_access_token', 'test-token-123');
      const jsonAdminOps = new AdminOperations(jsonConfig);
      const jsonAdapter = jsonConfig.httpAdapter as MockHttpAdapter;
      jsonAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await jsonAdminOps.getUsers();

      const requests = jsonAdapter.getRequests();
      expect(requests[0].headers?.['Authorization']).toBe('Bearer test-token-123');
    });

    it('should include device token in headers for JSON mode', async () => {
      const jsonConfig = createTestConfig({
        tokenDelivery: 'json',
      });
      const jsonStorage = jsonConfig.storage as MockStorage;
      await jsonStorage.setItem('nauth_device_token', 'device-token-123');
      const jsonAdminOps = new AdminOperations(jsonConfig);
      const jsonAdapter = jsonConfig.httpAdapter as MockHttpAdapter;
      jsonAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await jsonAdminOps.getUsers();

      const requests = jsonAdapter.getRequests();
      expect(requests[0].headers?.['X-Device-Token']).toBe('device-token-123');
    });

    it('should handle storage errors gracefully in JSON mode', async () => {
      class FailingStorage implements NAuthStorageAdapter {
        async getItem(): Promise<string | null> {
          throw new Error('Storage error');
        }
        async setItem(): Promise<void> {}
        async removeItem(): Promise<void> {}
        async clear(): Promise<void> {}
      }

      const jsonConfig = createTestConfig({
        tokenDelivery: 'json',
        storage: new FailingStorage(),
      });
      const jsonAdminOps = new AdminOperations(jsonConfig);
      const jsonAdapter = jsonConfig.httpAdapter as MockHttpAdapter;
      jsonAdapter.setResponse({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await jsonAdminOps.getUsers();

      const requests = jsonAdapter.getRequests();
      expect(requests[0].headers?.['Authorization']).toBeUndefined();
    });
  });

  describe('Cookies Mode CSRF', () => {
    let originalWindow: any;
    let originalDocument: any;

    beforeEach(() => {
      originalWindow = (global as any).window;
      originalDocument = (global as any).document;
      (global as any).window = {};
      (global as any).document = {
        cookie: 'nauth_csrf_token=test-csrf-token-123',
      };
    });

    afterEach(() => {
      (global as any).window = originalWindow;
      (global as any).document = originalDocument;
    });

    it('should include CSRF token in headers for POST requests in cookies mode', async () => {
      const cookiesConfig = createTestConfig({
        tokenDelivery: 'cookies',
      });
      const cookiesAdminOps = new AdminOperations(cookiesConfig);
      const cookiesAdapter = cookiesConfig.httpAdapter as MockHttpAdapter;
      cookiesAdapter.setResponse({ user: { sub: 'test' } });

      await cookiesAdminOps.createUser({
        email: 'test@example.com',
        password: 'password123',
      });

      const requests = cookiesAdapter.getRequests();
      expect(requests[0].headers?.['x-csrf-token']).toBe('test-csrf-token-123');
    });

    it('should handle missing CSRF token gracefully', async () => {
      Object.defineProperty(global, 'document', {
        value: {
          cookie: '',
        },
        writable: true,
        configurable: true,
      });

      const cookiesConfig = createTestConfig({
        tokenDelivery: 'cookies',
      });
      const cookiesAdminOps = new AdminOperations(cookiesConfig);
      const cookiesAdapter = cookiesConfig.httpAdapter as MockHttpAdapter;
      cookiesAdapter.setResponse({ user: { sub: 'test' } });

      await cookiesAdminOps.createUser({
        email: 'test@example.com',
        password: 'password123',
      });

      const requests = cookiesAdapter.getRequests();
      expect(requests[0].headers?.['x-csrf-token']).toBeUndefined();
    });
  });

  describe('Error Handling in HTTP Methods', () => {
    it('should handle errors in POST method', async () => {
      class PostErrorAdapter implements HttpAdapter {
        async request<T>(): Promise<HttpResponse<T>> {
          throw {
            response: {
              status: 400,
              data: {
                code: 'VALIDATION_FAILED',
                message: 'Invalid input',
              },
            },
          };
        }
      }

      const errorConfig = createTestConfig({
        httpAdapter: new PostErrorAdapter(),
      });
      const errorAdminOps = new AdminOperations(errorConfig);

      await expect(
        errorAdminOps.createUser({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(NAuthClientError);
    });

    it('should handle errors in DELETE method', async () => {
      class DeleteErrorAdapter implements HttpAdapter {
        async request<T>(): Promise<HttpResponse<T>> {
          throw {
            response: {
              status: 404,
              data: {
                code: 'USER_NOT_FOUND',
                message: 'User not found',
              },
            },
          };
        }
      }

      const errorConfig = createTestConfig({
        httpAdapter: new DeleteErrorAdapter(),
      });
      const errorAdminOps = new AdminOperations(errorConfig);

      await expect(errorAdminOps.deleteUser('test-uuid')).rejects.toThrow(NAuthClientError);
    });

    it('should extract error details from HTTP adapter response', async () => {
      class DetailedErrorAdapter implements HttpAdapter {
        async request<T>(): Promise<HttpResponse<T>> {
          throw {
            response: {
              status: 500,
              data: {
                code: 'INTERNAL_ERROR',
                message: 'Server error',
                details: { stack: 'error stack' },
              },
            },
          };
        }
      }

      const errorConfig = createTestConfig({
        httpAdapter: new DetailedErrorAdapter(),
      });
      const errorAdminOps = new AdminOperations(errorConfig);

      try {
        await errorAdminOps.getUser('test-uuid');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthClientError);
        const clientError = error as NAuthClientError;
        expect(clientError.code).toBe(NAuthErrorCode.INTERNAL_ERROR);
        expect(clientError.message).toBe('Server error');
        expect(clientError.details).toBeDefined();
      }
    });
  });

  describe('User lookup and attribute updates', () => {
    it('should resolve a user by email via query string', async () => {
      httpAdapter.setResponse({ sub: 'test-uuid', email: 'user@example.com' });

      const result = await adminOps.getUserByEmail({ email: 'user@example.com' });

      expect(result?.sub).toBe('test-uuid');
      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('GET');
      expect(request.url).toContain('/admin/users/by-email');
      expect(request.url).toContain('email=user%40example.com');
    });

    it('should pass requireEmailVerified through to the query', async () => {
      httpAdapter.setResponse({ sub: 'test-uuid' });

      await adminOps.getUserByEmail({ email: 'user@example.com', requireEmailVerified: true });

      expect(httpAdapter.getRequests()[0].url).toContain('requireEmailVerified=true');
    });

    it('should update user attributes with PUT', async () => {
      httpAdapter.setResponse({ sub: 'test-uuid', firstName: 'Ada' });

      const result = await adminOps.updateUser('test-uuid', { firstName: 'Ada' });

      expect(result.sub).toBe('test-uuid');
      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('PUT');
      expect(request.url).toContain('/admin/users/test-uuid');
      expect(request.body).toEqual({ firstName: 'Ada' });
    });

    it('should set verified status without disturbing omitted flags', async () => {
      httpAdapter.setResponse({ sub: 'test-uuid', isEmailVerified: true });

      await adminOps.updateVerifiedStatus('test-uuid', { isEmailVerified: true });

      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('POST');
      expect(request.url).toContain('/admin/users/test-uuid/verified-status');
      expect(request.body).toEqual({ isEmailVerified: true });
    });
  });

  describe('Single session revocation', () => {
    it('should revoke one session by sub and sessionId', async () => {
      httpAdapter.setResponse({ success: true });

      const result = await adminOps.revokeUserSession('test-uuid', 'session-9');

      expect(result.success).toBe(true);
      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('DELETE');
      expect(request.url).toContain('/admin/users/test-uuid/sessions/session-9');
    });

    it('should encode identifiers that contain URL-significant characters', async () => {
      httpAdapter.setResponse({ success: true });

      await adminOps.revokeUserSession('a/b', 'c d');

      expect(httpAdapter.getRequests()[0].url).toContain('/admin/users/a%2Fb/sessions/c%20d');
    });
  });

  describe('Audit queries', () => {
    it('should fetch events by type', async () => {
      httpAdapter.setResponse({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await adminOps.getEventsByType({ eventType: 'LOGIN_FAILED', limit: 50 });

      const [request] = httpAdapter.getRequests();
      expect(request.url).toContain('/admin/audit/events');
      expect(request.url).toContain('eventType=LOGIN_FAILED');
      expect(request.url).toContain('limit=50');
    });

    it('should fetch suspicious activity with no params', async () => {
      httpAdapter.setResponse({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await adminOps.getSuspiciousActivity();

      expect(httpAdapter.getRequests()[0].url).toContain('/admin/audit/suspicious');
    });

    it('should fetch risk assessment history for a user', async () => {
      httpAdapter.setResponse({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await adminOps.getRiskAssessmentHistory({ sub: 'test-uuid', limit: 5 });

      const [request] = httpAdapter.getRequests();
      expect(request.url).toContain('/admin/audit/risk');
      expect(request.url).toContain('sub=test-uuid');
    });
  });

  describe('API key management', () => {
    it('should create a key on behalf of a user', async () => {
      httpAdapter.setResponse({ key: 'plaintext', apiKey: { keyId: 'k1' } });

      const result = await adminOps.createApiKey({ sub: 'test-uuid', expiresInDays: 90 });

      expect(result.key).toBe('plaintext');
      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('POST');
      expect(request.url).toContain('/admin/api-keys');
      expect(request.body).toEqual({ sub: 'test-uuid', expiresInDays: 90 });
    });

    it('should list a user keys by sub', async () => {
      httpAdapter.setResponse({ apiKeys: [] });

      await adminOps.listApiKeys('test-uuid');

      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('GET');
      expect(request.url).toContain('sub=test-uuid');
    });

    it('should send sub in the body when updating a key', async () => {
      httpAdapter.setResponse({ keyId: 'k1' });

      await adminOps.updateApiKey('test-uuid', 'k1', { name: 'CI' });

      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('PATCH');
      expect(request.url).toContain('/admin/api-keys/k1');
      expect(request.body).toEqual({ sub: 'test-uuid', name: 'CI' });
    });

    it('should send sub in the body when revoking a key', async () => {
      httpAdapter.setResponse({ success: true });

      await adminOps.revokeApiKey('test-uuid', 'k1');

      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('POST');
      expect(request.url).toContain('/admin/api-keys/k1/revoke');
      expect(request.body).toEqual({ sub: 'test-uuid' });
    });

    it('should send sub in the body when deleting a key, since the route reads params+body', async () => {
      httpAdapter.setResponse({ success: true });

      await adminOps.deleteApiKey('test-uuid', 'k1');

      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('DELETE');
      expect(request.url).toContain('/admin/api-keys/k1');
      expect(request.body).toEqual({ sub: 'test-uuid' });
    });
  });


  describe('Trusted device management', () => {
    it('lists a user trusted devices', async () => {
      httpAdapter.setResponse({ trustedDevices: [{ id: 7 }] });

      const result = await adminOps.getUserTrustedDevices('test-uuid');

      expect(result.trustedDevices).toHaveLength(1);
      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('GET');
      expect(request.url).toContain('/admin/users/test-uuid/trusted-devices');
    });

    it('revokes one trusted device of a user', async () => {
      httpAdapter.setResponse({ success: true });

      const result = await adminOps.revokeUserTrustedDevice('test-uuid', 7);

      expect(result.success).toBe(true);
      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('DELETE');
      expect(request.url).toContain('/admin/users/test-uuid/trusted-devices/7');
    });

    it('revokes every trusted device of a user against the collection path', async () => {
      httpAdapter.setResponse({ revokedCount: 4 });

      const result = await adminOps.revokeAllUserTrustedDevices('test-uuid');

      expect(result.revokedCount).toBe(4);
      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe('DELETE');
      expect(request.url).toContain('/admin/users/test-uuid/trusted-devices');
      expect(request.url).not.toContain('/trusted-devices/');
    });
  });


  // ==========================================================================
  // Wire contract
  // ==========================================================================

  /**
   * Pins the exact request shape every admin method puts on the wire, against the
   * property names of the core DTO that will validate it.
   *
   * WHY: the client and the server typecheck independently, so a field-name mismatch
   * between them is invisible to TypeScript and shows up only as a runtime 400 that
   * names a field the caller never sent. `setPassword` shipped broken this way - it
   * posted `identifier` at a DTO declaring `sub`, and `whitelist: true` dropped the
   * unknown key silently before validation failed on the missing one.
   *
   * These expectations are pinned, not derived: `@nauth-toolkit/client` has no
   * dependency on `@nauth-toolkit/core` and should not gain one. Changing a core admin
   * DTO therefore will not fail this suite on its own - the `dto` note on each case is
   * the pointer a reviewer diffs against when a DTO moves.
   */
  describe('Wire contract', () => {
    const SUB = 'cb69dfbc-1188-41fc-92ef-bef86e771d9d';
    const KEY_ID = '6f1b9a2e-2f2e-4a1e-bc55-9e2f4c1d77aa';

    interface WireCase {
      /** Client method under test */
      name: string;
      /** Core DTO that validates the payload server-side */
      dto: string;
      /** Invoke the client method */
      run: () => Promise<unknown>;
      /** Expected HTTP method */
      method: string;
      /** Expected path, after prefixes and path-param substitution */
      url: string;
      /** Expected body property names, or [] for an empty body */
      bodyKeys?: string[];
      /** Expected query parameter names */
      queryKeys?: string[];
    }

    const cases = (): WireCase[] => [
      {
        name: 'setPassword',
        dto: 'AdminSetPasswordDTO',
        run: () => adminOps.setPassword(SUB, 'NewPass123!'),
        method: 'POST',
        url: 'https://api.example.com/auth/admin/set-password',
        bodyKeys: ['sub', 'newPassword'],
      },
      {
        name: 'setPassword (with options)',
        dto: 'AdminSetPasswordDTO',
        run: () => adminOps.setPassword(SUB, 'NewPass123!', { mustChangePassword: false, revokeSessions: false }),
        method: 'POST',
        url: 'https://api.example.com/auth/admin/set-password',
        bodyKeys: ['sub', 'newPassword', 'mustChangePassword', 'revokeSessions'],
      },
      {
        name: 'initiatePasswordReset',
        dto: 'AdminResetPasswordDTO',
        run: () => adminOps.initiatePasswordReset({ sub: SUB, deliveryMethod: 'email' }),
        method: 'POST',
        url: 'https://api.example.com/auth/admin/reset-password/initiate',
        bodyKeys: ['sub', 'deliveryMethod'],
      },
      {
        name: 'forcePasswordChange',
        dto: 'SetMustChangePasswordDTO',
        run: () => adminOps.forcePasswordChange(SUB),
        method: 'POST',
        url: `https://api.example.com/auth/admin/users/${SUB}/force-password-change`,
        bodyKeys: [],
      },
      {
        name: 'disableUser',
        dto: 'DisableUserDTO',
        run: () => adminOps.disableUser(SUB, 'Account compromised'),
        method: 'POST',
        url: `https://api.example.com/auth/admin/users/${SUB}/disable`,
        bodyKeys: ['reason'],
      },
      {
        name: 'enableUser',
        dto: 'EnableUserDTO',
        run: () => adminOps.enableUser(SUB),
        method: 'POST',
        url: `https://api.example.com/auth/admin/users/${SUB}/enable`,
        bodyKeys: [],
      },
      {
        name: 'updateVerifiedStatus',
        dto: 'UpdateVerifiedStatusRequestDTO',
        run: () => adminOps.updateVerifiedStatus(SUB, { isEmailVerified: true }),
        method: 'POST',
        url: `https://api.example.com/auth/admin/users/${SUB}/verified-status`,
        bodyKeys: ['isEmailVerified'],
      },
      {
        name: 'logoutAllSessions',
        dto: 'AdminLogoutAllDTO',
        run: () => adminOps.logoutAllSessions(SUB, true),
        method: 'POST',
        url: `https://api.example.com/auth/admin/users/${SUB}/logout-all`,
        bodyKeys: ['forgetDevices'],
      },
      {
        name: 'setMfaExemption',
        dto: 'SetMFAExemptionDTO',
        run: () => adminOps.setMfaExemption(SUB, true, 'Service account'),
        method: 'POST',
        url: 'https://api.example.com/auth/admin/mfa/exemption',
        bodyKeys: ['sub', 'exempt', 'reason'],
      },
      {
        name: 'setPreferredMfaDevice',
        dto: 'AdminSetPreferredDeviceDTO',
        run: () => adminOps.setPreferredMfaDevice(SUB, 3),
        method: 'POST',
        url: `https://api.example.com/auth/admin/users/${SUB}/mfa/devices/3/preferred`,
        bodyKeys: [],
      },
      {
        name: 'removeMfaDeviceById',
        dto: 'AdminRemoveDeviceDTO',
        run: () => adminOps.removeMfaDeviceById(3),
        method: 'DELETE',
        url: 'https://api.example.com/auth/admin/mfa/devices/3',
      },
      {
        name: 'getUserByEmail',
        dto: 'GetUserByEmailDTO',
        run: () => adminOps.getUserByEmail({ email: 'user@example.com', requireEmailVerified: true }),
        method: 'GET',
        url: 'https://api.example.com/auth/admin/users/by-email',
        queryKeys: ['email', 'requireEmailVerified'],
      },
      {
        name: 'getAuditHistory',
        dto: 'AdminGetUserAuthHistoryDTO',
        run: () => adminOps.getAuditHistory({ sub: SUB, limit: 10 }),
        method: 'GET',
        url: 'https://api.example.com/auth/admin/audit/history',
        queryKeys: ['sub', 'limit'],
      },
      {
        name: 'getRiskAssessmentHistory',
        dto: 'GetRiskAssessmentHistoryDTO',
        run: () => adminOps.getRiskAssessmentHistory({ sub: SUB, limit: 5 }),
        method: 'GET',
        url: 'https://api.example.com/auth/admin/audit/risk',
        queryKeys: ['sub', 'limit'],
      },
      {
        name: 'createApiKey',
        dto: 'AdminCreateApiKeyDTO',
        run: () => adminOps.createApiKey({ sub: SUB, name: 'CI', expiresInDays: 30 }),
        method: 'POST',
        url: 'https://api.example.com/auth/admin/api-keys',
        bodyKeys: ['sub', 'name', 'expiresInDays'],
      },
      {
        name: 'listApiKeys',
        dto: 'AdminManageApiKeyDTO',
        run: () => adminOps.listApiKeys(SUB),
        method: 'GET',
        url: 'https://api.example.com/auth/admin/api-keys',
        queryKeys: ['sub'],
      },
      {
        name: 'updateApiKey',
        dto: 'AdminUpdateApiKeyDTO',
        run: () => adminOps.updateApiKey(SUB, KEY_ID, { name: 'renamed' }),
        method: 'PATCH',
        url: `https://api.example.com/auth/admin/api-keys/${KEY_ID}`,
        bodyKeys: ['sub', 'name'],
      },
      {
        name: 'revokeApiKey',
        dto: 'AdminManageApiKeyDTO',
        run: () => adminOps.revokeApiKey(SUB, KEY_ID),
        method: 'POST',
        url: `https://api.example.com/auth/admin/api-keys/${KEY_ID}/revoke`,
        bodyKeys: ['sub'],
      },
      {
        name: 'deleteApiKey',
        dto: 'AdminManageApiKeyDTO',
        run: () => adminOps.deleteApiKey(SUB, KEY_ID),
        method: 'DELETE',
        url: `https://api.example.com/auth/admin/api-keys/${KEY_ID}`,
        bodyKeys: ['sub'],
      },
    ];

    it.each(cases())('$name sends the shape $dto validates', async (testCase: WireCase) => {
      httpAdapter.setResponse({});

      await testCase.run();

      const [request] = httpAdapter.getRequests();
      expect(request.method).toBe(testCase.method);

      const [urlPath, search] = request.url.split('?');
      expect(urlPath).toBe(testCase.url);

      if (testCase.queryKeys) {
        expect([...new URLSearchParams(search ?? '').keys()]).toEqual(testCase.queryKeys);
      } else {
        expect(search).toBeUndefined();
      }

      if (testCase.bodyKeys) {
        // Keys whose value is undefined are dropped by JSON.stringify, so they never
        // reach the server - compare against what is actually sent.
        const body = (request.body ?? {}) as Record<string, unknown>;
        const sentKeys = Object.keys(body).filter((key) => body[key] !== undefined);
        expect(sentKeys).toEqual(testCase.bodyKeys);
      } else {
        expect(request.body).toBeUndefined();
      }
    });
  });
});
