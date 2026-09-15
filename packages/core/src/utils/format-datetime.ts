import { NAuthConfig } from '../interfaces/config.interface';
import { isValidLocale, isValidTimezone } from '../validators/locale-timezone.validator';

/**
 * Human-readable date formatting for user-facing messages
 *
 * Notification emails historically rendered raw UTC ISO strings
 * (`2026-09-14T11:22:33.000Z`). These helpers render the same instant in the recipient's
 * own timezone and locale instead.
 *
 * Every function here is total: it never throws, whatever it is given. A message with an
 * oddly formatted date is a cosmetic problem; an exception thrown while sending a security
 * alert is a real one, and these run inside notification hooks that fire during
 * password changes and MFA removals.
 */

/**
 * The subset of a user needed to format a date for them.
 *
 * Deliberately structural rather than `IUser`, so callers can pass a partial user, a
 * plain object, or nothing at all.
 */
export interface DateFormatPreferences {
  timezone?: string | null;
  locale?: string | null;
}

/** Final fallback timezone when nothing else resolves. */
const FALLBACK_TIMEZONE = 'UTC';

/** Final fallback locale when nothing else resolves. */
const FALLBACK_LOCALE = 'en-US';

/** Timezone-name style used when `email.timeZoneNameStyle` is not configured. */
const DEFAULT_TIMEZONE_NAME_STYLE = 'long' as const;

/**
 * Resolve which timezone to format in.
 *
 * Order: the user's own value, then the configured server default, then the host's
 * timezone, then UTC. Each candidate is validated, so a stale or mistyped stored value
 * falls through to the next rather than breaking the format call.
 *
 * @param preferences - The recipient's stored preferences, if any
 * @param config - NAuth configuration, for `email.defaultTimezone`
 * @returns An IANA timezone name that `Intl` accepts
 */
export function resolveTimezone(preferences?: DateFormatPreferences | null, config?: NAuthConfig): string {
  const candidates = [preferences?.timezone, config?.email?.defaultTimezone, hostTimezone()];

  for (const candidate of candidates) {
    if (candidate && isValidTimezone(candidate)) return candidate;
  }
  return FALLBACK_TIMEZONE;
}

/**
 * Resolve which locale to format in.
 *
 * Order: the user's own value, then the configured server default, then the host's
 * locale, then `en-US`.
 *
 * @param preferences - The recipient's stored preferences, if any
 * @param config - NAuth configuration, for `email.defaultLocale`
 * @returns A BCP 47 tag that `Intl` accepts
 */
export function resolveLocale(preferences?: DateFormatPreferences | null, config?: NAuthConfig): string {
  const candidates = [preferences?.locale, config?.email?.defaultLocale, hostLocale()];

  for (const candidate of candidates) {
    if (candidate && isValidLocale(candidate)) return candidate;
  }
  return FALLBACK_LOCALE;
}

/** How the timezone is named on a formatted date+time — see `EmailConfig.timeZoneNameStyle`. */
type TimeZoneNameStyle = NonNullable<Required<NAuthConfig>['email']['timeZoneNameStyle']>;

/**
 * Resolve which timezone-name style to render on dates+times (not on date-only values).
 *
 * There is no per-user equivalent of this — unlike timezone/locale, it isn't something an
 * individual recipient would set, only the app operator.
 *
 * @param config - NAuth configuration, for `email.timeZoneNameStyle`
 * @returns An `Intl.DateTimeFormat` `timeZoneName` value
 */
function resolveTimeZoneNameStyle(config?: NAuthConfig): TimeZoneNameStyle {
  return config?.email?.timeZoneNameStyle ?? DEFAULT_TIMEZONE_NAME_STYLE;
}

/**
 * Format an instant as a human-readable date and time for a specific user.
 *
 * @param date - The instant to render. A string is parsed; an invalid or missing value yields `''`.
 * @param preferences - The recipient's timezone and locale, if known
 * @param config - NAuth configuration, for the server-side defaults
 * @returns A localised string such as `14 Sept 2026, 04:22 Pacific Daylight Time`, or the ISO string if formatting fails
 *
 * @example
 * ```typescript
 * formatDateTimeForUser(new Date(), { timezone: 'America/Los_Angeles', locale: 'en-GB' }, config);
 * // '14 Sept 2026, 04:22 Pacific Daylight Time'
 * ```
 *
 * @example No preferences — falls back to the server default
 * ```typescript
 * formatDateTimeForUser(new Date(), null, config); // 'Sep 14, 2026, 11:22 AM Coordinated Universal Time'
 * ```
 *
 * @example `email.timeZoneNameStyle: 'short'` — GMT offset instead of the full name
 * ```typescript
 * const config = { email: { timeZoneNameStyle: 'short' } };
 * formatDateTimeForUser(new Date(), { timezone: 'Australia/Sydney' }, config);
 * // '14 Sept 2026, 9:22 pm GMT+10'
 * ```
 */
export function formatDateTimeForUser(
  date: Date | string | null | undefined,
  preferences?: DateFormatPreferences | null,
  config?: NAuthConfig,
): string {
  const instant = toDate(date);
  if (!instant) return '';

  try {
    // Named component options (year/month/day/hour/minute), not the `dateStyle`/`timeStyle`
    // shorthand: `timeZoneName` cannot be combined with those per the Intl.DateTimeFormat
    // spec. Defaults to `'long'` (see `DEFAULT_TIMEZONE_NAME_STYLE`) — the full zone name,
    // stable across locales. `'short'` can render a colloquial abbreviation (`AEST`), but
    // only for a recipient whose own locale "owns" that zone; a mismatched locale falls
    // back to a bare GMT offset, and there's no forcing a specific abbreviation regardless
    // of locale (see `EmailConfig.timeZoneNameStyle`). Configurable via
    // `email.timeZoneNameStyle` for operators who'd rather have the shorter form.
    return new Intl.DateTimeFormat(resolveLocale(preferences, config), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: resolveTimeZoneNameStyle(config),
      timeZone: resolveTimezone(preferences, config),
    }).format(instant);
  } catch {
    // Should be unreachable — both inputs are validated above — but a formatted date is
    // never worth throwing over.
    return safeIso(instant);
  }
}

/**
 * Format an instant as a human-readable date only, for a specific user.
 *
 * @param date - The instant to render
 * @param preferences - The recipient's timezone and locale, if known
 * @param config - NAuth configuration, for the server-side defaults
 * @returns A localised date such as `14 Sept 2026`, or the ISO string if formatting fails
 */
export function formatDateForUser(
  date: Date | string | null | undefined,
  preferences?: DateFormatPreferences | null,
  config?: NAuthConfig,
): string {
  const instant = toDate(date);
  if (!instant) return '';

  try {
    return new Intl.DateTimeFormat(resolveLocale(preferences, config), {
      dateStyle: 'medium',
      timeZone: resolveTimezone(preferences, config),
    }).format(instant);
  } catch {
    return safeIso(instant);
  }
}

/**
 * Coerce a loose date input into a valid `Date`, or null.
 */
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;

  const instant = value instanceof Date ? value : new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * ISO string that cannot throw on an out-of-range date.
 */
function safeIso(instant: Date): string {
  try {
    return instant.toISOString();
  } catch {
    return '';
  }
}

/**
 * The host's timezone, or undefined if the runtime will not report one.
 */
function hostTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The host's locale, or undefined if the runtime will not report one.
 */
function hostLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || undefined;
  } catch {
    return undefined;
  }
}
