/**
 * HTTP request configuration.
 *
 * Platform-agnostic request format that can be implemented by any HTTP client.
 */
export interface HttpRequest {
  /**
   * HTTP method
   */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /**
   * Full URL (already resolved with baseUrl)
   */
  url: string;

  /**
   * Request headers
   */
  headers?: Record<string, string>;

  /**
   * Request body (will be JSON stringified by adapter)
   */
  body?: unknown;

  /**
   * Credentials mode for cookies
   * - 'include': Send cookies (for cookies mode)
   * - 'omit': Don't send cookies (for JSON mode)
   */
  credentials?: 'include' | 'omit' | 'same-origin';

  /**
   * Abort signal for request cancellation
   */
  signal?: AbortSignal;
}

/**
 * HTTP response returned by adapter.
 */
export interface HttpResponse<T> {
  /**
   * Response data (already parsed)
   */
  data: T;

  /**
   * HTTP status code
   */
  status: number;

  /**
   * Response headers
   */
  headers: Record<string, string>;
}

/**
 * Platform-agnostic HTTP adapter interface.
 *
 * Implementations:
 * - FetchAdapter: For vanilla JS, Node.js (uses native fetch)
 * - AngularHttpAdapter: For Angular (uses HttpClient)
 * - AxiosAdapter: For React/Vue (uses Axios)
 *
 * @example
 * ```typescript
 * class MyAdapter implements HttpAdapter {
 *   async request<T>(config: HttpRequest): Promise<HttpResponse<T>> {
 *     // Use any HTTP client
 *     const response = await myHttpClient.request(config);
 *     return { data: response.data, status: response.status, headers: {} };
 *   }
 * }
 * ```
 */
export interface HttpAdapter {
  /**
   * Execute an HTTP request.
   *
   * @param config - Request configuration
   * @returns Response with data, status, and headers
   * @throws Error if request fails (adapter should throw descriptive errors)
   */
  request<T>(config: HttpRequest): Promise<HttpResponse<T>>;
}
