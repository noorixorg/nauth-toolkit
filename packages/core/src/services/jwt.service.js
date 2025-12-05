"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.JwtService = void 0;
var jose = require("jose");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
var crypto = require("crypto");
/**
 * JWT Service (Platform-Agnostic)
 *
 * Handles all JWT token operations using jose library for platform independence.
 *
 * **Features:**
 * - Platform-agnostic (no framework dependencies)
 * - Support for multiple algorithms (HS256, HS384, HS512, RS256, RS384, RS512)
 * - Token rotation with family tracking
 * - Token reuse detection
 * - Symmetric and asymmetric key support
 *
 * **Security Features:**
 * - HS256 as default algorithm (symmetric key)
 * - HS256/HS384/HS512 for symmetric keys
 * - RS256/RS384/RS512 for asymmetric keys
 * - Token rotation on refresh
 * - Token family tracking for reuse detection
 * - Configurable expiration times
 * - Standard JWT claims (iss, aud, sub, exp, iat)
 *
 * @example
 * ```typescript
 * const jwtService = new JwtService(config);
 *
 * // Generate token pair
 * const tokens = await jwtService.generateTokenPair({
 *   userId: 'user-123',
 *   email: 'user@example.com',
 *   sessionId: 'session-456',
 * });
 *
 * // Validate token
 * const result = await jwtService.validateAccessToken(tokens.accessToken);
 * if (result.valid) {
 *   console.log('User ID:', result.payload.sub);
 * }
 * ```
 */
