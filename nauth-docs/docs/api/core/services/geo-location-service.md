---
title: GeoLocationService
description: Service for IP geolocation using MaxMind GeoIP2 database files. Provides country, city, and coordinate lookups for IP addresses.
keywords: [geolocation, maxmind, geoip, ip, country, city, service, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GeoLocationService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Service for IP geolocation using MaxMind GeoIP2 database files. Provides IP to country/city lookup, database management, and automatic reloading capabilities.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GeoLocationService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GeoLocationService } from '@nauth-toolkit/core';
// Access via nauth.geoLocationService after NAuth.create()
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GeoLocationService } from '@nauth-toolkit/core';
// Access via nauth.geoLocationService after NAuth.create()
```

</TabItem>
</Tabs>

## Overview

The `GeoLocationService` provides IP geolocation using MaxMind GeoIP2 database files (.mmdb). It supports both managed downloads (via MaxMind API) and external database management (via geoipupdate or other tools).

:::note
Only available when `geoLocation.maxMind` is configured. Auto-injected by framework when enabled.
:::

:::info Requirements
- `@maxmind/geoip2-node` peer dependency must be installed
- MaxMind license key and account ID (for downloads) OR pre-existing .mmdb files
- See the [Geolocation guide](/docs/guides/geolocation) for setup instructions
:::

## Methods

### getIpGeolocation()

Get geolocation information for an IP address. Looks up the IP in the loaded MaxMind databases and returns country, city, and coordinates if available.

```typescript
async getIpGeolocation(ip: string): Promise<{
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}>
```

**Parameters**

- `ip` (`string`) - IP address to lookup (IPv4 or IPv6)

**Returns**

Object with optional geolocation fields:
- `country?: string` - Two-letter country code (e.g., 'US', 'GB')
- `city?: string` - City name in English (e.g., 'London', 'New York')
- `latitude?: number` - Geographic latitude
- `longitude?: number` - Geographic longitude

**Behavior**

- Private IPs (localhost, 192.168.x.x, 10.x.x.x, etc.) return `{}` without lookup
- City database is tried first (includes coordinates); falls back to country database
- If no databases are loaded, returns `{}`
- If IP not found in database, returns `{}`

**Errors**

None. This method never throws errors - it returns empty object if geolocation is unavailable.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Injectable } from '@nestjs/common';
import { GeoLocationService } from '@nauth-toolkit/nestjs';

@Injectable()
export class LocationService {
  constructor(private readonly geoLocationService: GeoLocationService) {}

  async checkUserLocation(ip: string) {
    const geo = await this.geoLocationService.getIpGeolocation(ip);
    
    if (geo.country) {
      console.log(`User is from ${geo.city}, ${geo.country}`);
      console.log(`Coordinates: ${geo.latitude}, ${geo.longitude}`);
    } else {
      console.log('Location unknown');
    }
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/check-location', async (req, res) => {
  const ip = req.ip || 'unknown';
  const geo = await nauth.geoLocationService.getIpGeolocation(ip);
  
  res.json({
    ip,
    country: geo.country || 'Unknown',
    city: geo.city || 'Unknown',
    coordinates: geo.latitude && geo.longitude 
      ? { lat: geo.latitude, lng: geo.longitude }
      : null
  });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get('/check-location', async (request, reply) => {
  const ip = request.ip || 'unknown';
  const geo = await nauth.geoLocationService.getIpGeolocation(ip);
  
  return {
    ip,
    country: geo.country || 'Unknown',
    city: geo.city || 'Unknown',
    coordinates: geo.latitude && geo.longitude 
      ? { lat: geo.latitude, lng: geo.longitude }
      : null
  };
});
```

</TabItem>
</Tabs>

---

### reloadGeoLocationDatabaseFromDisk()

Reload MaxMind database files from disk without downloading. Useful when database files are managed externally (via geoipupdate, container volumes, CI/CD, etc.).

```typescript
async reloadGeoLocationDatabaseFromDisk(): Promise<void>
```

**Parameters**

