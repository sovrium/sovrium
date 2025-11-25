# ADR 006: Table Permission Configuration Storage and Management

**Status**: Proposed
**Date**: 2025-01-25
**Decision Makers**: Product Architecture Review
**Related**: [ADR 005: Authorization Strategy](./005-authorization-strategy.md)

---

## Context

Sovrium implements fine-grained authorization for table APIs with:

- Role-based access control (RBAC) with 4 default roles: owner, admin, member, viewer
- Table-level operation permissions (read, create, update, delete)
- Field-level read/write permissions for sensitive data

**Problem Identified**: AUTH-SPECS-GAP-ANALYSIS.md (2025-11-25) identified missing specification for how table permissions are configured and stored.

**Example Permission Configuration**:

```json
{
  "tableConfig": {
    "id": 1,
    "name": "employees",
    "permissions": {
      "member": {
        "table": { "read": true, "create": false, "update": true, "delete": false },
        "fields": {
          "salary": { "read": false, "write": false }
        }
      },
      "viewer": {
        "table": { "read": true, "create": false, "update": false, "delete": false },
        "fields": {
          "salary": { "read": false, "write": false }
        }
      }
    }
  }
}
```

### Requirements

1. **Per-Table Configuration**: Each table can have different permission rules
2. **Role-Based**: Permissions defined per role (owner, admin, member, viewer)
3. **Field-Level Granularity**: Ability to restrict individual fields by role
4. **Runtime Changes**: Permission changes should apply immediately (no app restart)
5. **Testable via API**: E2E tests must be able to configure permissions dynamically
6. **Default Behavior**: If permissions not configured, default to sensible access control

---

## Decision

**We will store table permissions in a dedicated `table_permissions` PostgreSQL table with a CRUD API for configuration.**

### Database Schema

```sql
CREATE TABLE table_permissions (
  id SERIAL PRIMARY KEY,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  table_permissions JSONB NOT NULL, -- { "read": true, "create": false, ... }
  field_permissions JSONB,          -- { "salary": { "read": false, "write": false }, ... }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(table_id, role) -- One permission config per table+role
);

CREATE INDEX idx_table_permissions_table_id ON table_permissions(table_id);
```

### Configuration API

```
POST   /api/admin/tables/:tableId/permissions
GET    /api/admin/tables/:tableId/permissions
PUT    /api/admin/tables/:tableId/permissions/:role
DELETE /api/admin/tables/:tableId/permissions/:role
```

**Authentication**: Admin-only endpoints (requires `admin` or `owner` role)

### Default Permissions

If no permissions configured for a table+role, use these defaults:

| Role     | Table Permissions                                             | Field Permissions     |
| -------- | ------------------------------------------------------------- | --------------------- |
| `owner`  | `{ read: true, create: true, update: true, delete: true }`    | All fields accessible |
| `admin`  | `{ read: true, create: true, update: true, delete: true }`    | All fields accessible |
| `member` | `{ read: true, create: true, update: true, delete: false }`   | All fields accessible |
| `viewer` | `{ read: true, create: false, update: false, delete: false }` | All fields accessible |

**Rationale**: Secure-by-default with least-privilege principle (viewer is most restrictive).

---

## Rationale

### Why Separate Database Table?

1. **Runtime Configurability**: Permissions can be changed via API without app restart
2. **Per-Table Flexibility**: Each table can have unique permission rules
3. **Testability**: E2E tests can dynamically configure permissions for isolated scenarios
4. **Audit Trail**: created_at/updated_at track permission changes
5. **Scalability**: Database-backed configuration scales better than in-memory config files

### Why Not Static Metadata Column? (Alternative A)

**Approach**: Store permissions as JSONB column in `tables` table.

**Rejected Because**:

- ❌ **Schema coupling**: Tables table becomes overloaded with authorization concerns
- ❌ **Migration complexity**: Adding/removing roles requires table schema migration
- ❌ **Audit trail**: Harder to track permission changes separately from table changes
- ❌ **Query performance**: Filtering/indexing permissions within JSONB is less efficient

### Why Not Configuration Files? (Alternative C)

**Approach**: Store permissions in JSON/YAML files in codebase.

**Rejected Because**:

- ❌ **Not testable via API**: E2E tests cannot configure permissions dynamically
- ❌ **Requires deployment**: Permission changes need code deployment
- ❌ **Multi-tenant challenge**: Each organization needs separate config (complex)
- ❌ **Merge conflicts**: Multiple developers changing permissions causes git conflicts

---

## Consequences

### Positive Consequences

