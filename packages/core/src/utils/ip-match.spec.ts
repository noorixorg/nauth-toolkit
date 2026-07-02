import { isValidIpOrCidr, ipMatchesEntry } from './ip-match';

/**
 * IP allowlist matching unit tests.
 *
 * Covers validation (IPv4, IPv4 CIDR, IPv4-mapped IPv6, malformed rejection) and matching
 * (exact, CIDR ranges + boundaries, ::ffff normalization, empty-allowlist semantics live in the entity).
 */
describe('ip-match', () => {
  describe('isValidIpOrCidr', () => {
    it('accepts valid IPv4 and IPv4 CIDR', () => {
      expect(isValidIpOrCidr('203.0.113.4')).toBe(true);
      expect(isValidIpOrCidr('10.0.0.0/8')).toBe(true);
      expect(isValidIpOrCidr('0.0.0.0/0')).toBe(true);
      expect(isValidIpOrCidr('192.168.1.1/32')).toBe(true);
    });

    it('accepts IPv4-mapped IPv6 and plain IPv6', () => {
      expect(isValidIpOrCidr('::ffff:127.0.0.1')).toBe(true);
      expect(isValidIpOrCidr('::1')).toBe(true);
      expect(isValidIpOrCidr('2001:db8::1')).toBe(true);
    });

    it('rejects malformed / out-of-range / non-IP entries', () => {
      expect(isValidIpOrCidr('not-an-ip')).toBe(false);
      expect(isValidIpOrCidr('256.0.0.1')).toBe(false);
      expect(isValidIpOrCidr('10.0.0.0/33')).toBe(false);
      expect(isValidIpOrCidr('10.0.0.0/-1')).toBe(false);
      expect(isValidIpOrCidr('1::2::3')).toBe(false); // multiple "::" compression
      expect(isValidIpOrCidr('')).toBe(false);
      expect(isValidIpOrCidr('2001:db8::/32')).toBe(false); // IPv6 CIDR not supported
    });
  });

  describe('ipMatchesEntry', () => {
    it('matches exact IPv4', () => {
      expect(ipMatchesEntry('203.0.113.4', '203.0.113.4')).toBe(true);
      expect(ipMatchesEntry('203.0.113.5', '203.0.113.4')).toBe(false);
    });

    it('matches IPv4 CIDR ranges including boundaries', () => {
      expect(ipMatchesEntry('10.1.2.3', '10.0.0.0/8')).toBe(true);
      expect(ipMatchesEntry('11.0.0.1', '10.0.0.0/8')).toBe(false);
      expect(ipMatchesEntry('192.168.1.1', '0.0.0.0/0')).toBe(true); // /0 matches all IPv4
      expect(ipMatchesEntry('192.168.1.1', '192.168.1.1/32')).toBe(true); // /32 exact
      expect(ipMatchesEntry('192.168.1.2', '192.168.1.1/32')).toBe(false);
    });

    it('normalizes IPv4-mapped IPv6 caller addresses', () => {
      expect(ipMatchesEntry('::ffff:10.1.2.3', '10.0.0.0/8')).toBe(true);
      expect(ipMatchesEntry('::ffff:127.0.0.1', '127.0.0.1')).toBe(true);
    });

    it('does not match an IPv6 caller against an IPv4 CIDR (fail-closed)', () => {
      expect(ipMatchesEntry('2001:db8::1', '10.0.0.0/8')).toBe(false);
    });

    it('returns false on empty inputs', () => {
      expect(ipMatchesEntry('', '10.0.0.0/8')).toBe(false);
      expect(ipMatchesEntry('10.0.0.1', '')).toBe(false);
    });
  });
});
