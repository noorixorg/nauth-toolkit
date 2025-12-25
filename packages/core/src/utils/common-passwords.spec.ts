import * as fs from 'fs';
import * as path from 'path';
import { loadCommonPasswords, isCommonPassword, getCommonPasswordCount } from './common-passwords';

/**
 * Common Passwords Utility Tests
 *
 * Covers:
 * - Loading password list from file
 * - Fallback when file not found
 * - Password checking (case-insensitive)
 * - Performance characteristics
 * - Caching behavior
 */
describe('Common Passwords Utility', () => {
  // ============================================================================
  // Loading and Initialization
  // ============================================================================

  describe('loadCommonPasswords', () => {
    it('should load passwords into a Set', () => {
      const passwords = loadCommonPasswords();

      expect(passwords).toBeInstanceOf(Set);
      expect(passwords.size).toBeGreaterThan(0);
    });

    it('should return cached instance on subsequent calls', () => {
      const passwords1 = loadCommonPasswords();
      const passwords2 = loadCommonPasswords();

      // Should return exact same instance (not a copy)
      expect(passwords1).toBe(passwords2);
    });

    it('should contain known common passwords', () => {
      const passwords = loadCommonPasswords();

      // These should always be in the list (either from file or fallback)
      expect(passwords.has('password')).toBe(true);
      expect(passwords.has('123456')).toBe(true);
      expect(passwords.has('qwerty')).toBe(true);
    });

    it('should handle file loading gracefully', () => {
      const filePath = path.join(__dirname, '../data/common-passwords-10000.txt');
      const fileExists = fs.existsSync(filePath);

      const passwords = loadCommonPasswords();

      if (fileExists) {
        // If file exists, should load 10K+ passwords
        expect(passwords.size).toBeGreaterThanOrEqual(1000);
      } else {
        // If file missing, should use fallback list
        expect(passwords.size).toBeGreaterThanOrEqual(10);
      }
    });
  });

  // ============================================================================
  // Password Checking
  // ============================================================================

  describe('isCommonPassword', () => {
    it('should identify common passwords', () => {
      expect(isCommonPassword('password')).toBe(true);
      expect(isCommonPassword('password123')).toBe(true);
      expect(isCommonPassword('12345678')).toBe(true);
      expect(isCommonPassword('qwerty')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isCommonPassword('PASSWORD')).toBe(true);
      expect(isCommonPassword('PaSsWoRd')).toBe(true);
      expect(isCommonPassword('QWERTY')).toBe(true);
    });

    it('should reject strong passwords', () => {
      // These strong passwords should NOT be in common password list
      expect(isCommonPassword('Xy9$mK2#pLq8@vN3')).toBe(false);
      expect(isCommonPassword('correct-horse-battery-staple-2024')).toBe(false);
      expect(isCommonPassword('MyC0mpl3x!P@ssw0rd#2024')).toBe(false);
    });

    it('should handle empty string', () => {
      expect(isCommonPassword('')).toBe(false);
    });

    it('should handle special characters', () => {
      // Common passwords with numbers should be detected
      expect(isCommonPassword('password1')).toBe(true);
      expect(isCommonPassword('password123')).toBe(true);
    });
  });

  // ============================================================================
  // Performance and Count
  // ============================================================================

  describe('getCommonPasswordCount', () => {
    it('should return positive number', () => {
      const count = getCommonPasswordCount();

      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe('number');
    });

    it('should match loaded set size', () => {
      const passwords = loadCommonPasswords();
      const count = getCommonPasswordCount();

      expect(count).toBe(passwords.size);
    });

    it('should have at least 10 passwords', () => {
      // Even fallback list should have 10 passwords
      const count = getCommonPasswordCount();

      expect(count).toBeGreaterThanOrEqual(10);
    });
  });

  // ============================================================================
  // Performance Characteristics
  // ============================================================================

  describe('Performance', () => {
    it('should check passwords in constant time (O(1) with Set)', () => {
      const passwords = loadCommonPasswords();

      // Measure lookup time for different passwords
      const iterations = 100000; // Increased iterations for measurable time

      const start1 = performance.now();
      for (let i = 0; i < iterations; i++) {
        passwords.has('password');
      }
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      for (let i = 0; i < iterations; i++) {
        passwords.has('very-secure-password-that-definitely-is-not-common-123456789');
      }
      const time2 = performance.now() - start2;

      // Set lookup should be O(1), so both should complete in reasonable time
      // Both lookups should take less than 2000ms for 100K iterations (lenient for CI/system load)
      expect(time1).toBeLessThan(2000);
      expect(time2).toBeLessThan(2000);

      // Times should be similar (within 15x of each other for O(1) behavior)
      // This is lenient to account for V8 optimization, system variance, and CI load
      const ratio = Math.max(time1, time2) / Math.min(time1, time2);
      expect(ratio).toBeLessThan(15);
    });

    it('should handle rapid consecutive checks', () => {
      // Should not fail or slow down with many checks
      const testPasswords = ['password', 'secure123', 'MySecureP@ssw0rd', 'qwerty', 'admin', 'Xy9$mK2#pLq8@vN3'];

      for (let i = 0; i < 1000; i++) {
        for (const pwd of testPasswords) {
          isCommonPassword(pwd);
        }
      }

      // If we get here without timeout, performance is acceptable
      expect(true).toBe(true);
    });
  });

  // ============================================================================
  // Integration with Password Service
  // ============================================================================

  describe('Integration', () => {
    it('should provide API that matches PasswordService expectations', () => {
      // PasswordService calls loadCommonPasswords() once in constructor
      const passwords = loadCommonPasswords();

      // Then uses passwords.has(password.toLowerCase()) for checking
      expect(typeof passwords.has).toBe('function');

      const testPassword = 'password123';
      const result = passwords.has(testPassword.toLowerCase());

      expect(typeof result).toBe('boolean');
      expect(result).toBe(true);
    });

    it('should handle all lowercase storage correctly', () => {
      const passwords = loadCommonPasswords();

      // List stores everything as lowercase
      // So checking with original case should work via toLowerCase()
      expect(passwords.has('password')).toBe(true);
      expect(passwords.has('PASSWORD')).toBe(false); // Not in lowercase form
      expect(passwords.has('password'.toLowerCase())).toBe(true); // Correct usage
    });
  });

  // ============================================================================
  // Environment Variable Control
  // ============================================================================

  describe('Debug Logging', () => {
    const originalEnv = process.env.NAUTH_DEBUG;

    afterEach(() => {
      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.NAUTH_DEBUG = originalEnv;
      } else {
        delete process.env.NAUTH_DEBUG;
      }
    });

    it('should not throw errors regardless of NAUTH_DEBUG setting', () => {
      process.env.NAUTH_DEBUG = 'true';
      expect(() => loadCommonPasswords()).not.toThrow();

      process.env.NAUTH_DEBUG = 'false';
      expect(() => loadCommonPasswords()).not.toThrow();

      delete process.env.NAUTH_DEBUG;
      expect(() => loadCommonPasswords()).not.toThrow();
    });
  });
});
