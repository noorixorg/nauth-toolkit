# E2E Test Runner

## Quick Start

### Run a specific scenario with UI and slow motion (EASIEST):

```bash
# From project root - this is all you need!
yarn e2e:scenario signup-both-verification --ui --headed
```

### Available Options:

- `--headed` - Run in headed mode (visible browser)
- `--ui` - Run with Playwright UI (interactive test runner)
- `--slow-mo=1000` - Set slow motion delay in milliseconds (supports both `--slow-mo=` and `--slowmo=`)
- `--grep="pattern"` - Use grep pattern instead of scenario ID

### Examples:

```bash
# Easiest: Run with UI and slow motion (watch the test visually)
yarn e2e:scenario signup-both-verification --ui --headed

# Custom slow motion (slower - better for seeing mouse movements)
yarn e2e:scenario signup-both-verification --headed --slow-mo=3000

# Even slower for detailed observation
yarn e2e:scenario signup-both-verification --headed --slow-mo=5000

# Headed mode without UI (just see browser)
yarn e2e:scenario signup-both-verification --headed

# Run with grep pattern (multiple scenarios)
yarn e2e:scenario --grep="signup.*verification" --ui --headed

# From e2e directory directly
cd e2e
node run-scenario.js signup-both-verification --ui --headed
```

### Available Scenarios:

- `signup-basic`
- `signup-email-verification`
- `signup-phone-verification`
- `signup-both-verification` ⭐
- `signup-mfa-required-sms`
- `signup-mfa-required-totp`
- `signup-mfa-optional-totp`
- `login-basic`
- `login-mfa-required-totp`

### Shortcuts (without scenario config):

```bash
# Quick UI mode with grep
yarn e2e:ui --grep "signup-both-verification"

# Quick headed mode with grep
yarn e2e:headed --grep "signup-both-verification"
```

**Note:** The `e2e:scenario` command automatically sets the correct environment variables for each scenario. Use `--grep` if you want to run without automatic config.
