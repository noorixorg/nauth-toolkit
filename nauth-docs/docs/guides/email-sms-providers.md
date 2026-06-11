---
title: 'Email & SMS Providers'
description: 'Configure email and SMS providers for nauth-toolkit --- SMTP, AWS SES, SendGrid, AWS SNS, Twilio, and custom implementations'
sidebar_position: 4
keywords: [email, sms, smtp, aws ses, sendgrid, aws sns, twilio, nodemailer, provider, configuration]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Email & SMS Providers

Configure how nauth-toolkit sends emails and SMS messages. Pick a provider for each channel and pass it to your auth configuration.

## Email Providers

Install the Nodemailer-based email provider:

```bash npm2yarn
npm install @nauth-toolkit/email-nodemailer
```

<Tabs groupId="email-provider">
<TabItem value="smtp" label="SMTP" default>

```typescript title="config/auth.config.ts"
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

{
  emailProvider: new NodemailerEmailProvider({
    transport: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    defaults: {
      from: '"My App" <noreply@example.com>',
    },
  }),
}
```

</TabItem>
<TabItem value="aws-ses" label="AWS SES">

Uses AWS SDK v3 with IAM role discovery. No credentials needed on EC2/ECS/Lambda.

```bash npm2yarn
npm install @aws-sdk/client-sesv2
```

```typescript title="config/auth.config.ts"
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

{
  emailProvider: new NodemailerEmailProvider({
    transport: {
      SES: {
        sesClient: new SESv2Client({
          region: process.env.AWS_REGION || 'us-east-1',
        }),
        SendEmailCommand,
      },
    },
    defaults: {
      from: '"My App" <noreply@example.com>',
    },
  }),
}
```

</TabItem>
<TabItem value="sendgrid" label="SendGrid">

```typescript title="config/auth.config.ts"
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

{
  emailProvider: new NodemailerEmailProvider({
    transport: {
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    },
    defaults: {
      from: '"My App" <noreply@example.com>',
    },
  }),
}
```

</TabItem>
<TabItem value="custom" label="Custom Provider">

Implement the `EmailProvider` interface to use any email service:

```typescript title="src/providers/my-email.provider.ts"
import { EmailProvider } from '@nauth-toolkit/core';

class MyEmailProvider implements EmailProvider {
  async sendVerificationEmail(to: string, code: string, link?: string, expiryMinutes?: number): Promise<void> {
    await myService.send({
      to,
      subject: 'Verify your email',
      html: `Code: ${code}${link ? ` | <a href="${link}">Verify</a>` : ''}`,
    });
  }

  async sendMFAEmailCode(to: string, code: string, expiryMinutes?: number): Promise<void> {
    await myService.send({ to, subject: 'Your sign-in code', html: `Code: ${code}` });
  }

  async sendPasswordResetEmail(to: string, _token: string, code: string, link?: string, expiryMinutes?: number): Promise<void> {
    await myService.send({ to, subject: 'Reset your password', html: `Code: ${code}` });
  }

  async sendAdminPasswordResetEmail(to: string, code: string, link?: string, expiryMinutes?: number): Promise<void> {
    await myService.send({ to, subject: 'Password reset', html: `Code: ${code}` });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await myService.send({ to, subject: 'Welcome!', html: `Hi ${name}` });
  }

  // Optional notification methods (implement only the ones you need):
  // sendPasswordChangedEmail?, sendLockoutEmail?, sendNewDeviceEmail?,
  // sendAccountLockedEmail?, sendSessionsRevokedEmail?, sendMFAFirstEnabledEmail?,
  // sendMFAMethodAddedEmail?, sendMFADeviceRemovedEmail?, sendAdaptiveMFARiskAlertEmail?,
  // sendAccountDisabledEmail?, sendAccountEnabledEmail?, sendEmailChangedAlertEmail?,
  // sendEmailChangedConfirmationEmail?
}

{
  emailProvider: new MyEmailProvider(),
}
```

</TabItem>
</Tabs>

### Console provider (development)

For local development, log emails to the console instead of sending them:

```bash npm2yarn
npm install @nauth-toolkit/email-console
```

