import { AsyncLocalStorage } from 'async_hooks';

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
export class ContextStorage {
  private static als = new AsyncLocalStorage<Map<string, unknown>>();

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
  static run<T>(callback: () => T): T {
    const store = new Map<string, unknown>();
    return this.als.run(store, callback);
  }

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
  static set<T>(key: string, value: T): void {
    const store = this.als.getStore();
    if (!store) {
      throw new Error('Context not initialized. Call ContextStorage.run() first.');
    }
    store.set(key, value);
  }

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
  static get<T>(key: string): T | undefined {
    const store = this.als.getStore();
    return store?.get(key) as T | undefined;
  }

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
  static has(key: string): boolean {
    const store = this.als.getStore();
    return store?.has(key) || false;
  }

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
  static delete(key: string): boolean {
    const store = this.als.getStore();
    if (!store) {
      return false;
    }
    return store.delete(key);
  }

  /**
   * Clear all values from the current context
   *
   * @example
   * ```typescript
   * ContextStorage.clear();
   * ```
   */
  static clear(): void {
    const store = this.als.getStore();
    if (store) {
      store.clear();
    }
  }

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
  static keys(): string[] {
    const store = this.als.getStore();
    if (!store) {
      return [];
    }
    return Array.from(store.keys());
  }

  /**
   * Get the current store instance
   *
   * This is useful for frameworks like Fastify where hooks run independently
   * and you need to preserve the store across hook boundaries.
   *
   * @returns The current Map store or undefined
   * @internal
   */
  static getStore(): Map<string, unknown> | undefined {
    return this.als.getStore();
  }

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
  static enterStore<T>(store: Map<string, unknown>, callback: () => T): T {
    return this.als.run(store, callback);
  }
}
