import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { GeoLocationConfig, NAuthConfig } from '../interfaces/config.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { isPrivateIp } from '../utils/ip-extractor';

// ============================================================================
// Optional MaxMind Types
// ============================================================================

/**
 * MaxMind GeoIP2 Reader type (optional dependency)
 * Only available if @maxmind/geoip2-node is installed
 *
 * The Reader class has city() and country() methods that return response objects
 */
type MaxMindReader = {
  city: (ip: string) => {
    country?: { isoCode?: string; names?: { en?: string }; isInEuropeanUnion?: boolean };
    city?: { names?: { en?: string } };
    subdivisions?: Array<{ names?: { en?: string } }>;
    postal?: { code?: string };
    location?: { latitude?: number; longitude?: number; timeZone?: string };
    continent?: { code?: string; names?: { en?: string } };
  };
  country: (ip: string) => {
    country?: { isoCode?: string; names?: { en?: string }; isInEuropeanUnion?: boolean };
    continent?: { code?: string; names?: { en?: string } };
  };
};

/**
 * MaxMind library module type (optional peer dependency)
 * Injected via dependency injection if package is installed
 */
type MaxMindModule = {
  Reader: {
    open: (dbPath: string) => Promise<MaxMindReader>;
  };
};

// ============================================================================
// Download Helpers
// ============================================================================

/** Gzip member header, RFC 1952 section 2.3.1. */
const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);

/**
 * MaxMind DB metadata marker, which sits near the END of an .mmdb file rather than at
 * its start - the format has no leading magic number.
 *
 * @see https://maxmind.github.io/MaxMind-DB/
 */
const MMDB_METADATA_MARKER = Buffer.from([0xab, 0xcd, 0xef, ...Buffer.from('MaxMind.com')]);

/**
 * Whether a buffer is a gzip stream.
 *
 * @param buffer - Downloaded bytes
 * @returns True when the gzip header is present
 */
function isGzip(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer.subarray(0, 2).equals(GZIP_MAGIC);
}

/**
 * Whether a buffer is a MaxMind DB file.
 *
 * Looks for the metadata marker in the last 128KB, the search window the format's own
 * spec prescribes.
 *
 * @param buffer - Downloaded bytes
 * @returns True when the metadata marker is present
 */
function isMmdb(buffer: Buffer): boolean {
  const window = buffer.subarray(Math.max(0, buffer.length - 128 * 1024));
  return window.includes(MMDB_METADATA_MARKER);
}

/**
 * Strip credentials and query string from a URL so it is safe to log.
 *
 * Presigned URLs carry their signature in the query string, and a URL may embed
 * userinfo; neither belongs in a log line or an error message.
 *
 * @param rawUrl - URL to redact
 * @returns The origin and path only, or a placeholder when unparseable
 */
function redactUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.search = '';
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return '<malformed url>';
  }
}

/**
 * GeoLocation Service
 *
 * Provides IP geolocation using MaxMind GeoIP2 database files.
 * Platform-agnostic - works on all platforms where Node.js runs.
 *
 * Features:
 * - IP to country/city lookup from MaxMind .mmdb files
 * - Distributed locking for database updates (multi-server safe)
 * - Configurable database path (defaults to system temp directory)
 * - Graceful degradation if MaxMind not installed
 *
 * Requirements:
 * - @maxmind/geoip2-node peer dependency must be installed
 * - MaxMind license key and account ID for database downloads
 * - Storage adapter (for distributed locking)
 *
 * @example
 * ```typescript
 * // Get geolocation for an IP
 * const geo = await geoLocationService.getIpGeolocation('8.8.8.8');
 * console.log(geo.country); // 'US'
 * console.log(geo.city); // 'Mountain View'
 * ```
 */
export class GeoLocationService {
  private readonly config: GeoLocationConfig['maxMind'];
  private readonly dbPath: string;
  private readonly maxMindLib: MaxMindModule | null;
  private cityReader: MaxMindReader | null = null;
  private countryReader: MaxMindReader | null = null;
  private readonly defaultEditions = ['GeoLite2-City', 'GeoLite2-Country'];
  /** Editions the service actually opens a reader for. */
  private readonly loadableEditions = ['GeoLite2-City', 'GeoLite2-Country'];
  private readonly lockKey = 'maxmind-db-update-lock';
  private readonly lockTtlSeconds = 300; // 5 minutes
  /** How long to wait for another instance holding the download lock. */
  private readonly lockWaitMs = 120_000; // 2 minutes
  /** Reuse existing .mmdb files younger than this; GeoLite2 publishes twice a week. */
  private readonly minRefreshIntervalHours = 24;
  private readonly lockRetryDelayMs = 2_000;
  private updateInFlight: Promise<void> | null = null;

