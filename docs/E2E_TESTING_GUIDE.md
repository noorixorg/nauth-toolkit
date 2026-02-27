# E2E Testing Guide

Complete guide to the Playwright E2E testing system for nauth-toolkit.

## Overview

**Playwright API testing** for comprehensive end-to-end authentication flows.

- **Test execution**: Playwright API tests (direct HTTP requests, no browser needed)
- **Parameterized testing**: Tests run across multiple configurations (token delivery modes, verification methods, MFA enforcement)
- **Test mode endpoints**: Special endpoints enabled when `NAUTH_TEST_MODE=true` for retrieving test data from database
- **Flow state management**: Shared state across serial tests for complete authentication lifecycles

## Quick Start

```bash
# WARNING: IMPORTANT: Run all commands from the PROJECT ROOT directory
cd /path/to/nauth-toolkit

# 1. Install dependencies
yarn install

# 2. Ensure your sample-app is running with NAUTH_TEST_MODE=true
# The app should be accessible at the URL specified in TEST_BASE_URL
# (default: https://api.angular.dev1.noorix.com)

# 3. Run all tests
npx playwright test --project json
npx playwright test --project cookies

# 4. Run specific test file
npx playwright test current-config --project json

# 5. View HTML report
npx playwright show-report
```

**Note**: The `playwright.config.ts` is in the root directory and expects tests in `./tests/e2e/`. If you run from any other directory, Playwright won't find the projects or tests.

## Prerequisites

### Running the Sample App

The tests require the sample-app to be running with test mode enabled:

1. **Set environment variable**: `NAUTH_TEST_MODE=true`
2. **Start the app**: Run your sample-app (e.g., `yarn workspace sample-app start:dev`)
3. **Verify accessibility**: The app should be accessible at the URL specified in `TEST_BASE_URL` (or default remote URL)

**Note**: Tests connect to the API via HTTP - no Docker, MailHog, or other infrastructure is required. The app just needs to be running with test mode enabled.

## Architecture

### Playwright Projects

Two Playwright projects are configured to test different token delivery modes:

1. **`json` project**: Tests JSON token delivery (mobile/API clients)
   - Uses `/mobile` endpoints: `/auth/signup/mobile`, `/auth/login/mobile`, `/auth/refresh/mobile`
   - Tokens returned in JSON response body
   - Origin header: `http://localhost` (simulates Capacitor/mobile app)

2. **`cookies` project**: Tests cookie-based token delivery (web browsers)
   - Uses regular endpoints: `/auth/signup`, `/auth/login`, `/auth/refresh`
   - Tokens returned in Set-Cookie headers
   - Origin header: Frontend URL (from `TEST_FRONTEND_URL` env var or default)

### Test Configuration Matrix

Tests are parameterized using `tests/e2e/config-matrix.ts` which defines combinations of:

- **Token delivery**: `cookies` | `json`
- **Verification method**: `none` | `email` | `phone` | `both`
- **MFA enforcement**: `OPTIONAL` | `REQUIRED` | `ADAPTIVE`
- **MFA grace period**: Number of days (typically `0` or `7`)

Each configuration generates separate test runs, ensuring comprehensive coverage across all combinations.

## Test Fixtures

### Flow State (`flowState`)

Persists authentication state across serial tests in the same file:

```typescript
type AuthFlowState = {
  userEmail: string; // Auto-generated unique email
  userPhone?: string; // Auto-generated unique phone (E.164 format)
  password: string; // Fixed: 'SecurePass123!'
  userId?: string; // Set after signup
  accessToken?: string; // Set after successful auth (JSON mode)
  refreshToken?: string; // Set after successful auth (JSON mode)
  deviceToken?: string; // Set after successful auth
  challengeSession?: string; // Set when challenge is required
  challengeName?: string; // e.g., 'VERIFY_EMAIL', 'VERIFY_PHONE', 'MFA_REQUIRED'
  mfaSecret?: string; // TOTP secret after MFA setup
};
```

**Key features**:

- State is shared across serial tests in the same file (e.g., "Signup Flow" and "Login Lifecycle")
- Each test file + config + worker gets its own isolated state
- Email and phone are auto-generated with timestamps to avoid conflicts

### IP Address (`ipAddress`)

