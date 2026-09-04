import { OIDCOperations, PENDING_INTERACTION_KEY } from './oidc-operations';
import { resolveConfig, ResolvedNAuthClientConfig } from './config';
import { HttpAdapter, HttpRequest, HttpResponse } from './http-adapter';
import { NAuthClientError } from './errors';
import { NAuthErrorCode } from '../types/error.types';
import type { NAuthStorageAdapter } from '../storage/interface';
import type { OIDCInteractionState } from '../types/oidc.types';

/** In-memory storage adapter standing in for sessionStorage. */
class MockStorage implements NAuthStorageAdapter {
  private data = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
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

/** Storage that fails every operation, as a blocked-site-data browser would. */
class FailingStorage implements NAuthStorageAdapter {
  async getItem(): Promise<string | null> {
    throw new Error('storage unavailable');
  }

  async setItem(): Promise<void> {
    throw new Error('storage unavailable');
  }

  async removeItem(): Promise<void> {
    throw new Error('storage unavailable');
  }

  async clear(): Promise<void> {
    throw new Error('storage unavailable');
  }
}

/** HTTP adapter that records requests and replays a scripted response. */
class MockHttpAdapter implements HttpAdapter {
  readonly requests: HttpRequest[] = [];
  private response: HttpResponse<unknown> = { data: {}, status: 200, headers: {} };
  private failure: unknown = null;

  setResponse<T>(data: T, status = 200): void {
    this.response = { data, status, headers: {} };
    this.failure = null;
  }

  setFailure(failure: unknown): void {
    this.failure = failure;
  }

