"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCommonPasswords = loadCommonPasswords;
exports.isCommonPassword = isCommonPassword;
exports.getCommonPasswordCount = getCommonPasswordCount;
var fs = require("fs");
var path = require("path");
/**
 * Common Passwords Loader
 *
 * Loads a curated list of common passwords from bundled file at startup.
 * Platform-agnostic - works on Mac, Linux, Windows, Docker, serverless, etc.
 *
 * Security Features:
 * - One-time load on module initialization (memory cached)
 * - 10,000 most common passwords from SecLists
 * - O(1) lookup performance with Set
 * - Graceful fallback if file not found
 * - No runtime file I/O or network calls
 * - Silent by default (won't interfere with JSON logging)
 *
 * Memory footprint: ~200KB for 10K passwords in Set
 *
 * Environment Variables:
 * - NAUTH_DEBUG=true - Enable debug logging to stderr
 *
 * @example
 * ```typescript
 * const passwords = loadCommonPasswords();
 * if (passwords.has('password123')) {
 *   throw new Error('Password too common');
 * }
 * ```
 */
var COMMON_PASSWORDS = null;
/**
 * Internal logging helper
 *
 * Writes to stderr (not stdout) to avoid interfering with JSON logging.
 * Only logs if NAUTH_DEBUG environment variable is set.
 *
 * @param message - Message to log
 * @param isError - Whether this is an error/warning
 */
function debugLog(message, isError) {
    if (isError === void 0) { isError = false; }
    if (process.env.NAUTH_DEBUG === 'true') {
        var prefix = isError ? '[nauth-toolkit:WARN]' : '[nauth-toolkit:INFO]';
        process.stderr.write("".concat(prefix, " ").concat(message, "\n"));
    }
}
/**
 * Minimal fallback password list
 *
 * Used if the main password file cannot be loaded.
 * Contains only the most common passwords.
 */
var FALLBACK_PASSWORDS = [
    'password',
    'password123',
    '123456',
    '123456789',
    '12345678',
    '12345',
    'qwerty',
    'abc123',
    'password1',
    'admin',
    'letmein',
    'welcome',
    '123123',
    'monkey',
    '1234567',
    'password!',
    'qwerty123',
    '1q2w3e4r',
    'admin123',
    'root',
];
/**
 * Load common passwords from bundled file
 *
 * This function loads once on first call and caches the result.
 * Subsequent calls return the cached Set immediately.
 *
 * File location: packages/core/src/data/common-passwords-10000.txt
 * Format: One password per line, lowercase
 *
 * @returns Set of common passwords (lowercase)
 *
 * @example
 * ```typescript
 * // Load passwords (cached after first call)
 * const passwords = loadCommonPasswords();
 *
 * // Check if password is common
 * if (passwords.has('mypassword'.toLowerCase())) {
 *   console.log('Password is too common');
 * }
 * ```
 */
function loadCommonPasswords() {
    // Return cached version if already loaded
    if (COMMON_PASSWORDS) {
        return COMMON_PASSWORDS;
    }
    try {
        // Try to load from bundled file
        var filePath = path.join(__dirname, '../data/common-passwords-10000.txt');
        if (fs.existsSync(filePath)) {
            var content = fs.readFileSync(filePath, 'utf-8');
            COMMON_PASSWORDS = new Set(content
                .split('\n')
                .map(function (p) { return p.trim().toLowerCase(); })
                .filter(function (p) { return p.length > 0; }));
            debugLog("Loaded ".concat(COMMON_PASSWORDS.size, " common passwords from file"));
            return COMMON_PASSWORDS;
        }
        else {
            debugLog("Common passwords file not found at ".concat(filePath, ", using fallback list"), true);
        }
    }
    catch (error) {
        debugLog('Could not load common passwords file, using fallback list', true);
        if (error instanceof Error && process.env.NAUTH_DEBUG === 'true') {
            debugLog("Error details: ".concat(error.message), true);
        }
    }
    // Fallback to minimal list (silent by default)
    COMMON_PASSWORDS = new Set(FALLBACK_PASSWORDS.map(function (p) { return p.toLowerCase(); }));
    debugLog("Using fallback password list with ".concat(COMMON_PASSWORDS.size, " entries"), true);
    return COMMON_PASSWORDS;
}
/**
 * Check if a password is in the common password list
 *
 * Case-insensitive comparison.
 *
 * @param password - Password to check
 * @returns True if password is common, false otherwise
 *
 * @example
 * ```typescript
 * if (isCommonPassword('Password123')) {
 *   throw new Error('Password is too common');
 * }
 * ```
 */
function isCommonPassword(password) {
    var passwords = loadCommonPasswords();
    return passwords.has(password.toLowerCase());
}
/**
 * Get the size of the common password list
 *
 * @returns Number of passwords in the list
 */
function getCommonPasswordCount() {
    var passwords = loadCommonPasswords();
    return passwords.size;
}
// Load passwords on module import (cached for subsequent use)
loadCommonPasswords();