Simulates client IP addresses for rate limiting and adaptive MFA testing:

```typescript
type IPFixture = {
  current: string; // Current IP (auto-generated per test)
  setIP: (ip: string) => void; // Manually set IP
  reset: () => void; // Reset to auto-generated IP
};
```

**Usage**:

```typescript
test('Change IP for adaptive MFA', async ({ ipAddress, flows }) => {
  ipAddress.setIP('203.0.113.1'); // Simulate location change
  const result = await flows.login(email, password);
  // Adaptive MFA might trigger based on IP change
});
```

### Auth Config (`authConfig`)

Provides configuration-aware helpers:

```typescript
type AuthConfig = {
  deliveryMode: 'cookies' | 'json';
  verificationMethod: 'none' | 'email' | 'phone' | 'both';
  mfaEnforcement: 'OPTIONAL' | 'REQUIRED' | 'ADAPTIVE';
  mfaGracePeriod: number;
  useMobileEndpoint: (path: string) => string; // Auto-adds /mobile for JSON mode
  expectCookies: () => boolean;
  expectJsonTokens: () => boolean;
  shouldVerifyEmail: () => boolean;
  shouldVerifyPhone: () => boolean;
  shouldRequireMFA: () => boolean;
};
```

### API Client (`api`)

Automatic token/cookie management and IP simulation:

```typescript
type ApiClient = {
  get: (url: string, options?: any) => Promise<APIResponse>;
  post: (url: string, options?: any) => Promise<APIResponse>;
  put: (url: string, options?: any) => Promise<APIResponse>;
  patch: (url: string, options?: any) => Promise<APIResponse>;
  delete: (url: string, options?: any) => Promise<APIResponse>;
  getCookies: () => Record<string, string>; // Debug helper
};
```

**Features**:

- Automatically adds `Authorization: Bearer <token>` header for JSON mode
- Automatically adds `Cookie` header for cookie mode
- Automatically adds `X-Forwarded-For` header with current IP
- Automatically extracts and stores tokens/cookies from responses
- Handles device token in `X-Device-Token` header for JSON mode

### Mail (`mail`)

Retrieves email verification codes from the database:

```typescript
type MailFixture = {
  latestCode: (email: string) => Promise<string>; // Gets verification code from database
  latestLink: (email: string) => Promise<string>; // Gets verification link (not implemented)
};
```

**Implementation**:

- Calls `/test/email/latest?email=<email>` endpoint
- Endpoint queries `nauth_verification_tokens` table for latest unused email verification token
- Retries up to 10 times with 500ms delay
- Initial 2s delay to account for async email sending

### SMS (`sms`)

Retrieves SMS verification codes from the database:

```typescript
type SMSFixture = {
  latestCode: (phone: string) => Promise<string>;
};
```

**Implementation**:

- Calls `/test/sms/latest?phone=<phone>` endpoint
- Endpoint finds user by phone, then queries `nauth_verification_tokens` table for latest unused phone verification token
- Retries up to 5 times with 500ms delay
- Initial 1s delay to account for async SMS sending

### Test API (`testApi`)

Test mode utilities:

```typescript
type TestApiFixture = {
  reset: () => Promise<void>; // Reset test environment
  getTotpSecret: (userId: string) => Promise<string>; // Get TOTP secret
};
```

### Cookies (`cookies`)

Cookie parsing utilities:

```typescript
type CookiesFixture = {
  parseFromHeaders: (headers: Record<string, string | string[]>) => Record<string, ParsedCookie>;
  parseFromResponse: (response: APIResponse) => Record<string, ParsedCookie>;
};
```

### Flows (`flows`)

High-level authentication flow helpers:

```typescript
type Flows = {
  signup: (email: string, phone?: string) => Promise<FlowResult<{ challengeName?: string; session?: string }>>;
  login: (email: string, password: string) => Promise<FlowResult<{ challengeName?: string; session?: string }>>;
  completeChallenge: (
    challengeName: string,
    code: string,
  ) => Promise<FlowResult<{ challengeName?: string; session?: string }>>;
  refreshToken: () => Promise<FlowResult<void>>;
  logout: () => Promise<FlowResult<void>>;
  setupMFA: (method: 'TOTP' | 'SMS') => Promise<FlowResult<{ secret?: string }>>;
  verifyMFA: (code: string) => Promise<FlowResult<void>>;
};
```