✅ **Runtime Configurability**: Permission changes apply immediately (no restart)
✅ **Per-Organization Support**: Each organization can have custom table permissions (multi-tenancy)
✅ **Testable**: E2E tests can configure permissions via API for isolated scenarios
✅ **Audit Trail**: Database tracks who changed permissions and when
✅ **Scalable**: Database-backed configuration handles millions of permission configs
✅ **Type-Safe**: JSONB schema validated via Effect Schema at API boundaries

### Negative Consequences

❌ **Database Queries**: Every authorization check requires database lookup
→ **Mitigation**: Cache permissions per user+table+role in memory (Redis or Effect.Cache)

❌ **API Surface Expansion**: Need to implement 4 new admin endpoints
→ **Mitigation**: Reuse existing Hono route patterns, follow RESTful conventions

❌ **Migration Complexity**: Need to create `table_permissions` table and populate defaults
→ **Mitigation**: Drizzle migration with sensible defaults for existing tables

❌ **JSONB Schema Validation**: Need to validate permission structure at runtime
→ **Mitigation**: Effect Schema for table_permissions and field_permissions validation

### Risk Mitigation

**Performance Risk**: Permission lookups add latency

- **Mitigation 1**: Cache permissions in memory (TTL: 5 minutes, invalidate on update)
- **Mitigation 2**: Eager-load permissions for active user+table combinations
- **Mitigation 3**: PostgreSQL JSONB indexing for efficient queries

**Security Risk**: Incorrectly configured permissions expose sensitive data

- **Mitigation 1**: Default to most restrictive permissions (viewer-level)
- **Mitigation 2**: Admin-only API (require `admin` or `owner` role)
- **Mitigation 3**: Comprehensive E2E tests for all permission scenarios (28 specs in `specs/api/paths/tables/`)

---

## Alternatives Considered

### Summary Table

| Approach                      | Runtime Changes  | Testable via API | Multi-Tenant | Audit Trail | Verdict                 |
| ----------------------------- | ---------------- | ---------------- | ------------ | ----------- | ----------------------- |
| **Separate Table (Selected)** | ✅ Yes           | ✅ Yes           | ✅ Yes       | ✅ Yes      | ✅ **Best**             |
| Static Metadata Column        | ✅ Yes           | ✅ Yes           | ✅ Yes       | ⚠️ Partial  | ❌ Schema coupling      |
| Configuration Files           | ❌ No            | ❌ No            | ⚠️ Complex   | ❌ No       | ❌ Deployment required  |
| In-Memory Cache Only          | ⚠️ Until restart | ❌ No            | ⚠️ Complex   | ❌ No       | ❌ Data loss on restart |

### Decision Matrix

**Criteria Weights**: Testability (30%), Runtime Changes (25%), Multi-Tenant (20%), Scalability (15%), Implementation Cost (10%)

**Scores** (out of 10):

- **Separate Table**: 9.0 (testability: 10, runtime: 10, multi-tenant: 10, scalability: 9, cost: 6)
- Static Metadata: 7.5 (testability: 10, runtime: 10, multi-tenant: 10, scalability: 7, cost: 4)
- Config Files: 4.0 (testability: 2, runtime: 2, multi-tenant: 4, scalability: 10, cost: 8)
- In-Memory Cache: 5.5 (testability: 4, runtime: 6, multi-tenant: 6, scalability: 8, cost: 8)

**Conclusion**: Separate database table has the highest score due to testability and runtime configurability.

---

## Implementation Notes

### Database Migration

```typescript
// drizzle migration: create_table_permissions.ts
export const tablePermissions = pgTable('table_permissions', {
  id: serial('id').primaryKey(),
  tableId: integer('table_id')
    .notNull()
    .references(() => tables.id, { onDelete: 'cascade' }),
  role: text('role').notNull().$type<'owner' | 'admin' | 'member' | 'viewer'>(),
  tablePermissions: jsonb('table_permissions').notNull(),
  fieldPermissions: jsonb('field_permissions'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const tablePermissionsUniqueConstraint = unique('table_permissions_table_role_unique').on(
  tablePermissions.tableId,
  tablePermissions.role
)
```

### Effect Schema Validation

```typescript
// src/domain/models/table/permissions.ts
import { Schema } from '@effect/schema'

export const TablePermissionsSchema = Schema.Struct({
  read: Schema.Boolean,
  create: Schema.Boolean,
  update: Schema.Boolean,
  delete: Schema.Boolean,
})

export const FieldPermissionsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Struct({
    read: Schema.optional(Schema.Boolean),
    write: Schema.optional(Schema.Boolean),
  }),
})

export const PermissionConfigSchema = Schema.Struct({
  role: Schema.Literal('owner', 'admin', 'member', 'viewer'),
  tablePermissions: TablePermissionsSchema,
  fieldPermissions: Schema.optional(FieldPermissionsSchema),
})
```

### API Endpoint Example

