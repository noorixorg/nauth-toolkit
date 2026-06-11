# @nauth-toolkit/email-nodemailer

Nodemailer email provider for [nauth-toolkit](https://nauth.dev).

Sends verification codes, password reset emails, and MFA notifications using Nodemailer. Works with any SMTP server, AWS SES, Gmail, or other Nodemailer-supported transports. Includes Handlebars-based email templates with file-based customization.

**[Documentation](https://nauth.dev)** · **[GitHub](https://github.com/noorixorg/nauth-toolkit)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/email-nodemailer
```

Configure in your auth config:

```typescript
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

const authConfig = {
  emailProvider: new NodemailerEmailProvider({
    host: process.env.SMTP_HOST,
    port: 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: 'noreply@example.com',
  }),
};
```

---

## Also available

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/email-console`](https://www.npmjs.com/package/@nauth-toolkit/email-console) | Log emails to console — development use |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

MIT licensed. See [LICENSE](https://github.com/noorixorg/nauth-toolkit/blob/main/LICENSE).
