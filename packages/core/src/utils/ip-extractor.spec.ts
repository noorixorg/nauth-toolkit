/**
 * Tests for IP Address Extractor
 */

import { extractClientIp, isPrivateIp, getIpGeolocation } from './ip-extractor';

describe('extractClientIp', () => {
  describe('X-Forwarded-For header', () => {
    it('should extract leftmost IP from X-Forwarded-For header', () => {
      const req = {
        headers: {
          'x-forwarded-for': '203.0.113.1, 70.41.3.18, 150.172.238.178',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });

    it('should handle single IP in X-Forwarded-For', () => {
      const req = {
        headers: {
          'x-forwarded-for': '203.0.113.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });

    it('should trim whitespace from IPs', () => {
      const req = {
        headers: {
          'x-forwarded-for': '  203.0.113.1  ,  70.41.3.18  ',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });
  });

  describe('Cloudflare headers', () => {
    it('should use CF-Connecting-IP when X-Forwarded-For is not present', () => {
      const req = {
        headers: {
          'cf-connecting-ip': '203.0.113.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });

    it('should prefer X-Forwarded-For over CF-Connecting-IP (standard priority)', () => {
      const req = {
        headers: {
          'cf-connecting-ip': '203.0.113.1',
          'x-forwarded-for': '10.0.0.1',
        },
      };

      const result = extractClientIp(req);
      // X-Forwarded-For has highest priority by design
      expect(result).toBe('10.0.0.1');
    });
  });

  describe('Nginx X-Real-IP header', () => {
    it('should use X-Real-IP header when present', () => {
      const req = {
        headers: {
          'x-real-ip': '203.0.113.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });
  });

  describe('Apache X-Client-IP header', () => {
    it('should use X-Client-IP header when present', () => {
      const req = {
        headers: {
          'x-client-ip': '203.0.113.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });
  });

  describe('Priority order', () => {
    it('should prefer X-Forwarded-For over other headers', () => {
      const req = {
        headers: {
          'x-forwarded-for': '203.0.113.1',
          'cf-connecting-ip': '192.168.1.1',
          'x-real-ip': '10.0.0.1',
          'x-client-ip': '172.16.0.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });

    it('should fallback to CF-Connecting-IP if X-Forwarded-For is missing', () => {
      const req = {
        headers: {
          'cf-connecting-ip': '203.0.113.1',
          'x-real-ip': '10.0.0.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });
  });

  describe('IPv6 handling', () => {
    it('should convert ::1 to 127.0.0.1', () => {
      const req = {
        ip: '::1',
      };

      const result = extractClientIp(req);
      expect(result).toBe('127.0.0.1');
    });

    it('should convert ::ffff:127.0.0.1 to 127.0.0.1', () => {
      const req = {
        ip: '::ffff:127.0.0.1',
      };

      const result = extractClientIp(req);
      expect(result).toBe('127.0.0.1');
    });

    it('should strip ::ffff: prefix from IPv4-mapped IPv6 addresses', () => {
      const req = {
        ip: '::ffff:203.0.113.1',
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });

    it('should handle pure IPv6 addresses', () => {
      const req = {
        headers: {
          'x-forwarded-for': '2001:db8::1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('2001:db8::1');
    });
  });

  describe('Fallback to req.ip', () => {
    it('should use req.ip when no headers are present', () => {
      const req = {
        ip: '203.0.113.1',
        headers: {},
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });

    it('should use req.socket.remoteAddress as final fallback', () => {
      const req = {
        headers: {},
        socket: {
          remoteAddress: '203.0.113.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });

    it('should return 0.0.0.0 when all sources are missing', () => {
      const req = {
        headers: {},
      };

      const result = extractClientIp(req);
      expect(result).toBe('0.0.0.0');
    });
  });

  describe('Invalid IP handling', () => {
    it('should skip invalid IPv4 addresses', () => {
      const req = {
        headers: {
          'x-forwarded-for': '999.999.999.999, 203.0.113.1',
        },
      };

      const result = extractClientIp(req);
      // Should skip invalid and use fallback
      expect(result).not.toBe('999.999.999.999');
    });

    it('should validate IPv4 octet ranges', () => {
      const req = {
        headers: {
          'x-forwarded-for': '256.1.1.1',
        },
        ip: '203.0.113.1',
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1'); // Falls back to req.ip
    });
  });

  describe('Private IP filtering', () => {
    it('should skip private IPs when filterPrivateIps is true', () => {
      const req = {
        headers: {
          'x-forwarded-for': '10.0.0.1, 203.0.113.1',
        },
      };

      const result = extractClientIp(req, { filterPrivateIps: true });
      // Should skip 10.0.0.1 and use fallback or next IP
      expect(result).not.toBe('10.0.0.1');
    });

    it('should allow private IPs when filterPrivateIps is false', () => {
      const req = {
        headers: {
          'x-forwarded-for': '10.0.0.1',
        },
      };

      const result = extractClientIp(req, { filterPrivateIps: false });
      expect(result).toBe('10.0.0.1');
    });

    it('should detect 192.168.x.x as private', () => {
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
        ip: '203.0.113.1',
      };

      const result = extractClientIp(req, { filterPrivateIps: true });
      expect(result).toBe('203.0.113.1'); // Falls back to public IP
    });

    it('should detect 172.16-31.x.x as private', () => {
      const req = {
        headers: {
          'x-forwarded-for': '172.16.0.1',
        },
        ip: '203.0.113.1',
      };

      const result = extractClientIp(req, { filterPrivateIps: true });
      expect(result).toBe('203.0.113.1');
    });
  });

  describe('Case insensitive headers', () => {
    it('should handle uppercase header names', () => {
      const req = {
        headers: {
          'X-FORWARDED-FOR': '203.0.113.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });

    it('should handle PascalCase header names', () => {
      const req = {
        headers: {
          'X-Forwarded-For': '203.0.113.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });
  });

  describe('Production scenarios', () => {
    it('should handle AWS ALB X-Forwarded-For format', () => {
      const req = {
        headers: {
          'x-forwarded-for': '203.0.113.1, 172.31.1.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1'); // Real client IP
    });

    it('should handle Nginx proxy chain', () => {
      const req = {
        headers: {
          'x-real-ip': '203.0.113.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });

    it('should handle Cloudflare CDN', () => {
      const req = {
        headers: {
          'cf-connecting-ip': '203.0.113.1',
          'x-forwarded-for': '203.0.113.1, 172.16.0.1',
        },
      };

      const result = extractClientIp(req);
      expect(result).toBe('203.0.113.1');
    });
  });
});

describe('isPrivateIp', () => {
  it('should detect localhost IPv4 as private', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.1.1.1')).toBe(true);
  });

  it('should detect localhost IPv6 as private', () => {
    expect(isPrivateIp('::1')).toBe(true);
  });

  it('should detect 10.x.x.x as private', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('10.255.255.255')).toBe(true);
  });

  it('should detect 172.16-31.x.x as private', () => {
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('172.15.0.1')).toBe(false);
    expect(isPrivateIp('172.32.0.1')).toBe(false);
  });

  it('should detect 192.168.x.x as private', () => {
    expect(isPrivateIp('192.168.0.1')).toBe(true);
    expect(isPrivateIp('192.168.255.255')).toBe(true);
  });

  it('should detect link-local addresses as private', () => {
    expect(isPrivateIp('169.254.0.1')).toBe(true);
    expect(isPrivateIp('169.254.255.255')).toBe(true);
  });

  it('should detect public IPs as not private', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('203.0.113.1')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });
});

describe('getIpGeolocation', () => {
  it('should return empty object (placeholder implementation)', () => {
    const result = getIpGeolocation('8.8.8.8');
    expect(result).toEqual({});
    expect(result.country).toBeUndefined();
    expect(result.city).toBeUndefined();
  });
});