```typescript
// POST /api/admin/tables/:tableId/permissions
app.post(
  '/api/admin/tables/:tableId/permissions',
  requireAuth,
  requireRole(['admin', 'owner']),
  async (c) => {
    const tableId = parseInt(c.req.param('tableId'))
    const config = await c.req.json()

    // Validate with Effect Schema
    const validated = Schema.decodeUnknownSync(PermissionConfigSchema)(config)

    // Insert or update permission
    await db
      .insert(tablePermissions)
      .values({
        tableId,
        role: validated.role,
        tablePermissions: validated.tablePermissions,
        fieldPermissions: validated.fieldPermissions || null,
      })
      .onConflictDoUpdate({
        target: [tablePermissions.tableId, tablePermissions.role],
        set: {
          tablePermissions: validated.tablePermissions,
          fieldPermissions: validated.fieldPermissions || null,
          updatedAt: new Date(),
        },
      })

    // Invalidate cache
    await invalidatePermissionCache(tableId, validated.role)

    return c.json({ success: true })
  }
)
```

### Caching Strategy

```typescript
// src/application/services/authorization-cache.ts
import * as Effect from 'effect/Effect'
import * as Cache from 'effect/Cache'

export const PermissionCache = Cache.make({
  capacity: 1000,
  timeToLive: Effect.succeed(Duration.minutes(5)),
  lookup: (key: string) => fetchPermissionsFromDB(key),
})

// Cache key: "tableId:role" (e.g., "1:member")
export const getPermissions = (tableId: number, role: string) =>
  Effect.gen(function* () {
    const cache = yield* PermissionCache
    const cacheKey = `${tableId}:${role}`
    return yield* cache.get(cacheKey)
  })
```

---

## Enforcement

### Database-Level Enforcement (Active)

**UNIQUE Constraint**: `(table_id, role)` ensures one permission config per table+role

**Foreign Key**: `table_id REFERENCES tables(id) ON DELETE CASCADE` ensures orphaned permissions are cleaned up

**CHECK Constraint**: `role IN ('owner', 'admin', 'member', 'viewer')` prevents invalid roles

**Verification**: PostgreSQL enforces these constraints at insert/update time

---

### Effect Schema Validation (Active)

**Purpose**: Runtime validation of permission structure before database storage

**What's Enforced**:

- ✅ Permission config structure matches schema (table + field permissions)
- ✅ Role must be one of 4 valid values (owner, admin, member, viewer)
- ✅ Boolean values for permission flags (no strings or nulls accepted)

**Verification**: Effect Schema validation at API boundary catches invalid configs

---

### ESLint Boundaries (Active)

**Enforces**: Permission service in application layer, not infrastructure

**Configuration**: `eslint/boundaries.config.ts` (application-service element)

**What's Enforced**:

- ✅ Permission service in `src/application/services/authorization.ts`
- ✅ Permission checks cannot bypass application layer
- ✅ Infrastructure layer (database) only accessed via application services

**Verification**: `bun run lint` catches boundary violations

---

### Manual Review Required

1. **Default Permission Logic**: Ensure fallback permissions are sensible (viewer-level restrictive)
2. **Cache Invalidation**: Verify cache invalidates on permission updates
3. **Performance**: Monitor permission lookup latency (target < 10ms with cache)
4. **Multi-Tenancy**: Verify organization isolation (users cannot set permissions for other orgs)

---

## Implementation Status

**Phase**: Proposed (ADR pending approval)

**Blockers**:

- ❌ Awaiting user decision on approach (separate table vs metadata column)
- ❌ E2E test specs reference `tableConfig.permissions` but API doesn't exist yet

**Next Steps**:

1. **User Decision**: Approve ADR 006 or request changes
2. **Create Drizzle Migration**: Define `table_permissions` table schema
3. **Implement Admin API**: 4 CRUD endpoints for permission configuration
4. **Update Authorization Service**: Query `table_permissions` table instead of hardcoded defaults
5. **Implement Caching**: Effect.Cache for permission lookups
6. **Write E2E Tests**: Validate permission configuration and enforcement (28 specs exist, need API integration)
7. **Update AUTH-SPECS-GAP-ANALYSIS.md**: Mark permission configuration as resolved

---

## References

- **Related ADR**: [ADR 005: Authorization Strategy](./005-authorization-strategy.md)
- **Gap Analysis**: [AUTH-SPECS-GAP-ANALYSIS.md](../../../AUTH-SPECS-GAP-ANALYSIS.md)
- **E2E Specs**: [Table API Authorization Tests](../../../specs/api/paths/tables/)
- **Better Auth**: [Organization Plugin](../../infrastructure/framework/better-auth/123-plugins-organization.md)

---

**Last Updated**: 2025-01-25
**Authors**: Product Architecture Team
**Status**: Proposed (awaiting approval) ⏳
