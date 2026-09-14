/**
 * Browser environment detection
 *
 * The backend cannot infer a user's timezone reliably — IP geolocation is a guess, and a
 * server in UTC has no idea what "9am" means to the person reading its emails. The browser
 * knows both, so the SDK reads them once and sends them with signup.
 *
 * Every function here is total and returns `undefined` rather than throwing: these run on
 * the signup path, and a hostile or unusual runtime must not be able to break
 * registration over a formatting preference.
 */

/**
 * Whether a browser-like global environment is available.
 *
 * @returns True in a browser, false under SSR, Node, or a test runner without a DOM
 */
export function hasBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

/**
 * The browser's current IANA timezone.
 *
 * @returns An IANA name such as `Europe/Dublin`, or undefined outside a browser
 *
 * @example
 * ```typescript
 * detectTimezone(); // 'Asia/Karachi'
 * ```
 */
export function detectTimezone(): string | undefined {
  if (!hasBrowserEnvironment()) return undefined;

  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The browser's preferred BCP 47 locale.
 *
 * Prefers `navigator.language` (the user's top choice) and falls back to what `Intl`
 * resolved, which accounts for a runtime that has no data for the requested locale.
 *
 * @returns A tag such as `en-GB`, or undefined outside a browser
 *
 * @example
 * ```typescript
 * detectLocale(); // 'en-GB'
 * ```
 */
export function detectLocale(): string | undefined {
  if (!hasBrowserEnvironment()) return undefined;

  try {
    const preferred = typeof navigator !== 'undefined' ? navigator.language : undefined;
    if (preferred) return preferred;
    return Intl.DateTimeFormat().resolvedOptions().locale || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Detected timezone and locale, for seeding a new account.
 */
export interface DetectedPreferences {
  timezone?: string;
  locale?: string;
}

/**
 * Fill in timezone and locale from the browser, without overriding what the caller set.
 *
 * An explicit value always wins — including an explicit `undefined`, since a caller who
 * spelled the key out has made a choice. Only absent keys are populated.
 *
 * @param supplied - Values the caller already provided
 * @param enabled - Whether auto-detection is switched on
 * @returns The supplied values with any missing ones filled in
 */
export function withDetectedPreferences<T extends DetectedPreferences>(supplied: T, enabled: boolean): T {
  if (!enabled) return supplied;

  const result = { ...supplied };
  if (!('timezone' in supplied)) {
    const timezone = detectTimezone();
    if (timezone) result.timezone = timezone;
  }
  if (!('locale' in supplied)) {
    const locale = detectLocale();
    if (locale) result.locale = locale;
  }
  return result;
}
