# NAUTH E2E Testing Implementation Plan

## 0) Objectives & Scope

- Validate **real user journeys** end‑to‑end: signup → verification (email/phone) → MFA (TOTP/SMS/Passkey) → login → session mgmt → logout.
- Cover **enforcement modes**: OPTIONAL, REQUIRED, ADAPTIVE (incl. grace periods).
- Exercise **device trust**, **risk scoring**, **password reset**, **social login**, **rate‑limits/lockout**, **audit trail**.
- Run **deterministically in CI**: disposable DB/Redis, test email/SMS providers, artifacts on failure; no external dependencies.
- Test **NestJS sample-app** implementation (Express testing to be added after NestJS is perfected).

---

## 1) Architecture Overview

- **Runner**: **Playwright** for real browser automation (multi‑context, screenshots, video, trace).
- **API tests**: **Jest + Supertest** for fast backend challenge/state validation (complementing existing unit tests).
- **Infra**: **Docker Compose** for Postgres/MySQL, Redis, MailHog (email), plus test apps.
- **Fakes/Mocks**:
  - **Email** → MailHog SMTP/HTTP (intercept `NodemailerEmailProvider` or use test endpoint with `ConsoleEmailProvider`).
  - **SMS** → `TestSmsProvider` (extends `ConsoleSMSProvider`, persists codes to Redis/DB; expose test endpoint).
  - **TOTP** → RFC 6238-compatible TOTP generation in tests (app exposes secret via test endpoint in test mode only).
  - **WebAuthn/Passkey** → Playwright **virtual authenticator** (Chromium CDP).
  - **Social OAuth** → local mock issuer with static JWKs (for nightly), or use provider test tenants (Google/Apple/Facebook).
- **Control hooks** (test‑only): **Clock injection**, **Risk injection**, **Geo/IP override**, **Device trust endpoint**, **DB reset**.

**Why E2E (Playwright) in addition to unit tests?**

- Catches **cookies/session** issues, **redirect timing**, **CORS/CSRF**, UI wiring, browser storage, and **2FA UX** that unit tests can't see.
- Validates integration between `@nauth-toolkit/core` and `@nauth-toolkit/nestjs` adapter.
- Tests real HTTP flows matching `E2E_TEST_CASES.csv` scenarios.

---

## 2) App Changes (Test Mode)

### 2.1 Feature flags & guards

- Add `NAUTH_TEST_MODE=true` (or `NODE_ENV=test`) to enable all test helpers.
- **Never** include these in non-test builds. Gate via env flag in `sample-app`.

### 2.2 Providers (test implementations)

- **Email**:
  - Option A: Use `NodemailerEmailProvider` with MailHog SMTP (production-like).
  - Option B: Create `TestEmailProvider` that extends `ConsoleEmailProvider` and persists emails to Redis/DB with test endpoint.
- **SMS**: Create `TestSmsProvider` (extends `ConsoleSMSProvider` from `@nauth-toolkit/sms-console`) that persists `{ phone, code, createdAt }` to Redis/DB.
- **OAuth** (optional): Small local mock issuer exposing JWKS + predictable user profile (for nightly tests).

### 2.3 Control endpoints (only in test mode)

Add test routes to `sample-app`:

- `POST /test/reset` → Truncate nauth tables (allowlist), flush Redis storage adapter.
- `GET  /test/sms/latest?phone=...` → `{ code, createdAt }` from TestSmsProvider.
- `GET  /test/email/latest?email=...` → `{ code, link }` from MailHog or TestEmailProvider.
- `POST /test/clock/freeze { now }` & `POST /test/clock/advance { ms }` → Override time for grace period/expiry tests.
- `POST /test/risk/force { score }` → Force risk score for ADAPTIVE MFA tests (or accept `x-test-risk` header).
- `POST /test/device/trust { deviceId }` → Mark device as trusted (or mark current session trusted).
- `GET  /test/totp/secret?userId=...` → Expose TOTP secret for test verification (only in test mode).
- `GET  /test/user/:userId` → Get user state for assertions.

### 2.4 Test utilities

- **Clock service**: Inject mockable clock (replace direct `Date.now()` / `new Date()`).
- **Risk engine override**: Force risk buckets for ADAPTIVE MFA tests.
- **GeoIP stub**: Deterministic values for CI (override `GeoLocationService`).

---

## 3) Environments & Config

### 3.1 Test configuration files