```typescript title="config/auth.config.ts"
import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';

{
  emailProvider: new ConsoleEmailProvider(),
}
```

## SMS Providers

<Tabs groupId="sms-provider">
<TabItem value="twilio" label="Twilio" default>

```bash npm2yarn
npm install @nauth-toolkit/sms-twilio
```

```typescript title="config/auth.config.ts"
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

{
  smsProvider: new TwilioSMSProvider({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    fromNumber: process.env.TWILIO_FROM_NUMBER!,
  }),
}
```

To use a Messaging Service instead of a direct phone number:

```typescript
new TwilioSMSProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
})
```

See [Twilio API Reference](/docs/api/sms/twilio) for full configuration options.

</TabItem>
<TabItem value="aws-sns" label="AWS SNS">

```bash npm2yarn
npm install @nauth-toolkit/sms-aws-sns
```

```typescript title="config/auth.config.ts"
import { AWSSMSProvider } from '@nauth-toolkit/sms-aws-sns';

{
  smsProvider: new AWSSMSProvider({
    region: 'us-east-1',
    originationNumber: process.env.AWS_SMS_ORIGINATION || '+12345678901',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }),
}
```

AWS SNS supports two API modes:

| Mode | Config | Description |
|---|---|---|
| `'sns'` (default) | `apiMode: 'sns'` | Standard SNS Publish API |
| `'end-user-messaging-sms'` | `apiMode: 'end-user-messaging-sms'` | AWS End User Messaging SMS API (supports configuration sets) |

```typescript
new AWSSMSProvider({
  region: 'us-east-1',
  originationNumber: process.env.AWS_SMS_ORIGINATION,
  apiMode: 'end-user-messaging-sms',
  configurationSetName: 'my-config-set',
})
```

See [AWS SNS API Reference](/docs/api/sms/aws-sns) for IAM permissions and configuration sets.

</TabItem>
<TabItem value="console" label="Console (Development)">

Logs SMS messages to the console instead of sending them:

```bash npm2yarn
npm install @nauth-toolkit/sms-console
```

```typescript title="config/auth.config.ts"
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';

{
  smsProvider: new ConsoleSMSProvider(),
}
```

</TabItem>
<TabItem value="custom" label="Custom Provider">

Implement the `SMSProvider` interface to use any SMS service (MessageBird, Vonage, etc.):

```typescript title="src/providers/my-sms.provider.ts"
import { SMSProvider, SMSTemplateEngine, SMSTemplateVariables } from '@nauth-toolkit/core';

class MySMSProvider implements SMSProvider {
  private templateEngine?: SMSTemplateEngine;
  private globalVariables: SMSTemplateVariables = {};

  setTemplateEngine(engine: SMSTemplateEngine): void {
    this.templateEngine = engine;
  }

  setGlobalVariables(variables: SMSTemplateVariables): void {
    this.globalVariables = variables;
  }

  async sendOTP(
    phone: string,
    code: string,
    templateType?: string,
    variables?: Record<string, unknown>,
  ): Promise<void> {
    let message: string;

    if (this.templateEngine && templateType) {
      const allVariables: SMSTemplateVariables = {
        ...this.globalVariables,
        code,
        ...(variables as SMSTemplateVariables),
      };
      const template = await this.templateEngine.render(templateType, allVariables);
      message = template.content;
    } else {
      message = `Your verification code is: ${code}`;
    }

    await myClient.send({ to: phone, body: message });
  }
}

{
  smsProvider: new MySMSProvider(),
}
```

:::tip
When implementing a custom provider, call `this.templateEngine.render()` if a template engine is set. This ensures your custom templates and global variables work correctly. Fall back to a hardcoded message if no engine is available.
:::

</TabItem>
</Tabs>

## What's Next

- **[Email Templates](/docs/guides/email-templates)** --- Customize email templates and enable security notifications
- **[SMS Templates](/docs/guides/sms-templates)** --- Customize SMS message wording
- **[Notifications & Templates](/docs/concepts/notifications)** --- All template types, variables, and Handlebars syntax reference
