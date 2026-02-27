# Testing Guide - Authentication Challenge Flow

## Running Tests

### Run All Tests

```bash
yarn workspace @nauth-toolkit/core test
```

### Run Specific Test File

```bash
yarn workspace @nauth-toolkit/core test auth-challenge-helper.service.spec.ts
```

### Run Tests in Watch Mode

```bash
yarn workspace @nauth-toolkit/core test --watch
```

### Run Tests with Coverage

```bash
yarn workspace @nauth-toolkit/core test --coverage
```

### Run Specific Test Suite

```bash
yarn workspace @nauth-toolkit/core test -t "determineAuthResponse - Comprehensive Scenarios"
```

### Run Specific Test Case

```bash
yarn workspace @nauth-toolkit/core test -t "should return SUCCESS when verificationMethod is none"
```

## Test Coverage

The comprehensive test suite in `auth-challenge-helper.service.spec.ts` covers all scenarios documented in `CHALLENGE_SCENARIOS.md`:

### Signup Scenarios

- - MFA OPTIONAL: `none`, `email`, `phone`, `both` verification methods
- - MFA REQUIRED: Grace period 0 and 7 days with different verification methods
- - MFA ADAPTIVE: Grace period variations

### Login Scenarios

- - MFA OPTIONAL: Device trust, `mustChangePassword`, `mfaExempt`
- - MFA REQUIRED: Grace period active/expired, device trust
- - MFA ADAPTIVE: Risk levels, device trust, blocked state, grace period with metadata

### Social Login Scenarios

- - `requireForSocialLogin = false`: All verification methods
- - `requireForSocialLogin = true`: MFA OPTIONAL/REQUIRED/ADAPTIVE combinations

### Special Cases

- - Phone collection during verification
- - Preferred MFA method selection
- - FORCE_CHANGE_PASSWORD priority

## Test Structure

The comprehensive test suite is organized into nested `describe` blocks:

```typescript
describe('determineAuthResponse - Comprehensive Scenarios', () => {
  describe('Signup - MFA OPTIONAL', () => { ... });
  describe('Signup - MFA REQUIRED', () => { ... });
  describe('Login - MFA OPTIONAL', () => { ... });
  describe('Login - MFA REQUIRED', () => { ... });
  describe('Login - MFA ADAPTIVE', () => { ... });
  describe('Social Login', () => { ... });
  describe('Special Cases', () => { ... });
});
```

## Helper Functions

The test suite includes helper functions to simplify test setup:

- `createServiceWithMocks(config)`: Creates a service instance with all required mocks
- `mockStateEvaluation(state, challenge?, metadata?)`: Mocks the state machine evaluation
- `mockContextBuild(computed?, userOverride?)`: Mocks the context builder with pre-computed values

## Example Test

```typescript
it('should return MFA_REQUIRED when MFA enabled and device is untrusted', async () => {
  const config: NAuthConfig = {
    ...mockConfig,
    signup: { verificationMethod: 'none' },
    mfa: { enabled: true, enforcement: 'OPTIONAL' },
  };
  const service = createServiceWithMocks(config);
  const user = { ...mockUser, mfaEnabled: true } as IUser;
  mockContextBuild({ isDeviceTrusted: false, isMFAVerificationRequired: true }, user);
  mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
  mockMFADeviceRepository.find.mockResolvedValue([
    { id: 1, userId: 1, type: MFAMethod.TOTP, isActive: true } as IMFADevice,
  ]);
  mockChallengeService.createChallengeSession.mockResolvedValue(
    createMockChallengeSession('session-123', AuthChallenge.MFA_REQUIRED),
  );

  const result = await service.determineAuthResponse({ user, config });

  expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
});
```

## Debugging Tests

### Run with Verbose Output

```bash
yarn workspace @nauth-toolkit/core test --verbose
```

### Run Single Test File with Debug

```bash
yarn workspace @nauth-toolkit/core test auth-challenge-helper.service.spec.ts --verbose
```

### Check Test Coverage Report

After running with `--coverage`, check the coverage report:

```bash
open coverage/lcov-report/index.html
```

## Notes

- The old tests for deleted methods (`determinePendingChallenges`, `isMFASetupRequired`, `checkMFARequirement`) are disabled using `xdescribe` and should not be run
- All new tests use the state machine architecture via `determineAuthResponse`
- Tests mock the state machine and context builder to verify the integration points
