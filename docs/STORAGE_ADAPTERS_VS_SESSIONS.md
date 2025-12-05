# Storage Adapters vs Sessions - Optimistic Locking

## Key Distinction

**Optimistic locking with version fields is ONLY for database-stored Session entities.**
**Storage adapters (Redis/Memory/Database) use different atomic mechanisms.**

## What's Stored Where?

### 🗄️ **Database (Always) - With Optimistic Locking**

**Sessions** - Always stored in database, regardless of storage adapter:

```typescript
// Session entity in database
@Entity('nauth_sessions')
export class Session {
  @VersionColumn() // ← Optimistic locking version field
  version: number;

  id: number;
  userId: number;
  accessTokenHash: string;
  refreshTokenHash: string;
  isRevoked: boolean;
  expiresAt: Date;
  // ... other fields
}
```

**Why sessions are always in database:**
- Persistent across server restarts
- Shared across all server instances
- Supports complex queries (find by user, device, etc.)
- Optimistic locking with `@VersionColumn()` prevents TOCTOU attacks

### 📦 **Storage Adapters (Redis/Memory/Database) - No Version Fields**

**Transient state only** - Stored via your chosen storage adapter:

1. **Rate limit counters** (`rate-limit:email:user@example.com`)
2. **Distributed locks** (`refresh-lock:tokenHash`)
3. **Used token tracking** (`used-token:tokenHash`)
4. **Account lockout state** (`lockout:ip:1.2.3.4`)

**Why no version fields:**
- Simple key-value data, not complex entities
- Atomic operations (Redis `INCR`, database `UPDATE`) already prevent races
- Short-lived (TTL-based expiration)
- No need for complex queries

## How Each Works

### Session Version Checking (Database Only)

```typescript
// In AuthGuard - checks database session version
const session = await this.sessionService.findById(sessionId);
const initialVersion = session.version; // e.g., 5

// ... validate user permissions ...

// Re-check version to detect mid-request modifications
const revalidated = await this.sessionService.findById(sessionId);
if (revalidated.version !== initialVersion) {
  throw new SecurityException('Session was modified');
}
```

✅ **Works identically regardless of storage adapter** because:
- Sessions are always in database
- Version checking logic only touches database sessions
- Storage adapter selection doesn't affect session handling

### Storage Adapter Atomic Operations

**Memory Adapter:**
```typescript
// JavaScript Map with atomic operations
private store: Map<string, StoredValue> = new Map();

async incr(key: string): Promise<number> {
  const current = parseInt(this.store.get(key)?.value || '0', 10);
  const newValue = current + 1;
  this.store.set(key, { value: newValue.toString(), expiresAt: ... });
  return newValue;
}
```

**Database Adapter:**
```typescript
// TypeORM transaction with pessimistic locking
async incr(key: string): Promise<number> {
  return await this.rateLimitRepo.manager.transaction(async (em) => {
    const record = await em.findOne(RateLimit, {
      where: { key },
      lock: { mode: 'pessimistic_write' }, // ← Database-level lock
    });
    // Update atomically
  });
}
```

**Redis Adapter:**
```typescript
// Redis native atomic INCR command
async incr(key: string): Promise<number> {
  return await this.redisClient.incr(`nauth_${key}`); // ← Redis atomic operation
}
```

## Why Storage Adapters Don't Need Version Fields

### 1. **Atomic Operations**
- Redis: `INCR`, `SET`, `DEL` are atomic by design
- Database: Pessimistic locking or transactions ensure atomicity
- Memory: Single-threaded Node.js event loop makes operations atomic

### 2. **Single-Purpose Data**
- Rate limit counter: Just increment/decrement
- Lock: Just set/unset
- Used token: Just exists/doesn't exist
- No complex relationships or concurrent modifications to track

### 3. **Different Race Condition Solutions**

**Sessions (database):**
- Multiple fields that can change independently
- Complex validation logic
- **Solution:** Version field + double-check pattern (optimistic locking)

**Storage adapters:**
- Single value per key
- Simple increment/decrement operations
- **Solution:** Atomic operations (Redis `INCR`, database locks)

## Example: Refresh Token Lock Flow

```typescript
// Step 1: Acquire lock (uses storage adapter - atomic operation)
const lockAcquired = await this.sessionService.acquireRefreshLock(tokenHash);

// Step 2: Validate session (uses database - version checking)
const session = await this.sessionService.findById(sessionId);
const initialVersion = session.version;

// Step 3: Mark token as used (uses storage adapter - atomic operation)
await this.sessionService.markRefreshTokenAsUsed(tokenHash);

// Step 4: Update session with new tokens (database - version increments)
await this.sessionService.updateTokens(sessionId, newAccessHash, newRefreshHash);
// ↑ This increments session.version automatically

// Step 5: Re-check session version (database - optimistic locking)
const revalidated = await this.sessionService.findById(sessionId);
if (revalidated.version !== initialVersion) {
  throw new SecurityException('Session was modified');
}

// Step 6: Release lock (uses storage adapter)
await this.sessionService.releaseRefreshLock(tokenHash);
```

**Notice:**
- Lock acquisition: Storage adapter (atomic `incr`)
- Session validation: Database (version checking)
- Token marking: Storage adapter (atomic `set`)
- Session update: Database (version increments)
- Version re-check: Database (optimistic locking)
- Lock release: Storage adapter (atomic `del`)

## Summary

| Feature | Sessions (Database) | Storage Adapters |
|---------|---------------------|------------------|
| **Location** | Always in database | Redis/Memory/Database (your choice) |
| **Version Field** | ✅ Yes (`@VersionColumn()`) | ❌ No |
| **Optimistic Locking** | ✅ Yes (double-check pattern) | ❌ No (atomic operations instead) |
| **Race Prevention** | Version comparison | Atomic operations (`INCR`, locks) |
| **Affected by Storage Adapter** | ❌ No (always uses database) | ✅ Yes (depends on adapter choice) |
| **Multi-Server** | ✅ Yes (shared database) | Depends on adapter (Memory=❌, Redis/DB=✅) |

## Answer to Your Question

> "Does optimistic locking work the same for Redis and Memory adapters?"

**Yes, optimistic locking works identically regardless of storage adapter** because:

1. ✅ Sessions are **always** stored in the database
2. ✅ Version checking in `AuthGuard` only touches database sessions
3. ✅ Storage adapter choice doesn't affect session handling
4. ✅ Storage adapters use their own atomic mechanisms (don't need version fields)

**The storage adapter only affects:**
- Rate limit counters
- Distributed locks
- Used token tracking
- Account lockout state

**All of which use atomic operations, not version fields.**

