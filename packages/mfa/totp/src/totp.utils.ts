import { createHmac, randomBytes } from 'crypto';

/**
 * Supported hash algorithms for RFC 6238 TOTP.
 */
export type TotpHashAlgorithm = 'sha1' | 'sha256' | 'sha512';

/**
 * Parameters required to generate/verify RFC 6238 TOTP tokens.
 */
export interface TotpParams {
  /**
   * Base32-encoded shared secret (RFC 4648, no padding).
   */
  secret: string;

  /**
   * Number of digits in the token (typically 6 or 8).
   */
  digits: 6 | 8;

  /**
   * Time step in seconds (typically 30).
   */
  period: number;

  /**
   * HMAC hash algorithm used for token generation.
   */
  algorithm: TotpHashAlgorithm;
}

/**
 * Parameters required to build a standard `otpauth://` URI for authenticator apps.
 */
export interface OtpAuthUriParams extends TotpParams {
  /**
   * Issuer name shown in authenticator apps (e.g. "Acme").
   */
  issuer: string;

  /**
   * Account label shown in authenticator apps (e.g. user email).
   */
  label: string;
}

// ============================================================================
// Base32 (RFC 4648) helpers
// ============================================================================

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567' as const;

const BASE32_LOOKUP: Readonly<Record<string, number>> = (() => {
  const lookup: Record<string, number> = {};
  for (let i = 0; i < BASE32_ALPHABET.length; i += 1) {
    lookup[BASE32_ALPHABET[i]] = i;
  }
  return lookup;
})();

/**
 * Decode a base32 string (RFC 4648, no padding) into bytes.
 *
 * ⚠️ WARNING: This is security-sensitive. We reject invalid characters to avoid
 * ambiguous decoding behavior.
 *
 * @param input - Base32 string, case-insensitive, without padding.
 * @returns Decoded bytes.
 * @throws {Error} When input contains invalid base32 characters.
 */
export function base32Decode(input: string): Uint8Array {
  const normalized = input.toUpperCase().replace(/\s+/g, '');
  if (!normalized) {
    return new Uint8Array(0);
  }

  // Reject padding to match common authenticator secret formats and our own validation.
  if (normalized.includes('=')) {
    throw new Error('Invalid base32: padding is not supported');
  }

  let buffer = 0;
  let bits = 0;
  const bytes: number[] = [];

  for (const ch of normalized) {
    const val = BASE32_LOOKUP[ch];
    if (val === undefined) {
      throw new Error(`Invalid base32: illegal character "${ch}"`);
    }

    buffer = (buffer << 5) | val;
    bits += 5;

    while (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return Uint8Array.from(bytes);
}

/**
 * Encode bytes into a base32 string (RFC 4648, no padding).
 *
 * @param bytes - Input bytes.
 * @returns Base32 string without padding.
 */
export function base32Encode(bytes: Uint8Array): string {
  let buffer = 0;
  let bits = 0;
  let out = '';

  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(buffer >> bits) & 31];
    }
  }

  if (bits > 0) {
    out += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  }

  return out;
}

/**
 * Generate a random base32 secret suitable for TOTP.
 *
 * @param byteLength - Number of random bytes to generate (default 20 = 160-bit secret).
 * @returns Base32 secret (uppercase, no padding).
 */
export function generateBase32Secret(byteLength: number = 20): string {
  const bytes = randomBytes(byteLength);
  return base32Encode(bytes);
}

// ============================================================================
// RFC 4226 HOTP + RFC 6238 TOTP
// ============================================================================

/**
 * Generate an HOTP token for a secret and counter (RFC 4226).
 *
 * @param secretBytes - Shared secret bytes.
 * @param counter - HOTP counter value.
 * @param digits - Token length (6 or 8).
 * @param algorithm - HMAC hash algorithm.
 * @returns Numeric token as a zero-padded string.
 */
export function hotpGenerate(
  secretBytes: Uint8Array,
  counter: bigint,
  digits: 6 | 8,
  algorithm: TotpHashAlgorithm,
): string {
  // 8-byte counter, big-endian
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(counter);

  const hmac = createHmac(algorithm, Buffer.from(secretBytes)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  const token = String(code % mod).padStart(digits, '0');
  return token;
}

/**
 * Generate a TOTP token for the current time (RFC 6238).
 *
 * @param params - TOTP generation parameters.
 * @param nowMs - Current time in milliseconds (defaults to `Date.now()`).
 * @returns Token as a numeric string.
 */
export function totpGenerate(params: TotpParams, nowMs: number = Date.now()): string {
  const { secret, digits, period, algorithm } = params;
  const secretBytes = base32Decode(secret);
  const counter = BigInt(Math.floor(nowMs / 1000 / period));
  return hotpGenerate(secretBytes, counter, digits, algorithm);
}

/**
 * Verify a TOTP token within a time-step window.
 *
 * @param params - TOTP verification parameters.
 * @param token - Token to verify (numeric string).
 * @param window - Number of time steps to check before/after the current step.
 * @param nowMs - Current time in milliseconds (defaults to `Date.now()`).
 * @returns `true` when token matches within the window.
 */
export function totpVerify(
  params: TotpParams,
  token: string,
  window: number,
  nowMs: number = Date.now(),
): boolean {
  const { secret, digits, period, algorithm } = params;
  const secretBytes = base32Decode(secret);
  const current = BigInt(Math.floor(nowMs / 1000 / period));

  // Normalize token once to avoid repeated work in window scan.
  const cleanToken = token.replace(/\s+/g, '');

  for (let w = -window; w <= window; w += 1) {
    const counter = current + BigInt(w);
    if (counter < 0n) {
      continue;
    }
    const expected = hotpGenerate(secretBytes, counter, digits, algorithm);
    if (expected === cleanToken) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// otpauth:// URI builder
// ============================================================================

/**
 * Build an `otpauth://` URI compatible with major authenticator apps.
 *
 * @param params - URI parameters.
 * @returns `otpauth://totp/...` URI.
 */
export function buildOtpAuthUri(params: OtpAuthUriParams): string {
  const { issuer, label, secret, algorithm, digits, period } = params;

  // Common convention: label in the path contains "issuer:account".
  const pathLabel = encodeURIComponent(`${issuer}:${label}`);

  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: algorithm.toUpperCase(),
    digits: String(digits),
    period: String(period),
  });

  return `otpauth://totp/${pathLabel}?${query.toString()}`;
}

