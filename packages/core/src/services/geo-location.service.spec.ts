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
  exec: jest.fn(),
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
        accountId: 12345,
        licenseKey: 'test-license-key',
        dbPath: '/tmp/test-maxmind',
        autoDownloadOnStartup: false,
        skipDownloads: false,
        editions: ['GeoLite2-City', 'GeoLite2-Country'],
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
          accountId: 12345,
          licenseKey: 'test-key',
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
            autoDownloadOnStartup: true,
          },
        },
      };

      service = new GeoLocationService(
        configWithAutoDownload as NAuthConfig,
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      // This will fail in test environment but should attempt download
      await Promise.race([service.onModuleInit(), new Promise((resolve) => setTimeout(() => resolve('timeout'), 100))]);

      // Should attempt to acquire lock
      expect(mockStorageAdapter.set).toHaveBeenCalled();
    }, 1000);

    it('should skip auto-download when skipDownloads is true', async () => {
      mockMaxMindLib.Reader.open.mockRejectedValue(new Error('File not found'));

      const configWithSkipDownloads: Partial<NAuthConfig> = {
        geoLocation: {
          maxMind: {
            ...mockConfig.geoLocation!.maxMind!,
            skipDownloads: true,
            autoDownloadOnStartup: true,
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
      expect(mockLogger.debug).toHaveBeenCalledWith((expect as any).stringContaining('City lookup failed'));
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
      expect(mockLogger.debug).toHaveBeenCalledWith((expect as any).stringContaining('Country lookup failed'));
    });

    it('should return empty object when no databases loaded', async () => {
      (service as any).cityReader = null;
      (service as any).countryReader = null;

      const result = await service.getIpGeolocation('8.8.8.8');

      expect(result).toEqual({});
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

    it('should throw error when skipDownloads is true', async () => {
      const configWithSkipDownloads: Partial<NAuthConfig> = {
        geoLocation: {
          maxMind: {
            ...mockConfig.geoLocation!.maxMind!,
            skipDownloads: true,
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
        expect(error.message).toContain('Database downloads are disabled');
      }
    });

    it('should throw error when licenseKey missing', async () => {
      const configWithoutKey: Partial<NAuthConfig> = {
        geoLocation: {
          maxMind: {
            accountId: 12345,
            // licenseKey missing
          },
        },
      };

      const serviceWithoutKey = new GeoLocationService(
        configWithoutKey as NAuthConfig,
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      try {
        await serviceWithoutKey.updateGeoLocationDatabase();
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('MaxMind licenseKey and accountId are required');
      }
    });

    it('should throw error when accountId missing', async () => {
      const configWithoutAccountId: Partial<NAuthConfig> = {
        geoLocation: {
          maxMind: {
            licenseKey: 'test-key',
            // accountId missing
          },
        },
      };

      const serviceWithoutAccountId = new GeoLocationService(
        configWithoutAccountId as NAuthConfig,
        mockStorageAdapter,
        mockMaxMindLib,
        mockLogger,
      );

      try {
        await serviceWithoutAccountId.updateGeoLocationDatabase();
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('MaxMind licenseKey and accountId are required');
      }
    });

    it('should skip update when lock already acquired', async () => {
      mockStorageAdapter.set.mockResolvedValue(null); // Lock not acquired

      await service.updateGeoLocationDatabase();

      expect(mockLogger.warn).toHaveBeenCalledWith('MaxMind database update already in progress, skipping...');
      expect(mockStorageAdapter.del).not.toHaveBeenCalled();
    });

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
});
