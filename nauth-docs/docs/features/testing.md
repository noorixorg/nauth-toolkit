---
title: Testing Guide
description: Strategies for testing your application with nauth-toolkit
sidebar_position: 4
---

# Testing Your Integration

Testing authentication flows can be difficult because of email verification, SMS codes, and MFA. nauth-toolkit provides built-in tools to make E2E and integration testing easier.

## Test Mode

When running your application in a test environment (e.g., CI/CD), you can enable **Test Mode**. This exposes special endpoints that allow your test scripts to retrieve verification codes and reset state programmatically.

### Enabling Test Mode

Set the environment variable:

```bash
NAUTH_TEST_MODE=true
```

:::danger Production Warning
**NEVER** enable `NAUTH_TEST_MODE` in production. It exposes sensitive endpoints that allow bypassing security controls.
:::

## E2E Testing (Playwright/Cypress)

The biggest challenge in E2E testing is getting the verification code sent via email or SMS. In Test Mode, you can retrieve these codes directly from the API.

### Retrieving Verification Codes

Instead of checking a real email inbox, your test can query the test API:

**Get latest email code:**

```http
GET /test/email/latest?email=user@example.com
```

Response: `{"code": "123456"}`

**Get latest SMS code:**

```http
GET /test/sms/latest?phone=+1234567890
```

Response: `{"code": "123456"}`

### Example: Playwright Test

Here's how a typical signup flow looks in Playwright:

```typescript
test('Signup flow with email verification', async ({ request }) => {
  const email = `test-${Date.now()}@example.com`;

  // 1. Call Signup API
  const signup = await request.post('/auth/signup', {
    data: { email, password: 'Password123!' },
  });
  const { session } = await signup.json();

  // 2. Get verification code from Test API
  // Poll a few times if needed, as it might take a moment to generate
  const codeRes = await request.get(`/test/email/latest?email=${email}`);
  const { code } = await codeRes.json();

  // 3. Verify the code
  const verify = await request.post('/auth/respond-challenge', {
    data: {
      session,
      type: 'VERIFY_EMAIL',
      code,
    },
  });

  // 4. Assert success
  expect(verify.ok()).toBeTruthy();
  const tokens = await verify.json();
  expect(tokens).toHaveProperty('accessToken');
});
```

### Resetting State

To ensure a clean state between tests, you can reset the database:

```http
POST /test/reset
```

Or for a faster reset (truncates tables instead of dropping):

```http
POST /test/reset?light=true
```

## Unit Testing

When unit testing your own services that depend on `AuthService`, you should mock the nauth-toolkit services.

### Mocking AuthService

```typescript
import { AuthService } from '@nauth-toolkit/core';

const mockAuthService = {
  signup: jest.fn(),
  login: jest.fn(),
  validateToken: jest.fn(),
};

describe('MyService', () => {
  let service: MyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MyService,
        { provide: AuthService, useValue: mockAuthService }
      ],
    }).compile();

    service = module.get(MyService);
  });

  it('should call signup', async () => {
    mockAuthService.signup.mockResolvedValue({ user: { id: 1 } });
    await service.registerUser(...);
    expect(mockAuthService.signup).toHaveBeenCalled();
  });
});
```

## Test Endpoints Reference

These endpoints are only available when `NAUTH_TEST_MODE=true`.

| Endpoint             | Method | Description            | Params                  |
| -------------------- | ------ | ---------------------- | ----------------------- |
| `/test/email/latest` | GET    | Get latest email code  | `email`                 |
| `/test/sms/latest`   | GET    | Get latest SMS code    | `phone`                 |
| `/test/totp/secret`  | GET    | Get user's TOTP secret | `userId`                |
| `/test/reset`        | POST   | Reset database         | `light=true` (optional) |

:::tip TOTP Testing
Use `/test/totp/secret` to get the secret key for a user, then use a library like `otplib` in your test suite to generate the correct TOTP code for the current time.
:::