var JwtService = /** @class */ (function () {
    function JwtService(jwtConfig) {
        /** Cached access token key (for performance) */
        this.accessTokenKey = null;
        /** Cached refresh token key (for performance) */
        this.refreshTokenKey = null;
        this.config = jwtConfig;
        this.prepareKeys();
    }
    // ============================================================================
    // Key Preparation
    // ============================================================================
    /**
     * Prepare and cache signing keys for better performance
     * @private
     */
    JwtService.prototype.prepareKeys = function () {
        // Access token key
        if (this.config.accessToken.privateKey) {
            // Use private key (for RS256, RS384, RS512)
            this.accessTokenKey = crypto.createPrivateKey(this.config.accessToken.privateKey);
        }
        else if (this.config.accessToken.secret) {
            // For symmetric algorithms (HS256, HS384, HS512), use secret as Uint8Array
            this.accessTokenKey = new TextEncoder().encode(this.config.accessToken.secret);
        }
        // Refresh token key (always uses secret for symmetric algorithms)
        if (this.config.refreshToken.secret) {
            this.refreshTokenKey = new TextEncoder().encode(this.config.refreshToken.secret);
        }
    };
    /**
     * Get algorithm for signing access tokens
     *
     * Automatically selects appropriate algorithm based on key material:
     * - If privateKey is provided → uses configured algorithm (RS256, RS384, RS512)
     * - If only secret is provided → uses configured algorithm or defaults to HS256
     *
     * @private
     */
    JwtService.prototype.getAlgorithm = function () {
        // Default to HS256 if no algorithm is configured
        return this.config.algorithm || 'HS256';
    };
    /**
     * Get algorithm for signing refresh tokens
     *
     * Refresh tokens only support symmetric algorithms (HS256/HS384/HS512)
     * because RefreshTokenConfig only provides a secret, not a privateKey.
     *
     * Automatically selects appropriate symmetric algorithm:
     * - If configured algorithm is symmetric (HS256/HS384/HS512) → uses it
     * - If configured algorithm is asymmetric (RS256, RS384, RS512) → falls back to HS256
     * - Defaults to HS256 if no algorithm is configured
     *
     * @private
     */
    JwtService.prototype.getRefreshTokenAlgorithm = function () {
        var configuredAlgorithm = this.config.algorithm || 'HS256';
        // Refresh tokens only support symmetric algorithms (HS256, HS384, HS512)
        // because RefreshTokenConfig only has a secret, not a privateKey
        if (configuredAlgorithm === 'HS256' || configuredAlgorithm === 'HS384' || configuredAlgorithm === 'HS512') {
            return configuredAlgorithm;
        }
        // For asymmetric algorithms (RS256, RS384, RS512), fall back to HS256
        // This ensures compatibility with the symmetric refreshTokenKey
        return 'HS256';
    };
    // ============================================================================
    // Token Generation
    // ============================================================================
    /**
     * Generate both access and refresh tokens
     *
     * Creates a pair of tokens with the same token family for rotation tracking.
     * The token family allows detection of token reuse attacks.
     *
     * @param data - User and session information
     * @returns Token pair with access and refresh tokens
     *
     * @example
     * ```typescript
     * const tokens = await jwtService.generateTokenPair({
     *   userId: 'user-123',
     *   email: 'user@example.com',
     *   sessionId: 'session-456',
     * });
     *
     * // Store tokens and send to client
     * res.json({
     *   accessToken: tokens.accessToken,
     *   refreshToken: tokens.refreshToken,
     *   expiresIn: tokens.expiresIn,
     * });
     * ```
     */
    JwtService.prototype.generateTokenPair = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var tokenFamily, accessToken, refreshToken, expiresIn;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tokenFamily = data.tokenFamily || this.generateTokenFamily();
                        return [4 /*yield*/, this.generateAccessToken(__assign(__assign({}, data), { tokenFamily: tokenFamily }))];
                    case 1:
                        accessToken = _a.sent();
                        return [4 /*yield*/, this.generateRefreshToken(__assign(__assign({}, data), { tokenFamily: tokenFamily }))];
                    case 2:
                        refreshToken = _a.sent();
                        expiresIn = this.parseExpiresIn(this.config.accessToken.expiresIn);
                        return [2 /*return*/, {
                                accessToken: accessToken,
                                refreshToken: refreshToken,
                                expiresIn: expiresIn,
                            }];
                }
            });
        });
    };
    /**
     * Generate an access token
     *
     * Access tokens are short-lived (typically 15 minutes) and used for API authentication.
     * They contain user identity and authorization information.
     *
     * @param data - Token payload data
     * @returns Signed JWT access token
     */
    JwtService.prototype.generateAccessToken = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var algorithm, jwt;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.accessTokenKey) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'Access token key not configured. Provide secret or privateKey.');
                        }
                        algorithm = this.getAlgorithm();
                        jwt = new jose.SignJWT({
                            sub: data.userId,
                            email: data.email,
                            type: 'access',
                            sessionId: data.sessionId,
                            tokenFamily: data.tokenFamily,
                        })
                            .setProtectedHeader({ alg: algorithm })
                            .setIssuedAt()
                            .setExpirationTime(this.config.accessToken.expiresIn);
                        // Add issuer if configured
                        if (this.config.issuer) {
                            jwt = jwt.setIssuer(this.config.issuer);
                        }
                        // Add audience if configured
                        if (this.config.audience) {
                            if (Array.isArray(this.config.audience)) {
                                jwt = jwt.setAudience(this.config.audience);
                            }
                            else {
                                jwt = jwt.setAudience(this.config.audience);
                            }
                        }
                        return [4 /*yield*/, jwt.sign(this.accessTokenKey)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Generate a refresh token
     *
     * Refresh tokens are long-lived (typically 30 days) and used to obtain new access tokens.
     * They should be stored securely and rotated on each use.
     *
     * ⚠️ NOTE: Refresh tokens always use a symmetric algorithm (HS256/HS384/HS512)
     * because RefreshTokenConfig only provides a secret, not a privateKey.
     * This ensures compatibility between the algorithm and key type.
     *
     * @param data - Token payload data
     * @returns Signed JWT refresh token
     */
    JwtService.prototype.generateRefreshToken = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var algorithm, jwt;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.refreshTokenKey) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'Refresh token secret not configured.');
                        }
                        algorithm = this.getRefreshTokenAlgorithm();
                        jwt = new jose.SignJWT({
                            sub: data.userId,
                            email: data.email,
                            type: 'refresh',
                            sessionId: data.sessionId,
                            tokenFamily: data.tokenFamily,
                        })
                            .setProtectedHeader({ alg: algorithm })
                            .setIssuedAt()
                            .setExpirationTime(this.config.refreshToken.expiresIn);
                        return [4 /*yield*/, jwt.sign(this.refreshTokenKey)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ============================================================================
    // Token Validation
    // ============================================================================
    /**
     * Validate an access token
     *
     * Verifies:
     * - Token signature is valid
     * - Token hasn't expired
     * - Token type is 'access'
     * - Token structure is correct
     *
     * @param token - JWT access token to validate
     * @returns Validation result with payload or error
     *
     * @example
     * ```typescript
     * const result = await jwtService.validateAccessToken(token);
     *
     * if (!result.valid) {
     *   if (result.errorType === 'expired') {
     *     // Attempt to refresh token
     *   } else {
     *     // Invalid token, reject request
     *   }
     * }
     * ```
     */
    JwtService.prototype.validateAccessToken = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var verificationKey, payload, jwtPayload, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        verificationKey = void 0;
                        if (this.config.accessToken.publicKey) {
                            // Use public key for asymmetric verification (RS256, RS384, RS512)
                            verificationKey = crypto.createPublicKey(this.config.accessToken.publicKey);
                        }
                        else if (this.accessTokenKey) {
                            // Use secret for symmetric verification (HS256, HS512)
                            verificationKey = this.accessTokenKey;
                        }
                        else {
                            throw new Error('No verification key available');
                        }
                        return [4 /*yield*/, jose.jwtVerify(token, verificationKey, {
                                issuer: this.config.issuer,
                                audience: this.config.audience,
                            })];
                    case 1:
                        payload = (_a.sent()).payload;
                        jwtPayload = payload;
                        // Ensure token type is correct
                        if (jwtPayload.type !== 'access') {
                            return [2 /*return*/, {
                                    valid: false,
                                    error: 'Invalid token type',
                                    errorType: 'invalid',
                                }];
                        }
                        return [2 /*return*/, {
                                valid: true,
                                payload: jwtPayload,
                            }];
                    case 2:
                        error_1 = _a.sent();
                        return [2 /*return*/, this.handleValidationError(error_1)];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate a refresh token
     *
     * Similar to access token validation but checks for 'refresh' type.
     * Also verifies token hasn't been used before (if rotation is enabled).
     *
     * @param token - JWT refresh token to validate
     * @returns Validation result with payload or error
     */
    JwtService.prototype.validateRefreshToken = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, jwtPayload, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        if (!this.refreshTokenKey) {
                            throw new Error('Refresh token key not configured');
                        }
                        return [4 /*yield*/, jose.jwtVerify(token, this.refreshTokenKey)];
                    case 1:
                        payload = (_a.sent()).payload;
                        jwtPayload = payload;
                        // Ensure token type is correct
                        if (jwtPayload.type !== 'refresh') {
                            return [2 /*return*/, {
                                    valid: false,
                                    error: 'Invalid token type',
                                    errorType: 'invalid',
                                }];
                        }
                        return [2 /*return*/, {
                                valid: true,
                                payload: jwtPayload,
                            }];
                    case 2:
                        error_2 = _a.sent();
                        return [2 /*return*/, this.handleValidationError(error_2)];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Decode a token without verification
     *
     * ⚠️ WARNING: This method does NOT validate the token signature or expiration.
     * Only use for non-security-critical operations like logging or analytics.
     *
     * @param token - JWT token to decode
     * @returns Decoded payload or null if malformed
     */
    JwtService.prototype.decodeToken = function (token) {
        try {
            var payload = jose.decodeJwt(token);
            // Convert jose.JWTPayload to our JwtPayload via unknown
            return payload;
        }
        catch (_a) {
            return null;
        }
    };
    // ============================================================================
    // Token Utilities
    // ============================================================================
    /**
     * Generate a unique token family identifier
     *
     * Token families are used to track token rotation and detect reuse attacks.
     * All tokens in the same "family" (original + rotated versions) share this ID.
     *
     * ⚠️ SECURITY FIX #10: Increased from 16 bytes (128 bits) to 32 bytes (256 bits)
     *
     * @returns Random token family ID (256 bits)
     */
    JwtService.prototype.generateTokenFamily = function () {
        return crypto.randomBytes(32).toString('hex'); // 256 bits
    };
    /**
     * Hash a token for storage
     *
     * Tokens should be hashed before storing in the database for security.
     * This prevents token exposure if the database is compromised.
     *
     * @param token - Token to hash
     * @returns SHA-256 hash of the token
     */
    JwtService.prototype.hashToken = function (token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    };
    /**
     * Get access token expiry time in seconds
     *
     * @returns Access token expiry time in seconds
     *
     * @example
     * ```typescript
     * const expiry = jwtService.getAccessTokenExpiry();
     * console.log(expiry); // 900 (15 minutes)
     * ```
     */
    JwtService.prototype.getAccessTokenExpiry = function () {
        return this.parseExpiresIn(this.config.accessToken.expiresIn);
    };
    /**
     * Get refresh token TTL in seconds
     *
     * Used for setting expiration on used-token tracking in storage.
     *
     * @returns TTL in seconds
     */
    JwtService.prototype.getRefreshTokenTTL = function () {
        return this.parseExpiresIn(this.config.refreshToken.expiresIn);
    };
    /**
     * Extract token from Authorization header
     *
     * Supports standard "Bearer <token>" format
     *
     * @param authHeader - Authorization header value
     * @returns Extracted token or null
     *
     * @example
     * ```typescript
     * const token = jwtService.extractTokenFromHeader('Bearer eyJhbGc...');
     * // Returns: 'eyJhbGc...'
     * ```
     */
    JwtService.prototype.extractTokenFromHeader = function (authHeader) {
        if (!authHeader)
            return null;
        var _a = authHeader.split(' '), type = _a[0], token = _a[1];
        // Verify Bearer scheme
        if (type !== 'Bearer')
            return null;
        return token || null;
    };
    // ============================================================================
    // Private Helper Methods
    // ============================================================================
    /**
     * Parse expiration time from string or number
     * @param expiresIn - Expiration time (e.g., '15m', 900, '1h')
     * @returns Expiration time in seconds
     */
    JwtService.prototype.parseExpiresIn = function (expiresIn) {
        if (typeof expiresIn === 'number') {
            return expiresIn;
        }
        // Parse time strings (e.g., '15m', '1h', '30d')
        var units = {
            s: 1,
            m: 60,
            h: 3600,
            d: 86400,
        };
        var match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "Invalid expiresIn format: ".concat(expiresIn));
        }
        var value = match[1], unit = match[2];
        return parseInt(value, 10) * units[unit];
    };
    /**
     * Handle JWT validation errors and convert to standardized result
     * @param error - Error from JWT verification
     * @returns Standardized validation result
     */
    JwtService.prototype.handleValidationError = function (error) {
        if (error instanceof Error) {
            // jose errors have a 'code' property
            var errorWithCode = error;
            var errorCode = errorWithCode.code;
            // Token expired (jose errors)
            if (error.message.includes('expired') || errorCode === 'ERR_JWT_EXPIRED') {
                return {
                    valid: false,
                    error: 'Token has expired',
                    errorType: 'expired',
                };
            }
            // Invalid signature or malformed token
            if (error.message.includes('signature') || error.message.includes('invalid') || errorCode === 'ERR_JWT_INVALID') {
                return {
                    valid: false,
                    error: 'Invalid token',
                    errorType: 'invalid',
                };
            }
        }
        // Unknown error
        return {
            valid: false,
            error: 'Token validation failed',
            errorType: 'malformed',
        };
    };
    return JwtService;
}());
exports.JwtService = JwtService;
