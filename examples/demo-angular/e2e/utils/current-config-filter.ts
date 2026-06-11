import { BackendConfig } from './scenarios';

/**
 * Detects current backend configuration for test filtering
 *
 * IMPORTANT: These env vars are ONLY for filtering which test scenarios to run.
 * The backend itself uses `examples/demo-nestjs/src/config/auth.config.ts`.
 * You must manually update `auth.config.ts` to match the backend config you want to test.
 *
 * The env vars tell the test runner: "I've configured the backend with these settings,
 * so only run scenarios that match those settings."
 *
 * @returns Current backend configuration (for test filtering only)
 */
export function getCurrentBackendConfig(): BackendConfig {
  // Read from env vars to filter scenarios
  // NOTE: Backend actual config comes from auth.config.ts, not these env vars!
  const verificationMethod = process.env.VERIFICATION_METHOD as BackendConfig['verificationMethod'];
  const mfaEnforcement = process.env.MFA_ENFORCEMENT as BackendConfig['mfaEnforcement'];

  return {
    verificationMethod: verificationMethod || 'none',
    mfaEnabled: process.env.MFA_ENABLED === 'true' || false,
    mfaEnforcement: mfaEnforcement || 'OPTIONAL',
  };
}
