import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Phone number validator
 *
 * Validates E.164 format: +[country code][number]
 */
export function phoneValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null; // Let required validator handle empty values
  }
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(control.value)) {
    return { phoneFormat: { message: 'Phone must be in E.164 format (e.g., +14155552671)' } };
  }
  return null;
}


