/**
 * AuthService Unit Tests
 *
 * Covers login/signup with and without reCAPTCHA, and getRecaptchaToken behavior.
 */
import 'reflect-metadata';
import { AuthService } from './auth.service';
import { NAuthClientConfig } from '@nauth-toolkit/client';
import type { HttpAdapter } from '@nauth-toolkit/client';
import type { RecaptchaService } from '../lib/recaptcha.service';

/** Minimal success AuthResponse for mocks */
const mockAuthResponse = {
  user: { sub: '1', email: 'a@a.com', isEmailVerified: true, hasPasswordHash: true },
  accessToken: 'at',
  refreshToken: 'rt',
  accessTokenExpiresAt: 1,
  refreshTokenExpiresAt: 2,
};

/**
 * Creates a mock HttpAdapter that records POST request bodies and returns a valid auth response.
 */
function createMockHttpAdapter(): HttpAdapter & { getLoginBody: () => unknown; getSignupBody: () => unknown } {
  let loginBody: unknown;
  let signupBody: unknown;

  const adapter: HttpAdapter = {
    request: jest.fn().mockImplementation(async (config: { method?: string; body?: unknown }) => {
      if (config.method === 'POST' && config.body) {
        const b = config.body as Record<string, unknown>;
        if (b.identifier !== undefined && b.password !== undefined) {
          loginBody = config.body;
        } else if (b.email !== undefined && b.password !== undefined) {
          signupBody = config.body;
        }
      }
      return {
        status: 200,
        data: mockAuthResponse,
        headers: {},
      };
    }),
  };

  return Object.assign(adapter, {
    getLoginBody: () => loginBody,
    getSignupBody: () => signupBody,
  });
}

/**
 * Creates a mock HttpAdapter that records the body of the last POST request, regardless of its
 * shape, and returns the given response data. Used for endpoints whose request body doesn't fit
 * the identifier/email heuristics in {@link createMockHttpAdapter}.
 */
function createGenericMockHttpAdapter(responseData: unknown = { setupData: {} }): HttpAdapter & {
  getLastBody: () => unknown;
} {
  let lastBody: unknown;

  const adapter: HttpAdapter = {
    request: jest.fn().mockImplementation(async (config: { method?: string; body?: unknown }) => {
      if (config.method === 'POST' && config.body) {
        lastBody = config.body;
      }
      return {
        status: 200,
        data: responseData,
        headers: {},
      };
    }),
  };

  return Object.assign(adapter, {
    getLastBody: () => lastBody,
  });
}

function createConfig(overrides: Partial<NAuthClientConfig> = {}): NAuthClientConfig {
  const mockAdapter = createMockHttpAdapter();
  return {
    baseUrl: 'http://test/auth',
    tokenDelivery: 'json',
    httpAdapter: mockAdapter,
    navigationHandler: async () => {},
    ...overrides,
  } as NAuthClientConfig;
}

