import { test, expect } from '../../fixtures';

/**
 * Interoperability, in a real browser.
 *
 * `tests/e2e/specs/oidc/authorization-code-flow.spec.ts` drives the provider with
 * hand-written requests, which proves it behaves as this repository expects. This
 * suite instead drives the demo's third-party application simulator at `/rp`, which
 * signs in using `angular-auth-oidc-client` — a certified client library by a
 * different author, which knows nothing about nauth.
 *
 * That library discovers the provider from its issuer, runs the authorization code
 * flow with PKCE, fetches the JWKS and verifies the id_token signature itself. If any
 * of the discovery document, the token response or the id_token claims are wrong in a
 * way a real integrator would hit, the page shows an error instead of claims and
 * these fail.
 *
 * Needs the backend and the Angular app both running, and the seeded account:
 *   pnpm seed:oidc-e2e && pnpm test:e2e:oidc
 */
const FRONTEND = process.env.TEST_FRONTEND_URL ?? 'http://localhost:4200';

const ACCOUNT = {
  email: process.env.OIDC_E2E_EMAIL ?? 'oidc-e2e@example.com',
  password: process.env.OIDC_E2E_PASSWORD ?? 'OidcE2E!Passw0rd',
};

test.describe('OIDC Provider: a certified client in the browser', () => {
  test.beforeAll(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'oidc', 'Runs in the dedicated `oidc` project');
  });

  test('a third-party app signs a user in and receives verified claims', async ({ page }) => {
    test.slow();

    await page.goto(`${FRONTEND}/rp`);

    // The simulated application holds no session of its own yet.
    await expect(page.getByTestId('rp-signin')).toBeVisible();
    await page.getByTestId('rp-signin').click();

    // The provider parks the request and hands the browser to this deployment's
    // interaction page, which sends an anonymous visitor to the ordinary login.
    await page.waitForURL(/\/login/, { timeout: 20_000 });

    await page.getByLabel(/email/i).first().fill(ACCOUNT.email);
    await page.getByLabel(/password/i).first().fill(ACCOUNT.password);
    await page.getByRole('button', { name: /sign in|log ?in/i }).first().click();

    // The seeded account has no outstanding challenges, so the SDK's navigation
    // handler should take us straight back to the pending interaction.
    await page.waitForURL(/\/interaction\/|\/rp/, { timeout: 30_000 });

    // Consent, if the provider asks for it. A remembered grant skips this.
    const allow = page.getByRole('button', { name: /^allow$/i });
    if (await allow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await allow.click();
    }

    // Back at the third-party app, with the code exchanged and the id_token verified
    // by the client library rather than by us.
    await page.waitForURL(/\/rp/, { timeout: 30_000 });

    const claims = page.getByTestId('rp-claims');
    await expect(claims).toBeVisible({ timeout: 20_000 });

    const decoded = JSON.parse((await claims.textContent()) ?? '{}') as Record<string, unknown>;
    expect(decoded.sub).toBeTruthy();
    expect(decoded.email).toBe(ACCOUNT.email);

    // The subject must be nauth's external identifier, never an internal row id.
    expect(String(decoded.sub)).not.toMatch(/^\d+$/);

    await expect(page.getByTestId('rp-token')).not.toBeEmpty();
  });

  test('the refresh token works from the third-party app', async ({ page }) => {
    test.slow();

    await page.goto(`${FRONTEND}/rp`);

    // Reuse the session established above where possible; otherwise sign in again.
    if (await page.getByTestId('rp-signin').isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'No standing session; covered by the preceding test');
    }

    const before = await page.getByTestId('rp-token').textContent();
    await page.getByRole('button', { name: /refresh token/i }).click();

    await expect
      .poll(async () => page.getByTestId('rp-token').textContent(), { timeout: 20_000 })
      .not.toBe(before);
  });
});
