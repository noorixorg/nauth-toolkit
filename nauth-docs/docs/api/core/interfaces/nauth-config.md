---
title: NAuthConfig
description: Main configuration interface for nauth-toolkit authentication, providers, and security
keywords: [config, nauthconfig, authentication, providers, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# NAuthConfig

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Main configuration object for nauth-toolkit. This page intentionally stays minimal - the full option reference is documented inline in the configuration guide.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { NAuthConfig } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuthConfig } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuthConfig } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Overview

`NAuthConfig` is the main configuration object for nauth-toolkit, but its full option reference is documented inline in the configuration guide to avoid splitting context across multiple pages.

- See **[Configuration](/docs/concepts/configuration)** for the complete `NAuthConfig` reference (all options, defaults, and examples).

## Recent additions

- `recaptcha`: Google reCAPTCHA v2/v3/Enterprise bot protection. Configure `enabled`, `provider`, `enforceFor`, `minimumScore`, `skipInDevelopment`. See [RecaptchaConfig](./recaptcha-config) and [reCAPTCHA Guide](/docs/guides/recaptcha).
- `mfa.adaptive.blockedSignIn.scope`: control whether Adaptive MFA blocks apply to the **user**, **device**, or **IP**.
- `emailNotifications.suppress.mfaMethodAdded`: opt-in email notification when an **additional MFA method** is added.
- `signup.emailVerification.baseUrl`: base URL for email verification links. When configured, verification emails include a clickable link with the code (format: `${baseUrl}?code=${code}`). The consumer app handles routing. Supports both development (localhost) and production URLs.

## Related Types

- [`AdaptiveMFAUser`](./adaptive-mfa-user) - User interface for adaptive MFA risk events
- [`AdaptiveMFARiskEventPayload`](./adaptive-mfa-risk-event-payload) - Risk event payload interface