**FlowResult type**:

```typescript
type FlowResult<T> = {
  success: boolean;
  data?: T;
  response?: APIResponse;
  error?: string;
};
```

## Test Mode Endpoints

**Only enabled when `NAUTH_TEST_MODE=true`** in your sample-app environment.

These endpoints allow tests to retrieve verification codes and test data directly from the database.

### `POST /test/reset`

Resets test environment:

- **Full reset**: Drops and recreates all `nauth_*` tables
- **Light reset**: Truncates tables only (faster, preserves schema) - use `?light=true`
- Flushes Redis (if using Redis storage adapter)

```bash
# Full reset
curl -X POST http://localhost:3000/test/reset

# Light reset (faster)
curl -X POST "http://localhost:3000/test/reset?light=true"
```

**Note**: Tests don't use reset by default. Data accumulates for inspection. Test data is randomized to avoid conflicts.

### `GET /test/email/latest?email=test@example.com`

Retrieves latest email verification code from database:

```bash
curl "http://localhost:3000/test/email/latest?email=test%40example.com"
# Response: {"code": "123456"}
```

**Implementation**:

1. Finds user by email (normalized to lowercase)
2. Queries `nauth_verification_tokens` table for latest unused email verification token
3. Returns the code

### `GET /test/sms/latest?phone=+1234567890`

Retrieves latest SMS verification code from database:

```bash
curl "http://localhost:3000/test/sms/latest?phone=%2B1234567890"
# Response: {"code": "123456"}
```

**Implementation**:

1. Finds user by phone number
2. Queries `nauth_verification_tokens` table for latest unused phone verification token
3. Returns the code

### `GET /test/totp/secret?userId=user-id`

Retrieves TOTP secret for a user:

```bash
curl "http://localhost:3000/test/totp/secret?userId=abc123"
# Response: {"secret": "JBSWY3DPEHPK3PXP"}
```

**Use case**: Generate TOTP codes in tests using any RFC 6238-compatible TOTP generator.

## Running Tests

### Basic Commands

```bash
# Run all tests for JSON mode
npx playwright test --project json

# Run all tests for cookies mode
npx playwright test --project cookies

# Run specific test file
npx playwright test current-config --project json

# Run with browser visible (for debugging - not needed for API tests)
npx playwright test --project json --headed

# Run in debug mode (step through tests)
npx playwright test --project json --debug

# Run specific test by line number
npx playwright test current-config --project json --line 134

# View HTML report
npx playwright show-report
```

### Environment Variables

Set these in your shell or `.env` file:

```bash
# Base URL for API (default: https://api.angular.dev1.noorix.com)
TEST_BASE_URL=http://localhost:3000

# Frontend URL for cookie mode (default: https://angular.dev1.noorix.com)
TEST_FRONTEND_URL=http://localhost:4200
```

**Note**: The default URLs point to a remote test environment. For local testing, set `TEST_BASE_URL=http://localhost:3000` (or whatever port your app runs on).

### Test Organization

Tests are organized by functionality:

```
tests/e2e/specs/
├── current-config.spec.ts           # Tests matching current auth.config.ts (complete flows)
└── auth-lifecycle/
    └── complete-lifecycle.spec.ts    # Complete authentication lifecycle for all configs
                                      # Signup → Verification → Login → Refresh → Logout
```

**Test Structure:**

- **Complete Lifecycle** (`auth-lifecycle/complete-lifecycle.spec.ts`): Tests complete flows for all configs in the matrix
  - Signup → Email Verification → Phone Verification → Login → Refresh → Logout
  - Tests all 8 config permutations (cookies/json × verification methods × MFA enforcement)
- **Current Config** (`current-config.spec.ts`): Tests complete flows matching your current `auth.config.ts` settings
  - Same flow as complete-lifecycle, but only runs for configs matching your current settings
  - Useful for quick validation during development

### Parameterized Tests

Each test file uses `config-matrix.ts` to generate tests for multiple configurations:

