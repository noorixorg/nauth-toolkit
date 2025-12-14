# E2E Tests

## Quick Start

1. **Update backend config** in `examples/sample-nestjs/src/config/auth.config.ts`:

   ```typescript
   signup: { verificationMethod: 'none' | 'email' | 'phone' | 'both' }
   mfa: { enabled: true | false, enforcement: 'OPTIONAL' | 'REQUIRED' }
   ```

2. **Run tests** with matching env vars:
   ```bash
   VERIFICATION_METHOD=none MFA_ENABLED=true MFA_ENFORCEMENT=REQUIRED yarn e2e
   ```

Tests automatically filter to match your config.

## Commands

- `yarn e2e` - Run all matching tests (headless)
- `yarn e2e:watch` - UI mode with slow motion (for debugging)
- `yarn e2e:slow` - Headed browser with slow motion

## All Configs

| Config | verificationMethod | mfaEnabled | mfaEnforcement | Command                                                                         |
| ------ | ------------------ | ---------- | -------------- | ------------------------------------------------------------------------------- |
| 1      | `none`             | `false`    | `OPTIONAL`     | `VERIFICATION_METHOD=none MFA_ENABLED=false MFA_ENFORCEMENT=OPTIONAL yarn e2e`  |
| 2      | `email`            | `false`    | `OPTIONAL`     | `VERIFICATION_METHOD=email MFA_ENABLED=false MFA_ENFORCEMENT=OPTIONAL yarn e2e` |
| 3      | `phone`            | `false`    | `OPTIONAL`     | `VERIFICATION_METHOD=phone MFA_ENABLED=false MFA_ENFORCEMENT=OPTIONAL yarn e2e` |
| 4      | `both`             | `false`    | `OPTIONAL`     | `VERIFICATION_METHOD=both MFA_ENABLED=false MFA_ENFORCEMENT=OPTIONAL yarn e2e`  |
| 5      | `none`             | `true`     | `OPTIONAL`     | `VERIFICATION_METHOD=none MFA_ENABLED=true MFA_ENFORCEMENT=OPTIONAL yarn e2e`   |
| 6      | `none`             | `true`     | `REQUIRED`     | `VERIFICATION_METHOD=none MFA_ENABLED=true MFA_ENFORCEMENT=REQUIRED yarn e2e`   |
| 7      | `email`            | `true`     | `REQUIRED`     | `VERIFICATION_METHOD=email MFA_ENABLED=true MFA_ENFORCEMENT=REQUIRED yarn e2e`  |
| 8      | `phone`            | `true`     | `REQUIRED`     | `VERIFICATION_METHOD=phone MFA_ENABLED=true MFA_ENFORCEMENT=REQUIRED yarn e2e`  |
| 9      | `both`             | `true`     | `REQUIRED`     | `VERIFICATION_METHOD=both MFA_ENABLED=true MFA_ENFORCEMENT=REQUIRED yarn e2e`   |

## How It Works

1. Update `auth.config.ts` → wait 2-3s for restart
2. Set matching env vars → run command
3. All matching scenarios run automatically

No need to switch configs repeatedly. Update once, run once.
