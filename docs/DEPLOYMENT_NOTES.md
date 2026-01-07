# Deployment Notes

## Rate Limiting Storage - Current Implementation

### Current State: Memory-Based Storage

The nauth-toolkit currently uses **in-memory storage** for rate limiting, which has implications for different deployment scenarios:

#### - **Single ECS Task (1 Container)**

- **Status**: WORKS
- Rate limiting enforced correctly
- Trade-off: Data lost on container restart (rate limits reset)
- **Acceptable for**: Small-scale deployments

#### WARNING: **Multiple ECS Tasks (2+ Containers)**

- **Status**: PARTIAL PROTECTION
- Rate limiting enforced **per-container**, not globally
- User could bypass limits by hitting different containers
- **Risk Level**: Medium (abuse prevention is diminished, not eliminated)

### What's Rate Limited (In-Memory):

1. Email verification resend (3/hour per email)
2. SMS verification resend (3/hour per phone)
3. IP-based account lockout (5 failed attempts)
4. Token blacklist checking

### What's Stored in Database (Persistent):

1. User sessions (valid across containers -)
2. Login attempts (logged to database -)
3. Verification tokens (in database -)
4. Challenge sessions (in database -)

## Recommendations by Deployment Type

### Single-Container ECS

```typescript
// Default configuration - works out of the box
// No changes needed for basic rate limiting
```

### Multi-Container ECS (Production)

**TODO**: Redis adapter needs to be implemented

```typescript
// Future configuration (not yet implemented)
{
  provide: 'STORAGE_ADAPTER',
  useFactory: () => {
    const adapter = new RedisStorageAdapter({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
    adapter.initialize();
    return adapter;
  },
}
```

### Current Mitigations

Even with in-memory rate limiting, you're protected by:

1. **Database-backed verification tokens**
   - Each verification code requires a database record
   - Expires in 5 minutes (SMS) or 60 minutes (email)
   - Max 3 attempts per code

2. **Per-container rate limiting**
   - Each container independently enforces limits
   - Attacker would need to hit different containers simultaneously
   - Still provides some protection

3. **60-second resend delay**
   - Enforced before sending any code (time-based)
   - Works even in multi-container (database check)

## Rate Limiting Details

### Email Verification

- **Rate Limit**: 3 emails per hour
- **Resend Delay**: 60 seconds minimum between requests
- **Storage**: In-memory counter (per-container)

### SMS Verification

- **Rate Limit**: 3 SMS per hour
- **Resend Delay**: Configurable (default: 60 seconds)
- **Resend Limitation**: Only if pending verification exists
- **Storage**: In-memory counter (per-container)

### Account Lockout

- **Max Attempts**: 5 per IP
- **Lockout Duration**: 15 minutes
- **Storage**: In-memory cache (per-container)
- **Note**: Failed attempts are also logged to database

## ECS Deployment Considerations

### Acceptable Deployments (Memory-Based)

- Single container/task definition
- Development/staging environments
- Low-risk applications
- Applications with external rate limiting (CloudFront, API Gateway)

### Requires Redis (Not Yet Implemented)

- Multi-container production deployments
- High-traffic applications
- Applications requiring global rate limiting
- Enterprise deployments with strict security requirements

## Next Steps for Production

To support multi-container ECS, implement a `RedisStorageAdapter`:

```typescript
// packages/core/src/storage/redis-storage.adapter.ts
export class RedisStorageAdapter implements StorageAdapter {
  private client: Redis;

  async initialize(): Promise<void> {
    this.client = createClient({
      socket: {
        host: this.config.host,
        port: this.config.port,
      },
    });
    await this.client.connect();
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  // ... implement all StorageAdapter methods
}
```

## Summary

| Deployment          | Rate Limiting            | Status                |
| ------------------- | ------------------------ | --------------------- |
| Single ECS Task     | Enforced (per-container) | - Works              |
| Multi-Container ECS | Enforced (per-container) | WARNING: Partial protection |
| Production (Redis)  | Enforced (global)        |  TODO               |
