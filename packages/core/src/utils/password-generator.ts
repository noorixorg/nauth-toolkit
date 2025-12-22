import * as crypto from 'crypto';

/**
 * Generate a cryptographically secure random password
 *
 * Creates a password with:
 * - Mixed case letters (a-z, A-Z)
 * - Numbers (0-9)
 * - Special characters (!@#$%^&*)
 * - No ambiguous characters (0, O, l, 1, I) to prevent confusion
 *
 * The password is generated using cryptographically secure random number generation
 * (crypto.randomBytes) to ensure unpredictability.
 *
 * @param length - Password length (default: 16)
 * @returns Secure random password string
 *
 * @example
 * ```typescript
 * // Generate 16-character password (default)
 * const password = generateSecurePassword();
 * // Example output: "Kx9#mP2$vN7@qR4!"
 *
 * // Generate 20-character password
 * const longPassword = generateSecurePassword(20);
 * ```
 *
 * @throws {Error} If length is less than 8 or greater than 128
 */
export function generateSecurePassword(length: number = 16): string {
  if (length < 8) {
    throw new Error('Password length must be at least 8 characters');
  }
  if (length > 128) {
    throw new Error('Password length must not exceed 128 characters');
  }

  // Character sets (excluding ambiguous characters)
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'; // Excludes: i, l, o
  const uppercase = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // Excludes: I, L, O
  const numbers = '23456789'; // Excludes: 0, 1
  const special = '!@#$%^&*';

  // Combine all character sets
  const allChars = lowercase + uppercase + numbers + special;

  // Ensure at least one character from each set
  let password = '';
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  // Fill the rest with random characters from all sets
  const remainingLength = length - password.length;
  for (let i = 0; i < remainingLength; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password to avoid predictable pattern (first 4 chars are guaranteed)
  const passwordArray = password.split('');
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join('');
}
