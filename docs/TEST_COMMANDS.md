# Test Commands for nauth-toolkit/core

## Run All Tests

```bash
cd packages/core
yarn test
```

## Run Specific Test File

```bash
cd packages/core
yarn test <filename>.spec.ts
```

Examples:

```bash
# Test JWT service

# Test client info service
yarn test client-info.service.spec.ts

# Test challenge service
yarn test challenge.service.spec.ts

# Test auth challenge helper service
yarn test auth-challenge-helper.service.spec.ts
```

## Run Tests with Coverage

### Coverage for All Tests

```bash
cd packages/core
yarn test --coverage
```

### Coverage for Specific File

```bash
cd packages/core
yarn test <filename>.spec.ts --coverage --collectCoverageFrom='src/services/<filename>.ts'
```

Examples:

```bash
# JWT service coverage
yarn test jwt.service.spec.ts --coverage --collectCoverageFrom='src/services/jwt.service.ts'

# Client info service coverage
yarn test client-info.service.spec.ts --coverage --collectCoverageFrom='src/services/client-info.service.ts'

# Challenge service coverage
yarn test challenge.service.spec.ts --coverage --collectCoverageFrom='src/services/challenge.service.ts'

# Auth challenge helper service coverage
yarn test auth-challenge-helper.service.spec.ts --coverage --collectCoverageFrom='src/services/auth-challenge-helper.service.ts'
```

## Coverage Report Formats

### Text Summary (default)

```bash
yarn test --coverage --coverageReporters=text
```

### HTML Report (opens in browser)

```bash
yarn test --coverage --coverageReporters=html
```

### JSON Report

```bash
yarn test --coverage --coverageReporters=json
```

### Multiple Formats

```bash
yarn test --coverage --coverageReporters=text --coverageReporters=html
```

## View Coverage Report Location

After running with coverage, reports are saved to:

- **Text/JSON/HTML**: `packages/core/coverage/`
- **LCOV**: `packages/core/coverage/lcov.info`

## Quick Coverage Check for Phase 1 Files

```bash
cd packages/core

# File 1: JWT Service
yarn test jwt.service.spec.ts --coverage --collectCoverageFrom='src/services/jwt.service.ts' --coverageReporters=text | grep -A 10 "jwt.service.ts"

# File 2: Client Info Service
yarn test client-info.service.spec.ts --coverage --collectCoverageFrom='src/services/client-info.service.ts' --coverageReporters=text | grep -A 5 "client-info.service.ts"

# File 3: Challenge Service (when converted)
yarn test challenge.service.spec.ts --coverage --collectCoverageFrom='src/services/challenge.service.ts' --coverageReporters=text | grep -A 5 "challenge.service.ts"
```

## Run Tests in Watch Mode

```bash
cd packages/core
yarn test --watch
```

## Run Tests Matching Pattern

```bash
cd packages/core
yarn test --testNamePattern="should return"
```

## Run Tests with Verbose Output

```bash
cd packages/core
yarn test --verbose
```

## Check Test Coverage Summary Only

```bash
cd packages/core
yarn test --coverage --coverageReporters=text-summary
```
