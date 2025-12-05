"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextStorage = void 0;
var async_hooks_1 = require("async_hooks");
/**
 * Context Storage - Platform-Agnostic Async Local Storage
 *
 * Provides request-scoped storage using Node.js AsyncLocalStorage.
 * Replaces nestjs-cls for platform-agnostic context management.
 *
 * **Features:**
 * - Request-scoped data storage
 * - Works across async boundaries
 * - No framework dependencies
 * - Type-safe storage and retrieval
 *
 * @example
 * ```typescript
 * // Store data in context
 * ContextStorage.run(() => {
 *   ContextStorage.set('userId', '123');
 *   ContextStorage.set('clientInfo', { ip: '1.2.3.4' });
 *
 *   // Access from any nested function
 *   const userId = ContextStorage.get<string>('userId');
 * });
 * ```
 */
var ContextStorage = /** @class */ (function () {
    function ContextStorage() {
    }
    /**
     * Run a callback within a new context
     *
     * Creates a new async local storage context for the callback.
     * All ContextStorage operations within the callback will use this context.
     *
     * @param callback - Function to execute with context
     * @returns Result of the callback
     *
     * @example
     * ```typescript
     * const result = ContextStorage.run(() => {
     *   ContextStorage.set('key', 'value');
     *   return processRequest();
     * });
     * ```
     */
    ContextStorage.run = function (callback) {
        var store = new Map();
        return this.als.run(store, callback);
    };
    /**
     * Store a value in the current context
     *
     * @param key - Storage key
     * @param value - Value to store
     * @throws Error if called outside of a context (ContextStorage.run not called)
     *
     * @example
     * ```typescript
     * ContextStorage.set('userId', '123');
     * ContextStorage.set('clientInfo', { ip: '1.2.3.4', userAgent: 'Mozilla...' });
     * ```
     */
    ContextStorage.set = function (key, value) {
        var store = this.als.getStore();
        if (!store) {
            throw new Error('Context not initialized. Call ContextStorage.run() first.');
        }
        store.set(key, value);
    };
    /**
     * Retrieve a value from the current context
     *
     * @param key - Storage key
     * @returns Stored value or undefined if not found
     *
     * @example
     * ```typescript
     * const userId = ContextStorage.get<string>('userId');
     * const clientInfo = ContextStorage.get<ClientInfo>('CLIENT_INFO');
     * ```
     */
    ContextStorage.get = function (key) {
        var store = this.als.getStore();
        return store === null || store === void 0 ? void 0 : store.get(key);
    };
    /**
     * Check if a key exists in the current context
     *
     * @param key - Storage key
     * @returns True if key exists, false otherwise
     *
     * @example
     * ```typescript
     * if (ContextStorage.has('userId')) {
     *   const userId = ContextStorage.get<string>('userId');
     * }
     * ```
     */
    ContextStorage.has = function (key) {
        var store = this.als.getStore();
        return (store === null || store === void 0 ? void 0 : store.has(key)) || false;
    };
    /**
     * Delete a value from the current context
     *
     * @param key - Storage key
     * @returns True if key was deleted, false if it didn't exist
     *
     * @example
     * ```typescript
     * ContextStorage.delete('temporaryData');
     * ```
     */
    ContextStorage.delete = function (key) {
        var store = this.als.getStore();
        if (!store) {
            return false;
        }
        return store.delete(key);
    };
    /**
     * Clear all values from the current context
     *
     * @example
     * ```typescript
     * ContextStorage.clear();
     * ```
     */
    ContextStorage.clear = function () {
        var store = this.als.getStore();
        if (store) {
            store.clear();
        }
    };
    /**
     * Get all keys in the current context
     *
     * @returns Array of storage keys
     *
     * @example
     * ```typescript
     * const keys = ContextStorage.keys();
     * console.log('Stored keys:', keys);
     * ```
     */
    ContextStorage.keys = function () {
        var store = this.als.getStore();
        if (!store) {
            return [];
        }
        return Array.from(store.keys());
    };
    /**
     * Get the current store instance
     *
     * This is useful for frameworks like Fastify where hooks run independently
     * and you need to preserve the store across hook boundaries.
     *
     * @returns The current Map store or undefined
     * @internal
     */
    ContextStorage.getStore = function () {
        return this.als.getStore();
    };
    /**
     * Enter an existing context store
     *
     * This allows re-entering a context that was created elsewhere,
     * useful for frameworks where handlers run in separate scopes.
     *
     * @param store - The store to enter
     * @param callback - Function to execute with the store
     * @returns Result of the callback
     * @internal
     */
    ContextStorage.enterStore = function (store, callback) {
        return this.als.run(store, callback);
    };
    ContextStorage.als = new async_hooks_1.AsyncLocalStorage();
    return ContextStorage;
}());
exports.ContextStorage = ContextStorage;
