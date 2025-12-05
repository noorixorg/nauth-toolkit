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
Geolocation data powers [Adaptive MFA](/docs/features/mfa#adaptive-mfa), automatically requiring two-factor authentication for logins from new or suspicious locations.
:::

## Setup

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="maxmind" label="MaxMind GeoIP2 (Recommended)" default>

**Step 1: Get MaxMind credentials**

1. Sign up for a free account at [MaxMind](https://www.maxmind.com/en/geolite2/signup)
2. Generate a license key
3. Download the GeoLite2 City database (or use the web service)

**Step 2: Install the package**

```bash
yarn add @nauth-toolkit/geolocation-maxmind
```

**Step 3: Configure**

Using database file (recommended for production):

```typescript
import { MaxMindGeolocationProvider } from '@nauth-toolkit/geolocation-maxmind';

const config = {
  geolocationProvider: new MaxMindGeolocationProvider({
    type: 'database',
    databasePath: './data/GeoLite2-City.mmdb',
  }),
};
```

Using web service (simpler setup, requires API calls):

```typescript
const config = {
  geolocationProvider: new MaxMindGeolocationProvider({
    type: 'webService',
    accountId: process.env.MAXMIND_ACCOUNT_ID,
    licenseKey: process.env.MAXMIND_LICENSE_KEY,
  }),
};
```

  </TabItem>
  <TabItem value="custom" label="Custom Provider">

Implement your own geolocation provider by implementing the `IGeolocationProvider` interface:

```typescript
import { IGeolocationProvider, GeolocationData } from '@nauth-toolkit/core';

export class CustomGeolocationProvider implements IGeolocationProvider {
  async lookup(ip: string): Promise<GeolocationData | null> {
    // Your implementation here
    // Call your preferred geolocation API
    return {
      ip,
      country: 'US',
      countryCode: 'US',
      region: 'California',
      city: 'San Francisco',
      latitude: 37.7749,
      longitude: -122.4194,
      timezone: 'America/Los_Angeles',
    };
  }
}

const config = {
  geolocationProvider: new CustomGeolocationProvider(),
};
```

  </TabItem>
</Tabs>

## What Data is Captured

When geolocation is enabled, nauth-toolkit captures and stores:

```typescript
{
  ip: '203.0.113.42',
  country: 'United States',
  countryCode: 'US',
  region: 'California',
  city: 'San Francisco',
  latitude: 37.7749,
  longitude: -122.4194,
  timezone: 'America/Los_Angeles',
  isp: 'Comcast Cable', // If available
  asn: 7922,            // Autonomous System Number
}
```

**Where it's stored:**
- **Session records** - Every session includes login location
- **Audit logs** - All authentication events include location
- **User profile** - Last known location (optional)

:::note Privacy Considerations
IP addresses are considered personal data under GDPR. Ensure your privacy policy discloses geolocation tracking. Consider offering users the ability to view their login locations and opt out of tracking.
:::

## Security Features

### Impossible Travel Detection

Detects when a user appears in two distant locations in an impossibly short time.

**Example:**
1. User logs in from London at 10:00 AM
2. User logs in from Sydney at 10:15 AM
3. nauth-toolkit calculates the distance: ~17,000 km
4. Travel time at 900 km/h (airplane speed): ~19 hours
5. Actual elapsed time: 15 minutes
6. **Impossible travel detected** → Trigger alert/MFA

**Configuration:**

```typescript
{
  security: {
    impossibleTravel: {
      enabled: true,
      maxSpeedKmh: 900,      // Maximum realistic travel speed
      minDistanceKm: 500,    // Minimum distance to check (ignore local moves)
      action: 'require-mfa', // or 'block', 'alert', 'log'
    },
  },
}
```

**Actions:**
- `require-mfa` - Force MFA verification before allowing login
- `block` - Reject the login entirely
- `alert` - Send notification to user's email
- `log` - Record in audit log only (no action)

### New Location Detection

Alert users when they log in from a location they've never used before.

**Configuration:**

```typescript
{
  security: {
    newLocation: {
      enabled: true,
      granularity: 'city',   // 'country', 'city', or 'ip'
      action: 'require-mfa', // or 'alert', 'log'
      notifyUser: true,      // Send email notification
    },
  },
}
```

**Granularity levels:**
- `country` - Alert on new countries only (user in US, now in UK)
- `city` - Alert on new cities (user in NYC, now in LA)
- `ip` - Alert on every new IP address (most strict)

**Email notification example:**

```
Subject: New login from San Francisco, US

Hi John,

We noticed a login to your account from a new location:

Location: San Francisco, California, US
Time: Nov 6, 2025 at 2:30 PM PST
Device: Chrome on macOS
IP: 203.0.113.42

If this was you, no action needed. If not, secure your account immediately.
```

### Geofencing

Restrict logins to specific countries or regions.

**Configuration:**

```typescript
{
  security: {
    geofencing: {
      enabled: true,
      allowedCountries: ['US', 'CA', 'GB'], // ISO 3166-1 alpha-2 codes
      action: 'block', // or 'require-mfa', 'alert'
      message: 'Logins from your location are not permitted.',
    },
  },
}
```

**Use cases:**
- Comply with data residency laws
- Prevent fraud from high-risk countries
- Enforce regional licensing restrictions

:::warning User Impact
Geofencing can lock out legitimate users traveling abroad. Consider using `require-mfa` instead of `block`, or provide an exception process.
:::

## Integration with Adaptive MFA

Geolocation data is a key input for [Adaptive MFA risk scoring](/docs/features/mfa#adaptive-mfa):

```typescript
{
  mfa: {
    adaptive: {
      enabled: true,
      riskFactors: {
        newCountry: 30,        // +30 risk points for new country
        newCity: 20,           // +20 risk points for new city
        impossibleTravel: 100, // +100 risk points (always trigger MFA)
        highRiskCountry: 50,   // +50 risk points for specific countries
      },
      highRiskCountries: ['XX', 'YY'], // ISO codes
      requireOnRiskScore: 50, // Require MFA if score >= 50
    },
  },
}
```

**Risk calculation example:**

| Factor | Points | Total |
|--------|--------|-------|
| Base score | 0 | 0 |
| New city | +20 | 20 |
| New device | +30 | 50 |
| **Result:** Score >= 50 → **MFA required** | | |

## Analytics and Reporting

Query geolocation data for insights about your users.

**Example queries:**

```typescript
// Most common login countries
const countryStats = await auditService.getEventStatsByCountry();
// Returns: [
//   { country: 'US', count: 15234 },
//   { country: 'GB', count: 3421 },
//   { country: 'CA', count: 2103 },
// ]

// Active sessions by location
// Note: Use AuthService or SessionService methods if available
// These are internal implementation details
```

**Use cases:**
- Optimize CDN and server locations
- Identify popular regions for marketing
- Detect account sharing (same user, multiple locations)
- Comply with reporting requirements

## Privacy and Compliance

### GDPR Compliance

**Requirements:**
1. **Disclosure** - Privacy policy must mention IP geolocation tracking
2. **Purpose limitation** - Only use data for stated purposes (security)
3. **Data minimization** - Don't store more than needed
4. **User rights** - Allow users to view/delete their location data

**Implementation:**

```typescript
// Allow users to view their login locations
// Note: Use AuthService methods if available
// These are internal implementation details

// Allow users to delete location history
await auditService.deleteUserLocationData(userId);

// Anonymize IP addresses after geolocation lookup
{
  geolocation: {
    anonymizeIpAfterLookup: true, // Don't store full IP
  },
}
```

### Data Retention

Configure how long to keep geolocation data:

```typescript
{
  geolocation: {
    retentionDays: 90, // Keep location data for 90 days
    anonymizeAfterDays: 30, // Anonymize after 30 days
  },
}
```

**Retention strategies:**
- **Active sessions** - Keep full data while session is active
- **Recent sessions** - Keep for security monitoring (30-90 days)
- **Historical data** - Anonymize or delete after retention period

## Performance Considerations

### Database Lookups vs Web Service

<Tabs>
  <TabItem value="database" label="Database File (Recommended)" default>

**Pros:**
- Extremely fast (local file read)
- No external API calls
- Works offline
- No rate limits

**Cons:**
- Need to update database monthly (GeoLite2 updates)
- Larger deployment size (~60MB for GeoLite2-City)

**Best for:** Production deployments with high traffic

  </TabItem>
  <TabItem value="webservice" label="Web Service">

**Pros:**
- Always up-to-date data
- Smaller deployment size
- No database management

**Cons:**
- Network latency (50-200ms per lookup)
- External dependency
- Rate limits apply
- Costs money for high volume

**Best for:** Low-traffic applications or development

  </TabItem>
</Tabs>

### Caching

Cache geolocation lookups to reduce repeated queries:

```typescript
{
  geolocation: {
    cache: {
      enabled: true,
      ttlSeconds: 3600, // Cache for 1 hour
      maxSize: 10000,   // Store up to 10k IP addresses
    },
  },
}
```

Most users have relatively static IPs, so caching is very effective.

## Updating GeoIP2 Database

GeoLite2 databases are updated monthly. Automate updates:

```bash
# Download latest database
curl -o GeoLite2-City.tar.gz \
  "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_LICENSE_KEY&suffix=tar.gz"

# Extract
tar -xzf GeoLite2-City.tar.gz

# Move to your app's data directory
mv GeoLite2-City_*/GeoLite2-City.mmdb ./data/
```

**Automation:**
- Add to cron job (monthly)
- Use CI/CD pipeline to bundle latest database
- Implement hot-reload (nauth-toolkit detects file changes)

## Next Steps

- [MFA](/docs/features/mfa) - Use geolocation for adaptive MFA
- [Social Login](/docs/features/social-login) - Let users sign in with social accounts
- [Token Delivery](/docs/features/token-delivery) - Choose how to send tokens

