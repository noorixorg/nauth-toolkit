---
title: Geolocation
description: Track user location by IP address for security and analytics
sidebar_position: 4
---

# Geolocation

Track where your users are logging in from using IP address geolocation. This enables security features like impossible travel detection and provides valuable analytics about your user base.

For complete geolocation configuration options, see the [Configuration guide](/docs/concepts/configuration#geolocation).

:::info How It Works
nauth-toolkit integrates with MaxMind GeoIP2 to convert IP addresses to geographic locations (country, city, coordinates). This data is stored with sessions and login events for security monitoring and analytics.

The geolocation service is built into the core and uses MaxMind database files (.mmdb) for fast, local lookups.
:::

## Why Use Geolocation?

**Security benefits:**
- Detect impossible travel (user in Tokyo 1 hour ago, now in New York)
- Alert users of logins from new locations
- Automatically trigger MFA for logins from new countries
- Identify suspicious patterns (multiple countries in short time)

**Analytics benefits:**
- Understand where your users are located
- Optimize server locations for performance
- Comply with data residency requirements
- Provide localized experiences

:::tip Adaptive MFA Integration
Geolocation data powers [Adaptive MFA](/docs/features/mfa#adaptive-mfa-risk-based-authentication), automatically requiring two-factor authentication for logins from new or suspicious locations.
:::

## Setup

### Step 1: Install MaxMind Package

Geolocation requires the `@maxmind/geoip2-node` package as a peer dependency:

```bash
yarn add @maxmind/geoip2-node
```

### Step 2: Get MaxMind Credentials

1. Sign up for a free account at [MaxMind](https://www.maxmind.com/en/geolite2/signup)
2. Generate a license key from your account dashboard
3. Note your account ID (found in your account settings)

### Step 3: Configure

Add geolocation configuration to your auth config:

```typescript
import { NAuthModuleConfig } from '@nauth-toolkit/nestjs';

export const authConfig: NAuthModuleConfig = {
  // ... other config ...

  geoLocation: {
    maxMind: {
      licenseKey: process.env.MAXMIND_LICENSE_KEY,
      accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0', 10),
      // Optional: Custom database path (defaults to system temp directory)
      dbPath: '/app/data/maxmind',
      // Optional: Auto-download databases on startup (default: false)
      autoDownloadOnStartup: false,
      // Optional: Which databases to download (default: ['GeoLite2-City', 'GeoLite2-Country'])
      editions: ['GeoLite2-City', 'GeoLite2-Country'],
      // Optional: Skip downloads if managing files externally (default: false)
      skipDownloads: false,
    },
  },
};
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `licenseKey` | `string` | Required | MaxMind license key for downloading databases |
| `accountId` | `number` | Required | MaxMind account ID for downloading databases |
| `dbPath` | `string` | System temp | Directory where .mmdb files are stored |
| `autoDownloadOnStartup` | `boolean` | `false` | Download databases automatically on server startup |
| `editions` | `string[]` | `['GeoLite2-City', 'GeoLite2-Country']` | Which MaxMind databases to download |
| `skipDownloads` | `boolean` | `false` | Skip all downloads (use existing files only) |

**Usage Modes:**

1. **Auto-download mode** (recommended for development):
   ```typescript
   maxMind: {
     licenseKey: process.env.MAXMIND_LICENSE_KEY,
     accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0', 10),
     autoDownloadOnStartup: true, // Downloads on first run
   }
   ```

2. **External management mode** (recommended for production):
   ```typescript
   maxMind: {
     dbPath: '/app/data/maxmind',
     skipDownloads: true, // Toolkit only loads existing files
     // No licenseKey/accountId needed
   }
   ```
   Use MaxMind's `geoipupdate` tool or CI/CD to manage database updates.

3. **Custom path with auto-download**:
   ```typescript
   maxMind: {
     dbPath: '/app/data/maxmind',
     licenseKey: process.env.MAXMIND_LICENSE_KEY,
     accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0', 10),
     autoDownloadOnStartup: true,
   }
   ```

## What Data is Captured

When geolocation is enabled, nauth-toolkit captures and stores:

```typescript
{
  country: 'US',           // ISO country code
  city: 'San Francisco',   // City name (if available)
  latitude: 37.7749,       // Latitude (if available)
  longitude: -122.4194,    // Longitude (if available)
}
```

**Where it's stored:**
- **Session records** - Every session includes login location
- **Audit logs** - All authentication events include location
- **Client info** - Available via `ClientInfoService` in request context

:::note Privacy Considerations
IP addresses are considered personal data under GDPR. Ensure your privacy policy discloses geolocation tracking. Consider offering users the ability to view their login locations and opt out of tracking.
:::

## Integration with Adaptive MFA

Geolocation data is a key input for [Adaptive MFA risk scoring](/docs/features/mfa#adaptive-mfa-risk-based-authentication):

```typescript
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

**Risk factors that use geolocation:**
- `new_country` - Login from a country the user hasn't used before
- `impossible_travel` - Geographic distance/time anomaly detected
- `new_ip` - Login from a new IP address (uses country/city for context)

## Updating GeoIP2 Database

GeoLite2 databases are updated monthly by MaxMind. You have several options for keeping them up to date:

### Option 1: Auto-download on Startup

Enable `autoDownloadOnStartup` to download databases when the server starts:

```typescript
maxMind: {
  licenseKey: process.env.MAXMIND_LICENSE_KEY,
  accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0', 10),
  autoDownloadOnStartup: true,
}
```

:::warning Multi-Server Deployments
Only enable `autoDownloadOnStartup` if you're using a distributed storage adapter (Redis/Database). Otherwise, multiple servers may try to download simultaneously.
:::

### Option 2: Manual Update via API

Call the `updateGeoLocationDatabase()` method programmatically:

```typescript
// In your service or controller
await geoLocationService.updateGeoLocationDatabase();
```

Set up a cron job to call this periodically:

```typescript
// Example: Update databases weekly
@Cron('0 0 * * 0') // Every Sunday at midnight
async updateMaxMindDatabases() {
  await this.geoLocationService.updateGeoLocationDatabase();
}
```

### Option 3: External Management (Recommended for Production)

Use MaxMind's official `geoipupdate` tool or manage downloads via CI/CD:

```typescript
maxMind: {
  dbPath: '/app/data/maxmind',
  skipDownloads: true, // Toolkit only loads existing files
}
```

Then use `geoipupdate`:

```bash
# Install geoipupdate
apt-get install geoipupdate  # Debian/Ubuntu
brew install geoipupdate      # macOS

# Configure
cat > /etc/GeoIP.conf <<EOF
AccountID YOUR_ACCOUNT_ID
LicenseKey YOUR_LICENSE_KEY
EditionIDs GeoLite2-City GeoLite2-Country
EOF

# Update databases
geoipupdate -d /app/data/maxmind
```

## Performance Considerations

**Database file lookups:**
- Extremely fast (local file read, less than 1ms)
- No external API calls
- Works offline
- No rate limits
- Database files are approximately 60MB total (GeoLite2-City + GeoLite2-Country)

**Best practices:**
- Use database files (not web service) for production
- Store databases on fast storage (SSD)
- Update databases monthly (MaxMind releases updates monthly)
- Use distributed storage adapter for multi-server deployments

## Troubleshooting

**Geolocation not working:**
1. Check that `@maxmind/geoip2-node` is installed
2. Verify database files exist in `dbPath` directory
3. Check logs for MaxMind initialization errors
4. Ensure license key and account ID are correct

**Database download fails:**
1. Verify license key and account ID are correct
2. Check network connectivity to MaxMind servers
3. Ensure `dbPath` directory is writable
4. Check storage adapter is configured (required for distributed locking)

**No location data in sessions:**
1. Verify geolocation is configured in auth config
2. Check that database files are loaded (check service logs)
3. Ensure `GeoLocationService` is initialized (check module setup)

## Next Steps

- [MFA](/docs/features/mfa) - Use geolocation for adaptive MFA
- [Configuration](/docs/concepts/configuration#geolocation) - Complete configuration reference
- [Social Login](/docs/features/social-login) - Let users sign in with social accounts
- [Token Delivery](/docs/features/token-delivery) - Choose how to send tokens
