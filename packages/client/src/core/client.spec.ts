import { NAuthClient } from './client';
import { NAuthClientConfig, NAuthStorageAdapter } from '../types/config.types';
import { AuthChallenge } from '../types/auth.types';

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

type FetchMock = jest.MockInstance<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

const getFetchMock = (): FetchMock => globalThis.fetch as unknown as FetchMock;

const createMockResponse = (params: {
  ok: boolean;
  status: number;
  body: unknown;
}): Response => {
  const rawText = typeof params.body === 'string' ? params.body : JSON.stringify(params.body);

  // Minimal Response shape required by FetchAdapter:
  // - ok/status/text()
  // - headers.forEach()
  return {
    ok: params.ok,
    status: params.status,
    text: async () => rawText,
    headers: {
      forEach: (_cb: (value: string, key: string) => void): void => undefined,
    } as unknown as Headers,
  } as unknown as Response;
};

describe('NAuthClient', () => {
  const baseConfig: NAuthClientConfig = {
    baseUrl: 'https://api.example.com/auth',
    tokenDelivery: 'json',
    storage: new MockStorage(),
    onSessionExpired: () => undefined,
  };

  beforeEach(() => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('handles login token response', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    const response = await client.login('user@example.com', 'password');
    expect(response.accessToken).toBe('a1');
    const token = await client.getAccessToken();
    expect(token).toBe('a1');
  });

  it('auto-navigates to redirects.loginSuccess after login success', async () => {
    const navigationHandler = jest.fn();
    const client = new NAuthClient({
      ...baseConfig,
      navigationHandler,
      redirects: {
        loginSuccess: '/dashboard',
      },
    });
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    await client.login('user@example.com', 'password');

    expect(navigationHandler).toHaveBeenCalledWith('/dashboard');
  });

  it('auto-navigates to redirects.loginSuccess in cookies mode after login success', async () => {
    const navigationHandler = jest.fn();
    const client = new NAuthClient({
      ...baseConfig,
      tokenDelivery: 'cookies',
      navigationHandler,
      redirects: {
        loginSuccess: '/dashboard',
      },
    });
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    await client.login('user@example.com', 'password');

    expect(navigationHandler).toHaveBeenCalledWith('/dashboard');
  });

  it('auto-navigates to redirects.signupSuccess after signup success', async () => {
    const navigationHandler = jest.fn();
    const client = new NAuthClient({
      ...baseConfig,
      navigationHandler,
      redirects: {
        loginSuccess: '/dashboard',
        signupSuccess: '/onboarding',
      },
    });
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    await client.signup({ email: 'user@example.com', password: 'password' });

    expect(navigationHandler).toHaveBeenCalledWith('/onboarding');
  });

  it('skips auto-navigation when redirects.loginSuccess is explicitly disabled', async () => {
    const navigationHandler = jest.fn();
    const client = new NAuthClient({
      ...baseConfig,
      navigationHandler,
      redirects: {
        loginSuccess: null,
      },
    });
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    await client.login('user@example.com', 'password');

    expect(navigationHandler).not.toHaveBeenCalled();
  });

  it('skips auto-navigation when redirects.signupSuccess is explicitly disabled', async () => {
    const navigationHandler = jest.fn();
    const client = new NAuthClient({
      ...baseConfig,
      navigationHandler,
      redirects: {
        loginSuccess: '/dashboard',
        signupSuccess: null,
      },
    });
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    await client.signup({ email: 'user@example.com', password: 'password' });

    expect(navigationHandler).not.toHaveBeenCalled();
  });

  it('throws on non-OK response', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 401,
        body: { code: 'AUTH_INVALID_CREDENTIALS', message: 'invalid' },
      }),
    );
    await expect(client.login('x', 'y')).rejects.toThrow('invalid');
  });

  it('sends device token header in JSON mode (trusted device feature)', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_device_token', 'dt1');

    const client = new NAuthClient({
      ...baseConfig,
      storage,
    });

    getFetchMock().mockImplementation(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.endsWith('/login')) {
        return createMockResponse({
          ok: true,
          status: 200,
          body: {
            accessToken: 'a1',
            refreshToken: 'r1',
            accessTokenExpiresAt: 10,
            refreshTokenExpiresAt: 20,
            user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
          },
        });
      }

      if (url.endsWith('/is-trusted-device')) {
        const headers = (options?.headers ?? {}) as Record<string, string>;
        expect(headers['X-Device-Token']).toBe('dt1');
        return createMockResponse({
          ok: true,
          status: 200,
          body: { trusted: true },
        });
      }

      return createMockResponse({
        ok: true,
        status: 200,
        body: {},
      });
    });

    await client.login('user@example.com', 'password');
    const result = await client.isTrustedDevice();
    expect(result.trusted).toBe(true);
  });

  it('refreshTokens in cookies mode does not persist tokens to storage', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({
      baseUrl: 'https://api.example.com',
      authPathPrefix: '/auth',
      tokenDelivery: 'cookies',
      storage,
      onSessionExpired: () => undefined,
    });

    getFetchMock().mockImplementation(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === 'https://api.example.com/auth/refresh') {
        expect(options?.method).toBe('POST');
        expect(options?.credentials).toBe('include');
        return createMockResponse({
          ok: true,
          status: 200,
          body: {
            accessToken: 'a2',
            refreshToken: 'r2',
            accessTokenExpiresAt: 10,
            refreshTokenExpiresAt: 20,
          },
        });
      }

      return createMockResponse({
        ok: true,
        status: 200,
        body: {},
      });
    });

    const tokens = await client.refreshTokens();
    expect(tokens.accessToken).toBe('a2');

    // Cookies mode should not persist tokens client-side
    expect(await storage.getItem('nauth_access_token')).toBeNull();
    expect(await storage.getItem('nauth_refresh_token')).toBeNull();
  });

  it('clearLocalAuthState clears persisted user and tokens', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_user', JSON.stringify({ sub: 'u1', email: 'user@example.com' }));
    await storage.setItem('nauth_access_token', 'a1');
    await storage.setItem('nauth_refresh_token', 'r1');
    await storage.setItem('nauth_access_token_expires_at', '10');
    await storage.setItem('nauth_refresh_token_expires_at', '20');

    const client = new NAuthClient({
      ...baseConfig,
      storage,
    });

    await client.initialize();
    expect(client.isAuthenticatedSync()).toBe(true);

    await client.clearLocalAuthState();

    expect(client.isAuthenticatedSync()).toBe(false);
    expect(await storage.getItem('nauth_user')).toBeNull();
    expect(await storage.getItem('nauth_access_token')).toBeNull();
    expect(await storage.getItem('nauth_refresh_token')).toBeNull();
    expect(await storage.getItem('nauth_access_token_expires_at')).toBeNull();
    expect(await storage.getItem('nauth_refresh_token_expires_at')).toBeNull();
  });

  it('handles signup with challenge response', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          challengeName: 'VERIFY_EMAIL',
          session: 'session-123',
          challengeParameters: { availableMethods: ['email'] },
        },
      }),
    });

    const response = await client.signup({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(response.challengeName).toBe('VERIFY_EMAIL');
  });

  it('handles signup with success response', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    const response = await client.signup({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(response.accessToken).toBe('a1');
  });

  it('handles logout', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_access_token', 'a1');
    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(createMockResponse({ ok: true, status: 200, body: {} }));

    await client.logout();
    expect(await storage.getItem('nauth_access_token')).toBeNull();
  });

  it('handles logout with forgetDevice', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_device_token', 'dt1');
    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(createMockResponse({ ok: true, status: 200, body: {} }));

    await client.logout(true);
    // Device token should be removed from storage in all modes (defensive cleanup)
    expect(await storage.getItem('nauth_device_token')).toBeNull();
  });

  it('handles logout with forgetDevice in cookies mode (defensive cleanup)', async () => {
    const storage = new MockStorage();
    // Simulate a bug where device token ended up in localStorage in cookies mode
    await storage.setItem('nauth_device_token', 'undefined');
    const client = new NAuthClient({ ...baseConfig, storage, tokenDelivery: 'cookies' });

    getFetchMock().mockResolvedValue(createMockResponse({ ok: true, status: 200, body: {} }));

    await client.logout(true);
    // Should defensively clean up localStorage even in cookies mode
    expect(await storage.getItem('nauth_device_token')).toBeNull();
  });

  it('handles logoutAll', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_access_token', 'a1');
    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(
      createMockResponse({ ok: true, status: 200, body: { message: 'Success', revokedCount: 5 } }),
    );

    const result = await client.logoutAll();
    expect(result.revokedCount).toBe(5);
    expect(await storage.getItem('nauth_access_token')).toBeNull();
  });

  it('handles respondToChallenge with TOTP setup', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    const response = await client.respondToChallenge({
      type: AuthChallenge.MFA_SETUP_REQUIRED,
      session: 'session-123',
      method: 'totp',
      setupData: { secret: 'JBSWY3DPEHPK3PXP', code: '123456' },
    });
    expect(response.accessToken).toBe('a1');
  });

  it('throws error when respondToChallenge missing TOTP secret', async () => {
    const client = new NAuthClient(baseConfig);
    await expect(
      client.respondToChallenge({
        type: AuthChallenge.MFA_SETUP_REQUIRED,
        session: 'session-123',
        method: 'totp',
        setupData: { code: '123456' },
      }),
    ).rejects.toThrow('TOTP setup requires secret');
  });

  it('handles resendCode', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({ ok: true, status: 200, body: { destination: 'user@example.com' } }),
    );

    const result = await client.resendCode('session-123');
    expect(result.destination).toBe('user@example.com');
  });

  it('handles getSetupData', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: {
          setupData: { secret: 'JBSWY3DPEHPK3PXP', qrCode: 'data:image/png;base64,...', manualEntryKey: 'ABCD EFGH' },
        },
      }),
    );

    const result = await client.getSetupData('session-123', 'totp');
    expect((result.setupData as any).secret).toBe('JBSWY3DPEHPK3PXP');
  });

  it('handles getChallengeData', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { challengeData: { challenge: 'challenge-123', rpId: 'example.com' } },
      }),
    );

    const result = await client.getChallengeData('session-123', 'passkey');
    expect((result.challengeData as any).challenge).toBe('challenge-123');
  });

  it('handles getProfile', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({ ...baseConfig, storage });
    const user = { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true };

    getFetchMock().mockResolvedValue(createMockResponse({ ok: true, status: 200, body: user }));

    const profile = await client.getProfile();
    expect(profile.sub).toBe('u1');
    expect(await storage.getItem('nauth_user')).toBeTruthy();
  });

  it('handles updateProfile', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({ ...baseConfig, storage });
    const updatedUser = { sub: 'u1', email: 'new@example.com', isEmailVerified: true, hasPasswordHash: true };

    getFetchMock().mockResolvedValue(createMockResponse({ ok: true, status: 200, body: updatedUser }));

    const result = await client.updateProfile({ email: 'new@example.com' });
    expect(result.email).toBe('new@example.com');
  });

  it('handles changePassword', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(createMockResponse({ ok: true, status: 200, body: { message: 'Success' } }));

    await client.changePassword('oldPassword', 'newPassword');
    expect(getFetchMock()).toHaveBeenCalled();
  });

  it('handles forgotPassword', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({ ok: true, status: 200, body: { destination: 'user@example.com' } }),
    );

    const result = await client.forgotPassword('user@example.com');
    expect(result.destination).toBe('user@example.com');
  });

  it('handles confirmForgotPassword', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { success: true, mustChangePassword: false },
      }),
    );

    const result = await client.confirmForgotPassword('user@example.com', '123456', 'newPassword');
    expect(result.success).toBe(true);
  });

  it('handles resetPasswordWithCode', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { success: true },
      }),
    );

    const result = await client.resetPasswordWithCode('user@example.com', '123456', 'newPassword');
    expect(result.success).toBe(true);
  });

  it('handles getMfaStatus', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: {
          enabled: true,
          required: false,
          methods: ['totp'],
          availableMethods: ['totp'],
          hasBackupCodes: false,
          preferredMethod: 'totp',
          mfaExempt: false,
          mfaExemptReason: null,
          mfaExemptGrantedAt: null,
        },
      }),
    );

    const status = await client.getMfaStatus();
    expect(status.enabled).toBe(true);
    expect(status.methods).toContain('totp');
  });

  it('handles initialize and loads user from storage', async () => {
    const storage = new MockStorage();
    const user = { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true };
    await storage.setItem('nauth_user', JSON.stringify(user));
    await storage.setItem('nauth_access_token', 'a1');
    await storage.setItem('nauth_access_token_expires_at', String(Date.now() + 3600000));

    const client = new NAuthClient({ ...baseConfig, storage });
    await client.initialize();

    expect(client.isAuthenticatedSync()).toBe(true);
    const currentUser = await client.getCurrentUser();
    expect(currentUser?.sub).toBe('u1');
  });

  it('handles dispose and removes event listeners', () => {
    const client = new NAuthClient(baseConfig);
    // Should not throw
    client.dispose();
    expect(client).toBeDefined();
  });

  it('handles clearLocalAuthState with forgetDevice', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_device_token', 'dt1');
    const client = new NAuthClient({ ...baseConfig, storage });

    await client.clearLocalAuthState({ forgetDevice: true });
    // Device token should be removed in all modes (defensive cleanup)
    expect(await storage.getItem('nauth_device_token')).toBeNull();
  });

  it('handles clearLocalAuthState with forgetDevice in cookies mode (defensive cleanup)', async () => {
    const storage = new MockStorage();
    // Simulate bug where device token is in localStorage
    await storage.setItem('nauth_device_token', 'undefined');
    const client = new NAuthClient({ ...baseConfig, storage, tokenDelivery: 'cookies' });

    await client.clearLocalAuthState({ forgetDevice: true });
    // Should defensively clean up localStorage even in cookies mode
    expect(await storage.getItem('nauth_device_token')).toBeNull();
  });

  it('handles getMfaDevices', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: [{ id: 1, type: 'totp', name: 'My Phone', isPreferred: true }],
      }),
    );

    const devices = await client.getMfaDevices();
    expect(Array.isArray(devices)).toBe(true);
    expect(devices.length).toBeGreaterThan(0);
  });

  it('handles setupMfaDevice', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { secret: 'JBSWY3DPEHPK3PXP', qrCode: 'data:image/png;base64,...' },
      }),
    );

    const result = await client.setupMfaDevice('totp');
    expect(result).toBeDefined();
  });

  it('handles verifyMfaSetup', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { deviceId: 123 },
      }),
    );

    const result = await client.verifyMfaSetup('totp', { secret: 'JBSWY3DPEHPK3PXP', code: '123456' });
    expect(result.deviceId).toBe(123);
  });

  it('handles verifyMfaSetup with deviceName', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { deviceId: 123 },
      }),
    );

    const result = await client.verifyMfaSetup('totp', { secret: 'JBSWY3DPEHPK3PXP', code: '123456' }, 'My Device');
    expect(result.deviceId).toBe(123);
  });

  it('handles removeMfaDevice', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { message: 'Device removed' },
      }),
    );

    const result = await client.removeMfaDevice('totp');
    expect(result.message).toBe('Device removed');
  });

  it('handles removeMfaDeviceById', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { removedDeviceId: 123, removedMethod: 'totp', mfaDisabled: false },
      }),
    );

    const result = await client.removeMfaDeviceById(123);
    expect(result.removedDeviceId).toBe(123);
    expect(result.removedMethod).toBe('totp');
    expect(result.mfaDisabled).toBe(false);
  });


  it('handles generateBackupCodes', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { codes: ['code1', 'code2', 'code3'] },
      }),
    );

    const codes = await client.generateBackupCodes();
    expect(Array.isArray(codes)).toBe(true);
    expect(codes.length).toBeGreaterThan(0);
  });

  it('handles event subscription and unsubscription', () => {
    const client = new NAuthClient(baseConfig);
    const listener = jest.fn();
    const unsubscribe = client.on('auth:success', listener);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    client.off('auth:success', listener);
  });

  it('handles wildcard event subscription', () => {
    const client = new NAuthClient(baseConfig);
    const listener = jest.fn();
    const unsubscribe = client.on('*', listener);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('handles trustDevice in JSON mode', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({ ...baseConfig, storage, tokenDelivery: 'json' });
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { deviceToken: 'device-token-123' },
      }),
    );

    const result = await client.trustDevice();
    expect(result.deviceToken).toBe('device-token-123');
    expect(await storage.getItem('nauth_device_token')).toBe('device-token-123');
  });

  it('handles trustDevice in cookies mode (does not store to localStorage)', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({ ...baseConfig, storage, tokenDelivery: 'cookies' });
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: {}, // In cookies mode, interceptor strips deviceToken from response body
      }),
    );

    const result = await client.trustDevice();
    // In cookies mode, deviceToken is set as httpOnly cookie by backend, not returned in body
    expect(result.deviceToken).toBeUndefined();
    // Should NOT store to localStorage in cookies mode
    expect(await storage.getItem('nauth_device_token')).toBeNull();
  });

  it('handles getAuditHistory', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { events: [], total: 0, page: 1 },
      }),
    );

    const history = await client.getAuditHistory({ page: 1, limit: 20 });
    expect(history).toBeDefined();
  });

  it('handles getAuditHistory with array parameters', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { events: [], total: 0, page: 1 },
      }),
    );

    const history = await client.getAuditHistory({
      eventTypes: ['LOGIN_SUCCESS', 'LOGOUT'],
      eventStatus: ['SUCCESS', 'FAILURE'],
    });
    expect(history).toBeDefined();
  });

  it('handles getStoredChallenge', async () => {
    const storage = new MockStorage();
    const challenge = { challengeName: 'VERIFY_EMAIL', session: 'session-123' };
    await storage.setItem('nauth_challenge_session', JSON.stringify(challenge));
    const client = new NAuthClient({ ...baseConfig, storage });

    const stored = await client.getStoredChallenge();
    expect(stored).toEqual(challenge);
  });

  it('handles getStoredChallenge when not stored', async () => {
    const client = new NAuthClient(baseConfig);
    const stored = await client.getStoredChallenge();
    expect(stored).toBeNull();
  });

  it('handles clearStoredChallenge', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_challenge_session', JSON.stringify({ challengeName: 'VERIFY_EMAIL' }));
    const client = new NAuthClient({ ...baseConfig, storage });

    await client.clearStoredChallenge();
    expect(await storage.getItem('nauth_challenge_session')).toBeNull();
  });

  it('handles getChallengeRouter', () => {
    const client = new NAuthClient(baseConfig);
    const router = client.getChallengeRouter();
    expect(router).toBeDefined();
  });

  it('handles storeOauthState', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({ ...baseConfig, storage });

    await client.storeOauthState('app-state-123');
    expect(await storage.getItem('nauth_oauth_state')).toBe('app-state-123');
  });

  it('handles storeOauthState with empty string', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({ ...baseConfig, storage });

    await client.storeOauthState('');
    expect(await storage.getItem('nauth_oauth_state')).toBeNull();
  });

  it('handles getLastOauthState', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_oauth_state', 'app-state-123');
    const client = new NAuthClient({ ...baseConfig, storage });

    const state = await client.getLastOauthState();
    expect(state).toBe('app-state-123');
    expect(await storage.getItem('nauth_oauth_state')).toBeNull();
  });

  it('handles getLastOauthState when not stored', async () => {
    const client = new NAuthClient(baseConfig);
    const state = await client.getLastOauthState();
    expect(state).toBeNull();
  });

  it('handles isAuthenticated async', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_access_token', 'token-123');
    const client = new NAuthClient({ ...baseConfig, storage });

    const isAuth = await client.isAuthenticated();
    expect(isAuth).toBe(true);
  });

  it('handles isAuthenticated async when no token', async () => {
    const client = new NAuthClient(baseConfig);
    const isAuth = await client.isAuthenticated();
    expect(isAuth).toBe(false);
  });

  it('handles initialize with invalid JSON in storage', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_user', 'invalid-json');
    const client = new NAuthClient({ ...baseConfig, storage });

    await client.initialize();
    expect(await storage.getItem('nauth_user')).toBeNull();
  });

  it('handles getStoredChallenge with invalid JSON', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_challenge_session', 'invalid-json');
    const client = new NAuthClient({ ...baseConfig, storage });

    const stored = await client.getStoredChallenge();
    expect(stored).toBeNull();
  });

  it('handles login with challenge response', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          challengeName: 'MFA_REQUIRED',
          session: 'session-123',
          challengeParameters: { availableMethods: ['totp'] },
        },
      }),
    });

    const response = await client.login('user@example.com', 'password');
    expect(response.challengeName).toBe('MFA_REQUIRED');
  });

  it('handles login with non-NAuthClientError', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockRejectedValue(new Error('Network error'));

    await expect(client.login('user@example.com', 'password')).rejects.toThrow();
  });

  it('handles signup with challenge response', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          challengeName: 'VERIFY_EMAIL',
          session: 'session-123',
        },
      }),
    });

    const response = await client.signup({
      email: 'new@example.com',
      password: 'Password123!',
    });
    expect(response.challengeName).toBe('VERIFY_EMAIL');
  });

  it('handles signup with non-NAuthClientError', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockRejectedValue(new Error('Network error'));

    await expect(
      client.signup({
        email: 'new@example.com',
        password: 'Password123!',
      }),
    ).rejects.toThrow();
  });

  it('handles signup error handling', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 400,
        body: { code: 'VALIDATION_FAILED', message: 'Email already exists' },
      }),
    );

    await expect(
      client.signup({
        email: 'existing@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow();
  });

  it('handles respondToChallenge error handling', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 400,
        body: { code: 'CHALLENGE_INVALID', message: 'Invalid code' },
      }),
    );

    await expect(
      client.respondToChallenge({
        type: AuthChallenge.MFA_REQUIRED,
        session: 'session-123',
        method: 'totp',
        code: '000000',
      }),
    ).rejects.toThrow();
  });

  it('handles refreshTokens error when no refresh token in JSON mode', async () => {
    const client = new NAuthClient(baseConfig);
    await expect(client.refreshTokens()).rejects.toThrow();
  });

  it('handles refreshTokens in JSON mode with refresh token', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_refresh_token', 'refresh-token-123');
    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          accessTokenExpiresAt: Date.now() + 3600000,
          refreshTokenExpiresAt: Date.now() + 86400000,
        },
      }),
    );

    const tokens = await client.refreshTokens();
    expect(tokens.accessToken).toBe('new-access-token');
  });

  it('clears local auth state when refreshTokens fails with 401', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_refresh_token', 'expired-token');
    await storage.setItem('nauth_access_token', 'old-access');
    await storage.setItem('nauth_user', JSON.stringify({ sub: 'u1', email: 'test@example.com' }));

    const onSessionExpired = jest.fn();
    const client = new NAuthClient({ ...baseConfig, storage, onSessionExpired });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 401,
        body: {
          code: 'AUTH_SESSION_EXPIRED',
          message: 'Session expired',
        },
      }),
    );

    await expect(client.refreshTokens()).rejects.toThrow();

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(await storage.getItem('nauth_access_token')).toBeNull();
    expect(await storage.getItem('nauth_refresh_token')).toBeNull();
    expect(await storage.getItem('nauth_user')).toBeNull();
    expect(client.isAuthenticatedSync()).toBe(false);
  });

  it('emits auth:session_expired event when refreshTokens fails with 401', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_refresh_token', 'expired-token');

    const client = new NAuthClient({ ...baseConfig, storage });

    const eventListener = jest.fn();
    client.on('auth:session_expired', eventListener);

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 401,
        body: {
          code: 'AUTH_SESSION_EXPIRED',
          message: 'Session expired',
        },
      }),
    );

    await expect(client.refreshTokens()).rejects.toThrow();

    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'auth:session_expired',
        data: {},
      }),
    );
  });

  it('does not clear auth state when refreshTokens fails with non-401 error', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_refresh_token', 'valid-token');
    await storage.setItem('nauth_access_token', 'access-token');
    await storage.setItem('nauth_user', JSON.stringify({ sub: 'u1', email: 'test@example.com' }));

    const onSessionExpired = jest.fn();
    const client = new NAuthClient({ ...baseConfig, storage, onSessionExpired });

    // Initialize to load user into currentUser
    await client.initialize();

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 500,
        body: {
          code: 'INTERNAL_ERROR',
          message: 'Server error',
        },
      }),
    );

    await expect(client.refreshTokens()).rejects.toThrow();

    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(await storage.getItem('nauth_user')).not.toBeNull();
    expect(client.isAuthenticatedSync()).toBe(true);
  });

  it('handles loginWithSocial', async () => {
    const mockWindow = {
      location: { href: '' },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;
    const client = new NAuthClient(baseConfig);

    await client.loginWithSocial('google', { returnTo: '/callback', appState: 'state-123' });

    expect(mockWindow.location.href).toContain('/social/google/redirect');
    expect(mockWindow.location.href).toContain('returnTo');
    expect(mockWindow.location.href).toContain('appState=state-123');
    delete (global as any).window;
  });

  it('handles loginWithSocial with link action', async () => {
    const mockWindow = {
      location: { href: '' },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;
    const client = new NAuthClient(baseConfig);

    await client.loginWithSocial('apple', { action: 'link', returnTo: '/settings' });

    expect(mockWindow.location.href).toContain('action=link');
    delete (global as any).window;
  });

  it('handles exchangeSocialRedirect', async () => {
    const mockWindow = {
      location: { replace: jest.fn() },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    const response = await client.exchangeSocialRedirect('exchange-token-123');
    expect(response.accessToken).toBe('a1');
    delete (global as any).window;
  });

  it('throws error when exchangeSocialRedirect with empty token', async () => {
    const mockWindow = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;
    const client = new NAuthClient(baseConfig);
    await expect(client.exchangeSocialRedirect('')).rejects.toThrow('Missing exchangeToken');
    delete (global as any).window;
  });

  it('exchangeSocialRedirect passes appState in context to onAuthResponse', async () => {
    const mockWindow = {
      location: { replace: jest.fn() },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;

    const onAuthResponseMock = jest.fn();
    const client = new NAuthClient({
      ...baseConfig,
      onAuthResponse: onAuthResponseMock,
    });

    // Store appState before calling exchangeSocialRedirect (simulating guard behavior)
    await client.storeOauthState('invite-code-123');

    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    await client.exchangeSocialRedirect('exchange-token-123');

    // Verify onAuthResponse was called with appState in context
    expect(onAuthResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'a1',
        user: expect.objectContaining({ sub: 'u1' }),
      }),
      expect.objectContaining({
        source: 'social',
        appState: 'invite-code-123',
      })
    );

    delete (global as any).window;
  });

  it('exchangeSocialRedirect auto-navigates with appState when no onAuthResponse', async () => {
    const mockWindow = {
      location: { replace: jest.fn() },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;

    const client = new NAuthClient({
      ...baseConfig,
      redirects: {
        loginSuccess: '/dashboard',
      },
    });

    // Store appState before calling exchangeSocialRedirect (simulating guard behavior)
    await client.storeOauthState('invite-code-456');

    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    await client.exchangeSocialRedirect('exchange-token-789');

    // Verify navigation includes appState
    expect(mockWindow.location.replace).toHaveBeenCalledWith('/dashboard?appState=invite-code-456');

    delete (global as any).window;
  });

  it('handles verifyNativeSocial', async () => {
    const mockWindow = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    const response = await client.verifyNativeSocial({
      provider: 'google',
      idToken: 'id-token-123',
      accessToken: 'access-token-123',
    });
    expect(response.accessToken).toBe('a1');
    delete (global as any).window;
  });

  it('handles verifyNativeSocial with challenge', async () => {
    const mockWindow = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          challengeName: 'MFA_REQUIRED',
          session: 'session-123',
        },
      }),
    });

    const response = await client.verifyNativeSocial({
      provider: 'google',
      idToken: 'id-token-123',
    });
    expect(response.challengeName).toBe('MFA_REQUIRED');
    delete (global as any).window;
  });

  it('handles getLinkedAccounts', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { providers: ['google', 'apple'] },
      }),
    );

    const result = await client.getLinkedAccounts();
    expect(result.providers).toEqual(['google', 'apple']);
  });

  it('handles linkSocialAccount', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { message: 'Account linked successfully' },
      }),
    );

    const result = await client.linkSocialAccount('google', 'code-123', 'state-456');
    expect(result.message).toBe('Account linked successfully');
  });

  it('handles unlinkSocialAccount', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { message: 'Account unlinked successfully' },
      }),
    );

    const result = await client.unlinkSocialAccount('google');
    expect(result.message).toBe('Account unlinked successfully');
  });

  it('handles logout error gracefully', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_access_token', 'a1');
    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 500,
        body: { message: 'Server error' },
      }),
    );

    await client.logout();
    expect(await storage.getItem('nauth_access_token')).toBeNull();
  });

  it('handles logoutAll error and still clears state', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_access_token', 'a1');
    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 500,
        body: { message: 'Server error' },
      }),
    );

    await expect(client.logoutAll()).rejects.toThrow();
    expect(await storage.getItem('nauth_access_token')).toBeNull();
  });

  // ============================================================================
  // Ghost Session Prevention Tests
  // ============================================================================

  it('clears challenge session on clearLocalAuthState', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_challenge_session', JSON.stringify({ session: 'challenge-123' }));
    await storage.setItem('nauth_user', JSON.stringify({ sub: 'u1', email: 'user@example.com' }));
    await storage.setItem('nauth_access_token', 'a1');

    const client = new NAuthClient({ ...baseConfig, storage });

    await client.clearLocalAuthState();

    expect(await storage.getItem('nauth_challenge_session')).toBeNull();
    expect(await storage.getItem('nauth_user')).toBeNull();
    expect(await storage.getItem('nauth_access_token')).toBeNull();
  });

  it('clears challenge session on logout', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_challenge_session', JSON.stringify({ session: 'challenge-123' }));
    await storage.setItem('nauth_user', JSON.stringify({ sub: 'u1', email: 'user@example.com' }));

    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { message: 'Logged out' },
      }),
    );

    await client.logout();

    expect(await storage.getItem('nauth_challenge_session')).toBeNull();
    expect(await storage.getItem('nauth_user')).toBeNull();
  });

  it('clears challenge session on logoutAll', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_challenge_session', JSON.stringify({ session: 'challenge-123' }));
    await storage.setItem('nauth_user', JSON.stringify({ sub: 'u1', email: 'user@example.com' }));

    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { message: 'Logged out', revokedCount: 3 },
      }),
    );

    await client.logoutAll();

    expect(await storage.getItem('nauth_challenge_session')).toBeNull();
    expect(await storage.getItem('nauth_user')).toBeNull();
  });

  it('clears challenge session when logout fails', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_challenge_session', JSON.stringify({ session: 'challenge-123' }));
    await storage.setItem('nauth_user', JSON.stringify({ sub: 'u1', email: 'user@example.com' }));

    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 500,
        body: { message: 'Server error' },
      }),
    );

    await client.logout();

    // Should still clear challenge session even if logout request fails
    expect(await storage.getItem('nauth_challenge_session')).toBeNull();
    expect(await storage.getItem('nauth_user')).toBeNull();
  });

  it('clears challenge session when logoutAll fails', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_challenge_session', JSON.stringify({ session: 'challenge-123' }));
    await storage.setItem('nauth_user', JSON.stringify({ sub: 'u1', email: 'user@example.com' }));

    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 500,
        body: { message: 'Server error' },
      }),
    );

    await expect(client.logoutAll()).rejects.toThrow();

    // Should still clear challenge session even if logoutAll request fails
    expect(await storage.getItem('nauth_challenge_session')).toBeNull();
    expect(await storage.getItem('nauth_user')).toBeNull();
  });

  it('clears OAuth state on clearAuthState', async () => {
    // Use sessionStorage for OAuth state
    const mainStorage = new MockStorage();
    const oauthStorage = new MockStorage();

    // Simulate sessionStorage having OAuth state
    await oauthStorage.setItem('nauth_oauth_state', 'invite-code-123');

    const client = new NAuthClient({
      ...baseConfig,
      storage: mainStorage,
    });

    // Manually set OAuth storage for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).oauthStorage = oauthStorage;

    await client.clearLocalAuthState();

    // OAuth state should be cleared
    expect(await oauthStorage.getItem('nauth_oauth_state')).toBeNull();
  });

  it('clears all auth data including challenge and OAuth state on session expiry', async () => {
    const storage = new MockStorage();
    const oauthStorage = new MockStorage();

    await storage.setItem('nauth_user', JSON.stringify({ sub: 'u1', email: 'user@example.com' }));
    await storage.setItem('nauth_access_token', 'a1');
    await storage.setItem('nauth_refresh_token', 'r1');
    await storage.setItem('nauth_challenge_session', JSON.stringify({ session: 'challenge-123' }));
    await oauthStorage.setItem('nauth_oauth_state', 'invite-code-123');

    const client = new NAuthClient({ ...baseConfig, storage });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).oauthStorage = oauthStorage;

    await client.initialize();
    expect(client.isAuthenticatedSync()).toBe(true);

    // Simulate session expiry by clearing auth state
    await client.clearLocalAuthState();

    expect(client.isAuthenticatedSync()).toBe(false);
    expect(await storage.getItem('nauth_user')).toBeNull();
    expect(await storage.getItem('nauth_access_token')).toBeNull();
    expect(await storage.getItem('nauth_refresh_token')).toBeNull();
    expect(await storage.getItem('nauth_challenge_session')).toBeNull();
    expect(await oauthStorage.getItem('nauth_oauth_state')).toBeNull();
  });

  it('handles handleAuthResponse with deviceToken in JSON mode', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({ ...baseConfig, storage });
    const response = {
      accessToken: 'a1',
      refreshToken: 'r1',
      accessTokenExpiresAt: 10,
      refreshTokenExpiresAt: 20,
      deviceToken: 'device-token-123',
      user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
    };

    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: response,
      }),
    });

    await client.login('user@example.com', 'password');
    expect(await storage.getItem('nauth_device_token')).toBe('device-token-123');
  });

  it('handles handleAuthResponse in cookies mode', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({
      ...baseConfig,
      tokenDelivery: 'cookies',
      storage,
    });

    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    await client.login('user@example.com', 'password');
    expect(await storage.getItem('nauth_access_token')).toBeNull();
    expect(await storage.getItem('nauth_user')).toBeTruthy();
  });

  it('handles handleAuthResponse with challenge', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          challengeName: 'VERIFY_EMAIL',
          session: 'session-123',
        },
      }),
    });

    await client.login('user@example.com', 'password');
    const stored = await storage.getItem('nauth_challenge_session');
    expect(stored).toBeTruthy();
  });

  it('handles buildHeaders with CSRF token in cookies mode', async () => {
    const mockDocument = {
      cookie: 'nauth_csrf_token=csrf-token-123',
    };
    const mockWindow = {
      document: mockDocument,
      location: { replace: jest.fn() },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;
    (global as any).document = mockDocument;

    const client = new NAuthClient({
      ...baseConfig,
      tokenDelivery: 'cookies',
    });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { message: 'Success' },
      }),
    );

    await client.changePassword('oldPassword', 'newPassword');
    expect(getFetchMock()).toHaveBeenCalled();
    delete (global as any).window;
    delete (global as any).document;
  });

  it('handles buildHeaders without CSRF token in cookies mode', async () => {
    const mockWindow = {
      document: {
        cookie: '',
      },
      location: { replace: jest.fn() },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;

    const client = new NAuthClient({
      ...baseConfig,
      tokenDelivery: 'cookies',
    });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
      }),
    );

    await client.getProfile();
    delete (global as any).window;
  });

  it('handles buildHeaders with device token in JSON mode', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_device_token', 'device-token-123');
    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
      }),
    );

    await client.getProfile();
    expect(getFetchMock()).toHaveBeenCalled();
  });

  it('handles buildHeaders without device token in JSON mode', async () => {
    const client = new NAuthClient(baseConfig);

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
      }),
    );

    await client.getProfile();
    expect(getFetchMock()).toHaveBeenCalled();
  });

  it('handles handleStorageEvent with nauth_sync key', async () => {
    const storage = new MockStorage();
    const user = { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true };
    await storage.setItem('nauth_user', JSON.stringify(user));

    const mockWindow = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'storage') {
          setTimeout(() => {
            handler({
              key: 'nauth_sync',
              newValue: Date.now().toString(),
            } as StorageEvent);
          }, 10);
        }
      }),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;

    const client = new NAuthClient({ ...baseConfig, storage });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(client.getCurrentUser()?.sub).toBe('u1');
    delete (global as any).window;
  });

  it('handles handleStorageEvent with invalid user JSON', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_user', 'invalid-json');

    const mockWindow = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'storage') {
          setTimeout(() => {
            handler({
              key: 'nauth_sync',
              newValue: Date.now().toString(),
            } as StorageEvent);
          }, 10);
        }
      }),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;

    const client = new NAuthClient({ ...baseConfig, storage });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(client.getCurrentUser()).toBeNull();
    delete (global as any).window;
  });

  it('handles respondToChallenge with setupData validation error - not an object', async () => {
    const client = new NAuthClient(baseConfig);

    await expect(
      client.respondToChallenge({
        type: AuthChallenge.MFA_SETUP_REQUIRED,
        session: 'session-123',
        method: 'totp',
        setupData: null as any,
      }),
    ).rejects.toThrow('TOTP setup requires setupData with both secret and code');
  });

  it('handles respondToChallenge with setupData validation error', async () => {
    const client = new NAuthClient(baseConfig);

    await expect(
      client.respondToChallenge({
        type: AuthChallenge.MFA_SETUP_REQUIRED,
        session: 'session-123',
        method: 'totp',
        setupData: {} as any,
      }),
    ).rejects.toThrow('TOTP setup requires secret');
  });

  it('handles respondToChallenge with setupData missing code', async () => {
    const client = new NAuthClient(baseConfig);

    await expect(
      client.respondToChallenge({
        type: AuthChallenge.MFA_SETUP_REQUIRED,
        session: 'session-123',
        method: 'totp',
        setupData: { secret: 'JBSWY3DPEHPK3PXP' } as any,
      }),
    ).rejects.toThrow('TOTP setup requires code');
  });

  it('handles respondToChallenge with setupData missing secret', async () => {
    const client = new NAuthClient(baseConfig);

    await expect(
      client.respondToChallenge({
        type: AuthChallenge.MFA_SETUP_REQUIRED,
        session: 'session-123',
        method: 'totp',
        setupData: { code: '123456' } as any,
      }),
    ).rejects.toThrow('TOTP setup requires secret');
  });

  it('handles respondToChallenge with non-TOTP method', async () => {
    const client = new NAuthClient(baseConfig);
    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    const response = await client.respondToChallenge({
      type: AuthChallenge.MFA_REQUIRED,
      session: 'session-123',
      method: 'sms',
      code: '123456',
    });
    expect(response.accessToken).toBe('a1');
  });

  it('handles respondToChallenge with challenge response', async () => {
    const client = new NAuthClient(baseConfig);
    const challengeListener = jest.fn();
    client.on('auth:challenge', challengeListener);

    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          challengeName: 'MFA_REQUIRED',
          session: 'session-456',
          challengeParameters: { availableMethods: ['totp'] },
        },
      }),
    });

    const response = await client.respondToChallenge({
      type: AuthChallenge.MFA_REQUIRED,
      session: 'session-123',
      method: 'sms',
      code: '123456',
    });
    expect(response.challengeName).toBe('MFA_REQUIRED');
    expect(challengeListener).toHaveBeenCalled();
  });

  it('handles getAccessToken when no token stored', async () => {
    const storage = new MockStorage();
    const client = new NAuthClient({ ...baseConfig, storage });
    const token = await client.getAccessToken();
    expect(token).toBeNull();
  });

  it('handles getCurrentUser when no user cached', () => {
    const client = new NAuthClient(baseConfig);
    const user = client.getCurrentUser();
    expect(user).toBeNull();
  });

  it('handles isAuthenticatedSync when user is cached', async () => {
    const storage = new MockStorage();
    const user = { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true };
    await storage.setItem('nauth_user', JSON.stringify(user));
    const client = new NAuthClient({ ...baseConfig, storage });
    await client.initialize();

    expect(client.isAuthenticatedSync()).toBe(true);
  });

  it('handles isAuthenticatedSync when no user cached', () => {
    const client = new NAuthClient(baseConfig);
    expect(client.isAuthenticatedSync()).toBe(false);
  });

  it('handles onTokenRefresh callback', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_refresh_token', 'refresh-token-123');
    const onTokenRefresh = jest.fn();
    const client = new NAuthClient({ ...baseConfig, storage, onTokenRefresh });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          accessTokenExpiresAt: Date.now() + 3600000,
          refreshTokenExpiresAt: Date.now() + 86400000,
        },
      }),
    );

    await client.refreshTokens();
    expect(onTokenRefresh).toHaveBeenCalled();
  });

  it('handles onAuthStateChange callback on login', async () => {
    const storage = new MockStorage();
    const onAuthStateChange = jest.fn();
    const client = new NAuthClient({ ...baseConfig, storage, onAuthStateChange });

    getFetchMock().mockResolvedValue({
      ...createMockResponse({
        ok: true,
        status: 200,
        body: {
          accessToken: 'a1',
          refreshToken: 'r1',
          accessTokenExpiresAt: 10,
          refreshTokenExpiresAt: 20,
          user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
        },
      }),
    });

    await client.login('user@example.com', 'password');
    expect(onAuthStateChange).toHaveBeenCalled();
  });

  it('handles onAuthStateChange callback on logout', async () => {
    const storage = new MockStorage();
    await storage.setItem('nauth_access_token', 'a1');
    const onAuthStateChange = jest.fn();
    const client = new NAuthClient({ ...baseConfig, storage, onAuthStateChange });

    getFetchMock().mockResolvedValue(createMockResponse({ ok: true, status: 200, body: {} }));

    await client.logout();
    expect(onAuthStateChange).toHaveBeenCalledWith(null);
  });

  it('handles getCsrfToken when document is undefined', () => {
    const client = new NAuthClient(baseConfig);
    const token = (client as any).getCsrfToken();
    expect(token).toBeNull();
  });

  it('handles buildUrl with path starting with slash', () => {
    const client = new NAuthClient({
      ...baseConfig,
      authPathPrefix: '/api/auth',
    });
    const url = (client as any).buildUrl('/login');
    expect(url).toContain('/api/auth');
  });

  it('handles buildUrl with path not starting with slash', () => {
    const client = new NAuthClient({
      ...baseConfig,
      authPathPrefix: '/api/auth',
    });
    const url = (client as any).buildUrl('login');
    expect(url).toContain('/api/auth');
  });

  it('handles buildUrl without authPathPrefix', () => {
    const client = new NAuthClient(baseConfig);
    const url = (client as any).buildUrl('/login');
    expect(url).toBe('https://api.example.com/auth/login');
  });

  it('handles getTokenDeliveryMode', () => {
    const client = new NAuthClient(baseConfig);
    const mode = (client as any).getTokenDeliveryMode();
    expect(mode).toBe('json');
  });

  it('handles getTokenDeliveryMode in cookies mode', () => {
    const client = new NAuthClient({
      ...baseConfig,
      tokenDelivery: 'cookies',
    });
    const mode = (client as any).getTokenDeliveryMode();
    expect(mode).toBe('cookies');
  });

  it('handles handleStorageEvent with different key', async () => {
    const storage = new MockStorage();
    const user = { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true };
    await storage.setItem('nauth_user', JSON.stringify(user));

    const mockWindow = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'storage') {
          setTimeout(() => {
            handler({
              key: 'other_key',
              newValue: 'value',
            } as StorageEvent);
          }, 10);
        }
      }),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;

    const client = new NAuthClient({ ...baseConfig, storage });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(client.getCurrentUser()).toBeNull();
    delete (global as any).window;
  });

  it('handles handleStorageEvent with storage error', async () => {
    const storage = new MockStorage();
    const mockWindow = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'storage') {
          setTimeout(() => {
            handler({
              key: 'nauth_sync',
              newValue: Date.now().toString(),
            } as StorageEvent);
          }, 10);
        }
      }),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;

    storage.getItem = jest.fn().mockRejectedValue(new Error('Storage error'));

    const client = new NAuthClient({ ...baseConfig, storage });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(client.getCurrentUser()).toBeNull();
    delete (global as any).window;
  });

  it('handles defaultStorage in browser environment', () => {
    const mockWindow = {
      localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;

    const client = new NAuthClient({
      baseUrl: 'https://api.example.com/auth',
      tokenDelivery: 'json',
    });
    expect(client).toBeDefined();
    delete (global as any).window;
  });

  it('handles defaultStorage in non-browser environment', () => {
    delete (global as any).window;
    const client = new NAuthClient({
      baseUrl: 'https://api.example.com/auth',
      tokenDelivery: 'json',
    });
    expect(client).toBeDefined();
  });

  it('handles dispose with window.removeEventListener', () => {
    const mockWindow = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;

    const client = new NAuthClient(baseConfig);
    client.dispose();
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
    delete (global as any).window;
  });

  it('handles dispose without window', () => {
    delete (global as any).window;
    const client = new NAuthClient(baseConfig);
    expect(() => client.dispose()).not.toThrow();
  });

  it('handles admin initialization when admin config provided', () => {
    const client = new NAuthClient({
      ...baseConfig,
      admin: {
        pathPrefix: '/admin',
        headers: {},
        endpoints: {
          signup: '/admin/signup',
          signupSocial: '/admin/signup-social',
          getUsers: '/admin/users',
          getUser: '/admin/users/:sub',
          deleteUser: '/admin/users/:sub',
          disableUser: '/admin/users/:sub/disable',
          enableUser: '/admin/users/:sub/enable',
          setPassword: '/admin/users/:sub/reset-password',
          getUserSessions: '/admin/users/:sub/sessions',
          getAuditHistory: '/admin/audit/history',
        },
      },
    });
    expect(client.admin).toBeDefined();
  });

  it('handles respondToChallenge with error and emits error event', async () => {
    const client = new NAuthClient(baseConfig);
    const errorListener = jest.fn();
    client.on('auth:error', errorListener);

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 400,
        body: { code: 'CHALLENGE_INVALID', message: 'Invalid challenge' },
      }),
    );

    await expect(
      client.respondToChallenge({
        type: AuthChallenge.MFA_REQUIRED,
        session: 'session-123',
        method: 'sms',
        code: '123456',
      }),
    ).rejects.toThrow();

    expect(errorListener).toHaveBeenCalled();
  });

  it('handles verifyNativeSocial with error and emits error event', async () => {
    const mockWindow = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;

    const client = new NAuthClient(baseConfig);
    const errorListener = jest.fn();
    client.on('auth:error', errorListener);

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 400,
        body: { code: 'SOCIAL_TOKEN_INVALID', message: 'Invalid token' },
      }),
    );

    await expect(
      client.verifyNativeSocial({
        provider: 'google',
        idToken: 'invalid-token',
      }),
    ).rejects.toThrow();

    expect(errorListener).toHaveBeenCalled();
    delete (global as any).window;
  });

  it('handles verifyNativeSocial with non-NAuthClientError', async () => {
    const mockWindow = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;

    const client = new NAuthClient(baseConfig);
    const errorListener = jest.fn();
    client.on('auth:error', errorListener);

    getFetchMock().mockRejectedValue(new Error('Network error'));

    await expect(
      client.verifyNativeSocial({
        provider: 'google',
        idToken: 'token',
      }),
    ).rejects.toThrow();

    expect(errorListener).toHaveBeenCalled();
    delete (global as any).window;
  });

  it('handles getCsrfToken with cookie match', () => {
    const mockDocument = {
      cookie: 'nauth_csrf_token=csrf-token-123; other=value',
    };
    const mockWindow = {
      document: mockDocument,
      location: { replace: jest.fn() },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;
    (global as any).document = mockDocument;

    const client = new NAuthClient({
      ...baseConfig,
      tokenDelivery: 'cookies',
    });

    const token = (client as any).getCsrfToken();
    expect(token).toBe('csrf-token-123');
    delete (global as any).window;
    delete (global as any).document;
  });

  it('handles getCsrfToken with URL-encoded cookie value', () => {
    const mockDocument = {
      cookie: 'nauth_csrf_token=csrf%2Dtoken%2D123',
    };
    const mockWindow = {
      document: mockDocument,
      location: { replace: jest.fn() },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;
    (global as any).document = mockDocument;

    const client = new NAuthClient({
      ...baseConfig,
      tokenDelivery: 'cookies',
    });

    const token = (client as any).getCsrfToken();
    expect(token).toBe('csrf-token-123');
    delete (global as any).window;
    delete (global as any).document;
  });

  it('handles buildHeaders with CSRF token when cookie exists', async () => {
    const mockDocument = {
      cookie: 'nauth_csrf_token=csrf-token-123',
    };
    const mockWindow = {
      document: mockDocument,
      location: { replace: jest.fn() },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).window = mockWindow;
    (global as any).document = mockDocument;

    const client = new NAuthClient({
      ...baseConfig,
      tokenDelivery: 'cookies',
    });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { message: 'Success' },
      }),
    );

    await client.changePassword('oldPassword', 'newPassword');
    expect(getFetchMock()).toHaveBeenCalled();
    const callArgs = getFetchMock().mock.calls[0];
    const fetchOptions = callArgs[1] as RequestInit;
    const headers = (fetchOptions?.headers ?? {}) as Record<string, string>;
    expect(headers['x-csrf-token']).toBe('csrf-token-123');
    delete (global as any).window;
    delete (global as any).document;
  });

  it('handles buildHeaders with device token storage error gracefully', async () => {
    const storage = new MockStorage();
    const originalGetItem = storage.getItem.bind(storage);
    storage.getItem = jest.fn(async (key: string) => {
      if (key === 'nauth_device_token') {
        throw new Error('Storage error');
      }
      return originalGetItem(key);
    });
    const client = new NAuthClient({ ...baseConfig, storage });

    getFetchMock().mockResolvedValue(
      createMockResponse({
        ok: true,
        status: 200,
        body: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
      }),
    );

    await client.getProfile();
    expect(getFetchMock()).toHaveBeenCalled();
  });

  describe('reCAPTCHA', () => {
    it('sends recaptchaToken with login request when provided', async () => {
      const client = new NAuthClient(baseConfig);
      getFetchMock().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          body: {
            accessToken: 'a1',
            refreshToken: 'r1',
            user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
          },
        }),
      );

      await client.login('user@example.com', 'password', 'recaptcha-token-123');

      expect(getFetchMock()).toHaveBeenCalled();
      const callArgs = getFetchMock().mock.calls[0];
      const fetchOptions = callArgs[1] as RequestInit;
      const body = JSON.parse(fetchOptions.body as string);
      expect(body.recaptchaToken).toBe('recaptcha-token-123');
    });

    it('does not send recaptchaToken with login when not provided', async () => {
      const client = new NAuthClient(baseConfig);
      getFetchMock().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          body: {
            accessToken: 'a1',
            refreshToken: 'r1',
            user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
          },
        }),
      );

      await client.login('user@example.com', 'password');

      expect(getFetchMock()).toHaveBeenCalled();
      const callArgs = getFetchMock().mock.calls[0];
      const fetchOptions = callArgs[1] as RequestInit;
      const body = JSON.parse(fetchOptions.body as string);
      expect(body.recaptchaToken).toBeUndefined();
    });

    it('sends recaptchaToken with signup request when provided', async () => {
      const client = new NAuthClient(baseConfig);
      getFetchMock().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          body: {
            accessToken: 'a1',
            refreshToken: 'r1',
            user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
          },
        }),
      );

      await client.signup({
        email: 'user@example.com',
        password: 'password',
        recaptchaToken: 'recaptcha-token-456',
      });

      expect(getFetchMock()).toHaveBeenCalled();
      const callArgs = getFetchMock().mock.calls[0];
      const fetchOptions = callArgs[1] as RequestInit;
      const body = JSON.parse(fetchOptions.body as string);
      expect(body.recaptchaToken).toBe('recaptcha-token-456');
    });

    it('does not send recaptchaToken with signup when not provided', async () => {
      const client = new NAuthClient(baseConfig);
      getFetchMock().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          body: {
            accessToken: 'a1',
            refreshToken: 'r1',
            user: { sub: 'u1', email: 'user@example.com', isEmailVerified: true, hasPasswordHash: true },
          },
        }),
      );

      await client.signup({
        email: 'user@example.com',
        password: 'password',
      });

      expect(getFetchMock()).toHaveBeenCalled();
      const callArgs = getFetchMock().mock.calls[0];
      const fetchOptions = callArgs[1] as RequestInit;
      const body = JSON.parse(fetchOptions.body as string);
      expect(body.recaptchaToken).toBeUndefined();
    });
  });
});