  constructor(
    nauthConfig: NAuthConfig,
    private readonly storageAdapter: StorageAdapter,
    maxMindLib?: MaxMindModule | null,
    private readonly logger?: NAuthLogger,
  ) {
    // ============================================================================
    // Extract Configuration
    // ============================================================================
    this.config = nauthConfig.geoLocation?.maxMind;

    // ============================================================================
    // Initialize MaxMind Library (Optional)
    // ============================================================================
    this.maxMindLib = maxMindLib ?? null;

    if (!this.maxMindLib && this.config) {
      this.logger?.warn?.(
        'MaxMind GeoIP2 is configured but @maxmind/geoip2-node package is not installed. ' +
          'Install it with: yarn add @maxmind/geoip2-node\n' +
          'Or remove geoLocation.maxMind from your configuration to disable geolocation.',
      );
    }

    // ============================================================================
    // Resolve Database Path
    // ============================================================================
    if (this.config?.dbPath) {
      // Use configured path (absolute or relative to cwd)
      this.dbPath = path.isAbsolute(this.config.dbPath)
        ? this.config.dbPath
        : path.resolve(process.cwd(), this.config.dbPath);
    } else {
      // Default to system temp directory
      const systemTemp = os.tmpdir();
      this.dbPath = path.join(systemTemp, 'nauth_maxmind');
    }
  }

  /**
   * Whether startup must fail when no database could be loaded.
   *
   * Defaults to true once a custom `downloadUrl` is configured: mirroring the database
   * yourself is a deliberate act, and booting without it silently answers every lookup
   * with `{}`. The MaxMind-API path keeps its historical warn-and-continue default so
   * existing deployments are unaffected.
   *
   * @returns True when a missing database should abort startup
   */
  private get requireDatabaseOnStartup(): boolean {
    return this.config?.requireDatabaseOnStartup ?? this.config?.download?.from === 'url';
  }

