import { HttpAdapter, HttpRequest, HttpResponse } from '../core/http-adapter';
import { NAuthClientError } from '../core/errors';
import { NAuthErrorCode } from '../types/error.types';

/**
 * HTTP adapter using native fetch API.
 *
 * Suitable for:
 * - Vanilla JavaScript/TypeScript
 * - Node.js (with fetch polyfill or Node 18+)
 * - Environments without framework-specific HTTP clients
 *
 * @example
 * ```typescript
 * import { NAuthClient } from '@nauth-toolkit/client';
 * import { FetchAdapter } from '@nauth-toolkit/client/adapters/fetch';
 *
 * const client = new NAuthClient({
 *   baseUrl: 'https://api.example.com/auth',
 *   httpAdapter: new FetchAdapter(),
 * });
 * ```
 */
export class FetchAdapter implements HttpAdapter {
  /**
   * Execute HTTP request using native fetch.
   *
   * @param config - Request configuration
   * @returns Response with parsed data
   * @throws NAuthClientError if request fails
   */
  async request<T>(config: HttpRequest): Promise<HttpResponse<T>> {
    const fetchOptions: RequestInit = {
      method: config.method,
      headers: config.headers,
      signal: config.signal,
      credentials: config.credentials,
    };

    if (config.body !== undefined) {
      fetchOptions.body = JSON.stringify(config.body);
    }

    let response: Response;
    try {
      response = await fetch(config.url, fetchOptions);
    } catch (error) {
      throw new NAuthClientError(NAuthErrorCode.INTERNAL_ERROR, 'Network request failed', {
        isNetworkError: true,
        details: { url: config.url, message: (error as Error).message },
      });
    }

    const status = response.status;
    let data: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    // Extract headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    if (!response.ok) {
      const errorData = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
      const code =
        typeof errorData['code'] === 'string' ? (errorData.code as NAuthErrorCode) : NAuthErrorCode.INTERNAL_ERROR;
      const message =
        typeof errorData['message'] === 'string'
          ? (errorData.message as string)
          : `Request failed with status ${status}`;
      const timestamp = typeof errorData['timestamp'] === 'string' ? errorData.timestamp : undefined;
      const details = errorData['details'] as Record<string, unknown> | undefined;

      throw new NAuthClientError(code, message, {
        statusCode: status,
        timestamp,
        details,
      });
    }

    return { data: data as T, status, headers };
  }
}



