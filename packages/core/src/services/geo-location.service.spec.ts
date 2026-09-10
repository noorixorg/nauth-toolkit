import { GeoLocationService } from './geo-location.service';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { NAuthConfig } from '../interfaces/config.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock fs/promises
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock child_process
jest.mock('child_process', () => ({
  // Must invoke the callback: extractTarGz promisifies this, and a mock that never
  // calls back leaves the download pending forever instead of failing the test.
  exec: jest.fn((_cmd: string, cb?: (err: Error | null, res: { stdout: string; stderr: string }) => void) => {
    cb?.(null, { stdout: '', stderr: '' });
  }),
}));

/**
 * GeoLocation Service Unit Tests
 *
 * Tests IP geolocation functionality using MaxMind GeoIP2 databases.
 * Covers initialization, database loading, IP lookup, and error handling.
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 */
describe('GeoLocationService', () => {
  let service: GeoLocationService;
  let mockStorageAdapter: jest.Mocked<StorageAdapter>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockMaxMindLib: any;
  let mockCityReader: any;
  let mockCountryReader: any;

  const mockConfig: Partial<NAuthConfig> = {
    geoLocation: {
      maxMind: {
        dbPath: '/tmp/test-maxmind',
        editions: ['GeoLite2-City', 'GeoLite2-Country'],
        download: { from: 'maxmind', licenseKey: 'test-license-key', accountId: 12345, onStartup: false },
      },
    },
  };

  beforeEach(() => {
    // Create mock MaxMind readers
    mockCityReader = {
      city: jest.fn(),
    };

    mockCountryReader = {
      country: jest.fn(),
    };

    // Create mock MaxMind library
    mockMaxMindLib = {
      Reader: {
        open: jest.fn(),
      },
    };

    // Create mock storage adapter
    mockStorageAdapter = {
      initialize: jest.fn(),
      isHealthy: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      lpush: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),
      keys: jest.fn(),
      scan: jest.fn(),
      cleanup: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    // Create mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Reset mocks
    jest.clearAllMocks();
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.readdir.mockResolvedValue([]);
    mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as any);
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.unlink.mockResolvedValue(undefined);
    mockedFs.rename.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    service = new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, mockMaxMindLib, mockLogger);
    expect(service).toBeDefined();
  });

  it('should warn when MaxMind configured but library not installed', () => {
    new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, null, mockLogger);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      (expect as any).stringContaining(
        'MaxMind GeoIP2 is configured but @maxmind/geoip2-node package is not installed',
      ),
    );
  });

  it('should use configured dbPath when provided', () => {
    const customPath = '/custom/path';
    const configWithPath: Partial<NAuthConfig> = {
      geoLocation: {
        maxMind: {
          ...mockConfig.geoLocation!.maxMind!,
          dbPath: customPath,
        },
      },
    };

    service = new GeoLocationService(configWithPath as NAuthConfig, mockStorageAdapter, mockMaxMindLib, mockLogger);

    // Service should use the configured path
    expect(service).toBeDefined();
  });

  it('should use system temp directory when dbPath not configured', () => {
    const configWithoutPath: Partial<NAuthConfig> = {
      geoLocation: {
        maxMind: {
          download: { from: 'maxmind', licenseKey: 'test-key', accountId: 12345 },
        },
      },
    };

    const systemTemp = os.tmpdir();
    service = new GeoLocationService(configWithoutPath as NAuthConfig, mockStorageAdapter, mockMaxMindLib, mockLogger);

    expect(service).toBeDefined();
    // Path should default to system temp
  });

  // ============================================================================
  // onModuleInit() Method
  // ============================================================================

  describe('onModuleInit', () => {
    it('should return early when config not provided', async () => {
      service = new GeoLocationService({} as NAuthConfig, mockStorageAdapter, mockMaxMindLib, mockLogger);

      await service.onModuleInit();

      expect(mockedFs.mkdir).not.toHaveBeenCalled();
    });

    it('should return early when MaxMind library not available', async () => {
      service = new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, null, mockLogger);

      await service.onModuleInit();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        (expect as any).stringContaining('MaxMind GeoIP2 library not available'),
      );
    });

    it('should ensure database directory exists', async () => {
      mockMaxMindLib.Reader.open.mockRejectedValue(new Error('File not found'));

      service = new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, mockMaxMindLib, mockLogger);

      await service.onModuleInit();

      expect(mockedFs.mkdir).toHaveBeenCalledWith(mockConfig.geoLocation!.maxMind!.dbPath!, { recursive: true });
    });

    it('should load existing database files', async () => {
      mockMaxMindLib.Reader.open.mockResolvedValueOnce(mockCityReader).mockResolvedValueOnce(mockCountryReader);

      service = new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, mockMaxMindLib, mockLogger);

      await service.onModuleInit();

      expect(mockMaxMindLib.Reader.open).toHaveBeenCalledWith(
        path.join(mockConfig.geoLocation!.maxMind!.dbPath!, 'GeoLite2-City.mmdb'),
      );
      expect(mockMaxMindLib.Reader.open).toHaveBeenCalledWith(
        path.join(mockConfig.geoLocation!.maxMind!.dbPath!, 'GeoLite2-Country.mmdb'),
      );
    });

    it('should handle missing database files gracefully', async () => {
      mockMaxMindLib.Reader.open.mockRejectedValue(new Error('File not found'));

      service = new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, mockMaxMindLib, mockLogger);

      await service.onModuleInit();

      expect(mockLogger.debug).toHaveBeenCalledWith((expect as any).stringContaining('Failed to load City database'));
      expect(mockLogger.debug).toHaveBeenCalledWith(
        (expect as any).stringContaining('Failed to load Country database'),
      );
    });

    it('should auto-download databases if enabled and files missing', async () => {
      mockMaxMindLib.Reader.open.mockRejectedValue(new Error('File not found'));
      mockStorageAdapter.set.mockResolvedValue('lock-value');
      mockStorageAdapter.del.mockResolvedValue();

      // Mock fetch to fail quickly to prevent timeout
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const configWithAutoDownload: Partial<NAuthConfig> = {
        geoLocation: {
          maxMind: {
            ...mockConfig.geoLocation!.maxMind!,
            download: { from: 'maxmind', licenseKey: 'test-license-key', accountId: 12345, onStartup: true },
          },
        },
      };

      service = new GeoLocationService(
        configWithAutoDownload as NAuthConfig,
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      // fetch rejects immediately, so this settles on its own. Racing it against a
      // timer instead would leave the download running detached, mutating the shared
      // fs and storage mocks partway through whichever test ran next.
      await service.onModuleInit();

      // Should attempt to acquire lock
      expect(mockStorageAdapter.set).toHaveBeenCalled();
    }, 1000);

    it('should skip auto-download when skipDownloads is true', async () => {
      mockMaxMindLib.Reader.open.mockRejectedValue(new Error('File not found'));

      const configWithSkipDownloads: Partial<NAuthConfig> = {
        geoLocation: {
          maxMind: {
            ...mockConfig.geoLocation!.maxMind!,
            download: undefined,
          },
        },
      };

      service = new GeoLocationService(
        configWithSkipDownloads as NAuthConfig,
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.onModuleInit();

      // Should not attempt download
      expect(mockStorageAdapter.set).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getIpGeolocation() Method
  // ============================================================================

  describe('getIpGeolocation', () => {
    beforeEach(() => {
      service = new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, mockMaxMindLib, mockLogger);
    });

    it('should return empty object when config not provided', async () => {
      const serviceWithoutConfig = new GeoLocationService(
        {} as NAuthConfig,
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      const result = await serviceWithoutConfig.getIpGeolocation('8.8.8.8');

      expect(result).toEqual({});
    });

    it('should return empty object when MaxMind library not available', async () => {
      const serviceWithoutLib = new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, null, mockLogger);

      const result = await serviceWithoutLib.getIpGeolocation('8.8.8.8');

      expect(result).toEqual({});
    });

    it('should skip private IP addresses', async () => {
      // Set up service with loaded readers
      (service as any).cityReader = mockCityReader;
      (service as any).countryReader = mockCountryReader;

      const result = await service.getIpGeolocation('192.168.1.1');

      expect(result).toEqual({});
      expect(mockCityReader.city).not.toHaveBeenCalled();
      expect(mockCountryReader.country).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith((expect as any).stringContaining('Skipping private IP'));
    });

    it('should lookup IP in city database first', async () => {
      (service as any).cityReader = mockCityReader;
      (service as any).countryReader = mockCountryReader;

      mockCityReader.city.mockReturnValue({
        country: { isoCode: 'US' },
        city: { names: { en: 'Mountain View' } },
      });

      const result = await service.getIpGeolocation('8.8.8.8');

      expect(result).toEqual({
        country: 'US',
        city: 'Mountain View',
      });
      expect(mockCityReader.city).toHaveBeenCalledWith('8.8.8.8');
      expect(mockCountryReader.country).not.toHaveBeenCalled();
    });

    it('should fallback to country database when city lookup fails', async () => {
      (service as any).cityReader = mockCityReader;
      (service as any).countryReader = mockCountryReader;

      mockCityReader.city.mockImplementation(() => {
        throw new Error('City lookup failed');
      });
      mockCountryReader.country.mockReturnValue({
        country: { isoCode: 'US' },
      });

      const result = await service.getIpGeolocation('8.8.8.8');

      expect(result).toEqual({
        country: 'US',
      });
      expect(mockCityReader.city).toHaveBeenCalled();
      expect(mockCountryReader.country).toHaveBeenCalledWith('8.8.8.8');
    });

    it('should return empty object when both lookups fail', async () => {
      (service as any).cityReader = mockCityReader;
      (service as any).countryReader = mockCountryReader;

      mockCityReader.city.mockImplementation(() => {
        throw new Error('City lookup failed');
      });
      mockCountryReader.country.mockImplementation(() => {
        throw new Error('Country lookup failed');
      });

      const result = await service.getIpGeolocation('8.8.8.8');

      expect(result).toEqual({});
    });

    it('should return empty object when no databases loaded', async () => {
      (service as any).cityReader = null;
      (service as any).countryReader = null;

      const result = await service.getIpGeolocation('8.8.8.8');

      expect(result).toEqual({});
    });
  });

  // ============================================================================
  // reloadGeoLocationDatabaseFromDisk() Method
  // ============================================================================

  describe('reloadGeoLocationDatabaseFromDisk', () => {
    beforeEach(() => {
      service = new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, mockMaxMindLib, mockLogger);
    });

    it('should throw error when config not provided', async () => {
      const serviceWithoutConfig = new GeoLocationService(
        {} as NAuthConfig,
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      try {
        await serviceWithoutConfig.reloadGeoLocationDatabaseFromDisk();
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('MaxMind configuration not provided');
      }
    });

    it('should throw error when MaxMind library not available', async () => {
      const serviceWithoutLib = new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, null, mockLogger);

      try {
        await serviceWithoutLib.reloadGeoLocationDatabaseFromDisk();
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('MaxMind library not available');
      }
    });

    it('should reload database files from disk', async () => {
      // Spy on the private loadDatabaseFiles method
      const loadSpy = jest.spyOn(service as any, 'loadDatabaseFiles').mockResolvedValue(undefined);

      await service.reloadGeoLocationDatabaseFromDisk();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).toHaveBeenCalledWith('Reloaded MaxMind database files from disk');
    });

    it('should work in disk-only mode', async () => {
      const configWithSkipDownloads: Partial<NAuthConfig> = {
        geoLocation: {
          maxMind: {
            dbPath: '/tmp/maxmind',
          },
        },
      };

      const serviceWithSkipDownloads = new GeoLocationService(
        configWithSkipDownloads as NAuthConfig,
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      const loadSpy = jest.spyOn(serviceWithSkipDownloads as any, 'loadDatabaseFiles').mockResolvedValue(undefined);

      await serviceWithSkipDownloads.reloadGeoLocationDatabaseFromDisk();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).toHaveBeenCalledWith('Reloaded MaxMind database files from disk');
    });

    it('should handle load errors gracefully', async () => {
      const loadError = new Error('Failed to load database');
      jest.spyOn(service as any, 'loadDatabaseFiles').mockRejectedValue(loadError);

      try {
        await service.reloadGeoLocationDatabaseFromDisk();
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('Failed to load database');
      }
    });
  });

  // ============================================================================
  // updateGeoLocationDatabase() Method
  // ============================================================================

  describe('updateGeoLocationDatabase', () => {
    beforeEach(() => {
      service = new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, mockMaxMindLib, mockLogger);
    });

    it('should throw error when config not provided', async () => {
      const serviceWithoutConfig = new GeoLocationService(
        {} as NAuthConfig,
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      try {
        await serviceWithoutConfig.updateGeoLocationDatabase();
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('MaxMind configuration not provided');
      }
    });

    it('should throw error when MaxMind library not available', async () => {
      const serviceWithoutLib = new GeoLocationService(mockConfig as NAuthConfig, mockStorageAdapter, null, mockLogger);

      try {
        await serviceWithoutLib.updateGeoLocationDatabase();
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('MaxMind library not available');
      }
    });

    it('should throw when no download source is configured', async () => {
      const configWithSkipDownloads: Partial<NAuthConfig> = {
        geoLocation: {
          maxMind: {
            ...mockConfig.geoLocation!.maxMind!,
            download: undefined,
          },
        },
      };

      const serviceWithSkipDownloads = new GeoLocationService(
        configWithSkipDownloads as NAuthConfig,
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      try {
        await serviceWithSkipDownloads.updateGeoLocationDatabase();
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('No download source is configured');
      }
    });


    it('should wait for another instance instead of skipping when the lock is held', async () => {
      jest.useFakeTimers();
      // Lock held by another instance on the first attempt, released before the second.
      mockStorageAdapter.set.mockResolvedValueOnce(null).mockResolvedValue('lock-value');
      mockStorageAdapter.del.mockResolvedValue(undefined);
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      try {
        const pending = service.updateGeoLocationDatabase();
        await jest.advanceTimersByTimeAsync(3_000);
        await pending;
      } finally {
        jest.useRealTimers();
      }

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Another instance is updating the MaxMind database; waiting for it to finish...',
      );
      // Eventually acquired the lock and released it - never silently gave up.
      expect(mockStorageAdapter.set).toHaveBeenCalledTimes(2);
      expect(mockStorageAdapter.del).toHaveBeenCalledWith('maxmind-db-update-lock');
    }, 15000);

    it('should download without the lock once the wait times out', async () => {
      jest.useFakeTimers();
      mockStorageAdapter.set.mockResolvedValue(null); // Never acquired
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      try {
        const pending = service.updateGeoLocationDatabase();
        await jest.advanceTimersByTimeAsync(130_000); // past the 2 minute wait
        await pending;
      } finally {
        jest.useRealTimers();
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        (expect as any).stringContaining('waiting for the MaxMind update lock'),
      );
      // Downloaded anyway rather than starting with no geolocation data.
      expect(global.fetch).toHaveBeenCalled();
      // Never held the lock, so must not delete another instance's lock.
      expect(mockStorageAdapter.del).not.toHaveBeenCalled();
    }, 15000);

    it('should share a single run between concurrent callers in the same process', async () => {
      mockStorageAdapter.set.mockResolvedValue('lock-value');
      mockStorageAdapter.del.mockResolvedValue(undefined);
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await Promise.all([service.updateGeoLocationDatabase(), service.updateGeoLocationDatabase()]);

      // One lock acquisition for both callers.
      expect(mockStorageAdapter.set).toHaveBeenCalledTimes(1);
    }, 15000);

    it('should not release a lock that another instance has taken over', async () => {
      mockStorageAdapter.set.mockResolvedValue('lock-value');
      // Our lock expired and a different instance now owns the key.
      mockStorageAdapter.get.mockResolvedValue('lock-someone-else');
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await service.updateGeoLocationDatabase();

      expect(mockStorageAdapter.del).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        (expect as any).stringContaining('taken over by another instance'),
      );
    }, 15000);

    it('should acquire distributed lock before downloading', async () => {
      mockStorageAdapter.set.mockResolvedValue('lock-value');
      mockStorageAdapter.del.mockResolvedValue();

      // Mock fetch to throw error immediately to prevent actual download
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // This will fail but should attempt to acquire lock first
      try {
        await Promise.race([
          service.updateGeoLocationDatabase(),
          new Promise((resolve) => setTimeout(() => resolve('timeout'), 100)),
        ]);
      } catch {
        // Expected to fail
      }

      expect(mockStorageAdapter.set).toHaveBeenCalledWith(
        'maxmind-db-update-lock',
        (expect as any).stringContaining('lock-'),
        300,
        { nx: true },
      );
    }, 1000);

    it('should release lock after download completes', async () => {
      mockStorageAdapter.set.mockResolvedValue('lock-value');
      mockStorageAdapter.del.mockResolvedValue();
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
      } as any);

      // Mock exec to prevent timeout
      const mockExec = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });
      jest.doMock('child_process', () => ({
        exec: mockExec,
      }));
      jest.doMock('util', () => ({
        promisify: jest.fn(() => mockExec),
      }));

      // This will fail in test but should attempt to release lock
      try {
        await Promise.race([
          service.updateGeoLocationDatabase(),
          new Promise((resolve) => setTimeout(resolve, 100)), // Timeout after 100ms
        ]);
      } catch {
        // Expected to fail in test environment
      }

      // Should attempt to release lock in finally block
      expect(mockStorageAdapter.del).toHaveBeenCalledWith('maxmind-db-update-lock');
    }, 1000);

    it('should handle lock release errors gracefully', async () => {
      mockStorageAdapter.set.mockResolvedValue('lock-value');
      mockStorageAdapter.del.mockRejectedValue(new Error('Lock release failed'));

      // Mock exec to prevent timeout
      const mockExec = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });
      jest.doMock('child_process', () => ({
        exec: mockExec,
      }));
      jest.doMock('util', () => ({
        promisify: jest.fn(() => mockExec),
      }));

      // This will fail in test but should handle lock release error
      try {
        await Promise.race([
          service.updateGeoLocationDatabase(),
          new Promise((resolve) => setTimeout(resolve, 100)), // Timeout after 100ms
        ]);
      } catch {
        // Expected to fail in test environment
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        (expect as any).stringContaining('Failed to release MaxMind update lock'),
      );
    }, 1000);
  });

  // ============================================================================
  // Custom Download Source
  // ============================================================================

  describe('custom downloadUrl', () => {
    /** Bytes that satisfy isMmdb(): the format's metadata marker. */
    const mmdbBytes = (): Buffer => Buffer.concat([Buffer.from('payload'), Buffer.from([0xab, 0xcd, 0xef]), Buffer.from('MaxMind.com')]);

    /** Bytes that satisfy isGzip(): the RFC 1952 header. */
    const gzipBytes = (): Buffer => Buffer.concat([Buffer.from([0x1f, 0x8b, 0x08, 0x00]), Buffer.from('rest')]);

    const toArrayBuffer = (buf: Buffer): ArrayBuffer =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

    const configWith = (maxMind: Record<string, unknown>): NAuthConfig =>
      ({
        geoLocation: {
          maxMind: {
            dbPath: '/tmp/test-maxmind',
            editions: ['GeoLite2-City', 'GeoLite2-Country'],
            ...maxMind,
          },
        },
      }) as unknown as NAuthConfig;

    const respondWith = (buf: Buffer): jest.Mock =>
      jest.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', arrayBuffer: async () => toArrayBuffer(buf) });

    beforeEach(() => {
      mockStorageAdapter.set.mockResolvedValue('lock-value');
      mockStorageAdapter.del.mockResolvedValue();
      mockStorageAdapter.get.mockResolvedValue('lock-value');
      // No usable files on disk, so a download is always required.
      mockedFs.stat.mockRejectedValue(new Error('ENOENT'));
      mockMaxMindLib.Reader.open.mockResolvedValue(mockCityReader);
      mockCityReader.city = jest.fn();
    });

    it('substitutes {edition} and never contacts MaxMind', async () => {
      const fetchMock = respondWith(mmdbBytes());
      global.fetch = fetchMock;

      service = new GeoLocationService(
        configWith({ download: { from: 'url', url: 'https://cdn.example.com/geoip/{edition}.mmdb' } }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.updateGeoLocationDatabase();

      const urls = fetchMock.mock.calls.map((call) => call[0]);
      expect(urls).toEqual([
        'https://cdn.example.com/geoip/GeoLite2-City.mmdb',
        'https://cdn.example.com/geoip/GeoLite2-Country.mmdb',
      ]);
      expect(urls.some((url: string) => url.includes('maxmind.com'))).toBe(false);
    });

    it('accepts a per-edition URL map', async () => {
      const fetchMock = respondWith(mmdbBytes());
      global.fetch = fetchMock;

      service = new GeoLocationService(
        configWith({
          download: {
            from: 'url',
            url: {
              'GeoLite2-City': 'https://example.com/city.mmdb?sig=abc',
              'GeoLite2-Country': 'https://example.com/country.mmdb?sig=def',
            },
          },
        }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.updateGeoLocationDatabase();

      expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
        'https://example.com/city.mmdb?sig=abc',
        'https://example.com/country.mmdb?sig=def',
      ]);
    });

    it('needs no MaxMind credentials', async () => {
      global.fetch = respondWith(mmdbBytes());

      service = new GeoLocationService(
        configWith({ download: { from: 'url', url: 'https://cdn.example.com/{edition}.mmdb' } }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await expect(service.updateGeoLocationDatabase()).resolves.toBeUndefined();
    });

    it('refuses to update when no download source is configured', async () => {
      service = new GeoLocationService(configWith({}), mockStorageAdapter, mockMaxMindLib, mockLogger);

      await expect(service.updateGeoLocationDatabase()).rejects.toThrow(NAuthException);
      await expect(service.updateGeoLocationDatabase()).rejects.toThrow(/No download source is configured/);
    });

    it('sends HTTP Basic credentials when configured', async () => {
      const fetchMock = respondWith(mmdbBytes());
      global.fetch = fetchMock;

      service = new GeoLocationService(
        configWith({
          download: {
            from: 'url',
            url: 'https://cdn.example.com/{edition}.mmdb',
            auth: { username: 'mirror', password: 's3cret' },
          },
        }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.updateGeoLocationDatabase();

      const expected = `Basic ${Buffer.from('mirror:s3cret').toString('base64')}`;
      expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: expected });
    });

    it('writes a bare .mmdb response straight through, without tar extraction', async () => {
      global.fetch = respondWith(mmdbBytes());

      service = new GeoLocationService(
        configWith({ download: { from: 'url', url: 'https://cdn.example.com/{edition}.mmdb' } }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.updateGeoLocationDatabase();

      const written = mockedFs.writeFile.mock.calls.map((call) => String(call[0]));
      expect(written.some((file) => file.endsWith('.tar.gz'))).toBe(false);
      expect(written).toContain(path.join('/tmp/test-maxmind', 'GeoLite2-City.mmdb.download'));
      // Renamed into place only once fully written.
      expect(mockedFs.rename).toHaveBeenCalledWith(
        path.join('/tmp/test-maxmind', 'GeoLite2-City.mmdb.download'),
        path.join('/tmp/test-maxmind', 'GeoLite2-City.mmdb'),
      );
    });

    it('routes a gzip response through tar extraction', async () => {
      global.fetch = respondWith(gzipBytes());

      // Stand in for what tar leaves behind. The extraction directory is named
      // extract_<edition>_<timestamp>, so key the stat stub off that rather than the
      // edition name, which appears in both paths.
      mockedFs.readdir.mockResolvedValue(['GeoLite2-City.mmdb'] as never);
      mockedFs.stat.mockImplementation(async (target: unknown) =>
        String(target).includes('extract_')
          ? ({ isDirectory: () => false } as never)
          : Promise.reject(new Error('ENOENT')),
      );

      service = new GeoLocationService(
        configWith({ download: { from: 'url', url: 'https://cdn.example.com/{edition}.tar.gz' }, editions: ['GeoLite2-City'] }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.updateGeoLocationDatabase();

      // Archive staged to disk, unpacked, and the .mmdb moved into place.
      const written = mockedFs.writeFile.mock.calls.map((call) => String(call[0]));
      expect(written).toContain(path.join('/tmp/test-maxmind', 'GeoLite2-City.tar.gz'));
      expect(mockedFs.rename).toHaveBeenCalledWith(
        (expect as any).stringContaining('GeoLite2-City.mmdb'),
        path.join('/tmp/test-maxmind', 'GeoLite2-City.mmdb'),
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('rejects a response that is neither gzip nor a MaxMind database', async () => {
      global.fetch = respondWith(Buffer.from('<html>404 Not Found</html>'));

      service = new GeoLocationService(
        configWith({ download: { from: 'url', url: 'https://cdn.example.com/{edition}.mmdb' } }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.updateGeoLocationDatabase();

      expect(mockLogger.error).toHaveBeenCalledWith(
        (expect as any).stringContaining('neither a gzip archive nor a MaxMind database'),
      );
    });

    it('keeps a presigned signature out of logged errors', async () => {
      global.fetch = respondWith(Buffer.from('nope'));

      service = new GeoLocationService(
        configWith({
          download: {
            from: 'url',
            url: { 'GeoLite2-City': 'https://b.s3.amazonaws.com/city.mmdb?X-Amz-Signature=deadbeef' },
          },
          editions: ['GeoLite2-City'],
        }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.updateGeoLocationDatabase();

      const logged = mockLogger.error.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).toContain('https://b.s3.amazonaws.com/city.mmdb');
      expect(logged).not.toContain('deadbeef');
    });

    it('rejects an s3:// URL by name', async () => {
      service = new GeoLocationService(
        configWith({ download: { from: 'url', url: 's3://my-bucket/geoip/{edition}.mmdb' } }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.updateGeoLocationDatabase();

      expect(mockLogger.error).toHaveBeenCalledWith((expect as any).stringContaining('s3://, which is not supported'));
    });

    it('rejects plain http to a non-loopback host', async () => {
      service = new GeoLocationService(
        configWith({ download: { from: 'url', url: 'http://cdn.example.com/{edition}.mmdb' } }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.updateGeoLocationDatabase();

      expect(mockLogger.error).toHaveBeenCalledWith((expect as any).stringContaining('must use https://'));
    });

    it('allows plain http to loopback for local development', async () => {
      const fetchMock = respondWith(mmdbBytes());
      global.fetch = fetchMock;

      service = new GeoLocationService(
        configWith({ download: { from: 'url', url: 'http://localhost:9000/{edition}.mmdb' } }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.updateGeoLocationDatabase();

      expect(fetchMock).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('surfaces an auth hint on 401 and 403', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' });

      service = new GeoLocationService(
        configWith({ download: { from: 'url', url: 'https://cdn.example.com/{edition}.mmdb' } }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await service.updateGeoLocationDatabase();

      expect(mockLogger.error).toHaveBeenCalledWith((expect as any).stringContaining('download.auth'));
    });
  });

  // ============================================================================
  // requireDatabaseOnStartup
  // ============================================================================

  describe('requireDatabaseOnStartup', () => {
    const startupConfig = (maxMind: Record<string, unknown>): NAuthConfig =>
      ({
        geoLocation: {
          maxMind: {
            dbPath: '/tmp/test-maxmind',
            editions: ['GeoLite2-City'],
            ...maxMind,
          },
        },
      }) as unknown as NAuthConfig;

    beforeEach(() => {
      mockStorageAdapter.set.mockResolvedValue('lock-value');
      mockStorageAdapter.del.mockResolvedValue();
      mockStorageAdapter.get.mockResolvedValue('lock-value');
      mockedFs.stat.mockRejectedValue(new Error('ENOENT'));
      mockMaxMindLib.Reader.open.mockRejectedValue(new Error('File not found'));
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    });

    it('aborts startup when a downloadUrl is set and nothing loads', async () => {
      service = new GeoLocationService(
        startupConfig({ download: { from: 'url', url: 'https://cdn.example.com/{edition}.mmdb' } }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await expect(service.onModuleInit()).rejects.toThrow(NAuthException);
    });

    it('warns and continues on the MaxMind API path, as before', async () => {
      service = new GeoLocationService(
        startupConfig({ download: { from: 'maxmind', licenseKey: 'k', accountId: 12345 } }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('can be forced off even with a downloadUrl', async () => {
      service = new GeoLocationService(
        startupConfig({
          download: { from: 'url', url: 'https://cdn.example.com/{edition}.mmdb' },
          requireDatabaseOnStartup: false,
        }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });

    it('can be forced on for the MaxMind API path', async () => {
      service = new GeoLocationService(
        startupConfig({
          download: { from: 'maxmind', licenseKey: 'k', accountId: 12345 },
          requireDatabaseOnStartup: true,
        }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await expect(service.onModuleInit()).rejects.toThrow(NAuthException);
    });

    it('aborts when disk-only mode finds no files', async () => {
      service = new GeoLocationService(
        startupConfig({ requireDatabaseOnStartup: true }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      await expect(service.onModuleInit()).rejects.toThrow(/No MaxMind database could be loaded/);
    });
  });

  // ============================================================================
  // Startup diagnostics
  // ============================================================================

  describe('startup diagnostics', () => {
    const diagConfig = (maxMind: Record<string, unknown>): NAuthConfig =>
      ({ geoLocation: { maxMind: { dbPath: '/tmp/test-maxmind', ...maxMind } } }) as unknown as NAuthConfig;

    it('reports files that exist but will not open, rather than claiming none were found', async () => {
      mockMaxMindLib.Reader.open.mockRejectedValue(new Error('Invalid database type'));
      // The files are on disk; only opening them fails.
      mockedFs.access.mockResolvedValue(undefined);

      service = new GeoLocationService(diagConfig({}), mockStorageAdapter, mockMaxMindLib, mockLogger);
      await service.onModuleInit();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        (expect as any).stringContaining('exist in /tmp/test-maxmind but could not be opened'),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith((expect as any).stringContaining('Invalid database type'));
    });

    it('still reports genuinely missing files as missing', async () => {
      mockMaxMindLib.Reader.open.mockRejectedValue(new Error('ENOENT'));
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      service = new GeoLocationService(diagConfig({}), mockStorageAdapter, mockMaxMindLib, mockLogger);
      await service.onModuleInit();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        (expect as any).stringContaining('No MaxMind database files found'),
      );
    });

    it('warns about configured editions it will never read', async () => {
      mockMaxMindLib.Reader.open.mockRejectedValue(new Error('ENOENT'));
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      service = new GeoLocationService(
        diagConfig({ editions: ['GeoLite2-City', 'GeoLite2-ASN'] }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );
      await service.onModuleInit();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        (expect as any).stringContaining('GeoLite2-ASN, which the toolkit does not read'),
      );
    });

    it('stays quiet when every configured edition is readable', async () => {
      mockMaxMindLib.Reader.open.mockResolvedValue(mockCityReader);
      mockCityReader.city = jest.fn();

      service = new GeoLocationService(
        diagConfig({ editions: ['GeoLite2-City', 'GeoLite2-Country'] }),
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );
      await service.onModuleInit();

      const warnings = mockLogger.warn.mock.calls.map((call) => String(call[0])).join('\n');
      expect(warnings).not.toContain('does not read');
    });
  });
});
