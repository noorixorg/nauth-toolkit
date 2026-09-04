import { test, expect, type Page } from '@playwright/test';
import { LOGIN_PATH } from '../../oidc-helpers';

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
 * The nauth session is established through the API rather than by typing into the login
 * form. That is deliberate: the demo runs reCAPTCHA Enterprise, which serves an image
 * challenge to an automated browser and blocks the form outright. The session gate and
 * the anonymous login detour are covered by `authorization-code-flow.spec.ts`; what only
 * a browser can prove is what this suite keeps — that a certified client library, in a
 * real page, completes the flow against this provider.
 *
 * `page.request` shares the page's cookie jar, so the session it establishes is the one
 * the browser then carries into the authorization request.
 *
 * Needs the backend and the Angular app both running, and the seeded account:
 *   pnpm seed:oidc-e2e && pnpm test:e2e:oidc
 */
const FRONTEND = process.env.TEST_FRONTEND_URL ?? 'http://localhost:4200';

const ACCOUNT = {
  email: process.env.OIDC_E2E_EMAIL ?? 'oidc-e2e@example.com',
  password: process.env.OIDC_E2E_PASSWORD ?? 'OidcE2E!Passw0rd',
};

/**
 * Sign the simulated third-party application in, end to end.
 *
 * Each test gets its own browser context, so this runs per test rather than leaning on
 * state left behind by an earlier one.
 *
 * @param page - The test's page
 */
async function signInThroughProvider(page: Page): Promise<void> {
  const login = await page.request.post(`${FRONTEND}${LOGIN_PATH}`, {
    data: { identifier: ACCOUNT.email, password: ACCOUNT.password },
  });
  expect(login.status(), 'Seed the account first: run `pnpm seed:oidc-e2e`').toBe(200);
  expect(
    ((await login.json()) as { challengeName?: string }).challengeName,
    'Seeded account should not present a challenge',
  ).toBeUndefined();

  await page.goto(`${FRONTEND}/rp`);

  // The simulated application holds no session of its own yet.
  await expect(page.getByTestId('rp-signin')).toBeVisible();
  await page.getByTestId('rp-signin').click();

  // The redirect chain runs through the provider and lands on either the consent screen
  // or straight back at the client. Wait for it to settle before looking for anything:
  // checking too early finds neither.
  await page.waitForURL(/\/interaction\/|\/rp/, { timeout: 30_000 });

  // Consent, if the provider asks for it. A remembered grant skips this.
  //
  // `waitFor`, not `isVisible`: the latter answers immediately rather than retrying, so
  // it reports false while the consent component is still fetching the interaction, and
  // the run then sits on a screen it never pressed a button on.
  const allow = page.getByRole('button', { name: /^allow$/i });
  const consentShown = await allow
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (consentShown) {
    await allow.click();
  }

  // Back at the third-party app, with the code exchanged and the id_token verified by
  // the client library rather than by us.
  await page.waitForURL(/\/rp/, { timeout: 30_000 });
  await expect(page.getByTestId('rp-claims')).toBeVisible({ timeout: 20_000 });
}

test.describe('OIDC Provider: a certified client in the browser', () => {
  test.beforeAll(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'oidc', 'Runs in the dedicated `oidc` project');
  });

  test('a third-party app signs a user in and receives verified claims', async ({ page }) => {
    test.slow();

    await signInThroughProvider(page);

    const decoded = JSON.parse((await page.getByTestId('rp-claims').textContent()) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(decoded.sub).toBeTruthy();
    expect(decoded.email).toBe(ACCOUNT.email);

    // The subject must be nauth's external identifier, never an internal row id.
    expect(String(decoded.sub)).not.toMatch(/^\d+$/);

    await expect(page.getByTestId('rp-token')).not.toBeEmpty();
  });

  test('the refresh token works from the third-party app', async ({ page }) => {
    test.slow();

    await signInThroughProvider(page);

    const before = await page.getByTestId('rp-token').textContent();
    await page.getByRole('button', { name: /refresh token/i }).click();

    await expect
      .poll(async () => page.getByTestId('rp-token').textContent(), { timeout: 20_000 })
      .not.toBe(before);
  });
});
