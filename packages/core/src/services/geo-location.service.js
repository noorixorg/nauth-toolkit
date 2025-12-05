"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoLocationService = void 0;
var fs = require("fs/promises");
var path = require("path");
var os = require("os");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
var ip_extractor_1 = require("../utils/ip-extractor");
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
var GeoLocationService = /** @class */ (function () {
    function GeoLocationService(nauthConfig, storageAdapter, maxMindLib, logger) {
        var _a, _b, _c, _d;
        this.storageAdapter = storageAdapter;
        this.logger = logger;
        this.cityReader = null;
        this.countryReader = null;
        this.defaultEditions = ['GeoLite2-City', 'GeoLite2-Country'];
        this.lockKey = 'maxmind-db-update-lock';
        this.lockTtlSeconds = 300; // 5 minutes
        // ============================================================================
        // Extract Configuration
        // ============================================================================
        this.config = (_a = nauthConfig.geoLocation) === null || _a === void 0 ? void 0 : _a.maxMind;
        // ============================================================================
        // Initialize MaxMind Library (Optional)
        // ============================================================================
        this.maxMindLib = maxMindLib !== null && maxMindLib !== void 0 ? maxMindLib : null;
        if (!this.maxMindLib && this.config) {
            (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.warn) === null || _c === void 0 ? void 0 : _c.call(_b, 'MaxMind GeoIP2 is configured but @maxmind/geoip2-node package is not installed. ' +
                'Install it with: yarn add @maxmind/geoip2-node\n' +
                'Or remove geoLocation.maxMind from your configuration to disable geolocation.');
        }
        // ============================================================================
        // Resolve Database Path
        // ============================================================================
        if ((_d = this.config) === null || _d === void 0 ? void 0 : _d.dbPath) {
            // Use configured path (absolute or relative to cwd)
            this.dbPath = path.isAbsolute(this.config.dbPath)
                ? this.config.dbPath
                : path.resolve(process.cwd(), this.config.dbPath);
        }
        else {
            // Default to system temp directory
            var systemTemp = os.tmpdir();
            this.dbPath = path.join(systemTemp, 'nauth_maxmind');
        }
    }
    /**
     * Initialize service on module startup
     *
     * - Loads database files if they exist
     * - Optionally downloads databases if autoDownloadOnStartup is enabled
     */
    GeoLocationService.prototype.onModuleInit = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (!this.config) {
                            // No config provided - service disabled
                            return [2 /*return*/];
                        }
                        if (!this.maxMindLib) {
                            // MaxMind not installed - service disabled
                            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, 'MaxMind GeoIP2 library not available. Install @maxmind/geoip2-node to enable geolocation.');
                            return [2 /*return*/];
                        }
                        // Ensure database directory exists
                        return [4 /*yield*/, this.ensureDbDirectoryExists()];
                    case 1:
                        // Ensure database directory exists
                        _e.sent();
                        // Load existing database files
                        return [4 /*yield*/, this.loadDatabaseFiles()];
                    case 2:
                        // Load existing database files
                        _e.sent();
                        if (!(!this.config.skipDownloads && this.config.autoDownloadOnStartup && (!this.cityReader || !this.countryReader))) return [3 /*break*/, 6];
                        _e.label = 3;
                    case 3:
                        _e.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.updateGeoLocationDatabase()];
                    case 4:
                        _e.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _e.sent();
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, "Failed to auto-download MaxMind databases on startup: ".concat(error_1 instanceof Error ? error_1.message : 'Unknown error'));
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get geolocation information for an IP address
     *
     * @param ip - IP address to lookup
     * @returns Geolocation info with country and city (if available)
     *
     * @example
     * ```typescript
     * const geo = await geoLocationService.getIpGeolocation('8.8.8.8');
     * // { country: 'US', city: 'Mountain View' }
     * ```
     */
    GeoLocationService.prototype.getIpGeolocation = function (ip) {
        return __awaiter(this, void 0, void 0, function () {
            var result, result;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            return __generator(this, function (_l) {
                // ============================================================================
                // Check if Service is Available
                // ============================================================================
                if (!this.config || !this.maxMindLib) {
                    // Service not configured or MaxMind not installed
                    return [2 /*return*/, {}];
                }
                // ============================================================================
                // Skip Private IP Addresses
                // ============================================================================
                // MaxMind databases only contain public IP addresses. Private IPs (localhost,
                // 192.168.x.x, 10.x.x.x, etc.) will always fail lookup and generate unnecessary
                // error logs. Skip the lookup entirely for private IPs.
                if ((0, ip_extractor_1.isPrivateIp)(ip)) {
                    // Silently return empty result for private IPs (no lookup attempted)
                    (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, "Skipping private IP ".concat(ip, " for geolocation lookup"));
                    return [2 /*return*/, {}];
                }
                // ============================================================================
                // Try City Database First (More Detailed)
                // ============================================================================
                if (this.cityReader) {
                    try {
                        result = this.cityReader.city(ip);
                        return [2 /*return*/, {
                                country: (_c = result.country) === null || _c === void 0 ? void 0 : _c.isoCode,
                                city: (_e = (_d = result.city) === null || _d === void 0 ? void 0 : _d.names) === null || _e === void 0 ? void 0 : _e.en,
                            }];
                    }
                    catch (error) {
                        // Non-fatal: Log and try country database
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.debug) === null || _g === void 0 ? void 0 : _g.call(_f, "City lookup failed for IP ".concat(ip, ": ").concat(error instanceof Error ? error.message : 'Unknown error'));
                    }
                }
                // ============================================================================
                // Fallback to Country Database
                // ============================================================================
                if (this.countryReader) {
                    try {
                        result = this.countryReader.country(ip);
                        return [2 /*return*/, {
                                country: (_h = result.country) === null || _h === void 0 ? void 0 : _h.isoCode,
                            }];
                    }
                    catch (error) {
                        // Non-fatal: Return empty result
                        (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.debug) === null || _k === void 0 ? void 0 : _k.call(_j, "Country lookup failed for IP ".concat(ip, ": ").concat(error instanceof Error ? error.message : 'Unknown error'));
                    }
                }
                // No databases loaded or lookup failed
                return [2 /*return*/, {}];
            });
        });
    };
    /**
     * Update MaxMind GeoIP2 database files
     *
     * Downloads the latest database files from MaxMind using distributed locking
     * to prevent concurrent downloads in multi-server deployments.
     *
     * Uses storage adapter for distributed locking:
     * - Lock key: 'maxmind-db-update-lock'
     * - Lock TTL: 5 minutes (300 seconds)
     * - Only one server/process can download at a time
     *
     * @throws {NAuthException} If MaxMind credentials are missing or download fails
     *
     * @example
     * ```typescript
     * // Call this method via cron job for periodic updates
     * await geoLocationService.updateGeoLocationDatabase();
     * ```
     */
    GeoLocationService.prototype.updateGeoLocationDatabase = function () {
        return __awaiter(this, void 0, void 0, function () {
            var lockAcquired, editions, accountId, licenseKey, successCount, failureCount, _i, editions_1, edition, error_2, error_3;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            return __generator(this, function (_l) {
                switch (_l.label) {
                    case 0:
                        // ============================================================================
                        // Validate Configuration
                        // ============================================================================
                        if (!this.config) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'MaxMind configuration not provided');
                        }
                        if (!this.maxMindLib) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'MaxMind library not available. Install @maxmind/geoip2-node peer dependency.');
                        }
                        if (this.config.skipDownloads) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Database downloads are disabled (skipDownloads: true). Use existing files or disable skipDownloads to enable downloads.');
                        }
                        if (!this.config.licenseKey || !this.config.accountId) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'MaxMind licenseKey and accountId are required for database downloads');
                        }
                        return [4 /*yield*/, this.storageAdapter.set(this.lockKey, "lock-".concat(Date.now()), this.lockTtlSeconds, {
                                nx: true,
                            })];
                    case 1:
                        lockAcquired = _l.sent();
                        if (!lockAcquired) {
                            // Another process/server is already updating
                            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, 'MaxMind database update already in progress, skipping...');
                            return [2 /*return*/];
                        }
                        _l.label = 2;
                    case 2:
                        _l.trys.push([2, , 10, 14]);
                        editions = this.config.editions || this.defaultEditions;
                        accountId = this.config.accountId;
                        licenseKey = this.config.licenseKey;
                        successCount = 0;
                        failureCount = 0;
                        _i = 0, editions_1 = editions;
                        _l.label = 3;
                    case 3:
                        if (!(_i < editions_1.length)) return [3 /*break*/, 8];
                        edition = editions_1[_i];
                        _l.label = 4;
                    case 4:
                        _l.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.downloadDatabase(edition, accountId, licenseKey)];
                    case 5:
                        _l.sent();
                        successCount++;
                        return [3 /*break*/, 7];
                    case 6:
                        error_2 = _l.sent();
                        failureCount++;
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.call(_c, "Failed to download MaxMind database ".concat(edition, ": ").concat(error_2 instanceof Error ? error_2.message : 'Unknown error'));
                        return [3 /*break*/, 7];
                    case 7:
                        _i++;
                        return [3 /*break*/, 3];
                    case 8: 
                    // ============================================================================
                    // Reload Database Files
                    // ============================================================================
                    return [4 /*yield*/, this.loadDatabaseFiles()];
                    case 9:
                        // ============================================================================
                        // Reload Database Files
                        // ============================================================================
                        _l.sent();
                        // Only log success if at least one database was downloaded
                        if (successCount > 0) {
                            (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.log) === null || _f === void 0 ? void 0 : _f.call(_e, "MaxMind database update completed: ".concat(successCount, " succeeded, ").concat(failureCount, " failed"));
                        }
                        else if (failureCount > 0) {
                            (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.warn) === null || _h === void 0 ? void 0 : _h.call(_g, "MaxMind database update failed: All ".concat(failureCount, " database(s) failed to download. See error messages above."));
                        }
                        return [3 /*break*/, 14];
                    case 10:
                        _l.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, this.storageAdapter.del(this.lockKey)];
                    case 11:
                        _l.sent();
                        return [3 /*break*/, 13];
                    case 12:
                        error_3 = _l.sent();
                        // Non-fatal: Lock will expire automatically after TTL
                        (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.warn) === null || _k === void 0 ? void 0 : _k.call(_j, "Failed to release MaxMind update lock: ".concat(error_3 instanceof Error ? error_3.message : 'Unknown error'));
                        return [3 /*break*/, 13];
                    case 13: return [7 /*endfinally*/];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    // ============================================================================
    // Private Helper Methods
    // ============================================================================
    /**
     * Ensure database directory exists
     *
     * Creates the directory if it doesn't exist.
     */
    GeoLocationService.prototype.ensureDbDirectoryExists = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_4;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fs.mkdir(this.dbPath, { recursive: true })];
                    case 1:
                        _c.sent();
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, "MaxMind database directory: ".concat(this.dbPath));
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _c.sent();
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, "Failed to create MaxMind database directory at ".concat(this.dbPath, ": ").concat(error_4 instanceof Error ? error_4.message : 'Unknown error'));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load database files from disk
     *
     * Loads .mmdb files for City and Country databases if they exist.
     */
    GeoLocationService.prototype.loadDatabaseFiles = function () {
        return __awaiter(this, void 0, void 0, function () {
            var cityDbPath, _a, error_5, countryDbPath, _b, error_6, loaded, error_7;
            var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
            return __generator(this, function (_z) {
                switch (_z.label) {
                    case 0:
                        if (!this.maxMindLib) {
                            return [2 /*return*/];
                        }
                        _z.label = 1;
                    case 1:
                        _z.trys.push([1, 10, , 11]);
                        cityDbPath = path.join(this.dbPath, 'GeoLite2-City.mmdb');
                        _z.label = 2;
                    case 2:
                        _z.trys.push([2, 4, , 5]);
                        // Reader.open returns a Reader instance with city()/country() methods
                        _a = this;
                        return [4 /*yield*/, this.maxMindLib.Reader.open(cityDbPath)];
                    case 3:
                        // Reader.open returns a Reader instance with city()/country() methods
                        _a.cityReader = _z.sent();
                        if (typeof this.cityReader.city !== 'function') {
                            (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, 'MaxMind Reader instance does not have city() method');
                            this.cityReader = null;
                        }
                        else {
                            (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.debug) === null || _f === void 0 ? void 0 : _f.call(_e, 'Loaded GeoLite2-City database');
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_5 = _z.sent();
                        // City database not found or failed to load
                        (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.debug) === null || _h === void 0 ? void 0 : _h.call(_g, "Failed to load City database: ".concat(error_5 instanceof Error ? error_5.message : 'Unknown error'));
                        this.cityReader = null;
                        return [3 /*break*/, 5];
                    case 5:
                        countryDbPath = path.join(this.dbPath, 'GeoLite2-Country.mmdb');
                        _z.label = 6;
                    case 6:
                        _z.trys.push([6, 8, , 9]);
                        _b = this;
                        return [4 /*yield*/, this.maxMindLib.Reader.open(countryDbPath)];
                    case 7:
                        _b.countryReader = _z.sent();
                        if (typeof this.countryReader.country !== 'function') {
                            (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.warn) === null || _k === void 0 ? void 0 : _k.call(_j, 'MaxMind Reader instance does not have country() method');
                            this.countryReader = null;
                        }
                        else {
                            (_m = (_l = this.logger) === null || _l === void 0 ? void 0 : _l.debug) === null || _m === void 0 ? void 0 : _m.call(_l, 'Loaded GeoLite2-Country database');
                        }
                        return [3 /*break*/, 9];
                    case 8:
                        error_6 = _z.sent();
                        // Country database not found or failed to load
                        (_p = (_o = this.logger) === null || _o === void 0 ? void 0 : _o.debug) === null || _p === void 0 ? void 0 : _p.call(_o, "Failed to load Country database: ".concat(error_6 instanceof Error ? error_6.message : 'Unknown error'));
                        this.countryReader = null;
                        return [3 /*break*/, 9];
                    case 9:
                        if (!this.cityReader && !this.countryReader) {
                            if ((_q = this.config) === null || _q === void 0 ? void 0 : _q.skipDownloads) {
                                (_s = (_r = this.logger) === null || _r === void 0 ? void 0 : _r.warn) === null || _s === void 0 ? void 0 : _s.call(_r, "No MaxMind database files found in ".concat(this.dbPath, ". ") +
                                    "Downloads are disabled (skipDownloads: true). " +
                                    "Ensure database files are available in the configured path, or set skipDownloads: false to enable downloads.");
                            }
                            else {
                                (_u = (_t = this.logger) === null || _t === void 0 ? void 0 : _t.warn) === null || _u === void 0 ? void 0 : _u.call(_t, "No MaxMind database files found in ".concat(this.dbPath, ". ") +
                                    "Files will be downloaded when updateGeoLocationDatabase() is called or autoDownloadOnStartup is enabled.");
                            }
                        }
                        else {
                            loaded = [];
                            if (this.cityReader)
                                loaded.push('GeoLite2-City');
                            if (this.countryReader)
                                loaded.push('GeoLite2-Country');
                            (_w = (_v = this.logger) === null || _v === void 0 ? void 0 : _v.debug) === null || _w === void 0 ? void 0 : _w.call(_v, "Loaded MaxMind databases: ".concat(loaded.join(', ')));
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        error_7 = _z.sent();
                        (_y = (_x = this.logger) === null || _x === void 0 ? void 0 : _x.warn) === null || _y === void 0 ? void 0 : _y.call(_x, "Failed to load MaxMind database files: ".concat(error_7 instanceof Error ? error_7.message : 'Unknown error'));
                        return [3 /*break*/, 11];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
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
     * @param accountId - MaxMind account ID
     * @param licenseKey - MaxMind license key
     */
    GeoLocationService.prototype.downloadDatabase = function (edition, _accountId, licenseKey) {
        return __awaiter(this, void 0, void 0, function () {
            var url, tempTarPath, outputPath, response, fetchError_1, buffer, _a, _b, error_8;
            var _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        url = "https://download.maxmind.com/app/geoip_download?edition_id=".concat(edition, "&license_key=").concat(licenseKey, "&suffix=tar.gz");
                        tempTarPath = path.join(this.dbPath, "".concat(edition, ".tar.gz"));
                        outputPath = path.join(this.dbPath, "".concat(edition, ".mmdb"));
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 10, , 12]);
                        // ============================================================================
                        // Download tar.gz file
                        // ============================================================================
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug) === null || _d === void 0 ? void 0 : _d.call(_c, "Downloading MaxMind database ".concat(edition, "..."));
                        response = void 0;
                        _g.label = 2;
                    case 2:
                        _g.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, fetch(url, {
                                // Add timeout to prevent hanging requests
                                signal: AbortSignal.timeout(30000), // 30 second timeout
                            })];
                    case 3:
                        response = _g.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        fetchError_1 = _g.sent();
                        // Handle network errors (DNS failures, connection errors, etc.)
                        if ((fetchError_1 === null || fetchError_1 === void 0 ? void 0 : fetchError_1.code) === 'ENOTFOUND' ||
                            (fetchError_1 === null || fetchError_1 === void 0 ? void 0 : fetchError_1.code) === 'ECONNREFUSED' ||
                            (fetchError_1 === null || fetchError_1 === void 0 ? void 0 : fetchError_1.name) === 'AbortError') {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, "Network error while downloading MaxMind database ".concat(edition, ": ").concat(fetchError_1.message || 'DNS lookup failed or connection refused', ". Check your network connection and proxy settings."));
                        }
                        throw fetchError_1;
                    case 5:
                        if (!response.ok) {
                            throw new Error("MaxMind API returned ".concat(response.status, ": ").concat(response.statusText));
                        }
                        _b = (_a = Buffer).from;
                        return [4 /*yield*/, response.arrayBuffer()];
                    case 6:
                        buffer = _b.apply(_a, [_g.sent()]);
                        return [4 /*yield*/, fs.writeFile(tempTarPath, buffer)];
                    case 7:
                        _g.sent();
                        // ============================================================================
                        // Extract .mmdb file from tar.gz
                        // ============================================================================
                        // MaxMind tar.gz contains: <edition>_<date>/<edition>.mmdb
                        // We need to decompress gzip, then parse tar to find the .mmdb file
                        return [4 /*yield*/, this.extractTarGz(tempTarPath, outputPath, edition)];
                    case 8:
                        // ============================================================================
                        // Extract .mmdb file from tar.gz
                        // ============================================================================
                        // MaxMind tar.gz contains: <edition>_<date>/<edition>.mmdb
                        // We need to decompress gzip, then parse tar to find the .mmdb file
                        _g.sent();
                        // Clean up temp tar.gz file
                        return [4 /*yield*/, fs.unlink(tempTarPath).catch(function () {
                                // Ignore cleanup errors
                            })];
                    case 9:
                        // Clean up temp tar.gz file
                        _g.sent();
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.debug) === null || _f === void 0 ? void 0 : _f.call(_e, "Successfully downloaded and extracted ".concat(edition));
                        return [3 /*break*/, 12];
                    case 10:
                        error_8 = _g.sent();
                        // Clean up temp file on error
                        return [4 /*yield*/, fs.unlink(tempTarPath).catch(function () {
                                // Ignore cleanup errors
                            })];
                    case 11:
                        // Clean up temp file on error
                        _g.sent();
                        if (error_8 instanceof nauth_exception_1.NAuthException) {
                            throw error_8;
                        }
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, "Failed to download MaxMind database ".concat(edition, ": ").concat(error_8 instanceof Error ? error_8.message : 'Unknown error'));
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
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
    GeoLocationService.prototype.extractTarGz = function (tarGzPath, outputPath, edition) {
        return __awaiter(this, void 0, void 0, function () {
            var exec, promisify, execAsync, extractDir, entries, mmdbPath, _i, entries_1, entry, entryPath, stat, inner, _a, inner_1, f, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('child_process'); })];
                    case 1:
                        exec = (_c.sent()).exec;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('util'); })];
                    case 2:
                        promisify = (_c.sent()).promisify;
                        execAsync = promisify(exec);
                        extractDir = path.join(this.dbPath, "extract_".concat(edition, "_").concat(Date.now()));
                        return [4 /*yield*/, fs.mkdir(extractDir, { recursive: true })];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4:
                        _c.trys.push([4, , 15, 19]);
                        // Extract archive
                        return [4 /*yield*/, execAsync("tar -xzf \"".concat(tarGzPath, "\" -C \"").concat(extractDir, "\""))];
                    case 5:
                        // Extract archive
                        _c.sent();
                        return [4 /*yield*/, fs.readdir(extractDir)];
                    case 6:
                        entries = _c.sent();
                        mmdbPath = null;
                        _i = 0, entries_1 = entries;
                        _c.label = 7;
                    case 7:
                        if (!(_i < entries_1.length)) return [3 /*break*/, 13];
                        entry = entries_1[_i];
                        entryPath = path.join(extractDir, entry);
                        return [4 /*yield*/, fs.stat(entryPath)];
                    case 8:
                        stat = _c.sent();
                        if (!stat.isDirectory()) return [3 /*break*/, 10];
                        return [4 /*yield*/, fs.readdir(entryPath)];
                    case 9:
                        inner = _c.sent();
                        for (_a = 0, inner_1 = inner; _a < inner_1.length; _a++) {
                            f = inner_1[_a];
                            if (f.endsWith('.mmdb') && f.includes(edition)) {
                                mmdbPath = path.join(entryPath, f);
                                break;
                            }
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        if (entry.endsWith('.mmdb') && entry.includes(edition)) {
                            mmdbPath = entryPath;
                        }
                        _c.label = 11;
                    case 11:
                        if (mmdbPath)
                            return [3 /*break*/, 13];
                        _c.label = 12;
                    case 12:
                        _i++;
                        return [3 /*break*/, 7];
                    case 13:
                        if (!mmdbPath) {
                            throw new Error("Could not find extracted .mmdb file for ".concat(edition));
                        }
                        // Move to final location
                        return [4 /*yield*/, fs.rename(mmdbPath, outputPath)];
                    case 14:
                        // Move to final location
                        _c.sent();
                        return [3 /*break*/, 19];
                    case 15:
                        _c.trys.push([15, 17, , 18]);
                        // Best-effort cleanup
                        return [4 /*yield*/, execAsync("rm -rf \"".concat(extractDir, "\"")).catch(function () { return undefined; })];
                    case 16:
                        // Best-effort cleanup
                        _c.sent();
                        return [3 /*break*/, 18];
                    case 17:
                        _b = _c.sent();
                        return [3 /*break*/, 18];
                    case 18: return [7 /*endfinally*/];
                    case 19: return [2 /*return*/];
                }
            });
        });
    };
    return GeoLocationService;
}());
exports.GeoLocationService = GeoLocationService;