**Root `.env.test`** (for Docker Compose):

```bash
# Database (supports both PostgreSQL and MySQL)
DB_TYPE=postgres
DB_HOST=db
DB_PORT=5432
DB_USERNAME=test
DB_PASSWORD=test
DB_DATABASE=nauth_test

# Redis (for storage adapter)
REDIS_URL=redis://redis:6379

# Email (MailHog for testing)
SMTP_HOST=mailhog
SMTP_PORT=1025
EMAIL_FROM=test@nauth.local

# SMS (test provider)
SMS_PROVIDER=test

# JWT
JWT_SECRET=test-jwt-secret-min-32-chars-required-for-hs256
JWT_REFRESH_SECRET=test-refresh-secret-different-from-jwt-secret

# Test mode
NAUTH_TEST_MODE=true
NODE_ENV=test
```

**`examples/sample-app/.env.test`** (NestJS app):

```bash
# Inherit from root .env.test, add NestJS-specific
PORT=3000
```

### 3.2 `docker-compose.test.yml` (root level)

```yaml
version: '3.9'
services:
  # PostgreSQL (primary test DB)
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: nauth_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - '5433:5432' # Avoid conflict with local Postgres
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U test']
      interval: 5s
      timeout: 5s
      retries: 5

  # MySQL (alternative test DB)
  mysql:
    image: mysql:8
    environment:
      MYSQL_DATABASE: nauth_test
      MYSQL_USER: test
      MYSQL_PASSWORD: test
      MYSQL_ROOT_PASSWORD: test
    ports:
      - '3307:3306' # Avoid conflict with local MySQL
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
      interval: 5s
      timeout: 5s
      retries: 5

  # Redis (for storage adapter)
  redis:
    image: redis:7-alpine
    ports:
      - '6380:6379' # Avoid conflict with local Redis
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

  # MailHog (email testing)
  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - '8025:8025' # Web UI
      - '1025:1025' # SMTP
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:8025']
      interval: 5s
      timeout: 3s
      retries: 5

  # NestJS sample app (optional - can run separately)
  sample-app:
    build:
      context: .
      dockerfile: examples/sample-app/Dockerfile.test
    command: yarn workspace sample-app start:test
    env_file: .env.test
    ports:
      - '3000:3000'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      mailhog:
        condition: service_healthy
    environment:
      DB_HOST: postgres
      REDIS_URL: redis://redis:6379
      SMTP_HOST: mailhog
```

---

## 4) Playwright Setup

### 4.1 `playwright.config.ts` (root level)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000, // 60s for E2E flows
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Test apps
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'sample-app',
      use: {
        baseURL: 'http://localhost:3000', // NestJS sample app
      },
    },
  ],
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
  ],
  webServer: [
    // Start sample-app (NestJS)
    {
      command: 'yarn workspace sample-app start:test',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NAUTH_TEST_MODE: 'true',
      },
    },
  ],
});
```

### 4.2 Fixtures (`tests/e2e/fixtures.ts`)

```typescript
import { test as base } from '@playwright/test';
import * as speakeasy from 'speakeasy';

type TestFixtures = {
  mail: { latestCode: (email: string) => Promise<string>; latestLink: (email: string) => Promise<string> };
  sms: { latestCode: (phone: string) => Promise<string> };
  testApi: { reset: () => Promise<void>; getTotpSecret: (userId: string) => Promise<string> };
};

export const test = base.extend<TestFixtures>({
  mail: async ({ baseURL }, use) => {
    await use({
      latestCode: async (email: string) => {
        // Fetch from MailHog API
        const r = await fetch('http://localhost:8025/api/v2/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'to', query: email }),
        });
        const j = await r.json();
        const body = j.items?.[0]?.Content?.Body ?? '';
        // Extract 6-digit code
        const match = body.match(/\b\d{6}\b/);
        return match?.[0] ?? '';
      },
      latestLink: async (email: string) => {
        const r = await fetch('http://localhost:8025/api/v2/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'to', query: email }),
        });
        const j = await r.json();
        const body = j.items?.[0]?.Content?.Body ?? '';
        // Extract verification link
        const match = body.match(/https?:\/\/[^\s]+/);
        return match?.[0] ?? '';
      },
    });
  },
  sms: async ({ baseURL }, use) => {
    await use({
      latestCode: async (phone: string) => {
        const r = await fetch(`${baseURL}/test/sms/latest?phone=${encodeURIComponent(phone)}`);
        const j = await r.json();
        return j.code || '';
      },
    });
  },
  testApi: async ({ baseURL }, use) => {
    await use({
      reset: async () => {
        await fetch(`${baseURL}/test/reset`, { method: 'POST' });
      },
      getTotpSecret: async (userId: string) => {
        const r = await fetch(`${baseURL}/test/totp/secret?userId=${userId}`);
        const j = await r.json();
        return j.secret;
      },
    });
  },
});

