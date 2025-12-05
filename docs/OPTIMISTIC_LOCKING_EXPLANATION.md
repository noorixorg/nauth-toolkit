# Optimistic Locking & Version Field - Security Explanation

## What is Optimistic Locking?

**Optimistic locking** is a concurrency control mechanism that prevents race conditions without explicitly locking database rows. It uses a `version` field that automatically increments whenever the session record is updated.

## How It Works

### 1. Version Field

```typescript
// In session entity
@VersionColumn()  // TypeORM automatically increments this on every UPDATE
declare version: number;
```

Every time the session is updated (token rotation, revocation, etc.), TypeORM automatically increments `version` from `1` → `2` → `3`, etc.

### 2. The Security Check in Auth Guard

```typescript
// Step 1: Get session and store initial version
const session = await this.sessionService.findById(sessionId);
const initialVersion = session.version; // e.g., version = 5

// Step 2: Validate user permissions, check expiration, etc.
// ... (takes time, could be 50-200ms) ...

// Step 3: RE-CHECK session before allowing access
const revalidated = await this.sessionService.findById(sessionId);
if (revalidated.version !== initialVersion) {
  // Version changed! Someone modified the session during our validation
  throw new NAuthException('Session was modified - possible security breach');
}
```

## Security Vulnerability It Prevents: TOCTOU

**TOCTOU = Time-of-Check-Time-of-Use**

This is a critical security vulnerability where there's a time gap between checking if something is valid and actually using it. An attacker can exploit this gap.

### Attack Scenario Without Version Checking

```
Timeline Without Optimistic Locking:
─────────────────────────────────────────────────────────────────
Request A (Legitimate User):
├─ 10:00:00.000 → Check session: isRevoked = false ✅
├─ 10:00:00.050 → Validate user permissions
├─ 10:00:00.100 → Process request → Access granted ✅
└─ Result: User gets access

Request B (Attacker - Concurrent):
├─ 10:00:00.010 → Check session: isRevoked = false ✅
├─ 10:00:00.020 → ATTACK: Admin revokes session (sets isRevoked = true)
├─ 10:00:00.050 → Validate user permissions
├─ 10:00:00.100 → Process request → Access granted ✅ (WRONG!)
└─ Result: Attacker gets access even though session was revoked!
```

**The Problem**: There's a 100ms gap between checking `isRevoked` and using the session. The attacker's request was already in-flight when revocation happened.

### Defense With Optimistic Locking

```
Timeline With Optimistic Locking:
─────────────────────────────────────────────────────────────────
Request A (Legitimate User):
├─ 10:00:00.000 → Get session: version = 5, isRevoked = false ✅
├─ 10:00:00.050 → Validate permissions
├─ 10:00:00.100 → Re-check: version = 5, isRevoked = false ✅
└─ Result: Access granted ✅

Request B (Attacker - Concurrent):
├─ 10:00:00.010 → Get session: version = 5, isRevoked = false ✅
├─ 10:00:00.020 → ATTACK: Admin revokes session
│                 → version increments: 5 → 6, isRevoked = true
├─ 10:00:00.050 → Validate permissions
├─ 10:00:00.100 → Re-check: version = 6 ❌ (was 5!)
└─ Result: 401 Unauthorized - "Session was modified" ✅ BLOCKED!
```

**The Defense**: Even though Request B passed the initial check, the re-validation at the end detected that `version` changed from `5` to `6`, indicating the session was modified during the request.

## Real-World Attack Scenarios Prevented

### 1. **Session Revocation Bypass**

**Attack**: Attacker uses token that gets revoked mid-request
**Prevention**: Version check detects revocation happened during validation
**Impact**: Critical - prevents unauthorized access after account compromise

### 2. **Concurrent Token Refresh Exploitation**

**Attack**: Multiple refresh requests with same token (token reuse)
**Prevention**: First refresh increments version, subsequent requests detect change
**Impact**: Critical - prevents token theft/reuse attacks

### 3. **Token Rotation Race Condition**

**Attack**: Request made with old token while refresh is rotating to new token
**Prevention**: Version mismatch detected when session is updated during rotation
**Impact**: High - prevents invalid token acceptance

### 4. **Account Lockout Bypass**

**Attack**: Request in-flight when account gets locked/deactivated
**Prevention**: Version check detects account status change mid-request
**Impact**: Critical - prevents access after account compromise

## Technical Implementation

### TypeORM @VersionColumn()

```typescript
@Entity('nauth_sessions')
export class Session {
  @VersionColumn() // Automatically increments on UPDATE
  declare version: number;

  // Every UPDATE increments version:
  // UPDATE sessions SET isRevoked=true, version=version+1 WHERE id=123
}
```

### The Guard's Double-Check Pattern

```typescript
// ✅ SECURE: Double-check with version comparison
const initial = await findById(sessionId);
// ... do validation work ...
const revalidated = await findById(sessionId);

if (revalidated.version !== initial.version) {
  // Version changed = session was modified = potential attack
  throw new SecurityException();
}
```

## Performance vs Security Trade-off

**Optimistic Locking Advantages:**

- ✅ No database locks (better performance)
- ✅ Detects race conditions automatically
- ✅ Works across multiple servers/containers
- ✅ Simple to implement

**Trade-offs:**

- ⚠️ Requires re-reading the record (one extra query)
- ⚠️ Can fail on legitimate concurrent updates (needs retry logic)
- ⚠️ Must avoid version increments for non-security updates (like activity tracking)

## Why We Removed updateActivity()

We removed `updateActivity()` from the auth guard because:

- It was causing unnecessary version increments
- Activity tracking isn't security-critical
- It was creating false positives (legitimate requests failing)
- Activity can be tracked via middleware/background jobs instead

**The rule**: Only update session for security-critical operations:

- ✅ Token rotation → version increments (security-critical)
- ✅ Session revocation → version increments (security-critical)
- ❌ Activity tracking → removed (not security-critical)

## Summary

The `version` field provides **optimistic locking** to prevent **TOCTOU (Time-of-Check-Time-of-Use) vulnerabilities**. It ensures that if a session is modified (revoked, rotated, etc.) during request validation, the request is blocked even if it initially passed all checks. This is critical for preventing race condition exploits in multi-server, concurrent environments.

## Storage Adapters and Optimistic Locking

**Important:** Optimistic locking with version fields **only applies to Session entities stored in the database**. It works identically regardless of which storage adapter (Memory, Database, or Redis) you choose, because:

1. ✅ **Sessions are always stored in the database** (never in Redis/Memory)
2. ✅ **Version checking only touches database sessions**
3. ✅ **Storage adapters handle different data** (rate limits, locks, used tokens) which use atomic operations instead of version fields

**See `STORAGE_ADAPTERS_VS_SESSIONS.md` for detailed explanation.**
