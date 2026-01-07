# Database Architecture

##  **Design Decision: Database-Specific Entity Packages**

The `nauth-toolkit` supports multiple databases (PostgreSQL, MySQL) by providing **separate entity packages** for each database type. Each package contains TypeORM entities with database-specific column types.

### **Why Separate Packages Instead of Adapters?**

TypeORM decorators are **compile-time metadata** and require static literal values. Runtime adapters cannot be used in decorator definitions, so we use separate entity packages with hardcoded column types for each database.

##  **Architecture**

### **Core Components:**

1. **Base Entity Classes** (`@nauth-toolkit/core`) - Database-agnostic field definitions and business logic
2. **Database-Specific Entities** (`@nauth-toolkit/database-typeorm-postgres`, `@nauth-toolkit/database-typeorm-mysql`) - Extend base classes with TypeORM decorators and database-specific column types

### **Entity Pattern:**

```typescript
// Core: Base entity with all fields and logic
// packages/core/src/entities/user.entity.ts
export class BaseUser {
  id!: number;
  sub!: string;
  email!: string;
  metadata?: Record<string, unknown> | null;
  // ... all fields and business methods
}

// PostgreSQL: Extends base + adds PostgreSQL-specific decorators
// packages/database/typeorm-postgres/src/entities/user.entity.ts
@Entity('nauth_users')
export class User extends BaseUser {
  @Column({ type: 'uuid', unique: true })
  declare sub: string;

  @Column({ type: 'jsonb', nullable: true })
  declare metadata?: Record<string, unknown> | null;
}

// MySQL: Extends base + adds MySQL-specific decorators
// packages/database/typeorm-mysql/src/entities/user.entity.ts
@Entity('nauth_users')
export class User extends BaseUser {
  @Column({ type: 'char', length: 36, unique: true })
  declare sub: string;

  @Column({ type: 'json', nullable: true })
  declare metadata?: Record<string, unknown> | null;
}
```

##  **Database Compatibility Matrix**

| Feature | PostgreSQL | MySQL | SQLite | MSSQL |
|---------|------------|-------|--------|-------|
| **UUID Generation** | - Native (`pgcrypto`) | WARNING: Node.js crypto | WARNING: Node.js crypto | WARNING: Node.js crypto |
| **UUID Column Type** | `uuid` | `char(36)` | `text` | `uniqueidentifier` |
| **JSON Storage** | `jsonb` (binary) | `json` | `text` | `nvarchar(max)` |
| **Array Storage** | `text[]` (native) | `json` | `text` | `nvarchar(max)` |
| **Boolean Type** | `boolean` | `tinyint(1)` | `integer` | `bit` |
| **Timestamp** | `timestamp` | `datetime` | `text` | `datetime2` |

##  **Implementation Status**

### **- Completed:**
- PostgreSQL entity package with native UUID, JSONB, array support
- MySQL entity package with char(36) UUID, JSON, and proper type mappings
- Base entity classes in core with all business logic
- Entity inheritance pattern (no code duplication)
- Database-specific column type mappings

### **Future Work:**
- SQLite entity package (for testing)
- MSSQL entity package (for enterprise)
- Migration scripts between database types

##  **Benefits**

1. **No Code Duplication** - Field definitions in base classes, only decorators differ
2. **Type Safety** - Full TypeScript support, compile-time checking
3. **Database Optimizations** - Each package uses native database features
4. **Clear Separation** - Business logic in core, database specifics in packages
5. **Easy to Extend** - Add new databases by creating a new entity package

##  **Usage**

```typescript
// Install the appropriate database package
yarn add @nauth-toolkit/database-typeorm-postgres  // or ...typeorm-mysql

// In your app.module.ts
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';

TypeOrmModule.forRoot({
  type: 'postgres',
  entities: getNAuthEntities(), // - All entities with correct column types
})
```