  async request<T>(config: HttpRequest): Promise<HttpResponse<T>> {
    this.requests.push(config);
    if (this.failure) {
      throw this.failure;
    }
    return this.response as HttpResponse<T>;
  }
}

const buildConfig = (
  overrides: Partial<Parameters<typeof resolveConfig>[0]> = {},
  adapter: HttpAdapter = new MockHttpAdapter(),
): ResolvedNAuthClientConfig =>
  resolveConfig(
    {
      baseUrl: 'https://api.example.com',
      tokenDelivery: 'cookies',
      storage: new MockStorage(),
      ...overrides,
    },
    adapter,
  );

const sampleState: OIDCInteractionState = {
  uid: 'abc123',
  prompt: 'consent',
  client: { clientId: 'my-app', clientName: 'My App' },
  scopes: ['openid', 'email'],
  missingScopes: ['email'],
  gate: 'authenticated',
  sub: 'user-sub',
};

describe('OIDCOperations', () => {
  describe('endpoints', () => {
    it('defaults the base path to {baseUrl}/oidc/interaction', async () => {
      const http = new MockHttpAdapter();
      const oidc = new OIDCOperations(buildConfig({}, http), new MockStorage());
      http.setResponse(sampleState);

      await oidc.getInteraction('abc123');

      expect(http.requests[0].method).toBe('GET');
      expect(http.requests[0].url).toBe('https://api.example.com/oidc/interaction/abc123');
    });

    it('honours a configured base path', async () => {
      const http = new MockHttpAdapter();
      const config = buildConfig({ oidc: { basePath: 'https://api.example.com/identity/interaction' } }, http);
      const oidc = new OIDCOperations(config, new MockStorage());
      http.setResponse(sampleState);

      await oidc.getInteraction('abc123');

      expect(http.requests[0].url).toBe('https://api.example.com/identity/interaction/abc123');
    });

    it('prefers an explicit constructor base path over configuration', async () => {
      const http = new MockHttpAdapter();
      const config = buildConfig({ oidc: { basePath: '/from-config' } }, http);
      const oidc = new OIDCOperations(config, new MockStorage(), '/explicit');
      http.setResponse(sampleState);

      await oidc.getInteraction('abc123');

      expect(http.requests[0].url).toBe('/explicit/abc123');
    });

    it('encodes the interaction id', async () => {
      const http = new MockHttpAdapter();
      const oidc = new OIDCOperations(buildConfig({}, http), new MockStorage());
      http.setResponse(sampleState);

      await oidc.getInteraction('a/b c');

      expect(http.requests[0].url).toBe('https://api.example.com/oidc/interaction/a%2Fb%20c');
    });
  });

  describe('decisions', () => {
    it('posts an approval, granting everything asked for by default', async () => {
      const http = new MockHttpAdapter();
      const oidc = new OIDCOperations(buildConfig({}, http), new MockStorage());
      http.setResponse({ redirectTo: 'https://api.example.com/oidc/auth/abc123' });

      const result = await oidc.approve('abc123');

      expect(result.redirectTo).toBe('https://api.example.com/oidc/auth/abc123');
      expect(http.requests[0].method).toBe('POST');
      expect(http.requests[0].url).toBe('https://api.example.com/oidc/interaction/abc123/confirm');
      expect(http.requests[0].body).toEqual({ approve: true });
    });

    it('posts a narrowed scope set when one is given', async () => {
      const http = new MockHttpAdapter();
      const oidc = new OIDCOperations(buildConfig({}, http), new MockStorage());
      http.setResponse({ redirectTo: '/back' });

      await oidc.approve('abc123', ['openid']);

      expect(http.requests[0].body).toEqual({ approve: true, scopes: ['openid'] });
    });

    it('posts a refusal', async () => {
      const http = new MockHttpAdapter();
      const oidc = new OIDCOperations(buildConfig({}, http), new MockStorage());
      http.setResponse({ redirectTo: '/back' });

      await oidc.deny('abc123');

      expect(http.requests[0].body).toEqual({ approve: false });
    });

    it('completes the login step', async () => {
      const http = new MockHttpAdapter();
      const oidc = new OIDCOperations(buildConfig({}, http), new MockStorage());
      http.setResponse({ redirectTo: '/back' });

      await oidc.completeLogin('abc123');

      expect(http.requests[0].url).toBe('https://api.example.com/oidc/interaction/abc123/login');
    });

    it('aborts a pending interaction', async () => {
      const http = new MockHttpAdapter();
      const oidc = new OIDCOperations(buildConfig({}, http), new MockStorage());
      http.setResponse({ redirectTo: '/back' });

      await oidc.abort('abc123');

      expect(http.requests[0].url).toBe('https://api.example.com/oidc/interaction/abc123/abort');
    });
  });

  describe('credentials and headers', () => {
    it('sends cookies in cookie mode', async () => {
      const http = new MockHttpAdapter();
      const oidc = new OIDCOperations(buildConfig({}, http), new MockStorage());
      http.setResponse(sampleState);

      await oidc.getInteraction('abc123');

      expect(http.requests[0].credentials).toBe('include');
    });

    it('sends a bearer token in json mode', async () => {
      const http = new MockHttpAdapter();
      const storage = new MockStorage();
      await storage.setItem('nauth_access_token', 'token-value');
      const oidc = new OIDCOperations(buildConfig({ tokenDelivery: 'json', storage }, http), new MockStorage());
      http.setResponse(sampleState);

      await oidc.getInteraction('abc123');

      expect(http.requests[0].headers?.['Authorization']).toBe('Bearer token-value');
      expect(http.requests[0].credentials).toBe('omit');
    });
  });

  describe('errors', () => {
    it('surfaces the backend error code, so a login_required response is actionable', async () => {
      const http = new MockHttpAdapter();
      const oidc = new OIDCOperations(buildConfig({}, http), new MockStorage());
      http.setFailure({
        response: {
          status: 401,
          data: {
            code: NAuthErrorCode.OIDC_LOGIN_REQUIRED,
            message: 'A completed login is required',
            details: { uid: 'abc123', reason: 'no_session' },
          },
        },
      });

      await expect(oidc.completeLogin('abc123')).rejects.toMatchObject({
        code: NAuthErrorCode.OIDC_LOGIN_REQUIRED,
        statusCode: 401,
      });
    });

    it('reports an expired interaction as not found', async () => {
      const http = new MockHttpAdapter();
      const oidc = new OIDCOperations(buildConfig({}, http), new MockStorage());
      http.setFailure({
        response: { status: 404, data: { code: NAuthErrorCode.OIDC_INTERACTION_NOT_FOUND, message: 'gone' } },
      });

      await expect(oidc.getInteraction('abc123')).rejects.toBeInstanceOf(NAuthClientError);
    });
  });

  describe('pending interaction', () => {
    it('stashes, reads and clears the interaction id', async () => {
      const storage = new MockStorage();
      const oidc = new OIDCOperations(buildConfig(), storage);

      await oidc.setPendingInteraction('abc123');
      expect(await storage.getItem(PENDING_INTERACTION_KEY)).toBe('abc123');
      expect(await oidc.getPendingInteraction()).toBe('abc123');

      await oidc.clearPendingInteraction();
      expect(await oidc.getPendingInteraction()).toBeNull();
    });

    it('takes the id exactly once, so only one caller resumes the flow', async () => {
      const storage = new MockStorage();
      const oidc = new OIDCOperations(buildConfig(), storage);

      await oidc.setPendingInteraction('abc123');

      expect(await oidc.takePendingInteraction()).toBe('abc123');
      expect(await oidc.takePendingInteraction()).toBeNull();
    });

    it('degrades quietly when storage is unavailable', async () => {
      const oidc = new OIDCOperations(buildConfig(), new FailingStorage());

      await expect(oidc.setPendingInteraction('abc123')).resolves.toBeUndefined();
      await expect(oidc.getPendingInteraction()).resolves.toBeNull();
      await expect(oidc.clearPendingInteraction()).resolves.toBeUndefined();
    });
  });
});
