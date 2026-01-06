import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { HttpAdapter, HttpRequest, HttpResponse, NAuthClientError, NAuthErrorCode } from '@nauth-toolkit/client';

/**
 * HTTP adapter for Angular using HttpClient.
 *
 * This adapter:
 * - Uses Angular's HttpClient for all requests
 * - Works with Angular's HTTP interceptors (including authInterceptor)
 * - Auto-provided via Angular DI (providedIn: 'root')
 * - Converts HttpClient responses to HttpResponse format
 * - Converts HttpErrorResponse to NAuthClientError
 *
 * Users don't need to configure this manually - it's automatically
 * injected when using AuthService in Angular apps.
 *
 * @example
 * ```typescript
 * // Automatic usage (no manual setup needed)
 * // AuthService automatically injects AngularHttpAdapter
 * constructor(private auth: AuthService) {}
 * ```
 */
@Injectable()
export class AngularHttpAdapter implements HttpAdapter {
  constructor(private readonly http: HttpClient) {}

  /**
   * Safely parse a JSON response body.
   *
   * Angular's fetch backend (`withFetch()`) will throw a raw `SyntaxError` if
   * `responseType: 'json'` is used and the backend returns HTML (common for
   * proxies, 502 pages, SSR fallbacks, or misrouted requests).
   *
   * To avoid crashing consumer apps, we always request as text and then parse
   * JSON only when the response actually looks like JSON.
   *
   * @param bodyText - Raw response body as text
   * @param contentType - Content-Type header value (if available)
   * @returns Parsed JSON value (unknown)
   * @throws {SyntaxError} When body is non-empty but not valid JSON
   */
  private parseJsonBody(bodyText: string, contentType: string | null): unknown {
    const trimmed = bodyText.trim();
    if (!trimmed) return null;

    // If it's clearly HTML, never attempt JSON.parse (some proxies mislabel Content-Type).
    if (trimmed.startsWith('<')) {
      return bodyText;
    }

    const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
    const isJsonContentType = typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');

    if (!looksLikeJson && !isJsonContentType) {
      // Return raw text when it doesn't look like JSON (e.g., HTML error pages).
      return bodyText;
    }

    return JSON.parse(trimmed) as unknown;
  }

  /**
   * Execute HTTP request using Angular's HttpClient.
   *
   * @param config - Request configuration
   * @returns Response with parsed data
   * @throws NAuthClientError if request fails
   */
  async request<T>(config: HttpRequest): Promise<HttpResponse<T>> {
    try {
      // Use Angular's HttpClient - goes through ALL interceptors.
      // IMPORTANT: Use responseType 'text' to avoid raw JSON.parse crashes when
      // the backend returns HTML (seen in some proxy/SSR/misroute setups).
      const res = await firstValueFrom(
        this.http.request(config.method, config.url, {
          body: config.body,
          headers: config.headers,
          withCredentials: config.credentials === 'include',
          observe: 'response',
          responseType: 'text',
        }),
      );

      const contentType = res.headers?.get('content-type');
      const parsed = this.parseJsonBody(res.body ?? '', contentType);

      return {
        data: parsed as T,
        status: res.status,
        headers: {}, // Reserved for future header passthrough if needed
      };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        // Convert Angular's HttpErrorResponse to NAuthClientError.
        // When using responseType 'text', `error.error` is typically a string.
        const contentType = error.headers?.get('content-type') ?? null;
        const rawBody = typeof error.error === 'string' ? error.error : '';
        const parsedError = this.parseJsonBody(rawBody, contentType);

        const errorData =
          typeof parsedError === 'object' && parsedError !== null ? (parsedError as Record<string, unknown>) : {};
        const code =
          typeof errorData['code'] === 'string' ? (errorData['code'] as NAuthErrorCode) : NAuthErrorCode.INTERNAL_ERROR;
        const message =
          typeof errorData['message'] === 'string'
            ? (errorData['message'] as string)
            : typeof parsedError === 'string' && parsedError.trim()
              ? parsedError
              : error.message || `Request failed with status ${error.status}`;
        const timestamp = typeof errorData['timestamp'] === 'string' ? (errorData['timestamp'] as string) : undefined;
        const details =
          typeof errorData['details'] === 'object' ? (errorData['details'] as Record<string, unknown>) : undefined;

        throw new NAuthClientError(code, message, {
          statusCode: error.status,
          timestamp,
          details,
          isNetworkError: error.status === 0, // Network error (no response from server)
        });
      }

      // Re-throw non-HTTP errors as an SDK error so consumers don't see raw parser crashes.
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new NAuthClientError(NAuthErrorCode.INTERNAL_ERROR, message, {
        statusCode: 0,
        isNetworkError: true,
      });
    }
  }
}
