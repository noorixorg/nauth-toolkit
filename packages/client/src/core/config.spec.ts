/**
 * Config Unit Tests
 *
 * Tests configuration resolution functionality.
 */

import { resolveConfig, defaultEndpoints, defaultAdminEndpoints } from './config';
import { NAuthClientConfig } from '../types/config.types';
import { InMemoryStorage } from '../storage/memory';
import { HttpAdapter } from './http-adapter';

describe('resolveConfig', () => {
  let mockAdapter: HttpAdapter;

  beforeEach(() => {
    mockAdapter = {
      request: jest.fn(),
    };
  });

  it('should resolve config with defaults', () => {
    const config: NAuthClientConfig = {
      baseUrl: 'https://api.example.com',
      storage: new InMemoryStorage(),
      tokenDelivery: 'cookies',
    };

    const resolved = resolveConfig(config, mockAdapter);

    expect(resolved.baseUrl).toBe('https://api.example.com');
    expect(resolved.endpoints).toEqual(defaultEndpoints);
    expect(resolved.tokenDelivery).toBe('cookies');
    expect(resolved.storage).toBeInstanceOf(InMemoryStorage);
    expect(resolved.httpAdapter).toBe(mockAdapter);
    expect(resolved.timeout).toBe(30000);
    expect(resolved.csrf.cookieName).toBe('nauth_csrf_token');
    expect(resolved.csrf.headerName).toBe('x-csrf-token');
    expect(resolved.deviceTrust.headerName).toBe('X-Device-Token');
    expect(resolved.deviceTrust.storageKey).toBe('nauth_device_token');
  });

  it('should merge custom endpoints with defaults', () => {
    const config: NAuthClientConfig = {
      baseUrl: 'https://api.example.com',
      storage: new InMemoryStorage(),
      tokenDelivery: 'cookies',
      endpoints: {
        login: '/custom/login',
      },
    };

    const resolved = resolveConfig(config, mockAdapter);

    expect(resolved.endpoints.login).toBe('/custom/login');
    expect(resolved.endpoints.signup).toBe(defaultEndpoints.signup);
  });

  it('should resolve admin config when provided', () => {
    const config: NAuthClientConfig = {
      baseUrl: 'https://api.example.com',
      storage: new InMemoryStorage(),
      tokenDelivery: 'cookies',
      admin: {
        pathPrefix: '/custom-admin',
      },
    };

    const resolved = resolveConfig(config, mockAdapter);

    expect(resolved.admin).toBeDefined();
    expect(resolved.admin?.pathPrefix).toBe('/custom-admin');
    expect(resolved.admin?.endpoints).toEqual(defaultAdminEndpoints);
  });

  it('should use custom CSRF config', () => {
    const config: NAuthClientConfig = {
      baseUrl: 'https://api.example.com',
      storage: new InMemoryStorage(),
      tokenDelivery: 'cookies',
      csrf: {
        cookieName: 'custom_csrf',
        headerName: 'x-custom-csrf',
      },
    };

    const resolved = resolveConfig(config, mockAdapter);

    expect(resolved.csrf.cookieName).toBe('custom_csrf');
    expect(resolved.csrf.headerName).toBe('x-custom-csrf');
  });

  it('should use custom device trust config', () => {
    const config: NAuthClientConfig = {
      baseUrl: 'https://api.example.com',
      storage: new InMemoryStorage(),
      tokenDelivery: 'cookies',
      deviceTrust: {
        headerName: 'X-Custom-Device',
        storageKey: 'custom_device_token',
      },
    };

    const resolved = resolveConfig(config, mockAdapter);

    expect(resolved.deviceTrust.headerName).toBe('X-Custom-Device');
    expect(resolved.deviceTrust.storageKey).toBe('custom_device_token');
  });

  it('should use custom timeout', () => {
    const config: NAuthClientConfig = {
      baseUrl: 'https://api.example.com',
      storage: new InMemoryStorage(),
      tokenDelivery: 'cookies',
      timeout: 60000,
    };

    const resolved = resolveConfig(config, mockAdapter);

    expect(resolved.timeout).toBe(60000);
  });

  it('should use custom token delivery mode', () => {
    const config: NAuthClientConfig = {
      baseUrl: 'https://api.example.com',
      storage: new InMemoryStorage(),
      tokenDelivery: 'json',
    };

    const resolved = resolveConfig(config, mockAdapter);

    expect(resolved.tokenDelivery).toBe('json');
  });
});
