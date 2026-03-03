#!/usr/bin/env node
/**
 * Submit nauth.dev docs URLs to IndexNow in batches of 50.
 * Excludes: /docs/api/* (API reference), frontend-sdk/api/* (SDK API reference), and DTOs.
 *
 * Usage: node scripts/indexnow-submit.js
 * Requires: key file at static/13bf1d39da324faaa38d4d643c6fecd6.txt
 */

const INDEXNOW_URL = 'https://api.indexnow.org/IndexNow';
const HOST = 'nauth.dev';
const KEY = '13bf1d39da324faaa38d4d643c6fecd6';
const KEY_LOCATION = 'https://nauth.dev/13bf1d39da324faaa38d4d643c6fecd6.txt';
const BATCH_SIZE = 50;

/** All useful docs URLs to index (no API reference, no DTOs). */
const URL_LIST = [
  'https://nauth.dev/',
  'https://nauth.dev/docs/intro',
  'https://nauth.dev/docs/quick-start/nestjs',
  'https://nauth.dev/docs/quick-start/express',
  'https://nauth.dev/docs/quick-start/fastify',
  'https://nauth.dev/docs/quick-start/angular',
  'https://nauth.dev/docs/quick-start/react',
  'https://nauth.dev/docs/concepts/how-it-works',
  'https://nauth.dev/docs/concepts/configuration',
  'https://nauth.dev/docs/concepts/challenge-system',
  'https://nauth.dev/docs/concepts/token-management',
  'https://nauth.dev/docs/concepts/storage',
  'https://nauth.dev/docs/concepts/error-handling',
  'https://nauth.dev/docs/concepts/notifications',
  'https://nauth.dev/docs/concepts/lifecycle-hooks',
  'https://nauth.dev/docs/concepts/audit-logs',
  'https://nauth.dev/docs/concepts/rate-limiting',
  'https://nauth.dev/docs/guides/basic-auth',
  'https://nauth.dev/docs/guides/admin-operations',
  'https://nauth.dev/docs/guides/email-sms-providers',
  'https://nauth.dev/docs/guides/email-templates',
  'https://nauth.dev/docs/guides/sms-templates',
  'https://nauth.dev/docs/guides/lifecycle-hooks',
  'https://nauth.dev/docs/guides/geolocation',
  'https://nauth.dev/docs/guides/audit-logs',
  'https://nauth.dev/docs/guides/rate-limiting',
  'https://nauth.dev/docs/guides/recaptcha',
  'https://nauth.dev/docs/guides/openapi-dto-schemas',
  'https://nauth.dev/docs/guides/routes',
  'https://nauth.dev/docs/guides/mfa/how-mfa-works',
  'https://nauth.dev/docs/guides/mfa/email',
  'https://nauth.dev/docs/guides/mfa/sms',
  'https://nauth.dev/docs/guides/mfa/totp',
  'https://nauth.dev/docs/guides/mfa/passkey',
  'https://nauth.dev/docs/guides/social/how-social-login-works',
  'https://nauth.dev/docs/guides/social/google',
  'https://nauth.dev/docs/guides/social/apple',
  'https://nauth.dev/docs/guides/social/facebook',
  'https://nauth.dev/docs/frontend-sdk/overview',
  'https://nauth.dev/docs/frontend-sdk/guides/getting-started',
  'https://nauth.dev/docs/frontend-sdk/guides/challenge-handling',
  'https://nauth.dev/docs/frontend-sdk/guides/mfa-setup',
  'https://nauth.dev/docs/frontend-sdk/guides/social-auth',
  'https://nauth.dev/docs/frontend-sdk/guides/authentication-events',
  'https://nauth.dev/docs/frontend-sdk/guides/error-handling',
  'https://nauth.dev/docs/frontend-sdk/concepts/configuration',
  'https://nauth.dev/docs/frontend-sdk/concepts/token-management',
  'https://nauth.dev/docs/frontend-sdk/angular/standalone-setup',
  'https://nauth.dev/docs/frontend-sdk/angular/ngmodule-setup',
  'https://nauth.dev/docs/frontend-sdk/angular/auth-service',
  'https://nauth.dev/docs/frontend-sdk/angular/guards',
  'https://nauth.dev/docs/frontend-sdk/angular/interceptor',
  'https://nauth.dev/docs/frontend-sdk/angular/oauth-callback-guard',
  'https://nauth.dev/docs/frontend-sdk/react/setup',
  'https://nauth.dev/docs/frontend-sdk/react/protected-routes',
  'https://nauth.dev/docs/frontend-sdk/react/oauth-callback',
  'https://nauth.dev/docs/frontend-sdk/mobile/capacitor-setup',
  'https://nauth.dev/docs/frontend-sdk/mobile/native-social',
];

async function submitBatch(urlList) {
  const body = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  };
  const res = await fetch(INDEXNOW_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  return { status: res.status, ok: res.ok, statusText: res.statusText };
}

async function main() {
  const total = URL_LIST.length;
  console.log(`Submitting ${total} URLs to IndexNow in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < URL_LIST.length; i += BATCH_SIZE) {
    const batch = URL_LIST.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const result = await submitBatch(batch);
    if (result.ok) {
      console.log(`Batch ${batchNum}: ${batch.length} URLs submitted (HTTP ${result.status})`);
    } else {
      console.error(`Batch ${batchNum}: failed HTTP ${result.status} ${result.statusText}`);
      process.exitCode = 1;
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
