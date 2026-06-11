---
title: 'Telemetry'
description: 'Anonymous usage telemetry --- exactly what is collected, what is never collected, all opt-out switches, and how the data is handled'
sidebar_position: 10
keywords: [telemetry, analytics, opt-out, privacy, anonymous, usage data, do not track]
image: /img/api-social-card.png
---

# Telemetry

nauth-toolkit collects **anonymous usage data** to guide development — which token delivery modes, MFA policies, and provider packages are actually used in the wild. Collection is on by default, disclosed at first boot, and can be turned off with a single environment variable.

```bash
NAUTH_TELEMETRY_DISABLED=1
```

## What is sent

One small JSON payload at boot and once per day afterwards. It describes the **shape** of your configuration — enums, booleans, and registered provider names — never values.

```json
{
  "schemaVersion": 1,
  "instanceId": "8b6c2f6e-...",
  "event": "boot",
  "coreVersion": "0.3.0",
  "nodeMajor": 22,
  "platform": "linux",
  "arch": "x64",
  "nodeEnv": "production",
  "framework": "nestjs",
  "config": {
    "tokenDeliveryMethod": "hybrid",
    "mfa": { "enabled": true, "enforcement": "ADAPTIVE", "gracePeriodSet": true, "allowedMethods": ["sms", "totp"] },
    "mfaProviders": ["totp", "sms"],
    "socialProviders": ["google"],
    "storageAdapter": "RedisStorageAdapter",
    "signupVerificationMethod": "both",
    "auditLogsEnabled": true,
    "recaptchaEnabled": false,
    "geoLocationConfigured": true
  }
}
```

| Field | Source |
| --- | --- |
| `instanceId` | Random UUID generated on first boot — identifies an install, not a person or machine. Persisted in your storage adapter (Redis/database) so all processes of a deployment share one ID; installs using in-memory storage persist it in `~/.nauth-toolkit/telemetry-instance-id` instead |
| `coreVersion`, `nodeMajor`, `platform`, `arch` | Package version and runtime environment |
| `nodeEnv` | `production`, `development`, or `other` |
| `framework` | `nestjs`, `express`, or `fastify` |
| `config.*` | Enums and booleans from your auth config, plus registered provider names |

## What is never sent

- IP addresses — the collector does not read or store the request source address
- Secrets, keys, tokens, or any configuration **values**
- Domains, URLs, emails, phone numbers, table names, or template content
- Anything about your users — no counts, no identifiers, no activity
- Per-request data of any kind — telemetry never runs inside a request path

## Opting out

Any one of the following disables telemetry completely:

| Switch | Use when |
| --- | --- |
| `NAUTH_TELEMETRY_DISABLED=1` | Recommended — works everywhere, no code change |
| `DO_NOT_TRACK=1` | Honored as part of the cross-tool [DNT convention](https://consoledonottrack.com/) |
| `telemetry: { enabled: false }` in your auth config | Keep the decision in code |
| Automatic | Always off in CI (`CI=true`) and tests (`NODE_ENV=test`) |

```typescript
const authConfig = {
  // ...
  telemetry: {
    enabled: false,
  },
};
```

## Performance

Telemetry is engineered to be invisible:

- The boot ping is deferred and fire-and-forget — startup gains no awaits
- The daily heartbeat timer is unref'd and never keeps the process alive
- Requests time out after 3 seconds and all failures are silently ignored
- No middleware, no request-path involvement, zero per-request cost

## Data handling

Pings are received at `telemetry.nauth.dev` and stored with one record per install per day. Source IPs are never read or stored, records expire automatically after 400 days, and the data is used only in aggregate to prioritize nauth-toolkit development.

## What's Next

- **[Configuration](/docs/concepts/configuration#telemetry)** — telemetry config reference
- **[Audit Logs](/docs/concepts/audit-logs)** — security event logging for your own users (unrelated to telemetry)
