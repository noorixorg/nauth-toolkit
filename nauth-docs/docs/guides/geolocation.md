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

One question drives the whole config: **where do the database files come from?** Answer it with the `download` block, and everything else follows.

```typescript title="config/auth.config.ts"
{
  geoLocation: {
    maxMind: {
      download: {
        from: 'maxmind',
        licenseKey: process.env.MAXMIND_LICENSE_KEY,
        accountId: Number(process.env.MAXMIND_ACCOUNT_ID),
      },
    },
  },
}
```

Omit `download` entirely and the toolkit fetches nothing --- it loads whatever `.mmdb` files are already in `dbPath`. That is the mode for a sidecar, an init container, `geoipupdate`, or a shared volume:

```typescript title="config/auth.config.ts"
{
  geoLocation: {
    maxMind: {
      dbPath: '/app/data/maxmind',
    },
  },
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `dbPath` | `string` | System temp | Directory holding the `.mmdb` files |
| `editions` | `string[]` | `['GeoLite2-City', 'GeoLite2-Country']` | Which databases to load and download |
| `download` | `object` | --- | Where to fetch from. Omit for disk-only |
| `requireDatabaseOnStartup` | `boolean` | `true` for `from: 'url'`, else `false` | Abort startup when no database could be loaded |

The `download` block takes one of two forms, discriminated on `from`:

| `from: 'maxmind'` | Type | Description |
|---|---|---|
| `licenseKey` | `string` | **Required.** MaxMind license key |
| `accountId` | `number` | **Required.** MaxMind account ID |
| `onStartup` | `boolean` | Download during startup. Default `true` |

| `from: 'url'` | Type | Description |
|---|---|---|
| `url` | `string \| Record<string, string>` | **Required.** A `{edition}` template, or one URL per edition |
| `auth` | `{ username, password }` | Optional HTTP Basic credentials |
| `onStartup` | `boolean` | Download during startup. Default `true` |

:::tip[Three modes, no contradictions]
The shape makes the old `skipDownloads` / `autoDownloadOnStartup` pairing unnecessary --- and its impossible combinations unrepresentable.

| Goal | Config |
|---|---|
| Files are put there for me | Omit `download` |
| Fetch at boot | `download: { from: ..., onStartup: true }` (the default) |
| Fetch only when my scheduler calls `updateGeoLocationDatabase()` | `download: { from: ..., onStartup: false }` |
:::

## Downloading from your own mirror

MaxMind rate-limits its download API per licence key. A large fleet where every container downloads on boot burns through that budget, and the instances that lose start with no geolocation data at all.

Point `download.url` at a copy you control and MaxMind is never contacted --- no licence key is involved at all:

```typescript title="config/auth.config.ts"
{
  geoLocation: {
    maxMind: {
      dbPath: '/app/data/maxmind',
      download: {
        from: 'url',
        url: 'https://cdn.example.com/geoip/{edition}.tar.gz',
      },
    },
  },
}
```

`{edition}` is replaced with each entry in `editions`. When your files do not share a naming scheme, give each edition its own URL:

```typescript title="config/auth.config.ts"
{
  geoLocation: {
    maxMind: {
      download: {
        from: 'url',
        url: {
          'GeoLite2-City': 'https://example.com/city.mmdb?X-Amz-Signature=...',
          'GeoLite2-Country': 'https://example.com/country.mmdb?X-Amz-Signature=...',
        },
      },
    },
  },
}
```

**What the URL may serve.** Either a `.tar.gz` laid out the way MaxMind ships it --- so a straight mirror of their archive works untouched --- or a bare `.mmdb` someone already unpacked. The toolkit detects which from the response bytes, not the file extension, so a presigned URL carrying a query string is fine.

**Authentication.** Presigned URLs and public mirrors need none. For a source behind HTTP Basic:

```typescript
download: {
  from: 'url',
  url: 'https://artifacts.internal/geoip/{edition}.tar.gz',
  auth: {
    username: process.env.GEOIP_MIRROR_USER,
    password: process.env.GEOIP_MIRROR_PASSWORD,
  },
},
```

:::note[S3 and other object stores]
`s3://` URLs are rejected. The toolkit ships no AWS SDK and does not sign S3 requests, so use the bucket's HTTPS endpoint, a presigned URL, or a CDN in front of it. Only `https://` is accepted --- plain `http://` works for loopback hosts during local development and nowhere else.
:::

### Startup blocks until the download finishes

`NAuth.create()` and the NestJS module both await geolocation initialisation, so a startup download completes before the instance serves its first request. There is no window where lookups run against an unloaded database.

With `from: 'url'`, a failure to load any database **aborts startup** rather than logging a warning. Booting anyway would leave every lookup silently answering with no data, which is exactly the failure a mirror is meant to prevent. Override it either way with `requireDatabaseOnStartup`:

```typescript
requireDatabaseOnStartup: false,  // boot anyway, warn only
```

The MaxMind API path keeps its original warn-and-continue default. Set `requireDatabaseOnStartup: true` to opt into fail-fast there too.

:::tip[Clustered deployments]
Startup downloads are safe when several containers start in parallel. With a distributed storage adapter (Redis or database), instances take turns behind a shared lock instead of all downloading at once, and files already on disk and less than 24 hours old are reused.

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
Use `reloadGeoLocationDatabaseFromDisk()` when files are managed externally. It reloads from disk without downloading, safe to call frequently, and the only update path in disk-only mode.
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
