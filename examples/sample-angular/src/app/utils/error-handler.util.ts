import { WritableSignal } from '@angular/core';
import { NAuthClientError } from '@nauth-toolkit/client';

/**
 * Handle authentication errors and set error message signal
 *
 * Provides consistent error handling across all authentication components.
 * Extracts error messages from NAuthClientError or generic Error objects.
 *
 * @param err - Error object (can be NAuthClientError or generic Error)
 * @param errorSignal - Signal to set the error message
 *
 * @example
 * ```typescript
 * import { handleAuthError } from '../utils/error-handler.util';
 *
 * try {
 *   await this.auth.login(email, password);
 * } catch (err) {
 *   handleAuthError(err, this.error);
 * }
 * ```
 */
export function handleAuthError(err: unknown, errorSignal: WritableSignal<string | null>): void {
  if (err instanceof NAuthClientError) {
    errorSignal.set(err.message);
  } else if (err instanceof Error) {
    errorSignal.set(err.message || 'An unexpected error occurred. Please try again.');
  } else {
    errorSignal.set('An unexpected error occurred. Please try again.');
  }
}
