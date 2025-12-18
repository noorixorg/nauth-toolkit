#!/usr/bin/env node

/**
 * Helper script to run Playwright scenarios with proper configuration
 * Usage: node run-scenario.js <scenario-id> [--headed] [--ui] [--slow-mo=1000] [--grep="pattern"]
 * Note: Supports both --slowmo= and --slow-mo= formats
 */

const { spawn } = require('child_process');
const path = require('path');

// Scenario configurations
const SCENARIO_CONFIGS = {
  'signup-basic': { verificationMethod: 'none', mfaEnabled: false, mfaEnforcement: 'OPTIONAL' },
  'signup-email-verification': {
    verificationMethod: 'email',
    mfaEnabled: false,
    mfaEnforcement: 'OPTIONAL',
  },
  'signup-phone-verification': {
    verificationMethod: 'phone',
    mfaEnabled: false,
    mfaEnforcement: 'OPTIONAL',
  },
  'signup-both-verification': {
    verificationMethod: 'both',
    mfaEnabled: false,
    mfaEnforcement: 'OPTIONAL',
  },
  'signup-mfa-required-sms': {
    verificationMethod: 'none',
    mfaEnabled: true,
    mfaEnforcement: 'REQUIRED',
  },
  'signup-mfa-required-totp': {
    verificationMethod: 'none',
    mfaEnabled: true,
    mfaEnforcement: 'REQUIRED',
  },
  'signup-mfa-optional-totp': {
    verificationMethod: 'none',
    mfaEnabled: true,
    mfaEnforcement: 'OPTIONAL',
  },
  'login-basic': { verificationMethod: 'none', mfaEnabled: false, mfaEnforcement: 'OPTIONAL' },
  'login-mfa-required-totp': {
    verificationMethod: 'none',
    mfaEnabled: true,
    mfaEnforcement: 'REQUIRED',
  },
};

// Parse arguments
const args = process.argv.slice(2);
const scenarioId = args.find((arg) => !arg.startsWith('--'));
const headed = args.includes('--headed');
const ui = args.includes('--ui');
// Support both --slowmo= and --slow-mo= formats
const slowmoArg = args.find((arg) => arg.startsWith('--slowmo=') || arg.startsWith('--slow-mo='));
const slowmo = slowmoArg ? slowmoArg.split('=')[1] : null;
const grepArg = args.find((arg) => arg.startsWith('--grep='));
const grep = grepArg ? grepArg.split('=')[1].replace(/^["']|["']$/g, '') : null;

if (!scenarioId && !grep) {
  console.error(
    'Usage: node run-scenario.js <scenario-id> [--headed] [--ui] [--slow-mo=1000] [--grep="pattern"]',
  );
  console.error('\nAvailable scenarios:');
  Object.keys(SCENARIO_CONFIGS).forEach((key) => console.error(`  - ${key}`));
  process.exit(1);
}

// Build environment variables
const env = { ...process.env };
// Default to SLOWMO=1000 when --headed is used (for better observation)
// Can be overridden with --slow-mo=<value> or SLOWMO env var
if (slowmo) {
  // Explicit --slow-mo= flag takes precedence
  env.SLOWMO = slowmo;
} else if (!env.SLOWMO && (headed || ui)) {
  // Default slow motion when running in headed/UI mode for better visibility
  // Only set if SLOWMO is not already set in environment
  env.SLOWMO = '1000';
}

if (grep) {
  // If using grep, don't set scenario-specific env vars
  console.log(`Running with grep pattern: ${grep}`);
} else if (scenarioId) {
  const config = SCENARIO_CONFIGS[scenarioId];
  if (!config) {
    console.error(`Unknown scenario: ${scenarioId}`);
    console.error('Available scenarios:', Object.keys(SCENARIO_CONFIGS).join(', '));
    process.exit(1);
  }

  env.VERIFICATION_METHOD = config.verificationMethod;
  env.MFA_ENABLED = config.mfaEnabled.toString();
  env.MFA_ENFORCEMENT = config.mfaEnforcement;

  console.log(`Running scenario: ${scenarioId}`);
  console.log(`Config:`, config);
}

// Build Playwright command
const playwrightArgs = ['test'];
if (grep) {
  playwrightArgs.push('--grep', grep);
} else if (scenarioId) {
  playwrightArgs.push('--grep', scenarioId);
}

if (headed) {
  playwrightArgs.push('--headed');
}

if (ui) {
  playwrightArgs.push('--ui');
}

// Note: slowMo is passed via SLOWMO environment variable, not as CLI option
// Playwright doesn't support --slow-mo as a CLI flag, only in config

// Change to e2e directory and run
const cwd = __dirname;
const cmd = 'npx';
const cmdArgs = ['playwright', ...playwrightArgs];

console.log(`\nCommand: ${cmd} ${cmdArgs.join(' ')}`);
console.log(
  `Environment: VERIFICATION_METHOD=${env.VERIFICATION_METHOD || 'N/A'}, MFA_ENABLED=${env.MFA_ENABLED || 'N/A'}${env.SLOWMO ? `, SLOWMO=${env.SLOWMO}` : ''}\n`,
);

const child = spawn(cmd, cmdArgs, {
  cwd,
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
