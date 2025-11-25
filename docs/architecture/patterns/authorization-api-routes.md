# Authorization in API Routes

## Overview

This document describes how to implement authorization in Hono API routes for table records operations. All routes must enforce:

1. Authentication (401 if missing)
2. Table-level permissions (403 if forbidden)
3. Field-level permissions (403 for protected fields, filtering for responses)
4. Organization isolation (404 for cross-org access)

## Architecture Layers

```
┌─────────────────────────────────────────────┐
│ Presentation Layer (Hono Routes)           │
│  - Extract auth from Better Auth           │
│  - Call authorization service               │
│  - Return 401/403/404 errors                │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Application Layer (Authorization Service)  │
│  - Check table-level permissions            │
│  - Check field-level permissions            │
│  - Filter response fields                   │
│  - Apply organization isolation             │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Infrastructure Layer (Better Auth + DB)    │
│  - Fetch user session & organization        │
│  - Fetch table permissions config           │
└─────────────────────────────────────────────┘
```

## Implementation Pattern

### 1. Extract Authenticated User (Middleware)

```typescript
// src/presentation/api/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { auth } from '@/infrastructure/auth/better-auth'

export const requireAuth = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session?.user) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
  }

  c.set('user', session.user)
  c.set('organizationId', session.user.organizationId)

  await next()
})
```

### 2. Check Table-Level Permissions (Route Handler)

```typescript
// src/presentation/api/routes/tables/records.ts
import { Hono } from 'hono'
import { requireAuth } from '@/presentation/api/middleware/auth'
import { checkTablePermission } from '@/application/services/authorization'

const app = new Hono()

app.post('/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')
  const tableId = parseInt(c.req.param('tableId'))
  const body = await c.req.json()

  // Check table-level create permission
  const canCreate = await checkTablePermission(user, tableId, 'create')
  if (!canCreate) {
    return c.json(
      { error: 'Forbidden', message: 'You do not have permission to create records in this table' },
      403
    )
  }

  // ... rest of handler
})
```

### 3. Check Field-Level Permissions (Write)

```typescript
// Before creating/updating record
const protectedFields = await getProtectedFields(user, tableId, 'write')

for (const field of Object.keys(body)) {
  if (protectedFields.includes(field)) {
    return c.json(
      { error: 'Forbidden', message: `You do not have permission to write to field: ${field}` },
      403
    )
  }
}
```

### 4. Filter Response Fields (Read)

```typescript
// After fetching record(s)
const readableFields = await getReadableFields(user, tableId)
const filteredRecords = records.map((record) =>
  Object.fromEntries(Object.entries(record).filter(([key]) => readableFields.includes(key)))
)

return c.json({ records: filteredRecords })
```

### 5. Enforce Organization Isolation

```typescript
// Add organization filter to all queries
const userOrgId = c.get('organizationId')

// For CREATE - auto-inject organization_id
const recordData = {
  ...body,
  organization_id: userOrgId, // Always use authenticated user's org
}

// For READ/UPDATE/DELETE - filter by organization
const record = await db.query.records.findFirst({
  where: and(
    eq(records.id, recordId),
    eq(records.organization_id, userOrgId) // Organization isolation
  ),
})

if (!record) {
  return c.json({ error: 'Record not found' }, 404) // Not 403 - prevents org enumeration
}
```

## Permission Check Order

**CRITICAL**: Always check permissions in this order to prevent information leakage:

1. **Authentication** (401) - Check if user is authenticated
2. **Organization Isolation** (404) - Check if record belongs to user's org
3. **Table-Level Permissions** (403) - Check if user can perform operation
4. **Field-Level Permissions** (403) - Check if user can access specific fields

**Why this order?**

- Returning 403 before checking org isolation would reveal that a record exists in another org
- Always return 404 for cross-org access, never 403

## Error Response Format

```typescript
// 401 Unauthorized
{
  "error": "Unauthorized",
  "message": "Authentication required"
}

// 403 Forbidden (table-level)
{
  "error": "Forbidden",
  "message": "You do not have permission to create records in this table"
}

// 403 Forbidden (field-level)
{
  "error": "Forbidden",
  "message": "You do not have permission to write to field: salary"
}

// 404 Not Found (org isolation)
{
  "error": "Record not found"
}
```

## Readonly Fields Protection

Certain fields are always readonly and cannot be set by any user:

```typescript
const READONLY_FIELDS = ['id', 'created_at', 'updated_at']

// Check for readonly field violations
for (const field of Object.keys(body)) {
  if (READONLY_FIELDS.includes(field)) {
    return c.json({ error: 'Forbidden', message: `Cannot set readonly field: ${field}` }, 403)
  }
}
```

## Organization Override Prevention

Users cannot create or update records for a different organization:

```typescript
// Prevent organization_id override
if (body.organization_id && body.organization_id !== userOrgId) {
  return c.json(
    { error: 'Forbidden', message: 'Cannot create records for different organization' },
    403
  )
}

// Prevent changing organization_id on updates
if (existingRecord.organization_id !== userOrgId) {
  return c.json({ error: 'Forbidden', message: 'Cannot change organization_id' }, 403)
}
```

## Batch Operations

For batch operations (create/update/delete multiple records):

1. Check permissions BEFORE starting transaction
2. Validate ALL records in the batch
3. If ANY record fails permission check, reject entire batch (403)
4. If ANY record fails org isolation, reject entire batch (404)
5. Use database transaction with rollback on any error

```typescript
// Batch create example
app.post('/tables/:tableId/records/batch', requireAuth, async (c) => {
  const user = c.get('user')
  const { records } = await c.req.json()

  // Check table-level permission once
  const canCreate = await checkTablePermission(user, tableId, 'create')
  if (!canCreate) {
    return c.json({ error: 'Forbidden', message: '...' }, 403)
  }

  // Validate ALL records before transaction
  for (const record of records) {
    // Check field-level permissions
    // Check readonly fields
    // Check organization_id
  }

  // Start transaction
  const result = await db.transaction(async (tx) => {
    // Insert all records with auto-injected organization_id
    return await tx
      .insert(records)
      .values(records.map((r) => ({ ...r, organization_id: userOrgId })))
  })

  return c.json({ created: result.length })
})
```

## Testing Requirements

Every authorization spec must verify:

1. **401** - Unauthenticated access rejected
2. **403** - Insufficient permissions rejected
3. **404** - Cross-org access returns "not found"
4. **200/201** - Authorized access succeeds
5. **Field filtering** - Protected fields excluded from response
6. **Transaction rollback** - No partial updates on permission failure

## Related Documentation

- Better Auth Integration: `authorization-better-auth-integration.md`
- Effect Service Implementation: `authorization-effect-service.md`
- Field-Level Permissions: `authorization-field-level-permissions.md`
- Organization Isolation: `authorization-organization-isolation.md`
- Error Handling: `authorization-error-handling.md`
- Implementation Examples: `authorization-implementation-examples.md`
