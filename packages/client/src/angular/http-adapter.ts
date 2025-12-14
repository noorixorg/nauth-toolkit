import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { HttpAdapter, HttpRequest, HttpResponse } from '../core/http-adapter';
import { NAuthClientError } from '../core/errors';
import { NAuthErrorCode } from '../types/error.types';

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
@Injectable({ providedIn: 'root' })
export class AngularHttpAdapter implements HttpAdapter {
  private readonly http = inject(HttpClient);

  /**
   * Execute HTTP request using Angular's HttpClient.
   *
   * @param config - Request configuration
   * @returns Response with parsed data
   * @throws NAuthClientError if request fails
   */
  async request<T>(config: HttpRequest): Promise<HttpResponse<T>> {
    try {
      // Use Angular's HttpClient - goes through ALL interceptors
      const data = await firstValueFrom(
        this.http.request<T>(config.method, config.url, {
          body: config.body,
          headers: config.headers,
          withCredentials: config.credentials === 'include',
          observe: 'body', // Only return body data
        }),
      );

      return {
        data,
        status: 200, // HttpClient only returns data on success
        headers: {}, // Can extract from observe: 'response' if needed
      };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        // Convert Angular's HttpErrorResponse to NAuthClientError
        const errorData = error.error || {};
        const code =
          typeof errorData['code'] === 'string' ? (errorData.code as NAuthErrorCode) : NAuthErrorCode.INTERNAL_ERROR;
        const message =
          typeof errorData['message'] === 'string'
            ? (errorData.message as string)
            : error.message || `Request failed with status ${error.status}`;
        const timestamp = typeof errorData['timestamp'] === 'string' ? errorData.timestamp : undefined;
        const details = errorData['details'] as Record<string, unknown> | undefined;

        throw new NAuthClientError(code, message, {
          statusCode: error.status,
          timestamp,
          details,
          isNetworkError: error.status === 0, // Network error (no response from server)
        });
      }

      // Re-throw non-HTTP errors
      throw error;
    }
  }
}



