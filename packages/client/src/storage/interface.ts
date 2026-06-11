/**
 * Storage adapter interface used by the client SDK.
 */
export interface NAuthStorageAdapter {
  /**
   * Retrieve a value by key.
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Persist a value.
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * Remove a stored value.
   */
  removeItem(key: string): Promise<void>;

  /**
   * Clear all stored values.
   */
  clear(): Promise<void>;
}