  /**
   * Initialize service on module startup
   *
   * Awaited by `NAuth.create()` and by the NestJS lifecycle, so a download started here
   * completes before the instance serves traffic. Readers are replaced in place once the
   * download lands - lookups made after this resolves always see the loaded database.
   *
   * - Loads database files if they exist
   * - Downloads them when a `download` source is configured with `onStartup` (default true)
   * - Throws instead of warning when {@link requireDatabaseOnStartup} applies
   *
   * @throws {NAuthException} If no database could be loaded and startup requires one
   */
  async onModuleInit(): Promise<void> {
    if (!this.config) {
      // No config provided - service disabled
      return;
    }

    if (!this.maxMindLib) {
      // MaxMind not installed - service disabled
      this.logger?.warn?.('MaxMind GeoIP2 library not available. Install @maxmind/geoip2-node to enable geolocation.');
      if (this.requireDatabaseOnStartup) {
        throw new NAuthException(
          AuthErrorCode.INTERNAL_ERROR,
          'Geolocation requires the @maxmind/geoip2-node package, which is not installed, and ' +
            'geoLocation.maxMind.requireDatabaseOnStartup is enabled. Install it, or disable that flag.',
        );
      }
      return;
    }

    // Only City and Country have readers; anything else configured would be downloaded
    // and then never read, which is worth saying out loud rather than silently wasting
    // the bandwidth and disk.
    const unusedEditions = (this.config.editions ?? this.defaultEditions).filter(
      (edition) => !this.loadableEditions.includes(edition),
    );
    if (unusedEditions.length > 0) {
      this.logger?.warn?.(
        `geoLocation.maxMind.editions includes ${unusedEditions.join(', ')}, which the toolkit does not read. ` +
          `Only ${this.loadableEditions.join(' and ')} are used for lookups; the rest are downloaded and ignored.`,
      );
    }

    // Ensure database directory exists
    await this.ensureDbDirectoryExists();

    // Load existing database files
    await this.loadDatabaseFiles();

    // Auto-download if enabled and files don't exist (only if downloads not skipped)
    const downloadOnStartup = this.config.download ? (this.config.download.onStartup ?? true) : false;
    if (downloadOnStartup && (!this.cityReader || !this.countryReader)) {
      try {
        await this.updateGeoLocationDatabase();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (this.requireDatabaseOnStartup) {
          throw new NAuthException(
            AuthErrorCode.INTERNAL_ERROR,
            `Failed to download MaxMind databases on startup: ${message}. Startup was aborted because ` +
              'geoLocation.maxMind.requireDatabaseOnStartup is enabled; serving without them would answer ' +
              'every geolocation lookup with no data.',
          );
        }
        this.logger?.warn?.(`Failed to auto-download MaxMind databases on startup: ${message}`);
      }
    }

    // A download can succeed for one edition and fail for another, and disk-only mode
    // never downloads at all - so check what actually loaded, not what was tried.
    if (this.requireDatabaseOnStartup && !this.cityReader && !this.countryReader) {
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        `No MaxMind database could be loaded from ${this.dbPath}, and ` +
          'geoLocation.maxMind.requireDatabaseOnStartup is enabled. Startup was aborted rather than serving ' +
          'traffic with geolocation silently unavailable.',
      );
    }
  }

  /**
   * Get geolocation information for an IP address
   *
   * @param ip - IP address to lookup
   * @returns Geolocation info with country, city, and coordinates (if available)
   *
   * @example
   * ```typescript
   * const geo = await geoLocationService.getIpGeolocation('8.8.8.8');
   * // { country: 'US', city: 'Mountain View', latitude: 37.386, longitude: -122.0838 }
   * ```
   */
  async getIpGeolocation(ip: string): Promise<{
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  }> {
    // ============================================================================
    // Check if Service is Available
    // ============================================================================
    if (!this.config || !this.maxMindLib) {
      // Service not configured or MaxMind not installed
      return {};
    }

    // ============================================================================
    // Skip Private IP Addresses
    // ============================================================================
    // MaxMind databases only contain public IP addresses. Private IPs (localhost,
    // 192.168.x.x, 10.x.x.x, etc.) will always fail lookup and generate unnecessary
    // error logs. Skip the lookup entirely for private IPs.
    if (isPrivateIp(ip)) {
      // Silently return empty result for private IPs (no lookup attempted)
      this.logger?.debug?.(`Skipping private IP ${ip} for geolocation lookup`);
      return {};
    }

    // ============================================================================
    // Try City Database First (More Detailed)
    // ============================================================================
    if (this.cityReader) {
      try {
        const result = this.cityReader.city(ip);
        const geoData = {
          country: result.country?.isoCode,
          city: result.city?.names?.en,
          latitude: result.location?.latitude,
          longitude: result.location?.longitude,
        };

        // Warn if coordinates are missing (useful for production debugging)
        if (!geoData.latitude || !geoData.longitude) {
          this.logger?.warn?.(
            `MaxMind city lookup for IP ${ip} returned city/country but NO coordinates: ` +
              `city=${geoData.city}, country=${geoData.country}`,
          );
        }

        return geoData;
      } catch {
        // Non-fatal: Try country database (error logged at warn level if needed)
      }
    } else {
      this.logger?.warn?.(
        `MaxMind cityReader is not initialized for IP ${ip}. ` + `Only country database available (no coordinates).`,
      );
    }

    // ============================================================================
    // Fallback to Country Database
    // ============================================================================
    if (this.countryReader) {
      try {
        const result = this.countryReader.country(ip);
        return {
          country: result.country?.isoCode,
        };
      } catch {
        // Non-fatal: Return empty result (error handled gracefully)
      }
    }

    // No databases loaded or lookup failed
    return {};
  }

  /**
   * Reload MaxMind database files from disk
   *
   * Reloads .mmdb files from the configured dbPath without downloading.
   * Useful when database files are managed externally (e.g., via geoipupdate,
   * cron jobs, or container volume updates).
   *
   * This method will:
   * - Attempt to load GeoLite2-City.mmdb
   * - Attempt to load GeoLite2-Country.mmdb
   * - Replace in-memory database readers with newly loaded ones
   * - Log warnings if no database files are found
   *
   * Safe to call repeatedly - if files haven't changed, it just reloads the same data.
   *
   * @example
   * ```typescript
   * // After external process updates database files
   * await geoLocationService.reloadGeoLocationDatabaseFromDisk();
   * ```
   *
   * @example
   * ```typescript
   * // In a NestJS scheduled job
   * @Cron('0 0 * * *')
   * async reloadGeoDb() {
   *   await this.geoLocationService.reloadGeoLocationDatabaseFromDisk();
   * }
   * ```
   */
  async reloadGeoLocationDatabaseFromDisk(): Promise<void> {
    if (!this.config) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'MaxMind configuration not provided');
    }

    if (!this.maxMindLib) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'MaxMind library not available. Install @maxmind/geoip2-node peer dependency.',
      );
    }

    await this.loadDatabaseFiles();
    this.logger?.log?.('Reloaded MaxMind database files from disk');
  }

  /**
   * Update MaxMind GeoIP2 database files
   *
   * Downloads the latest database files from MaxMind, then reloads the in-memory
   * database readers.
   *
   * **Cluster behaviour (ECS tasks, Kubernetes pods, multiple servers):**
   * Downloads are *serialized*, not skipped. Instances take turns behind a distributed
   * lock held in the storage adapter (Redis or database), and each one re-checks
   * `dbPath` before downloading:
   * - **Shared volume** (EFS, NFS, mounted PVC): the first instance downloads, the rest
   *   find fresh files and load them without touching MaxMind's API.
   * - **Container-local path** (the default, `os.tmpdir()`): each instance downloads its
   *   own copy when its turn comes, so no instance is left without geolocation data.
   *
   * Concurrent calls within a single process share one run.
   *
   * Lock details:
   * - Lock key: 'maxmind-db-update-lock'
   * - Lock TTL: 5 minutes (300 seconds), so a crashed instance cannot wedge the cluster
   * - Waits up to 2 minutes for another instance, then downloads anyway rather than
   *   starting without geolocation data
   * - Files younger than 24 hours are reused instead of re-downloaded
   *
   * After a successful download, the in-memory database readers are automatically
   * updated to use the new files.
   *
   * @throws {NAuthException} If MaxMind credentials are missing or download fails
   *
   * @example
   * ```typescript
   * // Call this method via cron job for periodic updates
   * await geoLocationService.updateGeoLocationDatabase();
   * ```
   */
  async updateGeoLocationDatabase(): Promise<void> {
    // ============================================================================
    // Validate Configuration
    // ============================================================================
    if (!this.config) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'MaxMind configuration not provided');
    }

    if (!this.maxMindLib) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'MaxMind library not available. Install @maxmind/geoip2-node peer dependency.',
      );
    }

    if (!this.config.download) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'No download source is configured. Set geoLocation.maxMind.download to fetch from MaxMind or from your ' +
          'own mirror; without it the toolkit only loads files already present in dbPath.',
      );
    }

    // ============================================================================
    // Deduplicate Within This Process
    // ============================================================================
    // Startup auto-download and a cron-triggered update can overlap; share one run
    // rather than downloading the same file twice into the same directory.
    const inFlight = this.updateInFlight;
    if (inFlight) {
      this.logger?.debug?.('MaxMind database update already running in this process; awaiting it.');
      return inFlight;
    }

    const run = this.runDatabaseUpdate().finally(() => {
      this.updateInFlight = null;
    });
    this.updateInFlight = run;
    return run;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Perform one database update, serialized against other instances.
   *
   * @remarks
   * Assumes configuration has already been validated by
   * {@link GeoLocationService.updateGeoLocationDatabase}.
   */
  private async runDatabaseUpdate(): Promise<void> {
    // ============================================================================
    // Acquire Distributed Lock (waiting, not skipping)
    // ============================================================================
    // Memory storage: Lock works within a single process (fine for single-server deployments)
    // Redis/Database storage: Lock works across servers, so instances take turns
    const lockToken = `lock-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const deadline = Date.now() + this.lockWaitMs;

    let holdsLock = false;
    let waitLogged = false;

    for (;;) {
      // Adapters return the stored value on success and null when the key already exists.
      const acquired = await this.storageAdapter.set(this.lockKey, lockToken, this.lockTtlSeconds, { nx: true });

      if (acquired) {
        holdsLock = true;
        break;
      }

      // Another instance holds the lock. On a shared dbPath its files land here and we
      // are done; on a container-local dbPath nothing appears and we wait for our turn.
      if (await this.loadFreshDatabasesFromDisk()) {
        this.logger?.log?.('MaxMind databases were updated by another instance; loaded from disk.');
        return;
      }

      if (Date.now() >= deadline) {
        this.logger?.warn?.(
          `Timed out after ${this.lockWaitMs}ms waiting for the MaxMind update lock; downloading without it.`,
        );
        break;
      }

      if (!waitLogged) {
        waitLogged = true;
        this.logger?.log?.('Another instance is updating the MaxMind database; waiting for it to finish...');
      }

      await this.delay(this.lockRetryDelayMs);
    }

    try {
      // ============================================================================
      // Skip If Already Fresh
      // ============================================================================
      // Re-checked under the lock: on a shared volume the instance that just released
      // it has written the files we were about to download.
      if (await this.loadFreshDatabasesFromDisk()) {
        this.logger?.log?.('MaxMind databases are already up to date; skipping download.');
        return;
      }

      // ============================================================================
      // Download and Update Databases
      // ============================================================================
      const editions = this.config?.editions || this.defaultEditions;
      const download = this.config?.download;
      const licenseKey = download?.from === 'maxmind' ? download.licenseKey : '';

      let successCount = 0;
      let failureCount = 0;

      for (const edition of editions) {
        try {
          await this.downloadDatabase(edition, licenseKey);
          successCount++;
        } catch (error) {
          failureCount++;
          this.logger?.error?.(
            `Failed to download MaxMind database ${edition}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          // Continue with other editions even if one fails
        }
      }

      // ============================================================================
      // Reload Database Files
      // ============================================================================
      await this.loadDatabaseFiles();

      // Only log success if at least one database was downloaded
      if (successCount > 0) {
        this.logger?.log?.(`MaxMind database update completed: ${successCount} succeeded, ${failureCount} failed`);
      } else if (failureCount > 0) {
        this.logger?.warn?.(
          `MaxMind database update failed: All ${failureCount} database(s) failed to download. See error messages above.`,
        );
      }
    } finally {
      // ============================================================================
      // Release Lock
      // ============================================================================
      if (holdsLock) {
        await this.releaseUpdateLock(lockToken);
      }
    }
  }

  /**
   * Release the distributed update lock, but only if this instance still owns it.
   *
   * @remarks
   * If the download outran the lock TTL another instance may already hold the lock;
   * deleting it unconditionally would let a third instance download concurrently.
   * The read-then-delete is not atomic, so this narrows the window rather than closing
   * it — the TTL remains the backstop.
   *
   * @param lockToken - Token written when the lock was acquired
   */
  private async releaseUpdateLock(lockToken: string): Promise<void> {
    try {
      const current = await this.storageAdapter.get(this.lockKey);
      // Only bail out when the adapter reports a *different* owner. Adapters that do not
      // report a value (or where the key already expired) fall through to the delete.
      if (typeof current === 'string' && current !== lockToken) {
        this.logger?.warn?.('MaxMind update lock expired and was taken over by another instance; leaving it in place.');
        return;
      }
      await this.storageAdapter.del(this.lockKey);
    } catch (error) {
      // Non-fatal: Lock will expire automatically after TTL
      this.logger?.warn?.(
        `Failed to release MaxMind update lock: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Load database files from disk if they are present and fresh enough to reuse.
   *
   * @remarks
   * Freshness is judged by file mtime. Every configured edition must be present and
   * fresh, otherwise a download is still needed.
   *
   * @returns True if fresh files were found and at least one reader was loaded
   */
  private async loadFreshDatabasesFromDisk(): Promise<boolean> {
    const editions = this.config?.editions || this.defaultEditions;
    if (!editions.length) {
      return false;
    }

    const maxAgeMs = this.minRefreshIntervalHours * 60 * 60 * 1000;
    const now = Date.now();

    for (const edition of editions) {
      try {
        const stats = await fs.stat(path.join(this.dbPath, `${edition}.mmdb`));
        if (!Number.isFinite(stats.mtimeMs) || now - stats.mtimeMs > maxAgeMs) {
          return false;
        }
      } catch {
        // Missing or unreadable - a download is required.
        return false;
      }
    }

    await this.loadDatabaseFiles();
    return Boolean(this.cityReader || this.countryReader);
  }

  /**
   * Pause for the given number of milliseconds.
   *
   * @param ms - Delay in milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Ensure database directory exists
   *
   * Creates the directory if it doesn't exist.
   */
  private async ensureDbDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.dbPath, { recursive: true });
      this.logger?.debug?.(`MaxMind database directory: ${this.dbPath}`);
    } catch (error) {
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        `Failed to create MaxMind database directory at ${this.dbPath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Load database files from disk
   *
   * Loads .mmdb files for City and Country databases if they exist.
   */
  private async loadDatabaseFiles(): Promise<void> {
    if (!this.maxMindLib) {
      return;
    }

    // Why each reader failed to open, keyed by file path, so a missing file can be told
    // apart from an unreadable one.
    const openFailures = new Map<string, string>();

    try {
      // Try to load City database
      const cityDbPath = path.join(this.dbPath, 'GeoLite2-City.mmdb');
      try {
        // Reader.open returns a Reader instance with city()/country() methods
        this.cityReader = await this.maxMindLib.Reader.open(cityDbPath);
        if (typeof this.cityReader.city !== 'function') {
          this.logger?.warn?.('MaxMind Reader instance does not have city() method');
          this.cityReader = null;
        } else {
          this.logger?.debug?.('Loaded GeoLite2-City database');
        }
      } catch (error) {
        // City database not found or failed to load
        openFailures.set(cityDbPath, error instanceof Error ? error.message : 'Unknown error');
        this.logger?.debug?.(
          `Failed to load City database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        this.cityReader = null;
      }

      // Try to load Country database
      const countryDbPath = path.join(this.dbPath, 'GeoLite2-Country.mmdb');
      try {
        this.countryReader = await this.maxMindLib.Reader.open(countryDbPath);
        if (typeof this.countryReader.country !== 'function') {
          this.logger?.warn?.('MaxMind Reader instance does not have country() method');
          this.countryReader = null;
        } else {
          this.logger?.debug?.('Loaded GeoLite2-Country database');
        }
      } catch (error) {
        // Country database not found or failed to load
        openFailures.set(countryDbPath, error instanceof Error ? error.message : 'Unknown error');
        this.logger?.debug?.(
          `Failed to load Country database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        this.countryReader = null;
      }

      if (!this.cityReader && !this.countryReader) {
        // Distinguish "the files are not there" from "the files are there and would not
        // open". Reporting the first when it is really the second sends the reader off
        // to debug a download that already succeeded.
        const present: string[] = [];
        for (const dbFilePath of openFailures.keys()) {
          try {
            await fs.access(dbFilePath);
            present.push(dbFilePath);
          } catch {
            // Genuinely absent.
          }
        }

        if (present.length > 0) {
          const detail = present.map((file) => `${path.basename(file)}: ${openFailures.get(file)}`).join('; ');
          this.logger?.warn?.(
            `MaxMind database files exist in ${this.dbPath} but could not be opened (${detail}). ` +
              `The files may be truncated or corrupt, or @maxmind/geoip2-node may not be resolvable from here.`,
          );
        } else if (!this.config?.download) {
          this.logger?.warn?.(
            `No MaxMind database files found in ${this.dbPath}, and no download source is configured. ` +
              `Place the .mmdb files there, or set geoLocation.maxMind.download to fetch them.`,
          );
        } else {
          this.logger?.warn?.(
            `No MaxMind database files found in ${this.dbPath}. ` +
              `They will be fetched on startup, or when updateGeoLocationDatabase() is called.`,
          );
        }
      } else {
        // Log which databases were loaded
        const loaded = [];
        if (this.cityReader) loaded.push('GeoLite2-City');
        if (this.countryReader) loaded.push('GeoLite2-Country');
        this.logger?.debug?.(`Loaded MaxMind databases: ${loaded.join(', ')}`);
      }
    } catch (error) {
      this.logger?.warn?.(
        `Failed to load MaxMind database files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Resolve where a given edition should be downloaded from.
   *
   * Returns the configured mirror when `downloadUrl` is set, otherwise MaxMind's own
   * download API.
   *
   * @param edition - Edition name (e.g., 'GeoLite2-City')
   * @param licenseKey - MaxMind license key, used only for the MaxMind API URL
   * @returns The resolved URL, and whether it came from consumer configuration
   * @throws {NAuthException} If a configured URL is missing for the edition or uses an unsupported scheme
   */
  private resolveDownloadUrl(edition: string, licenseKey: string): { url: string; custom: boolean } {
    const download = this.config?.download;

    if (download?.from !== 'url') {
      return {
        url: `https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${licenseKey}&suffix=tar.gz`,
        custom: false,
      };
    }

    const url =
      typeof download.url === 'string' ? download.url.replace(/\{edition\}/g, edition) : download.url[edition];

    if (!url) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `geoLocation.maxMind.download.url has no entry for edition '${edition}'. ` +
          'Add one, or remove the edition from geoLocation.maxMind.editions.',
      );
    }

    this.assertSupportedDownloadUrl(url, edition);
    return { url, custom: true };
  }

  /**
   * Reject download URLs the toolkit cannot fetch.
   *
   * Only HTTPS is accepted, plus plain HTTP to loopback for local development. `s3://`
   * is called out by name because it is the natural thing to reach for and would
   * otherwise fail with an opaque parse error.
   *
   * @param url - Configured URL
   * @param edition - Edition the URL belongs to, for the error message
   * @throws {NAuthException} If the scheme is unsupported or the URL is malformed
   */
  private assertSupportedDownloadUrl(url: string, edition: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `geoLocation.maxMind.downloadUrl for '${edition}' is not a valid URL.`,
      );
    }

    if (parsed.protocol === 's3:') {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `geoLocation.maxMind.downloadUrl for '${edition}' uses s3://, which is not supported - the toolkit ships ` +
          "no AWS SDK and does not sign S3 requests. Use the bucket's HTTPS endpoint, a presigned URL, or a CDN " +
          'in front of it.',
      );
    }

    const isLoopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback)) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `geoLocation.maxMind.downloadUrl for '${edition}' must use https:// (got ${parsed.protocol}//). ` +
          'Plain http:// is accepted only for loopback hosts during local development.',
      );
    }
  }

  /**
   * Build request headers for a download from the configured mirror.
   *
   * @returns Headers including HTTP Basic credentials when configured
   */
  private buildDownloadHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const auth = this.config?.download?.from === 'url' ? this.config.download.auth : undefined;

    if (auth) {
      const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    }

    return headers;
  }

  /**
   * Download a MaxMind database file
   *
   * Downloads the specified edition from MaxMind's download API,
   * extracts the .mmdb file from the tar.gz archive, and saves it.
   *
   * Uses Node.js built-in zlib for gzip decompression and implements
   * basic tar parsing to extract the .mmdb file.
   *
   * @param edition - Edition name (e.g., 'GeoLite2-City')
   * @param licenseKey - MaxMind license key, unused when a mirror is configured
   */
  private async downloadDatabase(edition: string, licenseKey: string): Promise<void> {
    const { url, custom } = this.resolveDownloadUrl(edition, licenseKey);
    const tempTarPath = path.join(this.dbPath, `${edition}.tar.gz`);
    const outputPath = path.join(this.dbPath, `${edition}.mmdb`);

    try {
      // ============================================================================
      // Download the archive or database file
      // ============================================================================
      this.logger?.debug?.(
        custom
          ? `Downloading MaxMind database ${edition} from the configured mirror...`
          : `Downloading MaxMind database ${edition}...`,
      );

      // Wrap fetch in timeout and better error handling
      let response: Response;
      try {
        response = await fetch(url, {
          headers: custom ? this.buildDownloadHeaders() : undefined,
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });
      } catch (fetchError: unknown) {
        const fetchErrorObj = fetchError as { code?: unknown; name?: unknown; message?: unknown };
        const errorCode = typeof fetchErrorObj.code === 'string' ? fetchErrorObj.code : undefined;
        const errorName = typeof fetchErrorObj.name === 'string' ? fetchErrorObj.name : undefined;
        const errorMessage = typeof fetchErrorObj.message === 'string' ? fetchErrorObj.message : undefined;

        // Handle network errors (DNS failures, connection errors, etc.)
        if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED' || errorName === 'AbortError') {
          throw new NAuthException(
            AuthErrorCode.INTERNAL_ERROR,
            `Network error while downloading MaxMind database ${edition} from ${redactUrl(url)}: ${
              errorMessage || 'DNS lookup failed or connection refused'
            }. Check your network connection and proxy settings.`,
          );
        }
        throw fetchError;
      }

      if (!response.ok) {
        const source = custom ? `Download source ${redactUrl(url)}` : 'MaxMind API';
        const hint =
          custom && (response.status === 401 || response.status === 403)
            ? ' Check geoLocation.maxMind.download.auth, or whether a presigned URL has expired.'
            : '';
        throw new Error(`${source} returned ${response.status}: ${response.statusText}.${hint}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // ============================================================================
      // Write out the database
      // ============================================================================
      // A mirror may serve either MaxMind's own tar.gz or a bare .mmdb that someone
      // already unpacked. Detect from the bytes rather than the URL - a presigned URL
      // carries a query string, so its path extension proves nothing.
      if (isGzip(buffer)) {
        await fs.writeFile(tempTarPath, buffer);

        // MaxMind tar.gz contains: <edition>_<date>/<edition>.mmdb
        // We need to decompress gzip, then parse tar to find the .mmdb file
        await this.extractTarGz(tempTarPath, outputPath, edition);

        // Clean up temp tar.gz file
        await fs.unlink(tempTarPath).catch(() => {
          // Ignore cleanup errors
        });
      } else if (isMmdb(buffer)) {
        // Write to a temp name and rename, so a half-written file is never loadable.
        const tempDbPath = `${outputPath}.download`;
        await fs.writeFile(tempDbPath, buffer);
        await fs.rename(tempDbPath, outputPath);
      } else {
        throw new Error(
          `Download source ${redactUrl(url)} returned data that is neither a gzip archive nor a MaxMind database ` +
            `(${buffer.length} bytes). Check that the URL points at a .tar.gz or .mmdb file and not, for example, ` +
            'an HTML error page.',
        );
      }

      this.logger?.debug?.(`Successfully downloaded and extracted ${edition}`);
    } catch (error) {
      // Clean up temp file on error
      await fs.unlink(tempTarPath).catch(() => {
        // Ignore cleanup errors
      });

      if (error instanceof NAuthException) {
        throw error;
      }

      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        `Failed to download MaxMind database ${edition}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Extract .mmdb file from tar.gz archive
   *
   * Uses Node.js built-in zlib for gzip decompression and implements
   * basic tar parsing to find and extract the .mmdb file.
   *
   * @param tarGzPath - Path to the .tar.gz file
   * @param outputPath - Path where .mmdb file should be saved
   * @param edition - Edition name (to find correct file in archive)
   */
  private async extractTarGz(tarGzPath: string, outputPath: string, edition: string): Promise<void> {
    // Prefer OS tar (no extra deps) per project guidance
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Use a dedicated extraction directory to avoid polluting dbPath
    const extractDir = path.join(this.dbPath, `extract_${edition}_${Date.now()}`);
    await fs.mkdir(extractDir, { recursive: true });

    try {
      // Extract archive
      await execAsync(`tar -xzf "${tarGzPath}" -C "${extractDir}"`);

      // Find the .mmdb file (usually in a subdirectory like GeoLite2-City_YYYYMMDD/GeoLite2-City.mmdb)
      const entries = await fs.readdir(extractDir);
      let mmdbPath: string | null = null;
      for (const entry of entries) {
        const entryPath = path.join(extractDir, entry);
        const stat = await fs.stat(entryPath);
        if (stat.isDirectory()) {
          const inner = await fs.readdir(entryPath);
          for (const f of inner) {
            if (f.endsWith('.mmdb') && f.includes(edition)) {
              mmdbPath = path.join(entryPath, f);
              break;
            }
          }
        } else if (entry.endsWith('.mmdb') && entry.includes(edition)) {
          mmdbPath = entryPath;
        }
        if (mmdbPath) break;
      }

      if (!mmdbPath) {
        throw new Error(`Could not find extracted .mmdb file for ${edition}`);
      }

      // Move to final location
      await fs.rename(mmdbPath, outputPath);
    } finally {
      // Cleanup extraction directory
      try {
        // Best-effort cleanup
        await execAsync(`rm -rf "${extractDir}"`).catch(() => undefined);
      } catch {
        // ignore
      }
    }
  }
}