export const expect = test.expect;
export { speakeasy };
```

### 4.3 Example E2E (P0 journey)

```typescript
// tests/e2e/onboarding.spec.ts
import { test, expect, speakeasy } from './fixtures';

test.describe('Onboarding Flow', () => {
  test('SU-002: signup with email verification + TOTP setup + login', async ({ page, mail, testApi }) => {
    // Reset test state
    await testApi.reset();

    const email = `test+${Date.now()}@example.com`;
    const password = 'TestPass123!';

    // 1. Signup
    await page.goto('/auth/signup');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', password);
    await page.click('button[type=submit]');

    // 2. Verify email
    await expect(page.locator('text=Verification code')).toBeVisible();
    const code = await mail.latestCode(email);
    await page.fill('input[name=code]', code);
    await page.click('button:has-text("Verify")');

    // 3. Setup TOTP MFA
    await expect(page.locator('text=Setup MFA')).toBeVisible();
    // Get TOTP secret from test endpoint
    const userId = await page.evaluate(() => (window as any).__TEST_USER_ID__);
    const secret = await testApi.getTotpSecret(userId);
    const token = speakeasy.totp({ secret, encoding: 'base32' });
    await page.fill('input[name=totpCode]', token);
    await page.click('button:has-text("Complete Setup")');

    // 4. Should be logged in
    await expect(page).toHaveURL(/\/dashboard|\/home/);

    // 5. Logout
    await page.click('text=Logout');
    await expect(page).toHaveURL(/\/login|\/auth\/login/);

    // 6. Login with MFA
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', password);
    await page.click('button[type=submit]');

    // MFA challenge
    await expect(page.locator('text=Enter MFA code')).toBeVisible();
    const mfaToken = speakeasy.totp({ secret, encoding: 'base32' });
    await page.fill('input[name=mfaCode]', mfaToken);
    await page.click('button:has-text("Verify")');

    // Should be logged in
    await expect(page).toHaveURL(/\/dashboard|\/home/);
  });
});
```

### 4.4 WebAuthn/Passkey emulation

```typescript
// tests/e2e/mfa-passkey.spec.ts
import { test, expect } from './fixtures';

test('MFA Passkey setup and verification', async ({ page, testApi }) => {
  await testApi.reset();

  // Setup virtual authenticator
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'usb',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });

  // ... rest of test
});
```

---

## 5) API‑Level Tests (Fast, Complementary)

- Use **Jest + Supertest** for: challenge JSON/state transitions, token rotation/reuse detection, rate‑limits/lockout, audit logs, DTO validation.
- Test NestJS `sample-app` implementation.
- Seed with factories; run on every PR.
- Location: `tests/api/` (separate from unit tests in `packages/core/src/**/*.spec.ts`).

**Example structure:**

```
tests/
  api/
    auth.spec.ts          # Signup/login flows
    challenges.spec.ts    # Challenge completion
    mfa.spec.ts           # MFA setup/verification
    sessions.spec.ts      # Token refresh, logout
    social.spec.ts        # Social auth flows
    helpers/
      factories.ts       # User/session factories
      test-client.ts     # Supertest wrapper
