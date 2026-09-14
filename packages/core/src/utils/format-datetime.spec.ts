import { NAuthConfig } from '../interfaces/config.interface';
import { formatDateForUser, formatDateTimeForUser, resolveLocale, resolveTimezone } from './format-datetime';

/**
 * Date formatting unit tests
 *
 * Every assertion passes an explicit timezone and locale, so results do not depend on the
 * machine running the suite. Note `process.env.TZ` is deliberately NOT used to pin this:
 * Node resolves the host zone for `Intl` at startup, so setting it inside a test has no
 * effect and would give false confidence.
 */
describe('format-datetime', () => {
  const INSTANT = new Date('2026-09-14T10:22:33.000Z');

  /** The zone this machine reports — the expected value of the host fallback. */
  const HOST_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const config = (email?: { defaultTimezone?: string; defaultLocale?: string }): NAuthConfig =>
    ({ email }) as NAuthConfig;

  describe('resolveTimezone', () => {
    it("prefers the user's own timezone", () => {
      expect(resolveTimezone({ timezone: 'Asia/Karachi' }, config({ defaultTimezone: 'Europe/Dublin' }))).toBe(
        'Asia/Karachi',
      );
    });

    it('falls back to the configured default', () => {
      expect(resolveTimezone({ timezone: null }, config({ defaultTimezone: 'Europe/Dublin' }))).toBe('Europe/Dublin');
    });

    it('falls through a stored timezone the runtime does not recognise', () => {
      // A value that was valid when stored, or was written directly to the database.
      expect(resolveTimezone({ timezone: 'Mars/Olympus' }, config({ defaultTimezone: 'Europe/Dublin' }))).toBe(
        'Europe/Dublin',
      );
    });

    it('falls back to the host timezone when nothing is configured', () => {
      expect(resolveTimezone(null, config())).toBe(HOST_TIMEZONE);
    });

    it('tolerates no preferences and no config at all', () => {
      expect(resolveTimezone()).toBeTruthy();
    });
  });

  describe('resolveLocale', () => {
    it("prefers the user's own locale", () => {
      expect(resolveLocale({ locale: 'en-GB' }, config({ defaultLocale: 'fr-FR' }))).toBe('en-GB');
    });

    it('falls back to the configured default', () => {
      expect(resolveLocale({ locale: null }, config({ defaultLocale: 'fr-FR' }))).toBe('fr-FR');
    });

    it('falls through a malformed stored locale', () => {
      expect(resolveLocale({ locale: 'not a locale' }, config({ defaultLocale: 'fr-FR' }))).toBe('fr-FR');
    });
  });

  describe('formatDateTimeForUser', () => {
    it("renders in the user's timezone", () => {
      const utc = formatDateTimeForUser(INSTANT, { timezone: 'UTC', locale: 'en-GB' });
      const karachi = formatDateTimeForUser(INSTANT, { timezone: 'Asia/Karachi', locale: 'en-GB' });

      expect(utc).toContain('10:22');
      expect(karachi).toContain('15:22');
      expect(utc).not.toEqual(karachi);
    });

    it("renders in the user's locale", () => {
      const gb = formatDateTimeForUser(INSTANT, { timezone: 'UTC', locale: 'en-GB' });
      const us = formatDateTimeForUser(INSTANT, { timezone: 'UTC', locale: 'en-US' });

      expect(gb).not.toEqual(us);
    });

    it('uses the server default when the user has no preferences', () => {
      const result = formatDateTimeForUser(INSTANT, null, config({ timezone: undefined } as never));
      expect(result).toContain('2026');
    });

    it('accepts an ISO string as well as a Date', () => {
      expect(formatDateTimeForUser(INSTANT.toISOString(), { timezone: 'UTC', locale: 'en-GB' })).toEqual(
        formatDateTimeForUser(INSTANT, { timezone: 'UTC', locale: 'en-GB' }),
      );
    });

    it('returns empty string for a missing date rather than throwing', () => {
      expect(formatDateTimeForUser(null)).toBe('');
      expect(formatDateTimeForUser(undefined)).toBe('');
      expect(formatDateTimeForUser('')).toBe('');
    });

    it('returns empty string for an unparseable date rather than throwing', () => {
      expect(formatDateTimeForUser('not a date')).toBe('');
    });

    it('never throws on a bogus stored timezone — it degrades instead', () => {
      expect(() => formatDateTimeForUser(INSTANT, { timezone: 'Nowhere/Nothing', locale: 'zz-ZZ' })).not.toThrow();
      expect(formatDateTimeForUser(INSTANT, { timezone: 'Nowhere/Nothing', locale: 'zz-ZZ' })).toContain('2026');
    });
  });

  describe('formatDateForUser', () => {
    it('renders a date with no time component', () => {
      const result = formatDateForUser(INSTANT, { timezone: 'UTC', locale: 'en-GB' });
      expect(result).toContain('2026');
      expect(result).not.toContain(':');
    });

    it('returns empty string for a missing date', () => {
      expect(formatDateForUser(null)).toBe('');
    });
  });
});
