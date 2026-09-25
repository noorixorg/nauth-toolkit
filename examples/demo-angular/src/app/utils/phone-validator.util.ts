import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Validates a phone number in E.164 format (`+` followed by 1-15 digits).
 *
 * Tolerates PrimeNG `p-inputmask` placeholder characters (spaces and
 * underscores) by stripping them before validation, so it can be used
 * directly against a masked input's raw value.
 *
 * @param control - Form control to validate
 * @returns Validation errors or null if valid
 *
 * @example
 * ```typescript
 * phone: ['', [Validators.required, phoneFormatValidator, Validators.maxLength(20)]],
 * ```
 */
export function phoneFormatValidator(control: AbstractControl): ValidationErrors | null {
  const phone = control.value as string | null;

  if (!phone) {
    return null; // Let Validators.required handle empty values
  }

  // Remove whitespace and mask placeholder characters (underscores, spaces)
  const cleaned = phone.replace(/[\s_]/g, '');

  // E.164 format: + followed by 1-15 digits
  const e164Pattern = /^\+[1-9]\d{1,14}$/;

  if (!e164Pattern.test(cleaned)) {
    return {
      phoneFormat: {
        message: 'Phone must be in E.164 format with + prefix (e.g., +14155552671)',
      },
    };
  }

  return null;
}