```

---

## 6) Suite Strategy & Tagging

### 6.1 Priorities (mapped from `E2E_TEST_CASES.csv`)

- **P0 (per PR)**: ~20 core journeys covering:
  - Signup flows (SU-001 to SU-009): email/phone verification, MFA grace periods
  - Login flows (LG-001 to LG-011): standard login, MFA verification, trusted devices
  - Challenge completion (CF-001 to CF-010): email/phone verification, MFA setup/verification
  - Session management: refresh, logout, revoke all
- **P1 (nightly)**: Remaining E2E:
  - Adaptive MFA risk matrix (ADAPTIVE enforcement)
  - Grace period expiry scenarios
  - Social login variants (LG-012 to LG-015)
  - Device trust permutations
  - Account management (AM-001 to AM-008)
- **P2 (weekly)**: Extended scenarios:
  - WebAuthn/Passkey flows
  - Live social test tenants (Google/Apple/Facebook)
  - Long‑run rate‑limit/lockout/soak tests
  - Multi‑session scenarios

### 6.2 Map from `E2E_TEST_CASES.csv`

Update CSV with columns:

- `Priority (P0/P1/P2)`
- `Type (UI/API)` - UI = Playwright, API = Supertest
- `Mocks (email|sms|totp|webauthn|social)` - Required test infrastructure
- `Tag (signup|login|mfa|session|social|reset)` - Test grouping
- `Owner` - Team member responsible
- `Status (pending|implemented|automated|blocked)` - Implementation status

Implement P0 first; mark status as **implemented/automated**.

---

## 7) CI Pipeline (GitHub Actions)

```yaml
name: e2e-tests
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * *' # Nightly at 2 AM UTC