describe('AuthService', () => {
  describe('login', () => {
    it('does not send recaptchaToken when not provided and no RecaptchaService', async () => {
      const config = createConfig();
      const adapter = config.httpAdapter as ReturnType<typeof createMockHttpAdapter>;
      const auth = new AuthService(config, adapter as never, undefined, undefined);

      await auth.login('u', 'p');

      const body = adapter.getLoginBody() as { recaptchaToken?: string };
      expect(body?.recaptchaToken).toBeUndefined();
    });

    it('sends recaptchaToken when provided as third argument', async () => {
      const config = createConfig();
      const adapter = config.httpAdapter as ReturnType<typeof createMockHttpAdapter>;
      const auth = new AuthService(config, adapter as never, undefined, undefined);

      await auth.login('u', 'p', 'manual-token');

      const body = adapter.getLoginBody() as { recaptchaToken?: string };
      expect(body?.recaptchaToken).toBe('manual-token');
    });

    it('sends auto-generated token when RecaptchaService v3 returns token', async () => {
      const config = createConfig({
        recaptcha: { enabled: true, version: 'v3', siteKey: 'k', action: 'login' },
      });
      const adapter = config.httpAdapter as ReturnType<typeof createMockHttpAdapter>;
      const mockRecaptcha: jest.Mocked<Pick<RecaptchaService, 'execute' | 'shouldSkip'>> = {
        execute: jest.fn().mockResolvedValue('auto-token'),
        shouldSkip: jest.fn().mockReturnValue(false),
      };
      const auth = new AuthService(config, adapter as never, undefined, mockRecaptcha as never);

      await auth.login('u', 'p');

      const body = adapter.getLoginBody() as { recaptchaToken?: string };
      expect(body?.recaptchaToken).toBe('auto-token');
      expect(mockRecaptcha.execute).toHaveBeenCalledWith('login');
    });

    it('does not send token when RecaptchaService is present but config.recaptcha.enabled is false', async () => {
      const config = createConfig({ recaptcha: { enabled: false, version: 'v3', siteKey: 'k' } });
      const adapter = config.httpAdapter as ReturnType<typeof createMockHttpAdapter>;
      const mockRecaptcha: jest.Mocked<Pick<RecaptchaService, 'execute' | 'shouldSkip'>> = {
        execute: jest.fn().mockResolvedValue('x'),
        shouldSkip: jest.fn().mockReturnValue(false),
      };
      const auth = new AuthService(config, adapter as never, undefined, mockRecaptcha as never);

      await auth.login('u', 'p');

      const body = adapter.getLoginBody() as { recaptchaToken?: string };
      expect(body?.recaptchaToken).toBeUndefined();
      expect(mockRecaptcha.execute).not.toHaveBeenCalled();
    });

    it('does not send token when RecaptchaService.shouldSkip returns true', async () => {
      const config = createConfig({
        recaptcha: { enabled: true, version: 'v3', siteKey: 'k', action: 'login' },
      });
      const adapter = config.httpAdapter as ReturnType<typeof createMockHttpAdapter>;
      const mockRecaptcha: jest.Mocked<Pick<RecaptchaService, 'execute' | 'shouldSkip'>> = {
        execute: jest.fn().mockResolvedValue('x'),
        shouldSkip: jest.fn().mockReturnValue(true),
      };
      const auth = new AuthService(config, adapter as never, undefined, mockRecaptcha as never);

      await auth.login('u', 'p');

      const body = adapter.getLoginBody() as { recaptchaToken?: string };
      expect(body?.recaptchaToken).toBeUndefined();
      expect(mockRecaptcha.execute).not.toHaveBeenCalled();
    });

    it('does not throw when RecaptchaService.execute rejects; continues without token', async () => {
      const config = createConfig({
        recaptcha: { enabled: true, version: 'v3', siteKey: 'k', action: 'login' },
      });
      const adapter = config.httpAdapter as ReturnType<typeof createMockHttpAdapter>;
      const mockRecaptcha: jest.Mocked<Pick<RecaptchaService, 'execute' | 'shouldSkip'>> = {
        execute: jest.fn().mockRejectedValue(new Error('recaptcha failed')),
        shouldSkip: jest.fn().mockReturnValue(false),
      };
      const auth = new AuthService(config, adapter as never, undefined, mockRecaptcha as never);

      await expect(auth.login('u', 'p')).resolves.toBeDefined();

      const body = adapter.getLoginBody() as { recaptchaToken?: string };
      expect(body?.recaptchaToken).toBeUndefined();
    });
  });

  describe('signup', () => {
    it('does not send recaptchaToken when not in payload and no RecaptchaService', async () => {
      const config = createConfig();
      const adapter = config.httpAdapter as ReturnType<typeof createMockHttpAdapter>;
      const auth = new AuthService(config, adapter as never, undefined, undefined);

      await auth.signup({ email: 'e@e.com', password: 'SecurePass123!' });

      const body = adapter.getSignupBody() as { recaptchaToken?: string };
      expect(body?.recaptchaToken).toBeUndefined();
    });

    it('sends auto-generated token when RecaptchaService v3 returns token', async () => {
      const config = createConfig({
        recaptcha: { enabled: true, version: 'v3', siteKey: 'k', action: 'signup' },
      });
      const adapter = config.httpAdapter as ReturnType<typeof createMockHttpAdapter>;
      const mockRecaptcha: jest.Mocked<Pick<RecaptchaService, 'execute' | 'shouldSkip'>> = {
        execute: jest.fn().mockResolvedValue('signup-auto-token'),
        shouldSkip: jest.fn().mockReturnValue(false),
      };
      const auth = new AuthService(config, adapter as never, undefined, mockRecaptcha as never);

      await auth.signup({ email: 'e@e.com', password: 'SecurePass123!' });

      const body = adapter.getSignupBody() as { recaptchaToken?: string };
      expect(body?.recaptchaToken).toBe('signup-auto-token');
      expect(mockRecaptcha.execute).toHaveBeenCalledWith('signup');
    });

    it('keeps existing recaptchaToken in payload (v2 manual) and does not overwrite', async () => {
      const config = createConfig();
      const adapter = config.httpAdapter as ReturnType<typeof createMockHttpAdapter>;
      const auth = new AuthService(config, adapter as never, undefined, undefined);

      await auth.signup({
        email: 'e@e.com',
        password: 'SecurePass123!',
        recaptchaToken: 'v2-manual-token',
      });

      const body = adapter.getSignupBody() as { recaptchaToken?: string };
      expect(body?.recaptchaToken).toBe('v2-manual-token');
    });
  });

  describe('getSetupData', () => {
    it('includes setupData in the request body when provided', async () => {
      const adapter = createGenericMockHttpAdapter();
      const config = createConfig({ httpAdapter: adapter });
      const auth = new AuthService(config, adapter as never, undefined, undefined);

      await auth.getSetupData('session-123', 'sms', { phoneNumber: '+14155552671' });

      const body = adapter.getLastBody() as Record<string, unknown>;
      expect(body).toEqual({
        session: 'session-123',
        method: 'sms',
        setupData: { phoneNumber: '+14155552671' },
      });
    });

    it('omits the setupData key entirely when not provided', async () => {
      const adapter = createGenericMockHttpAdapter();
      const config = createConfig({ httpAdapter: adapter });
      const auth = new AuthService(config, adapter as never, undefined, undefined);

      await auth.getSetupData('session-123', 'totp');

      const body = adapter.getLastBody() as Record<string, unknown>;
      expect(body).not.toHaveProperty('setupData');
      expect(body).toEqual({ session: 'session-123', method: 'totp' });
    });
  });

  describe('setupMfaDevice', () => {
    it('includes setupData in the request body when provided', async () => {
      const adapter = createGenericMockHttpAdapter();
      const config = createConfig({ httpAdapter: adapter });
      const auth = new AuthService(config, adapter as never, undefined, undefined);

      await auth.setupMfaDevice('sms', { phoneNumber: '+14155552671' });

      const body = adapter.getLastBody() as Record<string, unknown>;
      expect(body).toEqual({
        methodName: 'sms',
        setupData: { phoneNumber: '+14155552671' },
      });
    });

    it('omits the setupData key entirely when not provided', async () => {
      const adapter = createGenericMockHttpAdapter();
      const config = createConfig({ httpAdapter: adapter });
      const auth = new AuthService(config, adapter as never, undefined, undefined);

      await auth.setupMfaDevice('totp');

      const body = adapter.getLastBody() as Record<string, unknown>;
      expect(body).not.toHaveProperty('setupData');
      expect(body).toEqual({ methodName: 'totp' });
    });
  });
});
