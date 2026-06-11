/**
 * Token Delivery Policy Unit Tests
 *
 * Tests token delivery policy resolution.
 */

import { resolveDeliveryForRequest, resolveRefreshExpiresIn, HybridPolicy } from './token-delivery-policy';

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

describe('resolveRefreshExpiresIn', () => {
  const hybridPolicyWithTTLs = {
    webOrigins: ['https://web.example.com'],
    nativeOrigins: ['mobile://app'],
    cookieRefreshExpiresIn: '7d',
    jsonRefreshExpiresIn: '90d',
  };

  it('should return undefined when tokenDelivery method is not hybrid', () => {
    const req = { attributes: {}, raw: { headers: { origin: 'https://web.example.com' } } };
    const config = {
      tokenDelivery: { method: 'cookies' as const, hybridPolicy: hybridPolicyWithTTLs },
    };
    expect(resolveRefreshExpiresIn(req, config)).toBeUndefined();
  });

  it('should return undefined when hybridPolicy is absent', () => {
    const req = { attributes: {}, raw: { headers: { origin: 'https://web.example.com' } } };
    const config = { tokenDelivery: { method: 'hybrid' as const } };
    expect(resolveRefreshExpiresIn(req, config)).toBeUndefined();
  });

  it('should prefer route override (Express/Fastify nauthTokenDelivery) over origin classification', () => {
    // Express/Fastify nauth.helpers.tokenDelivery('json') middleware sets
    // req.attributes.nauthTokenDelivery. Origin would otherwise classify as cookies.
    const req = {
      attributes: { nauthTokenDelivery: 'json' as const },
      raw: { headers: { origin: 'https://web.example.com' } },
    };
    const config = {
      tokenDelivery: { method: 'hybrid' as const, hybridPolicy: hybridPolicyWithTTLs },
    };
    expect(resolveRefreshExpiresIn(req, config)).toBe('90d');
  });

  it('should prefer route override (NestJS @TokenDelivery via nauthTokenDeliveryOverride) over origin classification', () => {
    // NestJS cookie-token interceptor stores the decorator value as
    // req.attributes.nauthTokenDeliveryOverride (alias).
    const req = {
      attributes: { nauthTokenDeliveryOverride: 'json' as const },
      raw: { headers: { origin: 'https://web.example.com' } },
    };
    const config = {
      tokenDelivery: { method: 'hybrid' as const, hybridPolicy: hybridPolicyWithTTLs },
    };
    expect(resolveRefreshExpiresIn(req, config)).toBe('90d');
  });

  it('should prefer @TokenDelivery cookies override even when no origin matches', () => {
    const req = {
      attributes: { nauthTokenDelivery: 'cookies' as const },
      raw: {},
    };
    const config = {
      tokenDelivery: { method: 'hybrid' as const, hybridPolicy: hybridPolicyWithTTLs },
    };
    expect(resolveRefreshExpiresIn(req, config)).toBe('7d');
  });

  it('should return cookieRefreshExpiresIn for a web origin when no decorator override is set', () => {
    const req = { attributes: {}, raw: { headers: { origin: 'https://web.example.com' } } };
    const config = {
      tokenDelivery: { method: 'hybrid' as const, hybridPolicy: hybridPolicyWithTTLs },
    };
    expect(resolveRefreshExpiresIn(req, config)).toBe('7d');
  });

  it('should return jsonRefreshExpiresIn for a native origin when no decorator override is set', () => {
    const req = { attributes: {}, raw: { headers: { origin: 'mobile://app' } } };
    const config = {
      tokenDelivery: { method: 'hybrid' as const, hybridPolicy: hybridPolicyWithTTLs },
    };
    expect(resolveRefreshExpiresIn(req, config)).toBe('90d');
  });

  it('should return undefined when the matching side has no override set', () => {
    const req = { attributes: {}, raw: { headers: { origin: 'mobile://app' } } };
    const config = {
      tokenDelivery: {
        method: 'hybrid' as const,
        hybridPolicy: {
          nativeOrigins: ['mobile://app'],
          cookieRefreshExpiresIn: '7d',
        },
      },
    };
    expect(resolveRefreshExpiresIn(req, config)).toBeUndefined();
  });

  it('should fall back to cookie (safe default) when origin is unknown and cookieRefreshExpiresIn is set', () => {
    const req = { attributes: {}, raw: { headers: { origin: 'https://unknown.example.com' } } };
    const config = {
      tokenDelivery: { method: 'hybrid' as const, hybridPolicy: hybridPolicyWithTTLs },
    };
    expect(resolveRefreshExpiresIn(req, config)).toBe('7d');
  });

  it('should accept numeric TTL values', () => {
    const req = { attributes: {}, raw: { headers: { origin: 'mobile://app' } } };
    const config = {
      tokenDelivery: {
        method: 'hybrid' as const,
        hybridPolicy: {
          nativeOrigins: ['mobile://app'],
          jsonRefreshExpiresIn: 7776000,
        },
      },
    };
    expect(resolveRefreshExpiresIn(req, config)).toBe(7776000);
  });

  it('should handle undefined request gracefully (programmatic/background calls)', () => {
    const config = {
      tokenDelivery: { method: 'hybrid' as const, hybridPolicy: hybridPolicyWithTTLs },
    };
    // No request → no attribute override, no origin → safe default (cookies)
    expect(resolveRefreshExpiresIn(undefined, config)).toBe('7d');
  });
});
