# @nauth-toolkit/email-console

Console email provider for [nauth-toolkit](https://nauth.dev).

Logs email content to the console instead of sending it. Use during development and testing to see verification codes, magic links, and password reset emails without configuring a real email service.

**[Documentation](https://nauth.dev)** · **[GitHub](https://github.com/noorixorg/nauth-toolkit)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/email-console
```

Configure in your auth config:

```typescript
import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';

const authConfig = {
  emailProvider: new ConsoleEmailProvider(),
};
```

---

## For production

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/email-nodemailer`](https://www.npmjs.com/package/@nauth-toolkit/email-nodemailer) | Nodemailer — SMTP, AWS SES, SendGrid, any transport |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

MIT licensed. See [LICENSE](https://github.com/noorixorg/nauth-toolkit/blob/main/LICENSE).
