#!/usr/bin/env node
/**
 * Seed the account the OIDC end-to-end suite signs in with.
 *
 * The suite needs a deterministic, fully verified user with no MFA so it can focus on
 * the OpenID Connect flow rather than re-walking the signup and challenge chain, which
 * has its own suite. Running this repeatedly is safe: an existing account is reset to
 * a known-good state rather than duplicated.
 *
 * The account is marked `mfaExempt`, which is what keeps it deterministic: the demo
 * runs ADAPTIVE enforcement, so without the exemption a login would sometimes return
 * MFA_SETUP_REQUIRED depending on the risk score, and the suite would fail for reasons
 * that have nothing to do with the provider.
 *
 * Reads the same DB_* variables as examples/demo-nestjs.
 *
 *   node scripts/seed-oidc-e2e-user.js
 *   OIDC_E2E_EMAIL=me@example.com OIDC_E2E_PASSWORD='…' node scripts/seed-oidc-e2e-user.js
 */
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Read the demo's environment, but resolve packages normally: the workspace hoists
// them to the repository root.
require('dotenv').config({ path: path.join(__dirname, '..', 'examples', 'demo-nestjs', '.env') });

const argon2 = require('argon2');
const { Client } = require('pg');

const EMAIL = process.env.OIDC_E2E_EMAIL || 'oidc-e2e@example.com';
const PASSWORD = process.env.OIDC_E2E_PASSWORD || 'OidcE2E!Passw0rd';
const PHONE = process.env.OIDC_E2E_PHONE || '+15550100200';

async function main() {
  // Matches PasswordService's DEFAULT_ARGON2_CONFIG, so the demo can verify it.
  const passwordHash = await argon2.hash(PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
  });

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  await client.connect();
  try {
    const existing = await client.query('SELECT id, sub FROM nauth_users WHERE email = $1', [EMAIL]);

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE nauth_users SET
           "passwordHash" = $1, "isEmailVerified" = true, "isPhoneVerified" = true,
           "isActive" = true, "isLocked" = false, "mustChangePassword" = false,
           "mfaEnabled" = false, "mfaExempt" = true, "failedLoginAttempts" = 0, "lockedUntil" = NULL
         WHERE email = $2`,
        [passwordHash, EMAIL],
      );
      report('reset', existing.rows[0].id, existing.rows[0].sub);
      return;
    }

    const created = await client.query(
      `INSERT INTO nauth_users
         (sub, email, phone, "firstName", "lastName", "passwordHash",
          "isEmailVerified", "isPhoneVerified", "isActive", "isLocked",
          "mustChangePassword", "mfaEnabled", "failedLoginAttempts", "hasSocialAuth", "mfaExempt")
       VALUES ($1, $2, $3, 'Ada', 'Lovelace', $4, true, true, true, false, false, false, 0, false, true)
       RETURNING id, sub`,
      [randomUUID(), EMAIL, PHONE, passwordHash],
    );
    report('created', created.rows[0].id, created.rows[0].sub);
  } finally {
    await client.end();
  }
}

function report(action, id, sub) {
  console.log(`OIDC e2e account ${action}`);
  console.log(`  email : ${EMAIL}`);
  console.log(`  pass  : ${PASSWORD}`);
  console.log(`  id    : ${id}`);
  console.log(`  sub   : ${sub}`);
}

main().catch((error) => {
  console.error(`Failed to seed the OIDC e2e account: ${error.message}`);
  process.exit(1);
});