jobs:
  # Fast API tests (run on every PR)
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      - name: Build packages
        run: yarn build:all
      - name: Start test infrastructure
        run: docker compose -f docker-compose.test.yml up -d postgres redis mailhog
      - name: Wait for services
        run: |
          sleep 5
          docker compose -f docker-compose.test.yml ps
      - name: Run API tests
        run: yarn test:api
        env:
          DB_HOST: localhost
          DB_PORT: 5433
          REDIS_URL: redis://localhost:6380
          SMTP_HOST: localhost
          SMTP_PORT: 1025
          NAUTH_TEST_MODE: 'true'

  # E2E tests - P0 (run on every PR)
  e2e-p0:
    runs-on: ubuntu-latest
    needs: api-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      - name: Build packages
        run: yarn build:all
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      - name: Start test infrastructure
        run: docker compose -f docker-compose.test.yml up -d
      - name: Wait for services
        run: |
          sleep 10
          docker compose -f docker-compose.test.yml ps
      - name: Run E2E P0 tests
        run: yarn test:e2e:p0
        env:
          DB_HOST: localhost
          DB_PORT: 5433
          REDIS_URL: redis://localhost:6380
          SMTP_HOST: localhost
          SMTP_PORT: 1025
          NAUTH_TEST_MODE: 'true'
      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-p0
          path: playwright-report/**

  # E2E tests - Full suite (nightly)
  e2e-full:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      - name: Build packages
        run: yarn build:all
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      - name: Start test infrastructure
        run: docker compose -f docker-compose.test.yml up -d
      - name: Wait for services
        run: sleep 10
      - name: Run full E2E suite
        run: yarn test:e2e:all
        env:
          DB_HOST: localhost
          DB_PORT: 5433
          REDIS_URL: redis://localhost:6380
          SMTP_HOST: localhost
          SMTP_PORT: 1025
          NAUTH_TEST_MODE: 'true'
      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-full
          path: playwright-report/**
```

---

## 8) Package Scripts

**Root `package.json`:**

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:p0": "playwright test --grep @p0",
    "test:e2e:all": "playwright test --grep-invert @skip-ci",
    "test:api": "jest --config jest.e2e.api.config.js",
    "test:api:watch": "jest --config jest.e2e.api.config.js --watch"
  }
}
```

**`examples/sample-app/package.json`:**

```json
{
  "scripts": {
    "start:test": "NODE_ENV=test NAUTH_TEST_MODE=true nest start --watch"
  }
}
```

---

## 9) Folder Structure

```
nauth-toolkit/
├── tests/                          # E2E and API tests
│   ├── e2e/                        # Playwright E2E tests
│   │   ├── onboarding.spec.ts      # @p0 - Signup flows
│   │   ├── login.spec.ts           # @p0 - Login flows
│   │   ├── mfa.spec.ts             # @p0 - MFA setup/verification
│   │   ├── sessions.spec.ts        # @p0 - Session management
│   │   ├── social.spec.ts          # @p1 - Social auth
│   │   ├── adaptive.spec.ts        # @p1 - Adaptive MFA
│   │   ├── webauthn.spec.ts        # @p2 - Passkey/WebAuthn
│   │   └── fixtures.ts             # Playwright fixtures
│   ├── api/                        # Jest + Supertest API tests
│   │   ├── auth.spec.ts            # Auth flows
│   │   ├── challenges.spec.ts      # Challenge completion
│   │   ├── mfa.spec.ts             # MFA API
│   │   ├── sessions.spec.ts        # Session API
│   │   ├── social.spec.ts          # Social auth API
│   │   └── helpers/
│   │       ├── factories.ts        # Test data factories
│   │       └── test-client.ts      # Supertest wrapper
│   └── helpers/                    # Shared test utilities
│       ├── email-client.ts            # MailHog client
│       ├── sms-client.ts            # TestSmsProvider client
│       └── oauth-mock.ts            # OAuth mock server
├── docker-compose.test.yml         # Test infrastructure
├── .env.test                       # Test environment variables
├── playwright.config.ts            # Playwright configuration
└── jest.e2e.api.config.js          # Jest config for API tests
```

---

## 10) Acceptance Criteria (per phase)

### Phase A: Test Mode + Infra

- Test endpoints gated by `NAUTH_TEST_MODE`.
- MailHog + TestSmsProvider integrated.
- `/test/reset` wipes DB; Redis flushed.
- Clock and risk injection working.
- CI brings stack up via Compose.

### Phase B: Playwright Bootstrap

- Base config + fixtures + artifacts.
- One full P0 journey green (signup → verify → MFA → login).
- HTML report available as CI artifact.

### Phase C: P0 Coverage Complete

- ~20 P0 journeys automated and passing.
- API tests cover token lifecycle, audit trail, rate‑limit/lockout.

### Phase D: P1/P2 Expansion

- Nightly covers ADAPTIVE, social, WebAuthn.
- Flakiness < 1% over rolling 10 runs.

---

## 11) Flakiness & Maintenance

- Use stable `data-test` selectors; avoid brittle CSS/XPath.
- Prefer `await expect(...).toHaveURL()` / `toBeVisible()` with sensible timeouts.
- Quarantine with `@flaky`; fix before re‑enable.
- Keep mocks deterministic; never call real externals in CI.

---

## 12) Security & Isolation

- Test endpoints/secret exposure **never** ship in prod builds.
- Use separate test secrets/keys; rotate if CI compromised.
- Compose network private; only expose what tests need.

---

## 13) Next Actions (Checklist)

### Phase A: Test Infrastructure

- [ ] Create `TestSmsProvider` (extends `ConsoleSMSProvider`, persists to Redis/DB).
- [ ] Add test endpoints to `sample-app`:
  - [ ] `POST /test/reset` - Reset test state
  - [ ] `GET /test/sms/latest?phone=...` - Get SMS code
  - [ ] `GET /test/email/latest?email=...` - Get email code/link
  - [ ] `GET /test/totp/secret?userId=...` - Get TOTP secret
  - [ ] `POST /test/clock/freeze` - Freeze time
  - [ ] `POST /test/clock/advance` - Advance time
  - [ ] `POST /test/risk/force` - Force risk score
  - [ ] `POST /test/device/trust` - Trust device
- [ ] Guard all test endpoints with `NAUTH_TEST_MODE` check.
- [ ] Create `docker-compose.test.yml` with Postgres, MySQL, Redis, MailHog.
- [ ] Create `.env.test` configuration file.

### Phase B: Playwright Setup

- [ ] Add Playwright dependencies to root `package.json`.
- [ ] Create `playwright.config.ts` for NestJS sample-app testing.
- [ ] Create `tests/e2e/fixtures.ts` with mail, SMS, and test API fixtures.
- [ ] Implement first P0 test (signup → email verification → login).
- [ ] Verify Playwright report generation.

### Phase C: API Tests

- [ ] Create `jest.e2e.api.config.js` for API tests.
- [ ] Create `tests/api/` structure with Supertest tests.
- [ ] Implement test factories for users, sessions, challenges.
- [ ] Add API tests for core flows (signup, login, challenges).

### Phase D: E2E Coverage

- [ ] Tag `E2E_TEST_CASES.csv` with Priority/Type/Mocks/Owner/Status.
- [ ] Implement P0 E2E tests (~20 core journeys).
- [ ] Implement P1 E2E tests (adaptive, social, device trust).
- [ ] Implement P2 E2E tests (WebAuthn, extended scenarios).

### Phase E: CI Integration

- [ ] Create GitHub Actions workflow (`.github/workflows/e2e.yml`).
- [ ] Configure P0 tests to run on every PR.
- [ ] Configure nightly full suite.
- [ ] Set up artifact uploads for failures.
