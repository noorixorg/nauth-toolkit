/**
 * Angular HTTP Adapter Unit Tests
 */
import 'reflect-metadata';
import { of, throwError } from 'rxjs';
import { AngularHttpAdapter } from './http-adapter';
import { HttpRequest, NAuthClientError, NAuthErrorCode } from '@nauth-toolkit/client';
import { HttpErrorResponse } from '@angular/common/http';
// Import HttpHeaders directly from Angular (not from mock)
const { HttpHeaders } = require('@angular/common/http');

describe('AngularHttpAdapter', () => {
  let adapter: AngularHttpAdapter;
  let mockHttpClient: any;

  beforeEach(() => {
    mockHttpClient = {
      request: jest.fn(),
    };
    adapter = new AngularHttpAdapter(mockHttpClient);
  });

  describe('request', () => {
    it('should execute successful GET request', async () => {
      const headers = new HttpHeaders({ 'content-type': 'application/json' });
      const mockResponse = {
        status: 200,
        body: '{"data":"test"}',
        headers,
      };

      mockHttpClient.request.mockReturnValue(of(mockResponse));

      const config: HttpRequest = {
        method: 'GET',
        url: '/api/test',
        headers: {},
      };

      const result = await adapter.request(config);

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ data: 'test' });
      expect(mockHttpClient.request).toHaveBeenCalledWith('GET', '/api/test', {
        body: undefined,
        headers: {},
        withCredentials: false,
        observe: 'response',
        responseType: 'text',
      });
    });

    it('should execute POST request with body and credentials', async () => {
      const headers = new HttpHeaders({ 'content-type': 'application/json' });
      const mockResponse = {
        status: 201,
        body: '{"id":1}',
        headers,
      };

      mockHttpClient.request.mockReturnValue(of(mockResponse));

      const config: HttpRequest = {
        method: 'POST',
        url: '/api/create',
        body: { name: 'test' },
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      };

      const result = await adapter.request(config);

      expect(result.status).toBe(201);
      expect(result.data).toEqual({ id: 1 });
      expect(mockHttpClient.request).toHaveBeenCalledWith('POST', '/api/create', {
        body: { name: 'test' },
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        observe: 'response',
        responseType: 'text',
      });
    });

    it('should handle empty response body', async () => {
      const headers = new HttpHeaders();
      const mockResponse = {
        status: 204,
        body: '',
        headers,
      };

      mockHttpClient.request.mockReturnValue(of(mockResponse));

      const config: HttpRequest = {
        method: 'DELETE',
        url: '/api/delete',
        headers: {},
      };

      const result = await adapter.request(config);

      expect(result.status).toBe(204);
      expect(result.data).toBeNull();
    });

    it('should handle HTML response (non-JSON)', async () => {
      const headers = new HttpHeaders({ 'content-type': 'text/html' });
      const mockResponse = {
        status: 502,
        body: '<html><body>Error</body></html>',
        headers,
      };

      mockHttpClient.request.mockReturnValue(of(mockResponse));

      const config: HttpRequest = {
        method: 'GET',
        url: '/api/test',
        headers: {},
      };

      const result = await adapter.request(config);

      expect(result.status).toBe(502);
      expect(result.data).toBe('<html><body>Error</body></html>');
    });

    it('should convert HttpErrorResponse to NAuthClientError', async () => {
      const headers = new HttpHeaders({ 'content-type': 'application/json' });
      // HttpErrorResponse with responseType: 'text' stores error as a string
      const errorResponse = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        error: '{"code":"AUTH_TOKEN_INVALID","message":"Token expired"}',
        headers,
      });
      // Ensure error is a string and status is set
      Object.defineProperty(errorResponse, 'error', {
        value: '{"code":"AUTH_TOKEN_INVALID","message":"Token expired"}',
        writable: true,
      });
      Object.defineProperty(errorResponse, 'status', {
        value: 401,
        writable: true,
      });

      mockHttpClient.request.mockReturnValue(throwError(() => errorResponse));

      const config: HttpRequest = {
        method: 'GET',
        url: '/api/protected',
        headers: {},
      };

      await expect(adapter.request(config)).rejects.toThrow(NAuthClientError);

      try {
        await adapter.request(config);
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthClientError);
        expect((error as NAuthClientError).code).toBe(NAuthErrorCode.AUTH_TOKEN_INVALID);
        expect((error as NAuthClientError).message).toBe('Token expired');
        expect((error as NAuthClientError).statusCode).toBe(401);
      }
    });

    it('should handle network error (status 0)', async () => {
      const errorResponse = new HttpErrorResponse({
        status: 0,
        statusText: 'Unknown Error',
        error: null,
        headers: new HttpHeaders(),
      });

      mockHttpClient.request.mockReturnValue(throwError(() => errorResponse));

      const config: HttpRequest = {
        method: 'GET',
        url: '/api/test',
        headers: {},
      };

      await expect(adapter.request(config)).rejects.toThrow(NAuthClientError);

      try {
        await adapter.request(config);
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthClientError);
        expect((error as NAuthClientError).statusCode).toBe(0);
        expect((error as NAuthClientError).isNetworkError).toBe(true);
      }
    });

    it('should handle non-HTTP errors', async () => {
      const syntaxError = new SyntaxError('Unexpected token');
      mockHttpClient.request.mockReturnValue(throwError(() => syntaxError));

      const config: HttpRequest = {
        method: 'GET',
        url: '/api/test',
        headers: {},
      };

      await expect(adapter.request(config)).rejects.toThrow(NAuthClientError);

      try {
        await adapter.request(config);
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthClientError);
        expect((error as NAuthClientError).code).toBe(NAuthErrorCode.INTERNAL_ERROR);
        expect((error as NAuthClientError).message).toBe('Unexpected token');
        expect((error as NAuthClientError).isNetworkError).toBe(true);
      }
    });
  });

  describe('parseJsonBody', () => {
    it('should parse valid JSON', () => {
      const result = (adapter as any).parseJsonBody('{"key":"value"}', 'application/json');
      expect(result).toEqual({ key: 'value' });
    });

    it('should return null for empty body', () => {
      const result = (adapter as any).parseJsonBody('', null);
      expect(result).toBeNull();
    });

    it('should return raw text for HTML content', () => {
      const html = '<html><body>Error</body></html>';
      const result = (adapter as any).parseJsonBody(html, 'text/html');
      expect(result).toBe(html);
    });

    it('should parse JSON-like content without Content-Type', () => {
      const result = (adapter as any).parseJsonBody('{"data":123}', null);
      expect(result).toEqual({ data: 123 });
    });

    it('should return raw text for non-JSON content', () => {
      const text = 'plain text response';
      const result = (adapter as any).parseJsonBody(text, 'text/plain');
      expect(result).toBe(text);
    });
  });
});