```typescript
import { getConfigsByTag } from '../../config-matrix';

const configs = getConfigsByTag('@email-only');

for (const config of configs) {
  test.describe(`Signup Email Only: ${config.name}`, () => {
    // Override authConfig fixture with config values
    test.use({
      authConfig: async ({}, use) => {
        await use({
          deliveryMode: config.tokenDelivery,
          verificationMethod: config.verificationMethod,
          // ... other config values
        });
      },
    });

    test('1. Signup with email only', async ({ flows, flowState, authConfig }) => {
      // Test implementation
    });
  });
}
```

This generates separate test runs for each configuration (e.g., `email-only-cookies`, `email-only-json`).

### Serial Tests

Use `test.describe.serial()` to run tests sequentially and share state:

```typescript
test.describe.serial('Signup Flow', () => {
  test('1. Signup', async ({ flows, flowState }) => {
    // flowState is populated here
  });

  test('2. Complete Email Verification', async ({ flows, flowState, mail }) => {
    // flowState from previous test is available here
    const code = await mail.latestCode(flowState.userEmail);
  });
});
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '../fixtures';
import { getConfigsByTag } from '../config-matrix';

const configs = getConfigsByTag('@email-only');

for (const config of configs) {
  test.describe(`My Test: ${config.name}`, () => {
    // Override authConfig with config values
    test.use({
      authConfig: async ({}, use) => {
        await use({
          deliveryMode: config.tokenDelivery,
          verificationMethod: config.verificationMethod,
          mfaEnforcement: config.mfaEnforcement,
          mfaGracePeriod: config.mfaGracePeriod,
          useMobileEndpoint: (path: string) => {
            const mobileEndpoints = ['/auth/signup', '/auth/login', '/auth/refresh'];
            const needsMobile = mobileEndpoints.some((endpoint) => path.includes(endpoint));
            return config.tokenDelivery === 'json' && needsMobile ? `${path}/mobile` : path;
          },
          expectCookies: () => config.tokenDelivery === 'cookies',
          expectJsonTokens: () => config.tokenDelivery === 'json',
          shouldVerifyEmail: () => config.verificationMethod === 'email' || config.verificationMethod === 'both',
          shouldVerifyPhone: () => config.verificationMethod === 'phone' || config.verificationMethod === 'both',
          shouldRequireMFA: () => config.mfaEnforcement === 'REQUIRED' || config.mfaEnforcement === 'ADAPTIVE',
        });
      },
    });

    test('My test case', async ({ flows, flowState, authConfig, mail, sms, cookies }) => {
      // Test implementation
    });
  });
}
```

### Using Flow Helpers

```typescript
test('Complete signup flow', async ({ flows, flowState, authConfig, mail, cookies }) => {
  // 1. Signup
  const signupResult = await flows.signup(flowState.userEmail, flowState.userPhone);
  expect(signupResult.success).toBe(true);
  expect(signupResult.data?.challengeName).toBe('VERIFY_EMAIL');

  // 2. Get email code from database
  const code = await mail.latestCode(flowState.userEmail);
  expect(code).toBeTruthy();

  // 3. Complete challenge
  const challengeResult = await flows.completeChallenge('VERIFY_EMAIL', code);
  expect(challengeResult.success).toBe(true);

  // 4. Validate tokens
  if (authConfig.expectJsonTokens()) {
    const body = await challengeResult.response!.json();
    expect(body).toHaveProperty('accessToken');
  } else if (authConfig.expectCookies()) {
    const parsedCookies = cookies.parseFromResponse(challengeResult.response!);
    expect(parsedCookies).toHaveProperty('nauth_access_token');
  }
});
```

### Using API Client Directly

```typescript
test('Custom API call', async ({ api, flowState, authConfig }) => {
  // API client automatically handles tokens, cookies, and IP
  const response = await api.get('/auth/me');
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.email).toBe(flowState.userEmail);
});
```

### Conditional Tests

```typescript
test('Email verification (if required)', async ({ flows, flowState, authConfig, mail }) => {
  // Skip test if email verification not required
  test.skip(!authConfig.shouldVerifyEmail(), 'Email verification not required');

  const code = await mail.latestCode(flowState.userEmail);
  const result = await flows.completeChallenge('VERIFY_EMAIL', code);
  expect(result.success).toBe(true);
});
```

## Configuration Management

### Current Config Tests

The `current-config.spec.ts` file automatically reads your `auth.config.ts` and runs tests matching your current configuration:

