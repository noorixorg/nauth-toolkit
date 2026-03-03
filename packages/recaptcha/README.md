# @nauth-toolkit/recaptcha

reCAPTCHA provider for [nauth-toolkit](https://nauth.dev).

Integrates Google reCAPTCHA v2, v3, and reCAPTCHA Enterprise into nauth-toolkit's authentication flows. Verifies CAPTCHA tokens server-side during signup, login, and other protected endpoints.

**[Documentation](https://nauth.dev/docs/guides/recaptcha)** · **[GitHub](https://github.com/noorixorg/nauth)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/recaptcha
```

## Usage (reCAPTCHA v3)

```typescript
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';

const authConfig = {
  recaptcha: {
    provider: new RecaptchaV3Provider({
      secretKey: process.env.RECAPTCHA_SECRET_KEY,
    }),
    minimumScore: 0.5,
  },
};
```

## Providers

- **RecaptchaV2Provider** — checkbox-based verification
- **RecaptchaV3Provider** — score-based bot detection (invisible)
- **RecaptchaEnterpriseProvider** — Google Cloud project-based verification with site keys
- Configurable minimum score thresholds
- Per-action score overrides (signup, login, password reset)

---

Free to use. See [license](https://nauth.dev/docs/license).
