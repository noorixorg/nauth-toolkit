import { TelemetryService, TelemetryPayload } from './telemetry.service';
import { NAuthConfig } from '../interfaces/config.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthLogger } from '../utils/nauth-logger';

/**
 * In-memory StorageAdapter stub implementing the get/set (with NX) semantics
 * used by TelemetryService.
 */
class FakeStorageAdapter implements Partial<StorageAdapter> {
  private store = new Map<string, string>();
  failGets = false;

  async get(key: string): Promise<string | null> {
    if (this.failGets) {
      throw new Error('storage unavailable');
    }
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _ttl?: number, options?: { nx?: boolean }): Promise<void> {
    if (this.failGets) {
      throw new Error('storage unavailable');
    }
    if (options?.nx && this.store.has(key)) {
      return;
    }
    this.store.set(key, value);
  }
}

describe('TelemetryService', () => {
  const baseConfig = {
    jwt: {
      algorithm: 'HS256',
      accessToken: { secret: 'a'.repeat(64), expiresIn: '15m' },
      refreshToken: { secret: 'b'.repeat(64), expiresIn: '30d' },
    },
    tokenDelivery: { method: 'hybrid' },
    mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 7, allowedMethods: ['sms', 'totp'] },
    signup: { enabled: true, verificationMethod: 'both' },
    auditLogs: { enabled: true },
  } as unknown as NAuthConfig;

  let storage: FakeStorageAdapter;
  let logger: { log: jest.Mock; debug: jest.Mock; error: jest.Mock; warn: jest.Mock };
  let fetchMock: jest.SpyInstance;
  let savedEnv: NodeJS.ProcessEnv;

  const makeService = (config: NAuthConfig = baseConfig): TelemetryService =>
    new TelemetryService(
      config,
      storage as unknown as StorageAdapter,
      logger as unknown as NAuthLogger,
      'express',
      undefined,
      undefined,
    );

  /** Remove the env switches that would disable telemetry inside jest. */
  const enableTelemetryEnv = (): void => {
    delete process.env.NODE_ENV;
    delete process.env.CI;
    delete process.env.NAUTH_TELEMETRY_DISABLED;
    delete process.env.DO_NOT_TRACK;
  };

  /** Let the fire-and-forget promise chain settle. */
  const flush = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  };

  beforeEach(() => {
    savedEnv = { ...process.env };
    storage = new FakeStorageAdapter();
    logger = { log: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }) as unknown as Response);
  });

  afterEach(() => {
    process.env = savedEnv;
    fetchMock.mockRestore();
    jest.useRealTimers();
  });

  describe('isEnabled', () => {
    it('is disabled under jest by default (NODE_ENV=test)', () => {
      expect(makeService().isEnabled()).toBe(false);
    });

    it('is enabled when no opt-out switch is active', () => {
      enableTelemetryEnv();
      expect(makeService().isEnabled()).toBe(true);
    });

    it.each([
      ['config flag', (): NAuthConfig => ({ ...baseConfig, telemetry: { enabled: false } }) as NAuthConfig, {}],
      ['NAUTH_TELEMETRY_DISABLED', (): NAuthConfig => baseConfig, { NAUTH_TELEMETRY_DISABLED: '1' }],
      ['DO_NOT_TRACK', (): NAuthConfig => baseConfig, { DO_NOT_TRACK: '1' }],
      ['CI', (): NAuthConfig => baseConfig, { CI: 'true' }],
      ['NODE_ENV=test', (): NAuthConfig => baseConfig, { NODE_ENV: 'test' }],
    ])('is disabled via %s', (_name, configFactory, envOverrides) => {
      enableTelemetryEnv();
      Object.assign(process.env, envOverrides);
      expect(makeService(configFactory()).isEnabled()).toBe(false);
    });
  });

  describe('sendBootPing', () => {
    it('does nothing when disabled', async () => {
      const service = makeService(); // NODE_ENV=test under jest
      service.sendBootPing();
      await flush();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('sends a schema-exact payload when enabled', async () => {
      enableTelemetryEnv();
      const service = makeService();
      service.sendBootPing();
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://telemetry.nauth.dev/');
      const payload = JSON.parse(init.body as string) as TelemetryPayload;

      expect(Object.keys(payload).sort()).toEqual(
        ['arch', 'config', 'coreVersion', 'event', 'framework', 'instanceId', 'nodeEnv', 'nodeMajor', 'platform', 'schemaVersion'].sort(),
      );
      expect(payload.schemaVersion).toBe(1);
      expect(payload.event).toBe('boot');
      expect(payload.framework).toBe('express');
      expect(payload.instanceId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(payload.config.tokenDeliveryMethod).toBe('hybrid');
      expect(payload.config.mfa).toEqual({
        enabled: true,
        enforcement: 'ADAPTIVE',
        gracePeriodSet: true,
        allowedMethods: ['sms', 'totp'],
      });
      expect(payload.config.signupVerificationMethod).toBe('both');
      expect(payload.config.storageAdapter).toBe('FakeStorageAdapter');
      // No secrets or values beyond shape
      expect(init.body as string).not.toContain('secret');
      expect(init.body as string).not.toContain(String(baseConfig.jwt.accessToken.secret));
    });

    it('honors a custom endpoint override', async () => {
      enableTelemetryEnv();
      const service = makeService({ ...baseConfig, telemetry: { endpoint: 'https://example.com/t' } } as NAuthConfig);
      service.sendBootPing();
      await flush();
      expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/t');
    });

    it('logs the disclosure exactly once, on first instance-ID creation only', async () => {
      enableTelemetryEnv();
      const first = makeService();
      first.sendBootPing();
      await flush();
      expect(logger.log).toHaveBeenCalledTimes(1);
      expect(String(logger.log.mock.calls[0][0])).toContain('NAUTH_TELEMETRY_DISABLED');

      // Second boot of the same install (shared storage) — no disclosure.
      logger.log.mockClear();
      const second = makeService();
      second.sendBootPing();
      await flush();
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('shares the instance ID across services using the same storage', async () => {
      enableTelemetryEnv();
      makeService().sendBootPing();
      await flush();
      makeService().sendBootPing();
      await flush();
      const idA = (JSON.parse(fetchMock.mock.calls[0][1].body as string) as TelemetryPayload).instanceId;
      const idB = (JSON.parse(fetchMock.mock.calls[1][1].body as string) as TelemetryPayload).instanceId;
      expect(idA).toBe(idB);
    });

    it('falls back to a per-process UUID when storage fails, without throwing', async () => {
      enableTelemetryEnv();
      storage.failGets = true;
      const service = makeService();
      expect(() => service.sendBootPing()).not.toThrow();
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string) as TelemetryPayload;
      expect(payload.instanceId).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('swallows network failures silently (debug only, never throws)', async () => {
      enableTelemetryEnv();
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      const service = makeService();
      expect(() => service.sendBootPing()).not.toThrow();
      await flush();
      expect(logger.debug).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('heartbeat', () => {
    it('does not start when disabled', () => {
      jest.useFakeTimers();
      const service = makeService(); // disabled under jest
      service.startHeartbeat();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('schedules an unref-ed interval and stops on shutdown', () => {
      enableTelemetryEnv();
      jest.useFakeTimers();
      const service = makeService();
      service.startHeartbeat();
      expect(jest.getTimerCount()).toBe(1);
      service.shutdown();
      expect(jest.getTimerCount()).toBe(0);
      // Idempotent
      service.shutdown();
    });

    it('sends a heartbeat event when the interval fires', async () => {
      enableTelemetryEnv();
      jest.useFakeTimers();
      const service = makeService();
      service.startHeartbeat();
      jest.advanceTimersByTime(25 * 60 * 60 * 1000);
      jest.useRealTimers();
      await flush();
      expect(fetchMock).toHaveBeenCalled();
      const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string) as TelemetryPayload;
      expect(payload.event).toBe('heartbeat');
      service.shutdown();
    });
  });
});