```typescript
import { authConfig } from '../../../examples/sample-app/src/config/auth.config';

const currentConfig = {
  verificationMethod: authConfig.signup?.verificationMethod ?? 'none',
  mfaEnforcement: authConfig.mfa?.enforcement ?? 'OPTIONAL',
  tokenDelivery: authConfig.tokenDelivery?.method ?? 'cookies',
};

const matchingConfigs = getConfigsForCurrentAuthConfig(currentConfig);
```

**Usage**:

1. Edit `examples/sample-app/src/config/auth.config.ts` with desired settings
2. Restart sample-app (or let it auto-restart with `yarn start:dev`)
3. Run: `npx playwright test current-config --project json` (or `--project cookies`)

**Important**: Always specify `--project` to avoid running tests in both projects, which can cause state conflicts.

### Adding New Configurations

Edit `tests/e2e/config-matrix.ts`:

```typescript
export const TEST_CONFIGS: TestConfig[] = [
  // ... existing configs
  {
    name: 'my-new-config',
    tokenDelivery: 'json',
    verificationMethod: 'email',
    mfaEnforcement: 'REQUIRED',
    mfaGracePeriod: 0,
    tags: ['@signup', '@email', '@json', '@mfa-required'],
  },
];
```

## Troubleshooting

### Error: Project(s) "cookies" not found. Available projects: ""

**Cause**: Running commands from wrong directory (e.g., `tests/e2e/` instead of root)

**Solution**: Always run Playwright commands from the **project root**:

```bash
# - CORRECT: From project root
cd /path/to/nauth-toolkit
npx playwright test --project cookies

# - WRONG: From tests/e2e/ subdirectory
cd tests/e2e
npx playwright test --project cookies  # ERROR: Projects not found
```

**Alternative**: Specify config path if you must run from subdirectory:

```bash
# From tests/e2e/ directory
npx playwright test --project cookies --config ../../playwright.config.ts
```

### Test Expects Tokens But Receives Empty Response

**Symptoms**: Test fails with `expect(received).toHaveProperty('nauth_access_token')` but received `{}`

**Cause**: Backend server is not running

**Solution**: Start the sample-app with test mode enabled:

```bash
# In a separate terminal
cd /path/to/nauth-toolkit
NAUTH_TEST_MODE=true yarn workspace sample-app start:dev
```

Then run your tests in the original terminal.

### Understanding MFA Setup Requirements

**Important**: When `mfaEnforcement` is `ADAPTIVE` or `REQUIRED` with `gracePeriod: 0`:

- Signup will **NOT** return tokens immediately
- Instead, it returns `MFA_SETUP_REQUIRED` challenge
- User must complete MFA setup before receiving tokens
- This ensures MFA can be triggered adaptively on future logins

**Example Flow:**

1. `POST /auth/signup` → Returns `{ challengeName: 'MFA_SETUP_REQUIRED', session: '...' }`
2. `POST /auth/challenge/setup-data` → Returns setup data (e.g., TOTP QR code)
3. `POST /auth/respond-challenge` → Verify setup → Returns tokens

**Configuration Impact:**

- `verificationMethod: 'none'` + `mfaEnforcement: 'OPTIONAL'` → Tokens returned at signup
- `verificationMethod: 'none'` + `mfaEnforcement: 'ADAPTIVE'` + `gracePeriod: 0` → MFA setup required
- `verificationMethod: 'email'` + `mfaEnforcement: 'ADAPTIVE'` → Email verification first, then MFA setup

### Tests Timeout

```bash
# Check if sample-app is running and accessible
curl http://localhost:3000/health
# Or if using default remote URL:
curl https://api.angular.dev1.noorix.com/health

# Increase timeout in playwright.config.ts
timeout: 120_000,  // Default is 60_000
```

### Email/SMS Codes Not Found

```bash
# Check test mode is enabled
curl http://localhost:3000/test/email/latest?email=test%40example.com

# Check if codes are in database (requires database access)
# Query nauth_verification_tokens table for latest tokens

# Verify email/SMS providers are configured correctly in your app
```

### Token/Cookie Issues

```typescript
// Debug: Check current cookies
const cookies = api.getCookies();
console.log('Current cookies:', cookies);

// Debug: Check flow state
console.log('Access token:', flowState.accessToken);
console.log('Refresh token:', flowState.refreshToken);
```

