/**
 * Fetch Adapter Unit Tests
 */

import { FetchAdapter } from './fetch-adapter';
import { NAuthClientError } from '../core/errors';
import { NAuthErrorCode } from '../types/error.types';

global.fetch = jest.fn();

describe('FetchAdapter', () => {
  let adapter: FetchAdapter;

  beforeEach(() => {
    adapter = new FetchAdapter();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('request', () => {
    it('should execute GET request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{"data":"test"}'),
        headers: new Headers(),
      });

      const result = await adapter.request({
        method: 'GET',
        url: 'https://api.example.com/test',
      });

      expect(result.data).toEqual({ data: 'test' });
      expect(result.status).toBe(200);
    });

    it('should execute POST request with body', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
        headers: new Headers(),
      });

      await adapter.request({
        method: 'POST',
        url: 'https://api.example.com/test',
        body: { key: 'value' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ key: 'value' }),
        }),
      );
    });

    it('should throw NAuthClientError on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        adapter.request({
          method: 'GET',
          url: 'https://api.example.com/test',
        }),
      ).rejects.toThrow(NAuthClientError);

      await expect(
        adapter.request({
          method: 'GET',
          url: 'https://api.example.com/test',
        }),
      ).rejects.toMatchObject({
        code: NAuthErrorCode.INTERNAL_ERROR,
        isNetworkError: true,
      });
    });

    it('should throw NAuthClientError on HTTP error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            code: NAuthErrorCode.VALIDATION_FAILED,
            message: 'Validation failed',
          }),
        ),
        headers: new Headers(),
      });

      await expect(
        adapter.request({
          method: 'POST',
          url: 'https://api.example.com/test',
          body: {},
        }),
      ).rejects.toThrow(NAuthClientError);

      await expect(
        adapter.request({
          method: 'POST',
          url: 'https://api.example.com/test',
          body: {},
        }),
      ).rejects.toMatchObject({
        code: NAuthErrorCode.VALIDATION_FAILED,
        statusCode: 400,
      });
    });

    it('should handle non-JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('plain text'),
        headers: new Headers(),
      });

      const result = await adapter.request({
        method: 'GET',
        url: 'https://api.example.com/test',
      });

      expect(result.data).toBe('plain text');
    });

    it('should extract response headers', async () => {
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('X-Custom', 'value');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
        headers,
      });

      const result = await adapter.request({
        method: 'GET',
        url: 'https://api.example.com/test',
      });

      expect(result.headers['content-type'] ?? result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['x-custom'] ?? result.headers['X-Custom']).toBe('value');
    });
  });
});
