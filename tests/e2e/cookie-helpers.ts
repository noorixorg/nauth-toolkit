/**
 * Shared cookie helpers for E2E specs that work with raw Set-Cookie headers
 * (used by the refresh-token race-condition reproduction specs).
 */

/**
 * Structured representation of a parsed Set-Cookie header.
 */
export interface ParsedCookie {
  name: string;
  value: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  domain?: string;
}

/**
 * Parse Set-Cookie headers from a Playwright APIResponse into structured cookies.
 *
 * @param headersArray - Result of `response.headersArray()`
 * @returns Parsed cookies with their attributes
 */
export function parseSetCookieHeaders(headersArray: Array<{ name: string; value: string }>): ParsedCookie[] {
  return headersArray
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => {
      const [nameValue, ...attrs] = h.value.split(';').map((s) => s.trim());
      const eqIdx = nameValue.indexOf('=');
      const cookie: ParsedCookie = {
        name: nameValue.substring(0, eqIdx),
        value: nameValue.substring(eqIdx + 1),
      };
      for (const attr of attrs) {
        const lower = attr.toLowerCase();
        if (lower === 'httponly') cookie.httpOnly = true;
        else if (lower.startsWith('secure')) cookie.secure = true;
        else if (lower.startsWith('samesite=')) cookie.sameSite = attr.split('=')[1];
        else if (lower.startsWith('path=')) cookie.path = attr.split('=')[1];
        else if (lower.startsWith('domain=')) cookie.domain = attr.split('=')[1];
        else if (lower.startsWith('max-age=')) cookie.maxAge = parseInt(attr.split('=')[1], 10);
      }
      return cookie;
    });
}

/**
 * Build a Cookie header string from a name/value map (non-empty values only).
 *
 * @param cookies - Map of cookie name to value
 * @returns Cookie header string (e.g. "a=1; b=2")
 */
export function buildCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