### Configuration Not Working

1. Verify `auth.config.ts` is being read correctly
2. Check app logs for configuration errors
3. Ensure app restarted after config changes
4. Verify test is using correct project (`--project json` or `--project cookies`)

### State Conflicts

If tests interfere with each other:

1. Use unique emails/phones (already handled by `flowState` fixture)
2. Use different IP addresses (already handled by `ipAddress` fixture)
3. Run tests with `--workers=1` to avoid parallel execution:
   ```bash
   npx playwright test --project json --workers=1
   ```

### App Not Accessible

```bash
# Verify TEST_BASE_URL is correct
echo $TEST_BASE_URL

# Test connectivity
curl $TEST_BASE_URL/health

# Check if app is running locally
# (if testing against local app)
ps aux | grep node
```

## File Structure

```
nauth-toolkit/
├── playwright.config.ts            # Playwright configuration (projects, timeouts, etc.)
├── tests/
│   ├── TEST_SCENARIOS.csv         # Master log of all test scenarios
│   └── e2e/
│       ├── fixtures.ts             # Playwright fixtures (flowState, api, mail, sms, etc.)
│       ├── config-matrix.ts        # Test configuration matrix
│       ├── specs/                  # Test files
│       │   ├── current-config.spec.ts      # Tests matching current auth.config.ts (complete flows)
│       │   └── auth-lifecycle/             # Complete lifecycle tests
│       │       └── complete-lifecycle.spec.ts  # Complete flows for all configs
│       └── runner/                 # Test utilities (not actively used)
│           ├── assign-config-groups.ts
│           └── csv-parser.ts
└── examples/
    └── sample-app/
        └── src/
            ├── config/
            │   └── auth.config.ts  # Auth configuration (edit manually)
            └── test/
                ├── test.controller.ts  # Test mode endpoints
                └── test.service.ts
```

## Key Concepts

### Token Delivery Modes

- **JSON mode**: Tokens in response body, used by mobile/API clients
  - Endpoints: `/auth/signup/mobile`, `/auth/login/mobile`, `/auth/refresh/mobile`
  - Headers: `Authorization: Bearer <token>`, `X-Device-Token: <device-token>`

- **Cookies mode**: Tokens in Set-Cookie headers, used by web browsers
  - Endpoints: `/auth/signup`, `/auth/login`, `/auth/refresh`
  - Headers: `Cookie: nauth_access_token=...; nauth_refresh_token=...`

### Challenge Flow

1. **Signup/Login** → Returns challenge if verification/MFA required
2. **Verify** → Verify email/phone code (marks as verified in database)
3. **Complete Challenge** → Moves flow forward, checks for more challenges
4. **Tokens** → Issued when all challenges complete

### Test Data Randomization

- **Emails**: `test+${timestamp}+${random}@example.com`
- **Phones**: `+1555${random7digits}` (E.164 format)
- **IPs**: `192.168.${workerIndex+1}.${lastOctet}`

This ensures tests don't conflict even when running in parallel.

### Email/SMS Code Retrieval

- Codes are stored in the `nauth_verification_tokens` database table
- Test endpoints (`/test/email/latest`, `/test/sms/latest`) query the database directly
- No email/SMS service (like MailHog) is needed - codes are retrieved from the database
- The email/SMS providers still send codes, but tests retrieve them from the database

## Best Practices

1. **Use flow helpers**: Prefer `flows.signup()`, `flows.login()`, etc. over direct API calls
2. **Use serial tests**: Use `test.describe.serial()` for multi-step flows
3. **Validate both modes**: Test both JSON and cookies modes when possible
4. **Check config**: Use `authConfig` helpers to conditionally test features
5. **Debug with fixtures**: Use `api.getCookies()` and `flowState` for debugging
6. **Handle async**: Email/SMS codes are sent asynchronously - fixtures handle retries automatically
7. **Set TEST_BASE_URL**: Always set `TEST_BASE_URL` to point to your running app

## Support

- **Playwright docs**: https://playwright.dev
- **Test fixtures**: See `tests/e2e/fixtures.ts` for implementation details
- **Config matrix**: See `tests/e2e/config-matrix.ts` for available configurations
