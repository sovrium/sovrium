# Dual-Layer Authorization Architecture

## Overview

Sovrium implements a **dual-layer authorization architecture** where Better Auth and PostgreSQL Row-Level Security (RLS) work together as complementary security layers. This document explains how these layers interact and why both are necessary.

## The Two Layers

### Layer 1: Better Auth (API Guards)

**Purpose**: Gate access at the API route level before database queries execute.

```
HTTP Request → Better Auth Guard → Permission Check → (Block or Allow)
```

**Responsibilities**:

- Authentication (verify user identity)
- Session management
- Role-based access control via `hasPermission()`
- Early rejection of unauthorized requests
- API-level rate limiting

**Implementation**: Hono middleware with Better Auth Access Control plugin

```typescript
// Better Auth Access Control statement format
const statements = ac.newStatementBuilder({
  'projects:read': ['owner', 'admin', 'member'],
  'projects:write': ['owner', 'admin'],
  'projects:delete': ['owner'],
})
```

### Layer 2: PostgreSQL RLS (Database Guards)

**Purpose**: Filter and enforce access at the database level, regardless of application code.

```
SQL Query → RLS Policy → Row Filtering → (Filtered Results)
```

**Responsibilities**:

- Row-level filtering based on ownership
- Field-level visibility enforcement
- Organization isolation
- Defense against application bugs

**Implementation**: PostgreSQL RLS policies generated from table permission config

```sql
-- Example RLS policy for owner-based access
CREATE POLICY owner_access ON records
  USING (owner_id = current_setting('app.user_id')::text);
```

## Why Both Layers?

### Defense in Depth

If an attacker bypasses the API layer (through a bug or exploit), the database layer still enforces restrictions:

```
┌──────────────────────────────────────────────────────┐
│                    HTTP Request                       │
└────────────────────────┬─────────────────────────────┘
                         │
            ┌────────────▼────────────┐
            │   LAYER 1: Better Auth   │  ← Blocks invalid role/permission
            │   (API Guards)           │
            └────────────┬────────────┘
                         │ (if allowed)
            ┌────────────▼────────────┐
            │   LAYER 2: PostgreSQL    │  ← Filters rows user can't see
            │   (RLS Policies)         │
            └────────────┬────────────┘
                         │
            ┌────────────▼────────────┐
            │    Filtered Results     │
            └─────────────────────────┘
```

### Different Strengths

| Capability          | Better Auth         | PostgreSQL RLS           |
| ------------------- | ------------------- | ------------------------ |
| **Speed**           | Fast (in-memory)    | Slower (database)        |
| **Early rejection** | ✅ Yes              | ❌ Query must execute    |
| **Role checks**     | ✅ Native support   | ❌ Requires session vars |
| **Row filtering**   | ❌ Application code | ✅ Native support        |
| **Bug-proof**       | ❌ Code can bypass  | ✅ Database enforces     |
| **Audit trail**     | ❌ Manual logging   | ✅ Built-in              |

## Five Dual-Layer Patterns

### Pattern 1: Early Rejection

Better Auth blocks the request before RLS even runs.

**Scenario**: User without `projects:write` permission tries to create a record.

```
Request → Better Auth: hasPermission('projects:write') → BLOCKED (403)
         (RLS never executes - saves database query)
```

**Test Example** (from `admin-enforcement.spec.ts`):

```typescript
test.fixme('API-AUTH-ENFORCEMENT-009: should block at API layer before RLS for unauthorized roles')
```

### Pattern 2: Dual Filtering

Better Auth allows the role, then RLS filters the rows.

**Scenario**: Admin can read projects, but RLS limits to their organization's projects.

```
Request → Better Auth: hasPermission('projects:read') → ALLOWED
       → RLS: organization_id = current_org → Returns 5 of 100 rows
```

**Test Example** (from `rls-enforcement.spec.ts`):

```typescript
test.fixme('API-TABLES-PERMISSIONS-RLS-009: should demonstrate dual-layer filtering')
```

### Pattern 3: Field-Level Filtering

Better Auth grants base access, RLS hides sensitive fields.

**Scenario**: Member can read records, but salary field is hidden by RLS.

```
Request → Better Auth: hasPermission('records:read') → ALLOWED
       → RLS: Returns record WITH salary = NULL for non-admin
```

