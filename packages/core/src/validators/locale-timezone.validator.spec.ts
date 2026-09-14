import { isValidLocale, isValidTimezone } from './locale-timezone.validator';

/**
 * Locale/timezone validation unit tests
 *
 * These guard the DB against values `Intl` cannot use. A bad value stored here is
 * invisible until someone receives a badly formatted email, so the edge check matters.
 */
describe('locale-timezone.validator', () => {
  describe('isValidTimezone', () => {
    it.each(['Europe/Dublin', 'Asia/Karachi', 'America/New_York', 'UTC', 'utc'])('accepts %s', (tz) => {
      expect(isValidTimezone(tz)).toBe(true);
    });

    // Regression: an earlier implementation gated on `Intl.supportedValuesOf('timeZone')`,
    // which lists only canonical primary ids. Every one of these is what a real browser
    // reports, and every one was rejected — `Asia/Kolkata` in particular, while the
    // deprecated `Asia/Calcutta` passed.
    it.each([
      'Asia/Kolkata',
      'Asia/Calcutta',
      'Europe/Kyiv',
      'Europe/Kiev',
      'Asia/Yangon',
      'US/Pacific',
      'Australia/Canberra',
      'Etc/GMT+5',
    ])('accepts the alias %s that browsers actually report', (tz) => {
      expect(isValidTimezone(tz)).toBe(true);
    });

    it.each(['Mars/Olympus', 'Europe/Atlantis', 'GMT+5', 'not a timezone', '', '   '])('rejects %s', (tz) => {
      expect(isValidTimezone(tz)).toBe(false);
    });

    it('rejects non-strings without throwing', () => {
      expect(isValidTimezone(null)).toBe(false);
      expect(isValidTimezone(undefined)).toBe(false);
      expect(isValidTimezone(42)).toBe(false);
      expect(isValidTimezone({})).toBe(false);
    });
  });

  describe('isValidLocale', () => {
    it.each(['en', 'en-GB', 'ur-PK', 'zh-Hans-CN', 'pt-BR'])('accepts %s', (locale) => {
      expect(isValidLocale(locale)).toBe(true);
    });

    it.each(['not a locale', 'e', '', '   ', 'en_GB!'])('rejects %s', (locale) => {
      expect(isValidLocale(locale)).toBe(false);
    });

    it('rejects non-strings without throwing', () => {
      expect(isValidLocale(null)).toBe(false);
      expect(isValidLocale(undefined)).toBe(false);
      expect(isValidLocale(42)).toBe(false);
    });
  });
});
