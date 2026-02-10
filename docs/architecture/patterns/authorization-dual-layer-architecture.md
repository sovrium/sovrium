# API Authorization Architecture

## Overview

Sovrium implements **API-layer authorization** where Better Auth guards access at the API route level. All authorization decisions are made at the application layer before database queries execute.

## Authorization Layer: Better Auth (API Guards)

**Purpose**: Gate access at the API route level before database queries execute.

```
HTTP Request → Better Auth Guard → Permission Check → (Block or Allow) → Database Query
```

**Responsibilities**:

- Authentication (verify user identity)
- Session management
- Role-based access control via `hasPermission()`
- Early rejection of unauthorized requests
- API-level rate limiting
- Row and field filtering in application code

**Implementation**: Hono middleware with Better Auth Access Control plugin

```typescript
// Better Auth Access Control statement format
const statements = ac.newStatementBuilder({
  'projects:read': ['admin', 'member', 'viewer'],
  'projects:write': ['admin', 'member'],
  'projects:delete': ['admin'],
})
```

## Authorization Patterns

### Pattern 1: Role-Based Early Rejection

Better Auth blocks the request before any database query runs.

**Scenario**: User without `projects:write` permission tries to create a record.

```
Request → Better Auth: hasPermission('projects:write') → BLOCKED (403)
         (Database query never executes - saves resources)
```

**Test Example** (from `admin-enforcement.spec.ts`):

```typescript
test.fixme('API-AUTH-ENFORCEMENT-009: should block at API layer for unauthorized roles')
```

### Pattern 2: Application-Layer Filtering

Better Auth allows the role, then application code filters the rows based on user context or other criteria.

**Scenario**: Admin can read projects, but application filters based on user context.

```
Request → Better Auth: hasPermission('projects:read') → ALLOWED
       → Application: Applies user-specific filters → Returns filtered results
```

### Pattern 3: Field-Level Filtering

Better Auth grants base access, application code filters sensitive fields.

**Scenario**: Member can read records, but salary field is filtered by application code for non-admin.

```
Request → Better Auth: hasPermission('records:read') → ALLOWED
       → Application: Filters out salary field for non-admin users
```

### Pattern 4: User-Based Filtering

Better Auth checks permission type, application code filters based on user context.

**Scenario**: User with `records:read` permission sees records based on their role and context.

```
Request → Better Auth: hasPermission('records:read') → ALLOWED
       → Application: Applies role-based filtering → Returns user's accessible records
```

## Implementation Guide

### Configuring Authorization

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
        "read": ["admin", "member", "viewer"],
        "create": ["admin", "member"],
        "update": ["admin", "member"],
        "delete": ["admin"],
        "fieldPermissions": {
          "budget": {
            "read": ["admin"],
            "write": ["admin"]
          }
        }
      }
    }
  ]
}
```

### Better Auth Setup

```typescript
// src/infrastructure/auth/access-control.ts
import { createAccessControl } from 'better-auth/plugins/access-control'

export const ac = createAccessControl({
  statements: {
    'projects:read': ['admin', 'member', 'viewer'],
    'projects:create': ['admin', 'member'],
    'projects:update': ['admin', 'member'],
    'projects:delete': ['admin'],
  },
})

// Middleware usage
app.post('/api/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')

  // Permission check - early rejection
  if (!(await ac.hasPermission(user, 'projects:create'))) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Application-layer filtering applied in queries
  // ...
})
```

### Application-Layer Filtering

Row and field filtering is implemented in the application layer:

```typescript
// src/application/services/records-service.ts
export async function getRecords(user: User, tableId: number) {
  const table = await getTable(tableId)

  // Build query with filtering
  let query = db.select().from(records).where(eq(records.tableId, tableId))

  // Apply role-based filtering as needed based on permissions

  // Apply field filtering based on permissions
  const allowedFields = getReadableFields(table, user.role)

  const results = await query
  return results.map((record) => filterFields(record, allowedFields))
}
```

## Testing Authorization

### What to Assert

1. **Better Auth**: Request blocked/allowed at API level
2. **Application Filtering**: Rows filtered/hidden at application level
3. **Correct HTTP Status**: 403 for forbidden, 404 for not found

### Test Structure

```typescript
test.fixme(
  'SPEC-ID: should enforce [authorization pattern]',
  { tag: '@spec' },
  async ({ startServerWithSchema, signUp, signIn, page }) => {
    // GIVEN: Application with authorization configured
    await startServerWithSchema({
      name: 'test-app',
      auth: {
        emailAndPassword: true,
        plugins: {
          organization: true,
          accessControl: true,
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
            read: { type: 'roles', roles: ['member'] },
          },
        },
      ],
    })

    // WHEN: User performs action
    // ...

    // THEN: Verify authorization enforced
    // - Better Auth: blocked/allowed at API level
    // - Application: filtered at application level
  }
)
```

## Decision Matrix

| Scenario                   | Better Auth | Application | Result         |
| -------------------------- | ----------- | ----------- | -------------- |
| User lacks role permission | Blocks      | Never runs  | 403 Forbidden  |
| User has role permission   | Allows      | Returns     | Record visible |
| User has role, filtered    | Allows      | Filters     | Empty result   |
| Resource not accessible    | Allows      | Filters     | 404 Not Found  |

## Performance Considerations

### When to Use Each Check Type

| Check Type            | Implementation    | Notes                |
| --------------------- | ----------------- | -------------------- |
| Role membership       | Better Auth       | Fast, in-memory      |
| Permission statements | Better Auth       | Fast lookup          |
| Row filtering         | Application layer | WHERE clause filters |
| Field visibility      | Application layer | Select specific cols |
| Cross-org isolation   | Better Auth + App | Early rejection      |

### Optimization Tips

1. **Better Auth first**: Reject unauthorized roles before database query
2. **Index columns**: Index columns used in filters (`user_id`, `created_by`)
3. **Batch queries**: Avoid N+1 queries when checking permissions

## Related Spec Tests

The following spec files contain authorization tests:

| File                                                          | Pattern         | Tests   |
| ------------------------------------------------------------- | --------------- | ------- |
| `specs/app/tables/permissions/field-permissions.spec.ts`      | Field-Level     | 001-010 |
| `specs/api/auth/enforcement/admin-enforcement.spec.ts`        | Early Rejection | 001-010 |
| `specs/app/tables/permissions/organization-isolation.spec.ts` | Org Isolation   | 001-011 |

## Related Documentation

- [Better Auth Integration](./authorization-better-auth-integration.md) - Session extraction, roles
- [Field-Level Permissions](./authorization-field-level-permissions.md) - Column access control
- [API Routes Authorization](./authorization-api-routes.md) - Route-level middleware
- [Error Handling](./authorization-error-handling.md) - 401/403/404 conventions