**Test Example** (from `field-permissions.spec.ts`):

```typescript
test.fixme('API-TABLES-FIELD-PERMISSIONS-008: should demonstrate dual-layer field filtering')
```

### Pattern 4: Organization Isolation

Both layers verify organization membership independently.

**Scenario**: User tries to access record from different organization.

```
Request → Better Auth: User is authenticated, has member role → ALLOWED
       → RLS: organization_id = 'org_456' ≠ user's 'org_123' → No rows returned
```

**Test Example** (from `organization-isolation.spec.ts`):

```typescript
test.fixme('API-TABLES-ORG-ISOLATION-010: should enforce dual-layer organization validation')
```

### Pattern 5: Owner-Based Access

Better Auth checks permission type, RLS filters to owned records only.

**Scenario**: User with `records:read` permission can only see records they created.

```
Request → Better Auth: hasPermission('records:read') → ALLOWED
       → RLS: owner_id = current_user → Returns only user's 3 records
```

**Test Example** (from `field-permissions.spec.ts`):

```typescript
test.fixme('API-TABLES-FIELD-PERMISSIONS-010: should enforce owner-based dual-layer access')
```

## Implementation Guide

### Configuring Both Layers

**App Schema** (`app.json`):

```json
{
  "name": "my-app",
  "auth": {
    "emailAndPassword": true,
    "plugins": {
      "organization": true,
      "accessControl": true
    }
  },
  "tables": [
    {
      "id": 1,
      "name": "projects",
      "fields": [
        { "id": 1, "name": "id", "type": "integer", "required": true },
        { "id": 2, "name": "name", "type": "single-line-text" },
        { "id": 3, "name": "budget", "type": "currency" }
      ],
      "permissions": {
        "read": { "type": "roles", "roles": ["owner", "admin", "member"] },
        "create": { "type": "roles", "roles": ["owner", "admin"] },
        "update": { "type": "roles", "roles": ["owner", "admin"] },
        "delete": { "type": "roles", "roles": ["owner"] },
        "fieldPermissions": {
          "budget": {
            "read": { "type": "roles", "roles": ["owner", "admin"] },
            "write": { "type": "roles", "roles": ["owner"] }
          }
        }
      }
    }
  ]
}
```

### Layer 1: Better Auth Setup

```typescript
// src/infrastructure/auth/access-control.ts
import { createAccessControl } from 'better-auth/plugins/access-control'

export const ac = createAccessControl({
  statements: {
    'projects:read': ['owner', 'admin', 'member'],
    'projects:create': ['owner', 'admin'],
    'projects:update': ['owner', 'admin'],
    'projects:delete': ['owner'],
  },
})

// Middleware usage
app.post('/api/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')

  // Layer 1: Better Auth permission check
  if (!(await ac.hasPermission(user, 'projects:create'))) {
    return c.json({ error: 'Forbidden' }, 403) // Early rejection
  }

  // Layer 2: RLS will filter on database query
  // ...
})
```

### Layer 2: RLS Generation

RLS policies are generated from table permissions:

```typescript
// src/infrastructure/database/rls-generators.ts
export function generateRLSPolicy(table: Table): string {
  const policies: string[] = []

  // Organization isolation
  policies.push(`
    CREATE POLICY org_isolation ON ${table.name}
      USING (organization_id = current_setting('app.org_id')::text);
  `)

  // Owner-based access
  if (table.permissions.read.type === 'owner') {
    policies.push(`
      CREATE POLICY owner_read ON ${table.name}
        FOR SELECT
        USING (owner_id = current_setting('app.user_id')::text);
    `)
  }

  // Field-level hiding
  for (const [field, perms] of Object.entries(table.permissions.fieldPermissions ?? {})) {
    if (perms.read.type === 'roles') {
      policies.push(`
        CREATE POLICY field_${field}_read ON ${table.name}
          FOR SELECT
          USING (
            current_setting('app.user_role')::text = ANY(ARRAY[${perms.read.roles.map((r) => `'${r}'`).join(',')}])
            OR ${field} IS NULL
          );
      `)
    }
  }

  return policies.join('\n')
}
```

### Setting Session Variables

Before each query, set the RLS context:

