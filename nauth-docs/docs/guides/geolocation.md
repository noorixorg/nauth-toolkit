---
title: 'Geolocation'
description: 'Add IP-based geolocation for security monitoring, impossible travel detection, and adaptive MFA'
sidebar_position: 4
keywords: [geolocation, ip, maxmind, geoip, location, security, impossible travel, adaptive mfa]
image: /img/api-social-card.png
---

# Geolocation

Add IP-based geolocation to track where your users log in from. This enables impossible travel detection, new-location MFA triggers, and login location analytics. nauth-toolkit integrates with MaxMind GeoIP2 for fast local lookups (sub-millisecond, no API calls).

## Prerequisites

- A working auth setup ([Quick Start](/docs/quick-start/nestjs))
- A free [MaxMind](https://www.maxmind.com/en/geolite2/signup) account

## Step 1: Install

```bash
yarn add @maxmind/geoip2-node
```

## Step 2: Get MaxMind Credentials

1. Sign up at [MaxMind](https://www.maxmind.com/en/geolite2/signup) (free GeoLite2 account)
2. Generate a license key from your account dashboard
3. Note your account ID (found in account settings)

## Step 3: Configure

```typescript title="config/auth.config.ts"
{
  geoLocation: {
    maxMind: {
      licenseKey: process.env.MAXMIND_LICENSE_KEY,
      accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0', 10),
      autoDownloadOnStartup: true,
    },
  },
}
```

For production, manage database files externally and skip downloads:

```typescript title="config/auth.config.ts"
{
  geoLocation: {
    maxMind: {
      dbPath: '/app/data/maxmind',
      skipDownloads: true,
    },
  },
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `licenseKey` | `string` | Required | MaxMind license key for downloading databases |
| `accountId` | `number` | Required | MaxMind account ID for downloading databases |
| `dbPath` | `string` | System temp | Directory where .mmdb files are stored |
| `autoDownloadOnStartup` | `boolean` | `false` | Download databases on server startup |
| `editions` | `string[]` | `['GeoLite2-City', 'GeoLite2-Country']` | Which MaxMind databases to download |
| `skipDownloads` | `boolean` | `false` | Skip downloads, use existing files only |

:::tip[Clustered deployments]
`autoDownloadOnStartup` is safe when several containers start in parallel. With a distributed storage adapter (Redis or database), instances take turns behind a shared lock instead of all downloading at once, and files already on disk and less than 24 hours old are reused.

Both storage layouts work: on a shared volume the first instance downloads and the rest load its files; on a container-local `dbPath` (the default) each instance downloads its own copy when its turn comes.

Without a distributed adapter the lock is process-local, so each container downloads independently — correct, just not coordinated.
:::

## Step 4: Enable Adaptive MFA (Optional)

Geolocation data powers [Adaptive MFA](/docs/guides/mfa/how-mfa-works#adaptive-mfa), automatically requiring two-factor authentication for logins from new or suspicious locations:

```typescript title="config/auth.config.ts"
{
  mfa: {
    enabled: true,
    enforcement: 'ADAPTIVE',
    adaptive: {
      triggers: ['new_device', 'new_ip', 'new_country', 'impossible_travel'],
      riskLevels: {
        low: { maxScore: 20, action: 'allow', notifyUser: false },
        medium: { maxScore: 50, action: 'require_mfa', notifyUser: true },
        high: { maxScore: 100, action: 'require_mfa', notifyUser: true },
      },
    },
  },
  geoLocation: {
    maxMind: {
      licenseKey: process.env.MAXMIND_LICENSE_KEY,
      accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0', 10),
    },
  },
}
```

Risk factors that use geolocation:
- `new_country` --- Login from a country the user hasn't used before
- `impossible_travel` --- Geographic distance/time anomaly detected
- `new_ip` --- Login from a new IP address (uses country/city for context)

## Updating the GeoIP Database

GeoLite2 databases are updated monthly. For production, use MaxMind's `geoipupdate` tool:

```bash
# Install
apt-get install geoipupdate  # Debian/Ubuntu
brew install geoipupdate      # macOS

# Configure (/etc/GeoIP.conf)
# AccountID YOUR_ACCOUNT_ID
# LicenseKey YOUR_LICENSE_KEY
# EditionIDs GeoLite2-City GeoLite2-Country

# Run
geoipupdate -d /app/data/maxmind
```

After external updates, reload databases without restarting:

```typescript title="src/geo-update.service.ts"
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GeoLocationService } from '@nauth-toolkit/nestjs';

@Injectable()
export class GeoUpdateService {
  constructor(private readonly geoLocationService: GeoLocationService) {}

  @Cron('0 1 * * *') // Daily at 1 AM
  async reloadDatabases(): Promise<void> {
    await this.geoLocationService.reloadGeoLocationDatabaseFromDisk();
  }
}
```

:::tip
Use `reloadGeoLocationDatabaseFromDisk()` when files are managed externally. It reloads from disk without downloading, safe to call frequently even with `skipDownloads: true`.
:::

## What Data is Captured

When enabled, every session and authentication event includes:

```typescript
{
  country: 'US',
  city: 'San Francisco',
  latitude: 37.7749,
  longitude: -122.4194,
}
```

This data is stored in session records, audit logs, and is available via `ClientInfoService` in request context.

:::note[Privacy]
IP addresses are personal data under GDPR. Disclose geolocation tracking in your privacy policy and consider letting users view their login locations.
:::

## Troubleshooting

**Geolocation not working:**
1. Verify `@maxmind/geoip2-node` is installed
2. Check that database files exist in `dbPath`
3. Check logs for MaxMind initialization errors
4. Verify license key and account ID are correct

**Database download fails:**
1. Verify credentials are correct
2. Check network connectivity to MaxMind servers
3. Ensure `dbPath` directory is writable

**No location data in sessions:**
1. Verify geolocation is configured in auth config
2. Check that database files are loaded (service logs)

## What's Next

- **[MFA](/docs/guides/mfa/how-mfa-works#adaptive-mfa)** --- Use geolocation for adaptive MFA risk scoring
- **[Audit Logs](/docs/guides/audit-logs)** --- Location data is captured in every audit record
- **[Configuration](/docs/concepts/configuration#geolocation)** --- Complete geolocation configuration reference
- **[Rate Limiting](/docs/guides/rate-limiting)** --- Brute-force protection and throttling
