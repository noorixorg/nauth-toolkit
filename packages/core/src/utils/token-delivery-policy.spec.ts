/**
 * Token Delivery Policy Unit Tests
 *
 * Tests token delivery policy resolution.
 */

import { resolveDeliveryForRequest, HybridPolicy } from './token-delivery-policy';

describe('resolveDeliveryForRequest', () => {
  it('should return cookies by default when origin is unknown', () => {
    const req = {};
    const result = resolveDeliveryForRequest(req);
    expect(result).toBe('cookies');
  });

  it('should return cookies when origin is empty string', () => {
    const req = { headers: { origin: '' } };
    const result = resolveDeliveryForRequest(req);
    expect(result).toBe('cookies');
  });

  it('should return cookies when headers are missing', () => {
    const req = {};
    const result = resolveDeliveryForRequest(req);
    expect(result).toBe('cookies');
  });

  it('should return json for native origins', () => {
    const policy: HybridPolicy = {
      nativeOrigins: ['mobile://app', 'capacitor://localhost'],
    };
    const req = { headers: { origin: 'mobile://app' } };
    const result = resolveDeliveryForRequest(req, policy);
    expect(result).toBe('json');
  });

  it('should return cookies for web origins', () => {
    const policy: HybridPolicy = {
      webOrigins: ['https://example.com', 'https://app.example.com'],
    };
    const req = { headers: { origin: 'https://example.com' } };
    const result = resolveDeliveryForRequest(req, policy);
    expect(result).toBe('cookies');
  });

  it('should prioritize native origins over web origins', () => {
    const policy: HybridPolicy = {
      nativeOrigins: ['mobile://app'],
      webOrigins: ['https://example.com'],
    };
    const req = { headers: { origin: 'mobile://app' } };
    const result = resolveDeliveryForRequest(req, policy);
    expect(result).toBe('json');
  });

  it('should return cookies when origin not in policy lists', () => {
    const policy: HybridPolicy = {
      nativeOrigins: ['mobile://app'],
      webOrigins: ['https://example.com'],
    };
    const req = { headers: { origin: 'https://other.com' } };
    const result = resolveDeliveryForRequest(req, policy);
    expect(result).toBe('cookies');
  });

  it('should handle case-sensitive origin matching', () => {
    const policy: HybridPolicy = {
      nativeOrigins: ['mobile://app'],
    };
    const req = { headers: { origin: 'MOBILE://APP' } };
    const result = resolveDeliveryForRequest(req, policy);
    expect(result).toBe('cookies'); // Case-sensitive, so no match
  });
});