```typescript
// src/infrastructure/database/rls-context.ts
export async function setRLSContext(db: DrizzleDB, user: User) {
  await db.execute(sql`
    SET LOCAL app.user_id = ${user.id};
    SET LOCAL app.org_id = ${user.organizationId};
    SET LOCAL app.user_role = ${user.role};
  `)
}

// Usage in route
app.get('/api/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')

  await db.transaction(async (tx) => {
    // Set RLS context for this transaction
    await setRLSContext(tx, user)

    // RLS policies automatically applied
    const records = await tx.select().from(projects)
    return c.json({ records })
  })
})
```

## Testing Dual-Layer Behavior

### What to Assert

1. **Layer 1 (Better Auth)**: Request blocked/allowed at API level
2. **Layer 2 (RLS)**: Rows filtered/hidden at database level
3. **Both Together**: Correct final result with both layers active

### Test Structure

```typescript
test.fixme(
  'SPEC-ID: should demonstrate dual-layer [pattern]',
  { tag: '@spec' },
  async ({ startServerWithSchema, signUp, signIn, page }) => {
    // GIVEN: Application with BOTH layers configured
    await startServerWithSchema({
      name: 'test-app',
      auth: {
        emailAndPassword: true,
        plugins: {
          organization: true,
          accessControl: true, // Better Auth Access Control
        },
      },
      tables: [
        {
          id: 1,
          name: 'records',
          fields: [
            /* ... */
          ],
          permissions: {
            read: { type: 'roles', roles: ['member'] }, // RLS layer
          },
        },
      ],
    })

    // WHEN: User performs action
    // ...

    // THEN: Verify BOTH layers participated
    // - Better Auth: blocked/allowed at API level
    // - RLS: filtered/blocked at database level
  }
)
```

## Decision Matrix

| Scenario                   | Better Auth | RLS        | Result         |
| -------------------------- | ----------- | ---------- | -------------- |
| User lacks role permission | ❌ Blocks   | Never runs | 403 Forbidden  |
| User has role, owns record | ✅ Allows   | ✅ Returns | Record visible |
| User has role, doesn't own | ✅ Allows   | ❌ Filters | Empty result   |
| User has role, wrong org   | ✅ Allows   | ❌ Filters | 404 Not Found  |
| Admin bypasses, RLS active | (bypassed)  | ❌ Filters | Limited access |

## Performance Considerations

### When to Use Each Layer

| Check Type            | Use Better Auth    | Use RLS      |
| --------------------- | ------------------ | ------------ |
| Role membership       | ✅ Fast, in-memory | ❌ Slower    |
| Permission statements | ✅ Fast lookup     | ❌ Not ideal |
| Row filtering         | ❌ Code complexity | ✅ Native    |
| Field visibility      | ❌ Code complexity | ✅ Native    |
| Cross-org isolation   | ✅ Early rejection | ✅ Defense   |

### Optimization Tips

1. **Better Auth first**: Reject unauthorized roles before database query
2. **RLS indexes**: Index columns used in RLS policies (`organization_id`, `owner_id`)
3. **Session variable caching**: Set RLS context once per transaction, not per query
4. **Skip RLS for trusted queries**: Use `SECURITY DEFINER` for admin operations

## Related Spec Tests

The following spec files contain dual-layer tests:

| File                                                          | Pattern         | Tests   |
| ------------------------------------------------------------- | --------------- | ------- |
| `specs/app/tables/permissions/field-permissions.spec.ts`      | Field-Level     | 008-010 |
| `specs/api/auth/enforcement/admin-enforcement.spec.ts`        | Early Rejection | 009-010 |
| `specs/app/tables/permissions/organization-isolation.spec.ts` | Org Isolation   | 010-011 |
| `specs/app/tables/permissions/rls-enforcement.spec.ts`        | Dual Filtering  | 009-011 |
| `specs/api/security/api-key-security.spec.ts`                 | Early Rejection | 006     |

## Related Documentation

- [Better Auth Integration](./authorization-better-auth-integration.md) - Session extraction, roles
- [Organization Isolation](./authorization-organization-isolation.md) - Multi-tenancy patterns
- [Field-Level Permissions](./authorization-field-level-permissions.md) - Column access control
- [API Routes Authorization](./authorization-api-routes.md) - Route-level middleware
- [Error Handling](./authorization-error-handling.md) - 401/403/404 conventions
