import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Locale and timezone validation
 *
 * Both values are supplied by clients — usually detected from the browser, but also
 * settable by a user or an admin — and both are later fed to `Intl.DateTimeFormat` when
 * rendering dates in notification emails. Storing a value `Intl` cannot use would be
 * invisible until someone received a badly formatted email, so they are validated at the
 * edge instead.
 *
 * Validation is delegated to the platform rather than a regex: the IANA database changes
 * over time, and Node ships the current copy.
 */

/**
 * Whether a string is an IANA timezone name this runtime can format in.
 *
 * Validated by constructing a formatter, which throws `RangeError` only for a genuinely
 * unusable zone. Deliberately NOT `Intl.supportedValuesOf('timeZone')`: that lists only
 * canonical primary ids and omits every link/alias, so it rejects `Asia/Kolkata`,
 * `Europe/Kyiv`, `US/Pacific` and `UTC` while accepting the deprecated `Asia/Calcutta`.
 * Browsers report the alias forms, so gating on that list rejected real users at signup —
 * and which names passed would have shifted with the bundled ICU version.
 *
 * @param value - Candidate timezone name
 * @returns True when the runtime can format dates in this zone
 *
 * @example
 * ```typescript
 * isValidTimezone('Asia/Kolkata'); // true
 * isValidTimezone('Mars/Olympus'); // false
 * ```
 */
export function isValidTimezone(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;

  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether a string is a well-formed BCP 47 language tag this runtime can canonicalise.
 *
 * `Intl.getCanonicalLocales` throws a `RangeError` for a structurally invalid tag. Note
 * this checks *well-formedness*, not whether the runtime has data for the locale — an
 * obscure but valid tag passes and simply formats with a fallback.
 *
 * @param value - Candidate BCP 47 tag
 * @returns True when the tag is structurally valid
 *
 * @example
 * ```typescript
 * isValidLocale('en-GB');   // true
 * isValidLocale('english'); // false
 * ```
 */
export function isValidLocale(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;

  try {
    const canonical = Intl.getCanonicalLocales(value);
    return canonical.length > 0;
  } catch {
    return false;
  }
}

/**
 * Validate that a property holds an IANA timezone name.
 *
 * @param validationOptions - Standard class-validator options
 * @returns Property decorator
 *
 * @example
 * ```typescript
 * class UpdateProfileDTO {
 *   @IsOptional()
 *   @IsIanaTimezone({ message: 'Timezone must be a valid IANA name (e.g. Europe/Dublin)' })
 *   timezone?: string;
 * }
 * ```
 */
export function IsIanaTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isIanaTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isValidTimezone(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a valid IANA timezone name (e.g. Europe/Dublin)`;
        },
      },
    });
  };
}

/**
 * Validate that a property holds a BCP 47 language tag.
 *
 * @param validationOptions - Standard class-validator options
 * @returns Property decorator
 *
 * @example
 * ```typescript
 * class UpdateProfileDTO {
 *   @IsOptional()
 *   @IsBcp47Locale({ message: 'Locale must be a valid BCP 47 tag (e.g. en-GB)' })
 *   locale?: string;
 * }
 * ```
 */
export function IsBcp47Locale(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isBcp47Locale',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isValidLocale(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a valid BCP 47 locale tag (e.g. en-GB)`;
        },
      },
    });
  };
}