None

**Returns**

Promise that resolves when databases are reloaded

**Behavior**

- Attempts to load `GeoLite2-City.mmdb` and `GeoLite2-Country.mmdb` from configured `dbPath`
- Replaces in-memory database readers with newly loaded ones
- Logs warnings if no database files are found
- Safe to call repeatedly - if files haven't changed, it just reloads the same data
- Works with `skipDownloads: true` configuration

**Errors**

| Code | When |
| ---- | ---- |
| `VALIDATION_FAILED` | MaxMind configuration not provided |
| `VALIDATION_FAILED` | `@maxmind/geoip2-node` peer dependency not installed |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GeoLocationService } from '@nauth-toolkit/nestjs';

@Injectable()
export class GeoReloadService {
  constructor(private readonly geoLocationService: GeoLocationService) {}

  // Reload databases daily (after geoipupdate runs)
  @Cron('0 1 * * *') // Every day at 1 AM
  async reloadDatabases() {
    try {
      await this.geoLocationService.reloadGeoLocationDatabaseFromDisk();
      console.log('MaxMind databases reloaded successfully');
    } catch (error) {
      console.error('Failed to reload databases:', error);
    }
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
// Create an admin endpoint to trigger reload
app.post('/admin/reload-geo-db', async (req, res) => {
  try {
    await nauth.geoLocationService.reloadGeoLocationDatabaseFromDisk();
    res.json({ message: 'Databases reloaded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Or use node-cron
const cron = require('node-cron');
cron.schedule('0 1 * * *', async () => {
  await nauth.geoLocationService.reloadGeoLocationDatabaseFromDisk();
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
// Create an admin endpoint to trigger reload
fastify.post('/admin/reload-geo-db', async (request, reply) => {
  try {
    await nauth.geoLocationService.reloadGeoLocationDatabaseFromDisk();
    return { message: 'Databases reloaded successfully' };
  } catch (error) {
    reply.status(500);
    return { error: error.message };
  }
});

// Or use fastify-cron
fastify.cron.createJob({
  cronTime: '0 1 * * *',
  onTick: async () => {
    await nauth.geoLocationService.reloadGeoLocationDatabaseFromDisk();
  }
});
```

</TabItem>
</Tabs>

---

### updateGeoLocationDatabase()

Download the latest MaxMind database files and reload them into memory. Downloads are serialized across instances with a distributed lock, so containers that start in parallel take turns instead of all calling MaxMind at once.

```typescript
async updateGeoLocationDatabase(): Promise<void>
```

**Parameters**

None

**Returns**

Promise that resolves when databases are downloaded and reloaded

**Behavior**

- Downloads configured editions (default: `GeoLite2-City`, `GeoLite2-Country`) from MaxMind
- Uses distributed locking (lock key: `maxmind-db-update-lock`, TTL: 5 minutes)
- If another instance holds the lock, **waits** for it (up to 2 minutes) rather than giving up
- Reuses `.mmdb` files on disk that are less than 24 hours old instead of re-downloading
- Automatically reloads in-memory database readers after download
- Concurrent calls in the same process share a single run
- Requires `licenseKey` and `accountId` in configuration
- Throws if `skipDownloads: true`

:::note Clustered deployments
The lock serializes instances rather than silencing them, which keeps both storage layouts correct:

- **Shared volume** (EFS, NFS, mounted PVC) — the first instance downloads; the rest find fresh files and load them without hitting MaxMind.
- **Container-local path** (the default, `os.tmpdir()`) — each instance downloads its own copy when its turn comes, so no container is left without geolocation data.
:::

**Errors**

| Code | When |
| ---- | ---- |
| `VALIDATION_FAILED` | MaxMind configuration not provided |
| `VALIDATION_FAILED` | `@maxmind/geoip2-node` peer dependency not installed |
| `VALIDATION_FAILED` | `skipDownloads: true` is set in configuration |
| `VALIDATION_FAILED` | `licenseKey` or `accountId` is missing from configuration |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GeoLocationService } from '@nauth-toolkit/nestjs';

@Injectable()
export class GeoUpdateService {
  constructor(private readonly geoLocationService: GeoLocationService) {}

  // Update databases weekly
  @Cron('0 0 * * 0') // Every Sunday at midnight
  async updateMaxMindDatabases() {
    try {
      await this.geoLocationService.updateGeoLocationDatabase();
      console.log('MaxMind databases updated successfully');
    } catch (error) {
      console.error('Failed to update databases:', error);
    }
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
// Create an admin endpoint to trigger update
app.post('/admin/update-geo-db', async (req, res) => {
  try {
    await nauth.geoLocationService.updateGeoLocationDatabase();
    res.json({ message: 'Databases updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Or use node-cron
const cron = require('node-cron');
cron.schedule('0 0 * * 0', async () => {
  await nauth.geoLocationService.updateGeoLocationDatabase();
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
// Create an admin endpoint to trigger update
fastify.post('/admin/update-geo-db', async (request, reply) => {
  try {
    await nauth.geoLocationService.updateGeoLocationDatabase();
    return { message: 'Databases updated successfully' };
  } catch (error) {
    reply.status(500);
    return { error: error.message };
  }
});

// Or use fastify-cron
fastify.cron.createJob({
  cronTime: '0 0 * * 0',
  onTick: async () => {
    await nauth.geoLocationService.updateGeoLocationDatabase();
  }
});
```

</TabItem>
</Tabs>

---

## Configuration

The `GeoLocationService` is only available when `geoLocation.maxMind` is configured. See [Geolocation Configuration](/docs/concepts/configuration#geolocation) for all options.

### Basic Configuration

```typescript
import { NAuthModuleConfig } from '@nauth-toolkit/nestjs';

export const authConfig: NAuthModuleConfig = {
  // ... other config ...
  
  geoLocation: {
    maxMind: {
      // For managed downloads
      licenseKey: process.env.MAXMIND_LICENSE_KEY,
      accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0', 10),
      dbPath: '/app/data/maxmind',
      
      // OR for external management
      dbPath: '/app/data/maxmind',
      skipDownloads: true,
    },
  },
};
```

## Usage Patterns

### Pattern 1: Auto-Download (Development)

Best for development and single-server deployments.

```typescript
// Config
geoLocation: {
  maxMind: {
    licenseKey: process.env.MAXMIND_LICENSE_KEY,
    accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0', 10),
    autoDownloadOnStartup: true,
  },
}

// No additional code needed - databases auto-download on startup
```

### Pattern 2: Scheduled Updates (Production)

Best for production with nauth-managed downloads.

```typescript
// Config
geoLocation: {
  maxMind: {
    licenseKey: process.env.MAXMIND_LICENSE_KEY,
    accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0', 10),
    dbPath: '/app/data/maxmind',
  },
}

// Service
@Injectable()
export class GeoUpdateService {
  constructor(private readonly geoLocationService: GeoLocationService) {}

  @Cron('0 0 1 * *') // First day of each month
  async updateDatabases() {
    await this.geoLocationService.updateGeoLocationDatabase();
  }
}
```

### Pattern 3: External Management (Production)

Best for production with external database management (geoipupdate, CI/CD).

```typescript
// Config
geoLocation: {
  maxMind: {
    dbPath: '/app/data/maxmind',
    skipDownloads: true,
  },
}

// Service
@Injectable()
export class GeoReloadService {
  constructor(private readonly geoLocationService: GeoLocationService) {}

  @Cron('0 1 * * *') // Daily at 1 AM (after geoipupdate)
  async reloadDatabases() {
    await this.geoLocationService.reloadGeoLocationDatabaseFromDisk();
  }
}
```

## Related

- [Geolocation Feature Guide](/docs/guides/geolocation) - Setup and configuration
- [Configuration Reference](/docs/concepts/configuration#geolocation) - All configuration options
- [ClientInfoService](/docs/api/core/services/client-info-service) - Access geolocation in request context
