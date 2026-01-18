/**
 * Password Generator Unit Tests
 *
 * Tests secure password generation functionality.
 */

import { generateSecurePassword } from './password-generator';

describe('generateSecurePassword', () => {
  it('should generate a password with default length', () => {
    const password = generateSecurePassword();
    expect(password).toBeDefined();
    expect(typeof password).toBe('string');
    expect(password.length).toBe(16);
  });

  it('should generate a password with custom length', () => {
    const password = generateSecurePassword(20);
    expect(password.length).toBe(20);
  });

  it('should generate unique passwords', () => {
    const password1 = generateSecurePassword();
    const password2 = generateSecurePassword();
    expect(password1).not.toBe(password2);
  });

  it('should include lowercase letters', () => {
    const password = generateSecurePassword();
    expect(password).toMatch(/[a-z]/);
  });

  it('should include uppercase letters', () => {
    const password = generateSecurePassword();
    expect(password).toMatch(/[A-Z]/);
  });

  it('should include numbers', () => {
    const password = generateSecurePassword();
    expect(password).toMatch(/[0-9]/);
  });

  it('should include special characters', () => {
    const password = generateSecurePassword();
    expect(password).toMatch(/[!@#$%^&*]/);
  });

  it('should not include ambiguous characters', () => {
    const password = generateSecurePassword(100);
    // Should not contain: 0, O, l, 1, I
    expect(password).not.toMatch(/[0O1Il]/);
  });

  it('should throw error for length less than 8', () => {
    expect(() => {
      generateSecurePassword(7);
    }).toThrow('Password length must be at least 8 characters');
  });

  it('should throw error for length greater than 128', () => {
    expect(() => {
      generateSecurePassword(129);
    }).toThrow('Password length must not exceed 128 characters');
  });

  it('should work with minimum length (8)', () => {
    const password = generateSecurePassword(8);
    expect(password.length).toBe(8);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%^&*]/);
  });

  it('should work with maximum length (128)', () => {
    const password = generateSecurePassword(128);
    expect(password.length).toBe(128);
  });
});
