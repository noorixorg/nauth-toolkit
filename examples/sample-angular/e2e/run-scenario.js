#!/usr/bin/env node

/**
 * Helper script to run Playwright scenarios with proper configuration
 * Usage: node run-scenario.js <scenario-id> [--headed] [--ui] [--slowmo=1000] [--grep="pattern"]
 */

const { spawn } = require('child_process');
const path = require('path');

// Scenario configurations
const SCENARIO_CONFIGS = {
  'signup-basic': { verificationMethod: 'none', mfaEnabled: false, mfaEnforcement: 'OPTIONAL' },
  'signup-email-verification': { verificationMethod: 'email', mfaEnabled: false, mfaEnforcement: 'OPTIONAL' },
  'signup-phone-verification': { verificationMethod: 'phone', mfaEnabled: false, mfaEnforcement: 'OPTIONAL' },
  'signup-both-verification': { verificationMethod: 'both', mfaEnabled: false, mfaEnforcement: 'OPTIONAL' },
  'signup-mfa-required-sms': { verificationMethod: 'none', mfaEnabled: true, mfaEnforcement: 'REQUIRED' },
  'signup-mfa-required-totp': { verificationMethod: 'none', mfaEnabled: true, mfaEnforcement: 'REQUIRED' },
  'signup-mfa-optional-totp': { verificationMethod: 'none', mfaEnabled: true, mfaEnforcement: 'OPTIONAL' },
  'login-basic': { verificationMethod: 'none', mfaEnabled: false, mfaEnforcement: 'OPTIONAL' },
  'login-mfa-required-totp': { verificationMethod: 'none', mfaEnabled: true, mfaEnforcement: 'REQUIRED' },
};

// Parse arguments
const args = process.argv.slice(2);
const scenarioId = args.find(arg => !arg.startsWith('--'));
const headed = args.includes('--headed');
const ui = args.includes('--ui');
const slowmoArg = args.find(arg => arg.startsWith('--slowmo='));
const slowmo = slowmoArg ? slowmoArg.split('=')[1] : '1000';
const grepArg = args.find(arg => arg.startsWith('--grep='));
const grep = grepArg ? grepArg.split('=')[1].replace(/^["']|["']$/g, '') : null;

if (!scenarioId && !grep) {
  console.error('Usage: node run-scenario.js <scenario-id> [--headed] [--ui] [--slowmo=1000] [--grep="pattern"]');
  console.error('\nAvailable scenarios:');
  Object.keys(SCENARIO_CONFIGS).forEach(key => console.error(`  - ${key}`));
  process.exit(1);
}

// Build environment variables
const env = { ...process.env, SLOWMO: slowmo };

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

// Change to e2e directory and run
const cwd = __dirname;
const cmd = 'npx';
const cmdArgs = ['playwright', ...playwrightArgs];

console.log(`\nCommand: ${cmd} ${cmdArgs.join(' ')}`);
console.log(`Environment: VERIFICATION_METHOD=${env.VERIFICATION_METHOD || 'N/A'}, MFA_ENABLED=${env.MFA_ENABLED || 'N/A'}, SLOWMO=${slowmo}\n`);

const child = spawn(cmd, cmdArgs, {
  cwd,
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
